import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional
from google import genai
from dotenv import load_dotenv
from langchain_core.documents import Document
from pydub import AudioSegment

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)

GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL1",
    "gemini-1.5-flash"  # Fixed model name - "gemini-3.1-flash-lite" doesn't exist
)

# Optimized prompt - shorter and clearer
PROMPT = """Transcribe this audio. If not English, translate to English. 
Return only the English text without any additional commentary."""


def combine_audio_chunks(chunk_paths: List[str], output_path: str = "combined_audio.wav") -> Optional[str]:
    """
    Combine multiple audio chunks into a single file to reduce API calls.
    Returns the path to the combined file, or None if combination fails.
    """
    try:
        combined = AudioSegment.empty()
        
        for chunk_path in sorted(chunk_paths):
            audio = AudioSegment.from_file(chunk_path)
            combined += audio
        
        combined.export(output_path, format="wav")
        return output_path
    except Exception as e:
        print(f"Error combining audio chunks: {e}")
        return None


def transcribe_single_chunk(
    chunk_path: str,
    chunk_index: int,
    max_retries: int = 2  # Reduced from 3 to minimize API calls
) -> Optional[Document]:
    """
    Transcribe a single audio chunk with retry logic.
    Returns Document or None if all retries fail.
    """
    uploaded_file = None
    
    for attempt in range(max_retries):
        try:
            # Upload file
            uploaded_file = client.files.upload(file=chunk_path)
            
            # Wait for processing with timeout
            timeout = 60  # 60 seconds max wait
            start_time = time.time()
            
            while uploaded_file.state == "PROCESSING":
                if time.time() - start_time > timeout:
                    raise TimeoutError("File processing timed out")
                
                time.sleep(1)  # Reduced from 2 seconds for faster polling
                uploaded_file = client.files.get(name=uploaded_file.name)
            
            if uploaded_file.state == "FAILED":
                raise ValueError(f"File processing failed for {chunk_path}")
            
            # Generate transcription
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[PROMPT, uploaded_file]
            )
            
            text = getattr(response, "text", "").strip()
            
            if not text:
                raise ValueError("Empty transcription")
            
            return Document(
                page_content=text,
                metadata={
                    "source": chunk_path,
                    "chunk_index": chunk_index
                }
            )
            
        except Exception as e:
            error_message = str(e)
            print(f"Attempt {attempt + 1} failed for chunk {chunk_index}: {error_message}")
            
            # Check if error is temporary
            is_temporary = any(
                code in error_message 
                for code in ["503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED"]
            )
            
            if is_temporary and attempt < max_retries - 1:
                wait_time = min(2 ** attempt, 8)  # Cap at 8 seconds
                print(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            else:
                print(f"Skipping chunk {chunk_index} after {attempt + 1} attempts")
                return None
                
        finally:
            # Clean up uploaded file
            if uploaded_file:
                try:
                    client.files.delete(name=uploaded_file.name)
                except Exception:
                    pass
    
    return None


def transcribe_chunks_parallel(
    chunk_paths: List[str],
    max_workers: int = 3,  # Limit concurrent workers to avoid rate limits
    max_retries: int = 2
) -> List[Document]:
    """
    Transcribe chunks in parallel to reduce total time.
    """
    documents = []
    
    print(f"Processing {len(chunk_paths)} chunks with {max_workers} workers...")
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_chunk = {
            executor.submit(
                transcribe_single_chunk,
                path,
                index,
                max_retries
            ): (path, index)
            for index, path in enumerate(chunk_paths)
        }
        
        # Process completed tasks
        for future in as_completed(future_to_chunk):
            path, index = future_to_chunk[future]
            try:
                document = future.result()
                if document:
                    documents.append(document)
                    print(f"Successfully transcribed chunk {index + 1}")
            except Exception as e:
                print(f"Failed to transcribe chunk {index + 1}: {e}")
    
    # Sort documents by chunk index to maintain order
    documents.sort(key=lambda doc: doc.metadata.get("chunk_index", 0))
    
    if not documents:
        raise RuntimeError("No audio chunks were successfully transcribed")
    
    print(f"Successfully transcribed {len(documents)}/{len(chunk_paths)} chunks")
    return documents


def transcribe_chunks_batch(
    chunk_paths: List[str],
    batch_size: int = 5,  # Number of chunks to combine
    max_retries: int = 2
) -> List[Document]:
    """
    Combine multiple chunks into batches to reduce API calls.
    This significantly reduces API usage for long videos.
    """
    documents = []
    total_chunks = len(chunk_paths)
    
    # Process in batches
    for i in range(0, total_chunks, batch_size):
        batch = chunk_paths[i:i + batch_size]
        batch_num = i // batch_size + 1
        total_batches = (total_chunks + batch_size - 1) // batch_size
        
        print(f"Processing batch {batch_num}/{total_batches} ({len(batch)} chunks)")
        
        if len(batch) == 1:
            # Single chunk - transcribe directly
            doc = transcribe_single_chunk(batch[0], i, max_retries)
            if doc:
                documents.append(doc)
        else:
            # Combine chunks and transcribe as one
            combined_path = combine_audio_chunks(batch, f"batch_{batch_num}.wav")
            if combined_path:
                doc = transcribe_single_chunk(combined_path, i, max_retries)
                if doc:
                    # Update metadata to reflect batch processing
                    doc.metadata["batch"] = batch_num
                    doc.metadata["chunk_range"] = f"{i}-{i + len(batch) - 1}"
                    documents.append(doc)
                
                # Clean up combined file
                try:
                    os.remove(combined_path)
                except Exception:
                    pass
    
    if not documents:
        raise RuntimeError("No audio chunks were successfully transcribed")
    
    print(f"Successfully transcribed {len(documents)} batches from {total_chunks} chunks")
    return documents


def transcribe_chunks(
    chunk_paths: List[str],
    max_retries: int = 2,
    mode: str = "smart"  # "smart", "parallel", or "batch"
) -> List[Document]:
    """
    Main transcription function with smart mode selection.
    
    Modes:
    - "smart": Automatically choose best approach based on number of chunks
    - "parallel": Process chunks in parallel (faster but more API calls)
    - "batch": Combine chunks into batches (fewer API calls but slower)
    """
    if not chunk_paths:
        raise ValueError("No chunk paths provided")
    
    num_chunks = len(chunk_paths)
    
    if mode == "smart":
        # Choose strategy based on number of chunks
        if num_chunks <= 3:
            # Few chunks - use parallel processing
            mode = "parallel"
        elif num_chunks <= 10:
            # Medium - use parallel with limited workers
            mode = "parallel"
        else:
            # Many chunks - use batch processing to reduce API calls
            mode = "batch"
    
    print(f"Using {mode} mode for {num_chunks} chunks")
    
    if mode == "parallel":
        return transcribe_chunks_parallel(chunk_paths, max_retries=max_retries)
    elif mode == "batch":
        return transcribe_chunks_batch(chunk_paths, max_retries=max_retries)
    else:
        raise ValueError(f"Unknown mode: {mode}")


def combine_transcript_text(documents: List[Document]) -> str:
    """
    Join transcribed chunk Documents into a single, ordered transcript string.
    """
    ordered = sorted(documents, key=lambda doc: doc.metadata.get("chunk_index", 0))
    return "\n\n".join(doc.page_content for doc in ordered)


# Optional: Add caching to avoid re-transcribing the same chunks
class TranscriptionCache:
    """Simple cache to avoid re-transcribing the same audio chunks."""
    
    def __init__(self, cache_file: str = "transcription_cache.json"):
        import json
        self.cache_file = cache_file
        self.cache = {}
        self._load_cache()
    
    def _load_cache(self):
        import json
        try:
            with open(self.cache_file, 'r') as f:
                self.cache = json.load(f)
        except FileNotFoundError:
            self.cache = {}
    
    def _save_cache(self):
        import json
        with open(self.cache_file, 'w') as f:
            json.dump(self.cache, f)
    
    def get(self, key: str) -> Optional[str]:
        return self.cache.get(key)
    
    def set(self, key: str, value: str):
        self.cache[key] = value
        self._save_cache()
    
    def clear(self):
        self.cache = {}
        self._save_cache()


# Example usage with caching
def transcribe_chunks_with_cache(
    chunk_paths: List[str],
    cache: Optional[TranscriptionCache] = None,
    **kwargs
) -> List[Document]:
    """
    Transcribe chunks with caching to avoid redundant API calls.
    """
    if cache is None:
        cache = TranscriptionCache()
    
    documents = []
    chunks_to_process = []
    chunk_indices = []
    
    # Check cache first
    for index, path in enumerate(chunk_paths):
        cached_text = cache.get(path)
        if cached_text:
            documents.append(Document(
                page_content=cached_text,
                metadata={"source": path, "chunk_index": index, "cached": True}
            ))
        else:
            chunks_to_process.append(path)
            chunk_indices.append(index)
    
    if chunks_to_process:
        # Process only uncached chunks
        new_documents = transcribe_chunks(chunks_to_process, **kwargs)
        
        # Update cache with new transcriptions
        for doc, original_index in zip(new_documents, chunk_indices):
            doc.metadata["chunk_index"] = original_index
            cache.set(doc.metadata["source"], doc.page_content)
            documents.append(doc)
    
    # Sort all documents by chunk index
    documents.sort(key=lambda doc: doc.metadata.get("chunk_index", 0))
    
    return documents