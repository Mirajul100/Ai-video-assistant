import os
from langchain_community.vectorstores import Chroma
from langchain_core.vectorstores import VectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

CHROMA_DIR = "vector_db"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
COLLECTION_NAME = "video_transcripts"

def get_embeddings():
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL_NAME , model_kwargs={"device": "cpu"})
    return embeddings

def create_vector_store(documents: list[Document]) -> Chroma:
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=200)
    chunks = splitter.split_documents(documents)
    for i, chunk in enumerate(chunks):
        chunk.metadata['chunk_index'] = i

    embeddings = get_embeddings()
    vector_store = Chroma.from_documents(documents=chunks, 
                                         embedding=embeddings, 
                                         persist_directory=CHROMA_DIR, 
                                         collection_name=COLLECTION_NAME)
    return vector_store

def load_vector_store() -> Chroma:
    embeddings = get_embeddings()
    vector_store = Chroma(persist_directory=CHROMA_DIR, 
                          embedding_function=embeddings, 
                          collection_name=COLLECTION_NAME)
    return vector_store

def get_retriever(vector_store: Chroma, k: int = 5):
    retriever = vector_store.as_retriever(search_type="similarity", search_kwargs={"k": k})
    return retriever