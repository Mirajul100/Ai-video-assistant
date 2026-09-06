import logging
import shutil
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from langchain_core.documents import Document

from utils.adio_processing import process_audio_input
from core.transcribe_gemini import (
    transcribe_chunks,
    combine_transcript_text,
)
from core.summerize import (
    summarize_transcript,
    generate_title,
)
from core.extractor import (
    extract_key_points,
    extract_questions,
)
from core.reg_engine import (
    build_reg_chain,
    ask_question as run_ask_question,
)

# Import the new document loader we discussed previously
# Make sure to save the document_loader.py code in your 'core' directory!
from core.pdf_upload import load_any_document

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

logger = logging.getLogger("Lumen.ai")

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
DOWNLOADS_DIR = BASE_DIR / "downloads"

app = FastAPI(
    title="Lumen.ai API",
    description="AI Video & Document Assistant API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = FRONTEND_DIR

if STATIC_DIR.exists():
    app.mount(
        "/static",
        StaticFiles(directory=STATIC_DIR),
        name="static",
    )

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
    if items is None:
        return []

    if isinstance(items, Document):
        return [items]

    if isinstance(items, str):
        return [Document(page_content=items)]

    if isinstance(items, (list, tuple)):
        documents = []

        for item in items:
            if isinstance(item, Document):
                documents.append(item)

            elif isinstance(item, str):
                documents.append(
                    Document(page_content=item)
                )

            else:
                raise TypeError(
                    f"Unsupported transcript item type: {type(item).__name__}"
                )

        return documents

    raise TypeError(
        f"Unsupported transcript type: {type(items).__name__}"
    )


def to_list(text) -> list[str]:
    if not text:
        return []

    if isinstance(text, list):
        return [
            str(item).strip()
            for item in text
            if str(item).strip()
        ]

    return [
        line.strip()
        for line in str(text).strip().split("\n")
        if line.strip()
    ]


def cleanup_downloads():
    if not DOWNLOADS_DIR.exists():
        DOWNLOADS_DIR.mkdir(
            parents=True,
            exist_ok=True,
        )
        return

    try:
        for item in DOWNLOADS_DIR.iterdir():
            try:
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
            except Exception as exc:
                logger.warning(
                    "Failed to remove %s: %s",
                    item,
                    exc,
                )

        logger.info("Downloads folder cleaned successfully.")

    except Exception as exc:
        logger.warning(
            "Failed to clean downloads folder: %s",
            exc,
        )


@app.get("/", include_in_schema=False)
async def serve_frontend():
    index_file = FRONTEND_DIR / "index.html"

    if not index_file.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Frontend not found: {index_file}",
        )

    return FileResponse(index_file)


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "Lumen.ai API",
    }


@app.post(
    "/process",
    response_model=ProcessResponse,
)
def process_video(
    payload: ProcessRequest,
) -> ProcessResponse:

    url = payload.url.strip()

    if not url:
        raise HTTPException(
            status_code=400,
            detail="A video URL is required.",
        )

    logger.info("Starting video processing: %s", url)

    try:
        DOWNLOADS_DIR.mkdir(
            parents=True,
            exist_ok=True,
        )

        logger.info("Processing audio...")

        chunks = process_audio_input(
            source=url
        )

        if not chunks:
            raise ValueError(
                "No audio chunks were generated."
            )

        logger.info("Audio chunks generated: %d", len(chunks))

        logger.info("Transcribing audio...")

        raw_transcript = transcribe_chunks(
            chunk_paths=chunks
        )

        if not raw_transcript:
            raise ValueError(
                "Transcription returned no content."
            )

        transcript_docs = normalize_documents(
            raw_transcript
        )

        if not transcript_docs:
            raise ValueError(
                "No transcript documents were created."
            )

        transcript_text = combine_transcript_text(
            transcript_docs
        )

        if not transcript_text.strip():
            raise ValueError(
                "Combined transcript is empty."
            )

        logger.info("Generating summary...")
        summary = summarize_transcript(transcript=transcript_text)

        logger.info("Generating title...")
        title = generate_title(transcript=transcript_text)

        logger.info("Extracting key points...")
        key_points = extract_key_points(transcript=transcript_text)

        logger.info("Extracting questions...")
        questions = extract_questions(transcript=transcript_text)

        logger.info("Building RAG chain...")
        reg_chain = build_reg_chain(
            transcripts=transcript_docs
        )

        session_id = str(uuid.uuid4())

        sessions[session_id] = {
            "reg_chain": reg_chain,
            "transcript": transcript_text,
        }

        if len(sessions) > MAX_SESSIONS:
            oldest_id = next(iter(sessions))
            sessions.pop(oldest_id, None)
            logger.info("Session cap reached, evicted oldest session: %s", oldest_id)

        logger.info("Video processing completed successfully. Session: %s", session_id)
        cleanup_downloads()

        return ProcessResponse(
            success=True,
            session_id=session_id,
            title=str(title),
            summary=str(summary),
            key_points=to_list(key_points),
            questions=to_list(questions),
            transcript=transcript_text,
        )

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("Failed to process video: %s", url)
        cleanup_downloads()
        raise HTTPException(
            status_code=500,
            detail=f"PROCESS ERROR: {str(exc)}",
        )


