import json
import os
import threading
import time
import wave
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from google import genai
from langchain_core.documents import Document

load_dotenv()

client = None
_client_lock = threading.Lock()

GEMINI_MODEL = os.getenv("GEMINI_MODEL2", "").strip() or "gemini-3.5-flash-lite"

PROMPT = """Transcribe this audio.
If the audio is not English, translate it to English.
Return only the English transcript without any additional commentary."""


def get_gemini_client():
    """Create the Gemini client only when transcription is requested."""
    global client
    if client is None:
        with _client_lock:
            if client is None:
                api_key = os.getenv("GEMINI_API_KEY", "").strip()
                if not api_key:
                    raise RuntimeError("GEMINI_API_KEY is not configured.")
                client = genai.Client(api_key=api_key)
    return client


def combine_audio_chunks(
    chunk_paths: List[str],
    output_path: Optional[str] = None
) -> Optional[str]:
    if not chunk_paths:
        return None

    target_path = Path(output_path) if output_path else Path(chunk_paths[0]).with_name(
        f"combined_{uuid.uuid4().hex}.wav"
    )
    try:
        with wave.open(chunk_paths[0], "rb") as first:
            params = first.getparams()
        with wave.open(str(target_path), "wb") as output:
            output.setnchannels(params.nchannels)
            output.setsampwidth(params.sampwidth)
            output.setframerate(params.framerate)
            output.setcomptype(params.comptype, params.compname)

            for chunk_path in chunk_paths:
                with wave.open(chunk_path, "rb") as chunk:
                    if (
                        chunk.getnchannels() != params.nchannels
                        or chunk.getsampwidth() != params.sampwidth
                        or chunk.getframerate() != params.framerate
                        or chunk.getcomptype() != params.comptype
                    ):
                        raise ValueError(f"Incompatible WAV format: {chunk_path}")

                    while frames := chunk.readframes(65536):
                        output.writeframesraw(frames)

        return str(target_path)

    except Exception:
        target_path.unlink(missing_ok=True)
        raise


def transcribe_single_chunk(
    chunk_path: str,
    chunk_index: int,
    max_retries: int = 2
) -> Optional[Document]:
    """
    Upload and transcribe a single audio chunk.
    """

    gemini_client = get_gemini_client()
    uploaded_file = None

    for attempt in range(max_retries):
        try:
            print(
                f"Uploading chunk {chunk_index + 1}: "
                f"{chunk_path}"
            )

            uploaded_file = gemini_client.files.upload(
                file=chunk_path
            )

            timeout = 60
            start_time = time.time()

            while uploaded_file.state == "PROCESSING":

                if time.time() - start_time > timeout:
                    raise TimeoutError(
                        "File processing timed out"
                    )

                time.sleep(1)

                uploaded_file = gemini_client.files.get(
                    name=uploaded_file.name
                )

            if uploaded_file.state == "FAILED":
                raise ValueError(
                    f"File processing failed: {chunk_path}"
                )

            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[
                    PROMPT,
                    uploaded_file
                ]
            )

            text = getattr(
                response,
                "text",
                ""
            ).strip()

            if not text:
                raise ValueError(
                    "Empty transcription returned by Gemini"
                )

            return Document(
                page_content=text,
                metadata={
                    "source": chunk_path,
                    "chunk_index": chunk_index
                }
            )

        except Exception as e:

            error_message = str(e)

            print(
                f"Attempt {attempt + 1} failed for "
                f"chunk {chunk_index}: {error_message}"
            )

            is_temporary = any(
                code in error_message
                for code in [
                    "503",
                    "UNAVAILABLE",
                    "429",
                    "RESOURCE_EXHAUSTED"
                ]
            )

            if (
                is_temporary
                and attempt < max_retries - 1
            ):
                wait_time = min(
                    2 ** attempt,
                    8
                )

                print(
                    f"Retrying in {wait_time} seconds..."
                )

                time.sleep(wait_time)

            else:
                print(
                    f"Skipping chunk {chunk_index} "
                    f"after {attempt + 1} attempts"
                )

                return None

        finally:

            if uploaded_file:

                try:
                    gemini_client.files.delete(
                        name=uploaded_file.name
                    )
                except Exception:
                    pass

    return None


def transcribe_chunks_parallel(
    chunk_paths: List[str],
    max_workers: int = 3,
    max_retries: int = 2
) -> List[Document]:
    """
    Transcribe audio chunks in parallel.
    """

    documents = []
    failed_chunks = []

    print(
        f"Processing {len(chunk_paths)} chunks "
        f"with {max_workers} workers..."
    )

    with ThreadPoolExecutor(
        max_workers=max_workers
    ) as executor:

        future_to_chunk = {
            executor.submit(
                transcribe_single_chunk,
                path,
                index,
                max_retries
            ): index
            for index, path in enumerate(chunk_paths)
        }

        for future in as_completed(
            future_to_chunk
        ):

            index = future_to_chunk[future]

            try:

                document = future.result()

                if document:
                    documents.append(document)

                    print(
                        f"Successfully transcribed "
                        f"chunk {index + 1}"
                    )
                else:
                    failed_chunks.append(index + 1)

            except Exception as e:
                failed_chunks.append(index + 1)

                print(
                    f"Failed to transcribe "
                    f"chunk {index + 1}: {e}"
                )

    if failed_chunks:
        failed_numbers = ", ".join(map(str, failed_chunks))
        raise RuntimeError(
            f"Transcription failed for audio chunk(s): {failed_numbers}"
        )

    documents.sort(
        key=lambda doc: doc.metadata.get(
            "chunk_index",
            0
        )
    )

    if not documents:
        raise RuntimeError(
            "No audio chunks were successfully transcribed"
        )

    print(
        f"Successfully transcribed "
        f"{len(documents)}/{len(chunk_paths)} chunks"
    )

    return documents


