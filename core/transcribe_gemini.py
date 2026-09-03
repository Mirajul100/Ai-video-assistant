import os
import time

from google import genai
from dotenv import load_dotenv
from langchain_core.documents import Document

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)

GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.8-flash"
)


def transcribe_chunks(
    chunk_paths: list,
    max_retries: int = 3
) -> list[Document]:

    documents = []

    prompt = """
Transcribe only the speech in this audio.

If the speech is Bengali, translate it faithfully into natural English.
If the speech is English, transcribe it exactly.
Do not summarize.
Do not explain.
Do not infer.
Do not add words that were not spoken.
Return only the English text.
"""

    for index, path in enumerate(chunk_paths):

        print(f"Processing chunk {index + 1}/{len(chunk_paths)}: {path}")

        uploaded_file = None

        for attempt in range(1, max_retries + 1):

            try:
                uploaded_file = client.files.upload(file=path)

                while uploaded_file.state == "PROCESSING":
                    time.sleep(2)

                    uploaded_file = client.files.get(
                        name=uploaded_file.name
                    )

                if uploaded_file.state == "FAILED":
                    print(f"Failed to process audio: {path}")
                    break

                response = client.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=[
                        prompt,
                        uploaded_file
                    ]
                )

                text = getattr(response, "text", None)

                if not text:
                    raise ValueError(
                        "Gemini returned an empty response"
                    )

                text = text.strip()

                if not text:
                    raise ValueError(
                        "Gemini returned empty transcription"
                    )

                documents.append(
                    Document(
                        page_content=text,
                        metadata={
                            "source": path,
                            "chunk_index": index
                        }
                    )
                )

                print(
                    f"Successfully transcribed chunk "
                    f"{index + 1}"
                )

                break

            except Exception as e:

                error_message = str(e)

                print(
                    f"Error processing chunk {path}: "
                    f"{error_message}"
                )

                is_temporary_error = (
                    "503" in error_message
                    or "UNAVAILABLE" in error_message
                    or "429" in error_message
                    or "RESOURCE_EXHAUSTED" in error_message
                )

                if (
                    is_temporary_error
                    and attempt < max_retries
                ):
                    wait_time = 2 ** attempt

                    print(
                        f"Retrying in {wait_time} seconds..."
                    )

                    time.sleep(wait_time)

                    continue

                print(
                    f"Skipping chunk {index + 1}: {path}"
                )

                break

            finally:

                if uploaded_file is not None:
                    try:
                        client.files.delete(
                            name=uploaded_file.name
                        )
                    except Exception:
                        pass

    if not documents:
        raise RuntimeError(
            "No audio chunks were successfully transcribed"
        )

    print(
        f"Successfully transcribed "
        f"{len(documents)}/{len(chunk_paths)} chunks"
    )

    return documents


def combine_transcript_text(documents: list[Document]) -> str:
    """
    Join transcribed chunk Documents into a single, ordered transcript
    string. Use this ONLY where plain text is actually needed (e.g. the
    API response, or anywhere doing raw string display) — pass the
    Document list itself, not this joined string, into anything that
    still expects to read `.page_content` per chunk (like build_reg_chain).
    """
    ordered = sorted(documents, key=lambda doc: doc.metadata.get("chunk_index", 0))
    return "\n\n".join(doc.page_content for doc in ordered)