# ==========================================
# NEW ENDPOINT: PROCESS UPLOADED DOCUMENTS
# ==========================================
@app.post(
    "/process-document",
    response_model=ProcessResponse,
)
async def process_document(
    file: UploadFile = File(...),
) -> ProcessResponse:
    
    logger.info("Starting document processing for file: %s", file.filename)

    try:
        DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

        # 1. Save uploaded file temporarily
        file_path = DOWNLOADS_DIR / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 2. Extract Document objects using our universal loader
        logger.info("Loading document content...")
        document_pages = load_any_document(str(file_path))

        if not document_pages:
            raise ValueError("No content could be extracted from the document.")

        # 3. Combine document text for the LLM functions
        full_text = "\n\n".join([doc.page_content for doc in document_pages])

        if not full_text.strip():
            raise ValueError("The uploaded document is empty or contains no readable text.")

        # 4. Generate the same artifacts as a video
        logger.info("Generating summary...")
        summary = summarize_transcript(transcript=full_text)

        logger.info("Generating title...")
        title = generate_title(transcript=full_text)

        logger.info("Extracting key points...")
        key_points = extract_key_points(transcript=full_text)

        logger.info("Extracting questions...")
        questions = extract_questions(transcript=full_text)

        logger.info("Building RAG chain...")
        reg_chain = build_reg_chain(
            transcripts=document_pages
        )

        # 5. Create Session
        session_id = str(uuid.uuid4())
        sessions[session_id] = {
            "reg_chain": reg_chain,
            "transcript": full_text,  
        }

        if len(sessions) > MAX_SESSIONS:
            oldest_id = next(iter(sessions))
            sessions.pop(oldest_id, None)
            logger.info("Session cap reached, evicted oldest session: %s", oldest_id)

        logger.info("Document processing completed successfully. Session: %s", session_id)
        cleanup_downloads()

        return ProcessResponse(
            success=True,
            session_id=session_id,
            title=str(title),
            summary=str(summary),
            key_points=to_list(key_points),
            questions=to_list(questions),
            transcript=full_text,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to process document: %s", file.filename)
        cleanup_downloads()
        raise HTTPException(
            status_code=500,
            detail=f"DOCUMENT PROCESS ERROR: {str(exc)}",
        )


@app.post(
    "/ask",
    response_model=AskResponse,
)
def ask(
    payload: AskRequest,
) -> AskResponse:

    session_id = payload.session_id.strip()
    question = payload.question.strip()

    if not session_id:
        raise HTTPException(
            status_code=400,
            detail="A session ID is required.",
        )

    if not question:
        raise HTTPException(
            status_code=400,
            detail="A question is required.",
        )

    session = sessions.get(session_id)

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Session not found. Analyze a video or document first.",
        )

    logger.info("Question received for session %s: %s", session_id, question)

    try:
        answer = run_ask_question(
            reg_chain=session["reg_chain"],
            question=question,
        )

        return AskResponse(
            success=True,
            answer=str(answer),
        )

    except Exception as exc:
        logger.exception("Failed to answer question for session %s", session_id)

        raise HTTPException(
            status_code=500,
            detail=f"ASK ERROR: {str(exc)}",
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )