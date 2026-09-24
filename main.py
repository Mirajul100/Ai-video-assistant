import asyncio, logging, uuid, jwt, uvicorn
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from langchain_core.documents import Document

from utils.adio_processing import process_audio_input
from utils.pdf_upload import load_any_document
from core.transcribe_gemini import transcribe_chunks, combine_transcript_text
from core.summerize import summarize_transcript, generate_title
from core.extractor import extract_key_points, extract_questions
from core.reg_engine import build_reg_chain, load_reg_chain, ask_question as run_ask_question, clear_chat_memory
from core.data_base import init_db, save_lesson, get_user_history, get_lesson_by_id
from core.auth import auth_router, SECRET_KEY, ALGORITHM

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("Lumen.ai")

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR, DOWNLOADS_DIR = BASE_DIR / "frontend", BASE_DIR / "downloads"

app = FastAPI(title="Lumen.ai API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
init_db()
app.include_router(auth_router)

security = HTTPBearer(auto_error=False)
sessions, MAX_SESSIONS = {}, 50

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        return jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM]).get("sub")
    except jwt.PyJWTError:
        return None

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

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

def normalize_documents(items):
    if not items:
        return []
    if isinstance(items, Document):
        return [items]
    if isinstance(items, str):
        return [Document(page_content=items)]
    return [i if isinstance(i, Document) else Document(page_content=str(i)) for i in items]

def to_list(text):
    if not text:
        return []
    if isinstance(text, list):
        return [str(i).strip() for i in text if str(i).strip()]
    return [x.strip() for x in str(text).splitlines() if x.strip()]

def cleanup_files(files):
    for f in files:
        try:
            Path(f).unlink(missing_ok=True)
        except Exception as e:
            logger.warning(f"Failed to remove {f}: {e}")

def remove_oldest_session():
    if len(sessions) > MAX_SESSIONS:
        sid = next(iter(sessions))
        sessions.pop(sid, None)
        clear_chat_memory(sid)

@app.get("/", include_in_schema=False)
async def serve_frontend():
    index = FRONTEND_DIR / "index.html"
    if not index.exists():
        raise HTTPException(404, "Frontend not found.")
    return FileResponse(index)

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/history")
def get_history(user_id: str = Depends(get_current_user)):
    if not user_id:
        raise HTTPException(401, "Not authenticated")
    return {"history": get_user_history(user_id)}

@app.get("/lesson/{session_id}")
def fetch_lesson(session_id: str, user_id: str = Depends(get_current_user)):
    if not user_id:
        raise HTTPException(401, "Not authenticated")
    session_id = session_id.strip()
    if not session_id:
        raise HTTPException(400, "Session ID is required.")
    lesson = get_lesson_by_id(session_id, user_id)
    if not lesson:
        raise HTTPException(404, "Lesson not found.")
    if session_id not in sessions:
        try:
            sessions[session_id] = {
                "reg_chain": load_reg_chain(session_id),
                "transcript": lesson["transcript"]
            }
        except Exception:
            try:
                sessions[session_id] = {
                    "reg_chain": build_reg_chain(
                        normalize_documents(lesson["transcript"]),
                        session_id
                    ),
                    "transcript": lesson["transcript"]
                }
            except Exception as e:
                logger.exception("Failed to load lesson chain.")
                raise HTTPException(500, f"Failed to load lesson: {e}")
        remove_oldest_session()
    return lesson

@app.post("/process", response_model=ProcessResponse)
async def process_video(payload: ProcessRequest, user_id: str = Depends(get_current_user)):
    if not user_id:
        raise HTTPException(401, "Not authenticated.")
    url = payload.url.strip()
    if not url:
        raise HTTPException(400, "A video URL is required.")

    chunks = []
    try:
        DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
        chunks = await asyncio.to_thread(process_audio_input, url)
        if not chunks:
            raise RuntimeError("No audio chunks generated.")

        docs = normalize_documents(await asyncio.to_thread(transcribe_chunks, chunks))
        if not docs:
            raise RuntimeError("No transcript generated.")

        text = combine_transcript_text(docs).strip()
        if not text:
            raise RuntimeError("Transcript is empty.")

        sess_id = str(uuid.uuid4())

        summary, title, keys, qs, chain = await asyncio.gather(
            asyncio.to_thread(summarize_transcript, text),
            asyncio.to_thread(generate_title, text),
            asyncio.to_thread(extract_key_points, text),
            asyncio.to_thread(extract_questions, text),
            asyncio.to_thread(build_reg_chain, docs, sess_id)
        )

        sessions[sess_id] = {"reg_chain": chain, "transcript": text}
        remove_oldest_session()

        await asyncio.to_thread(
            save_lesson,
            sess_id, user_id, str(title), str(summary),
            to_list(keys), to_list(qs), text
        )

        return ProcessResponse(
            success=True,
            session_id=sess_id,
            title=str(title),
            summary=str(summary),
            key_points=to_list(keys),
            questions=to_list(qs),
            transcript=text
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("PROCESS ERROR")
        raise HTTPException(500, f"PROCESS ERROR: {e}")
    finally:
        cleanup_files(chunks)

@app.post("/process-document", response_model=ProcessResponse)
async def process_document(file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    if not user_id:
        raise HTTPException(401, "Not authenticated.")
    if not file.filename:
        raise HTTPException(400, "No file provided.")

    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
    path = DOWNLOADS_DIR / f"{uuid.uuid4().hex}_{Path(file.filename).name}"

    try:
        with open(path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                buffer.write(chunk)

        docs = normalize_documents(await asyncio.to_thread(load_any_document, str(path)))
        if not docs:
            raise RuntimeError("No text extracted.")

        text = "\n\n".join(d.page_content for d in docs if d.page_content).strip()
        if not text:
            raise RuntimeError("No readable text.")

        sess_id = str(uuid.uuid4())

        summary, title, keys, qs, chain = await asyncio.gather(
            asyncio.to_thread(summarize_transcript, text),
            asyncio.to_thread(generate_title, text),
            asyncio.to_thread(extract_key_points, text),
            asyncio.to_thread(extract_questions, text),
            asyncio.to_thread(build_reg_chain, docs, sess_id)
        )

        sessions[sess_id] = {"reg_chain": chain, "transcript": text}
        remove_oldest_session()

        await asyncio.to_thread(
            save_lesson,
            sess_id, user_id, str(title), str(summary),
            to_list(keys), to_list(qs), text
        )

        return ProcessResponse(
            success=True,
            session_id=sess_id,
            title=str(title),
            summary=str(summary),
            key_points=to_list(keys),
            questions=to_list(qs),
            transcript=text
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("DOCUMENT ERROR")
        raise HTTPException(500, f"DOCUMENT ERROR: {e}")
    finally:
        cleanup_files([str(path)])

@app.post("/ask", response_model=AskResponse)
async def ask(payload: AskRequest):
    session_id = payload.session_id.strip()
    question = payload.question.strip()

    if not session_id:
        raise HTTPException(400, "Session ID is required.")
    if not question:
        raise HTTPException(400, "Question is required.")

    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found.")

    try:
        answer = await asyncio.to_thread(
            run_ask_question,
            session["reg_chain"],
            question,
            session_id
        )
        return AskResponse(success=True, answer=str(answer))
    except Exception as e:
        logger.exception("Question answering failed.")
        raise HTTPException(500, f"ASK ERROR: {e}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)