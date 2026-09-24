from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

CHROMA_DIR = "vector_db"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
COLLECTION_NAME = "video_transcripts"

def get_embeddings():
    return HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL_NAME,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True}
    )

def get_collection_name(session_id: str):
    session_id = session_id.strip()
    if not session_id:
        raise ValueError("Session ID is required.")
    return f"{COLLECTION_NAME}_{session_id}"

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
    return Chroma(
        persist_directory=CHROMA_DIR,
        embedding_function=get_embeddings(),
        collection_name=get_collection_name(session_id)
    )

def get_retriever(vector_store, k: int = 5):
    return vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": k}
    )