def transcribe_chunks_batch(
    chunk_paths: List[str],
    batch_size: int = 5,
    max_retries: int = 2
) -> List[Document]:
    """
    Combine multiple chunks into batches and transcribe
    them to reduce Gemini API calls.
    """

    documents = []
    failed_batches = []

    total_chunks = len(chunk_paths)

    for i in range(
        0,
        total_chunks,
        batch_size
    ):

        batch = chunk_paths[
            i:i + batch_size
        ]

        batch_num = (
            i // batch_size
        ) + 1

        total_batches = (
            total_chunks + batch_size - 1
        ) // batch_size

        print(
            f"Processing batch "
            f"{batch_num}/{total_batches} "
            f"({len(batch)} chunks)"
        )

        if len(batch) == 1:

            doc = transcribe_single_chunk(
                batch[0],
                i,
                max_retries
            )

            if doc:
                documents.append(doc)
            else:
                failed_batches.append(str(i + 1))

        else:

            combined_path = combine_audio_chunks(batch)

            if combined_path:
                try:
                    doc = transcribe_single_chunk(
                        combined_path,
                        i,
                        max_retries
                    )
                    if doc:
                        doc.metadata["batch"] = batch_num
                        doc.metadata["chunk_range"] = (
                            f"{i}-{i + len(batch) - 1}"
                        )
                        documents.append(doc)
                    else:
                        failed_batches.append(
                            f"{i + 1}-{i + len(batch)}"
                        )
                finally:
                    Path(combined_path).unlink(missing_ok=True)

    if failed_batches:
        failed_ranges = ", ".join(failed_batches)
        raise RuntimeError(
            f"Transcription failed for audio chunk/batch range(s): {failed_ranges}"
        )

    if not documents:
        raise RuntimeError(
            "No audio chunks were successfully transcribed"
        )

    print(
        f"Successfully transcribed "
        f"{len(documents)} batches from "
        f"{total_chunks} chunks"
    )

    return documents


def transcribe_chunks(
    chunk_paths: List[str],
    max_retries: int = 2,
    mode: str = "smart"
) -> List[Document]:
    """
    Main transcription function.

    Modes:
    - smart
    - parallel
    - batch
    """

    if not chunk_paths:
        raise ValueError(
            "No chunk paths provided"
        )
    if max_retries < 1:
        raise ValueError("max_retries must be at least 1.")

    num_chunks = len(chunk_paths)

    if mode == "smart":

        if num_chunks <= 10:
            mode = "parallel"
        else:
            mode = "batch"

    print(
        f"Using {mode} mode "
        f"for {num_chunks} chunks"
    )

    if mode == "parallel":

        return transcribe_chunks_parallel(
            chunk_paths,
            max_retries=max_retries
        )

    if mode == "batch":

        return transcribe_chunks_batch(
            chunk_paths,
            max_retries=max_retries
        )

    raise ValueError(
        f"Unknown transcription mode: {mode}"
    )


def combine_transcript_text(
    documents: List[Document]
) -> str:
    """
    Combine transcript Documents into one
    ordered transcript.
    """

    ordered = sorted(
        documents,
        key=lambda doc: doc.metadata.get(
            "chunk_index",
            0
        )
    )

    return "\n\n".join(
        doc.page_content
        for doc in ordered
    )


class TranscriptionCache:
    """
    Simple JSON cache to avoid retranscribing
    the same audio chunks.
    """

    def __init__(
        self,
        cache_file: str = "transcription_cache.json"
    ):
        self.cache_file = cache_file
        self.cache = {}
        self._load_cache()

    def _load_cache(self):
        try:

            with open(
                self.cache_file,
                "r",
                encoding="utf-8"
            ) as file:

                self.cache = json.load(file)

        except (
            FileNotFoundError,
            json.JSONDecodeError
        ):

            self.cache = {}

    def _save_cache(self):

        with open(
            self.cache_file,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                self.cache,
                file,
                ensure_ascii=False,
                indent=2
            )

    def get(
        self,
        key: str
    ) -> Optional[str]:

        return self.cache.get(key)

    def set(
        self,
        key: str,
        value: str
    ):

        self.cache[key] = value
        self._save_cache()

    def clear(self):

        self.cache = {}
        self._save_cache()


def transcribe_chunks_with_cache(
    chunk_paths: List[str],
    cache: Optional[TranscriptionCache] = None,
    **kwargs
) -> List[Document]:
    """
    Transcribe only chunks that are not already cached.
    """

    if cache is None:
        cache = TranscriptionCache()

    documents = []
    chunks_to_process = []
    chunk_indices = []

    for index, path in enumerate(chunk_paths):

        cached_text = cache.get(path)

        if cached_text:

            documents.append(
                Document(
                    page_content=cached_text,
                    metadata={
                        "source": path,
                        "chunk_index": index,
                        "cached": True
                    }
                )
            )

        else:

            chunks_to_process.append(path)
            chunk_indices.append(index)

    if chunks_to_process:

        new_documents = transcribe_chunks(
            chunks_to_process,
            **kwargs
        )

        documents_by_source = {
            doc.metadata.get("source"): doc
            for doc in new_documents
        }
        for path, original_index in zip(chunks_to_process, chunk_indices):
            doc = documents_by_source.get(path)
            if not doc:
                continue
            doc.metadata["chunk_index"] = (
                original_index
            )

            cache.set(
                doc.metadata["source"],
                doc.page_content
            )

            documents.append(doc)

    documents.sort(
        key=lambda doc: doc.metadata.get(
            "chunk_index",
            0
        )
    )

    return documents
