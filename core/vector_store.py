import hashlib
import threading
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pathlib import Path

CHROMA_DIR = str(Path(__file__).resolve().parent.parent / "vector_db")
EMBEDDING_MODEL_NAME = "all-mpnet-base-v2"
COLLECTION_NAME = "video_transcripts"
_embedding_version = hashlib.sha256(EMBEDDING_MODEL_NAME.encode("utf-8")).hexdigest()[:8]

_embeddings = None
_embeddings_lock = threading.Lock()

def get_embeddings():
    """Load the local embedding model once, including under concurrent requests."""
    global _embeddings
    if _embeddings is None:
        with _embeddings_lock:
            if _embeddings is None:
                _embeddings = HuggingFaceEmbeddings(
                    model_name=EMBEDDING_MODEL_NAME,
                    model_kwargs={"device": "cpu"},
                    encode_kwargs={"normalize_embeddings": True}
                )
    return _embeddings

def get_collection_name(session_id: str):
    session_id = session_id.strip()
    if not session_id:
        raise ValueError("Session ID is required.")
    return f"{COLLECTION_NAME}_{_embedding_version}_{session_id}"

def create_vector_store(documents: list[Document], session_id: str):
    if not documents:
        raise ValueError("No documents provided.")
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=300)
    chunks = splitter.split_documents(documents)
    for i, chunk in enumerate(chunks):
        chunk.metadata["chunk_index"] = i
        chunk.metadata["session_id"] = session_id
    return Chroma.from_documents(
        documents=chunks,
        embedding=get_embeddings(),
        persist_directory=CHROMA_DIR,
        collection_name=get_collection_name(session_id)
    )

def load_vector_store(session_id: str):
    vector_store = Chroma(
        persist_directory=CHROMA_DIR,
        embedding_function=get_embeddings(),
        collection_name=get_collection_name(session_id)
    )
    if vector_store._collection.count() == 0:
        raise LookupError("The lesson vector index is missing or empty.")
    return vector_store

def get_retriever(vector_store, k: int = 5):
    return vector_store.as_retriever(
        search_type="mmr",
        search_kwargs={"k": k}
    )
