import logging
import shutil
import uuid
import jwt
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from langchain_core.documents import Document

# Custom imports
from utils.adio_processing import process_audio_input
from utils.pdf_upload import load_any_document
from core.transcribe_gemini import transcribe_chunks, combine_transcript_text
from core.summerize import summarize_transcript, generate_title
from core.extractor import extract_key_points, extract_questions
from core.reg_engine import build_reg_chain, ask_question as run_ask_question
from core.data_base import init_db, save_lesson, get_user_history
from core.auth import auth_router, SECRET_KEY, ALGORITHM

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("Lumen.ai")

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
DOWNLOADS_DIR = BASE_DIR / "downloads"

app = FastAPI(title="Lumen.ai API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()
app.include_router(auth_router)

security = HTTPBearer(auto_error=False)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None

STATIC_DIR = FRONTEND_DIR
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

sessions: dict[str, dict] = {}
MAX_SESSIONS = 50

class ProcessRequest(BaseModel):
    url: str
    language: str = "english"

class ProcessResponse(BaseModel):
    success: bool
    session_id: str
    title: str
    summary: str
    key_points: list[str]
    questions: list[str]
    transcript: str

class AskRequest(BaseModel):
    session_id: str
    question: str

class AskResponse(BaseModel):
    success: bool
    answer: str

def normalize_documents(items) -> list[Document]:
    if items is None: return []
    if isinstance(items, Document): return [items]
    if isinstance(items, str): return [Document(page_content=items)]
    if isinstance(items, (list, tuple)):
        documents = []
        for item in items:
            if isinstance(item, Document): documents.append(item)
            elif isinstance(item, str): documents.append(Document(page_content=item))
        return documents
    raise TypeError(f"Unsupported transcript type: {type(items).__name__}")

def to_list(text) -> list[str]:
    if not text: return []
    if isinstance(text, list): return [str(item).strip() for item in text if str(item).strip()]
    return [line.strip() for line in str(text).strip().split("\n") if line.strip()]

def cleanup_downloads():
    if not DOWNLOADS_DIR.exists():
        DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
        return
    for item in DOWNLOADS_DIR.iterdir():
        try:
            if item.is_dir(): shutil.rmtree(item)
            else: item.unlink()
        except Exception:
            pass

@app.get("/", include_in_schema=False)
async def serve_frontend():
    index_file = FRONTEND_DIR / "index.html"
    if not index_file.exists(): raise HTTPException(status_code=404)
    return FileResponse(index_file)

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/history")
def get_history(user_id: str = Depends(get_current_user)):
    if not user_id: raise HTTPException(status_code=401, detail="Not authenticated")
    return {"history": get_user_history(user_id)}

@app.post("/process", response_model=ProcessResponse)
def process_video(payload: ProcessRequest, user_id: str = Depends(get_current_user)) -> ProcessResponse:
    url = payload.url.strip()
    if not url: raise HTTPException(status_code=400, detail="A video URL is required.")

    try:
        DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
        chunks = process_audio_input(source=url)
        raw_transcript = transcribe_chunks(chunk_paths=chunks)
        transcript_docs = normalize_documents(raw_transcript)
        transcript_text = combine_transcript_text(transcript_docs)

        summary = summarize_transcript(transcript=transcript_text)
        title = generate_title(transcript=transcript_text)
        key_points = extract_key_points(transcript=transcript_text)
        questions = extract_questions(transcript=transcript_text)
        reg_chain = build_reg_chain(transcripts=transcript_docs)

        session_id = str(uuid.uuid4())
        sessions[session_id] = {"reg_chain": reg_chain, "transcript": transcript_text}

        save_lesson(session_id, user_id, str(title), str(summary), to_list(key_points), to_list(questions), transcript_text)

        if len(sessions) > MAX_SESSIONS:
            oldest_id = next(iter(sessions))
            sessions.pop(oldest_id, None)

        cleanup_downloads()
        return ProcessResponse(
            success=True, session_id=session_id, title=str(title), summary=str(summary),
            key_points=to_list(key_points), questions=to_list(questions), transcript=transcript_text,
        )
    except HTTPException: raise
    except Exception as exc:
        cleanup_downloads()
        raise HTTPException(status_code=500, detail=f"PROCESS ERROR: {str(exc)}")


# FIX: Removed 'async' from this function to prevent freezing
@app.post("/process-document", response_model=ProcessResponse)
def process_document(file: UploadFile = File(...), user_id: str = Depends(get_current_user)) -> ProcessResponse:
    try:
        DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
        file_path = DOWNLOADS_DIR / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        document_pages = load_any_document(str(file_path))
        full_text = "\n\n".join([doc.page_content for doc in document_pages])

        summary = summarize_transcript(transcript=full_text)
        title = generate_title(transcript=full_text)
        key_points = extract_key_points(transcript=full_text)
        questions = extract_questions(transcript=full_text)
        reg_chain = build_reg_chain(transcripts=document_pages)

        session_id = str(uuid.uuid4())
        sessions[session_id] = {"reg_chain": reg_chain, "transcript": full_text}

        save_lesson(session_id, user_id, str(title), str(summary), to_list(key_points), to_list(questions), full_text)

        cleanup_downloads()
        return ProcessResponse(
            success=True, session_id=session_id, title=str(title), summary=str(summary),
            key_points=to_list(key_points), questions=to_list(questions), transcript=full_text,
        )
    except Exception as exc:
        cleanup_downloads()
        raise HTTPException(status_code=500, detail=f"DOCUMENT ERROR: {str(exc)}")

@app.post("/ask", response_model=AskResponse)
def ask(payload: AskRequest) -> AskResponse:
    session = sessions.get(payload.session_id.strip())
    if not session: raise HTTPException(status_code=404, detail="Session not found.")
    
    try:
        answer = run_ask_question(reg_chain=session["reg_chain"], question=payload.question.strip())
        return AskResponse(success=True, answer=str(answer))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"ASK ERROR: {str(exc)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)