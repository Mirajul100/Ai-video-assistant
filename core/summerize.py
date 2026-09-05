from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv
import os
import time

load_dotenv()


MODEL = os.getenv("GEMINI_MODEL1", "gemini-3.1-flash-lite")
API_KEY = os.getenv("GEMINI_API_KEY")


def get_llm():
    return ChatGoogleGenerativeAI(
        model=MODEL,
        api_key=API_KEY,
        temperature=0.2,
    )


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

                wait_time = 1 ** attempt
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