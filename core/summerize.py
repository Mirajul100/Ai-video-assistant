from langchain_mistralai import ChatMistralAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv
import os
import time

load_dotenv()

def get_llm():
    return ChatGoogleGenerativeAI(
        model=os.getenv("GEMINI_MODEL1", "gemini-3.1-flash-lite"),
        api_key=os.getenv("GEMINI_API_KEY"),
        temperature=0.3,
    )

def split_transcript(transcript: str) -> list:
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=3000,
        chunk_overlap=200,
        length_function=len
    )
    return text_splitter.split_text(transcript)

def summarize_transcript(transcript: str) -> str:
    llm = get_llm()

    map_prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """
            You are a helpful AI assistant that summarizes transcripts.
            Rules:
            - Use only the information provided in the transcript.
            - Do not invent information.
            - Keep important facts and explanations.
            - Use simple and clear English.
            - Remove unnecessary repetition.
            """
        ),
        (
            "human",
            """
            Summarize the following transcript section concisely:

            {text}
            """
        )
    ])

    map_chain = map_prompt | llm | StrOutputParser()

    chunks = split_transcript(transcript)
    chunk_summaries = []

    for index, chunk in enumerate(chunks, start=1):
        try:
            summary = map_chain.invoke({
                "text": chunk
            })

            chunk_summaries.append(summary)
            time.sleep(1)

        except Exception as e:
            print(
                f"Failed to summarize chunk "
                f"{index}/{len(chunks)}: {e}"
            )

    if not chunk_summaries:
        raise RuntimeError(
            "No transcript chunks were successfully summarized."
        )

    combined_summary = "\n\n".join(chunk_summaries)

    combined_prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """
            You are an AI lesson assistant.
            Create a final summary using only the provided information.
            Rules:
            - Use simple and clear English.
            - Include only important points.
            - Remove repeated information.
            - Do not invent information.
            - Keep important facts and explanations.
            """
                    ),
                    (
                        "human",
                        """
            Create the final summary from the following section summaries:

            {text}
            """
        )
    ])

    combined_chain = combined_prompt | llm | StrOutputParser()

    print("Generating final summary...")

    final_summary = combined_chain.invoke({
        "text": combined_summary
    })

    return final_summary.strip()

def generate_title(transcript: str) -> str:
    llm = get_llm()

    title_prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """
            You generate short and accurate titles for transcripts.
            """
                    ),
                    (
                        "human",
                        """
            Generate one concise title that best represents the transcript.

            Rules:
            - Return only the title.
            - Do not add information not present in the transcript.
            - Keep the title short and clear.

            Transcript:

            {text}
            """
        )
    ])

    title_chain = title_prompt | llm | StrOutputParser()

    title = title_chain.invoke({
        "text": transcript[:2000]
    })

    return title.strip()