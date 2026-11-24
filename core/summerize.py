from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.output_parsers import PydanticOutputParser
from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator
import logging
import os
import time
from functools import lru_cache

load_dotenv()


MODEL = os.getenv("GEMINI_MODEL2", "").strip() or "gemini-3.5-flash-lite"
FALLBACK_MODEL = os.getenv("GEMINI_MODEL1", "").strip()
API_KEY = os.getenv("GEMINI_API_KEY")
MAX_RETRIES = int(os.getenv("GEMINI_MAX_RETRIES", "2"))
MAX_OUTPUT_TOKENS = int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "2048"))
logger = logging.getLogger(__name__)


class LessonKeyPoint(BaseModel):
    title: str = Field(description="A short name for one key idea")
    description: str = Field(description="A concise explanation supported by the source")


class LessonMaterials(BaseModel):
    title: str = Field(description="A short, accurate lesson title, at most 10 words")
    summary: str = Field(description="A concise, clear summary of the source")
    key_points: list[LessonKeyPoint] = Field(description="The most important ideas from the source")
    questions: list[str] = Field(description="Questions that assess understanding of the source")

    @field_validator("questions", mode="before")
    @classmethod
    def normalize_questions(cls, value):
        """Accept question objects as well as strings returned by the model."""
        if not isinstance(value, list):
            return value

        questions = []
        for item in value:
            if isinstance(item, dict):
                item = item.get("question") or item.get("text") or item.get("q")
            if item is not None and str(item).strip():
                questions.append(str(item).strip())
        return questions


@lru_cache(maxsize=2)
def get_llm(model: str = MODEL):
    return ChatGoogleGenerativeAI(
        model=model,
        api_key=API_KEY,
        temperature=0.4,
        max_retries=MAX_RETRIES,
        max_output_tokens=MAX_OUTPUT_TOKENS,
    )


def generate_lesson_materials(transcript: str) -> LessonMaterials:
    """Generate all lesson outputs in one API call to conserve model quota.

    Do not cache transcript inputs: long recordings would otherwise remain in
    process memory after their request has completed.
    """
    if not transcript or not transcript.strip():
        raise ValueError("Transcript is empty.")

    parser = PydanticOutputParser(pydantic_object=LessonMaterials)
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """You are an AI lesson assistant. Analyze the provided source and return a title, summary, key points, and review questions.

Use only information from the source. Do not invent facts or add outside knowledge. Keep the summary concise but complete. Provide up to 8 distinct key points and up to 8 useful questions. If the source does not support an item, leave that list empty.

{format_instructions}""",
        ),
        ("human", "Source:\n{transcript}"),
    ])
    inputs = {
        "transcript": transcript.strip(),
        "format_instructions": parser.get_format_instructions(),
    }
    try:
        return (prompt | get_llm() | parser).invoke(inputs)
    except Exception as error:
        message = str(error).upper()
        temporarily_unavailable = any(
            marker in message
            for marker in ("503", "UNAVAILABLE")
        )
        if not FALLBACK_MODEL or FALLBACK_MODEL == MODEL or not temporarily_unavailable:
            raise

        logger.warning(
            "Primary Gemini model %s is temporarily unavailable; retrying lesson generation with %s.",
            MODEL,
            FALLBACK_MODEL,
        )
        return (prompt | get_llm(FALLBACK_MODEL) | parser).invoke(inputs)


@lru_cache(maxsize=4)
def summarize_transcript(transcript: str) -> str:
    llm = get_llm()

    if not transcript or not transcript.strip():
        raise ValueError("Transcript is empty.")

    transcript = transcript.strip()

    if len(transcript) <= 15000:
        return summarize_directly(llm, transcript)

    return summarize_large_transcript(llm, transcript)


def summarize_directly(llm, transcript: str) -> str:

    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """
You are an AI lesson assistant.

Create a summary using ONLY the transcript.

Rules:
- Do not invent information.
- Do not use outside knowledge.
- Keep important facts and explanations.
- Keep important examples.
- Remove repetition.
- Use simple English.
- Be concise but complete.
"""
        ),
        (
            "human",
            """
Summarize this transcript:

{transcript}
"""
        )
    ])

    chain = prompt | llm | StrOutputParser()

    return chain.invoke({
        "transcript": transcript
    }).strip()


def summarize_large_transcript(llm, transcript: str) -> str:

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=10000,
        chunk_overlap=500,
        length_function=len
    )

    chunks = splitter.split_text(transcript)

    chunk_prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """
            You are an AI lesson assistant.

            Summarize this transcript section.

            Rules:
            - Use ONLY the provided section.
            - Do not invent information.
            - Keep important facts, concepts, and explanations.
            - Remove repetition.
            - Use simple English.
            - Keep the summary concise.
            """
                    ),
                    (
                        "human",
                        """
            Summarize this transcript section:

            {text}
            """
        )
    ])

    chain = chunk_prompt | llm | StrOutputParser()

    summaries = []

    for index, chunk in enumerate(chunks):

        for attempt in range(3):

            try:
                result = chain.invoke({
                    "text": chunk
                })

                summaries.append(result.strip())
                break

            except Exception as e:

                if attempt == 2:
                    raise RuntimeError(
                        f"Failed to summarize chunk {index + 1}: {e}"
                    )

                wait_time = 2 ** attempt
                time.sleep(wait_time)

    combined = "\n\n".join(summaries)

    final_prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """
            You are an AI lesson assistant.

            Create the final summary from the section summaries.

            Rules:
            - Use ONLY the provided information.
            - Do not invent information.
            - Remove repeated points.
            - Combine related ideas.
            - Keep important facts and explanations.
            - Use simple English.
            - Make the final summary clear and well organized.
            """
                    ),
                    (
                        "human",
                        """
            Create the final summary:

            {summaries}
            """
        )
    ])

    final_chain = final_prompt | llm | StrOutputParser()

    return final_chain.invoke({
        "summaries": combined
    }).strip()


@lru_cache(maxsize=16)
def generate_title(transcript: str) -> str:

    llm = get_llm()

    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """
Generate a short and accurate title.

Rules:
- Return ONLY the title.
- Maximum 10 words.
- Do not invent information.
- Use only information from the transcript.
"""
        ),
        (
            "human",
            """
Generate a title for this transcript:

{transcript}
"""
        )
    ])

    chain = prompt | llm | StrOutputParser()

    return chain.invoke({
        "transcript": transcript[:3000]
    }).strip()
