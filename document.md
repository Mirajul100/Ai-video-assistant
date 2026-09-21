# VideoMind

Paste a YouTube URL and get a transcript, summary, key points, and an AI Q&A over the video's content.

## Structure


├── Dockerfile
├── LICENSE
├── __pycache__
│   └── main.cpython-314.pyc
├── core
│   ├── __pycache__
│   ├── auth.py
│   ├── data_base.py
│   ├── data_base.py.save
│   ├── extractor.py
│   ├── reg_engine.py
│   ├── summerize.py
│   ├── transcribe_gemini.py
│   └── vector_store.py
├── document.md
├── downloads
├── example.env
├── frontend
│   ├── css
│   ├── image
│   ├── index.html
│   └── js
├── main.py
├── requirements.txt
├── utils
│   ├── __pycache__
│   ├── adio_processing.py
│   └── pdf_upload.py
├── vector_db
│   ├── 19fee8ab-9d7a-42d5-8e7f-bd4cfbd05181
│   └── chroma.sqlite3
├── venv
│   ├── bin
│   ├── include
│   ├── lib
│   ├── lib64 -> lib
│   ├── pyvenv.cfg
│   └── share
└── youtube_cookies.txt

## Requirements

- Python 3.10+ (for the `dict[str, dict]` type hint in `main.py`)
- FastAPI, Uvicorn, python-dotenv, plus whatever `utils.adio_processing`,
  `core.transcribe_gemini`, `core.summerize`, `core.extractor`, and
  `core.reg_engine` depend on (Gemini/LangChain client libraries, etc.)
- A `.env` file with any API keys those modules need (never exposed to the frontend)

```bash
pip install fastapi uvicorn python-dotenv
```

## Running it

**Backend** (from the project root, so the `utils`/`core` imports resolve):

```bash
uvicorn backend.main:app --reload --port 8000
```

**Frontend** — open `frontend/index.html` directly in a browser, or serve it:

```bash
cd frontend && python3 -m http.server 5500
```

The frontend calls the backend at `http://127.0.0.1:8000` (see `API_BASE` in `script.js`).

## API

### `POST /process`

```json
// Request
{ "url": "https://www.youtube.com/watch?v=VIDEO_ID", "language": "english" }

// Response
{
  "success": true,
  "session_id": "abc123",
  "title": "Video title",
  "summary": "Video summary",
  "key_points": ["Point 1", "Point 2"],
  "questions": ["Question 1?", "Question 2?"],
  "transcript": "Full transcript"
}
```

### `POST /ask`

```json
// Request
{ "session_id": "abc123", "question": "What is the main topic?" }

// Response
{ "success": true, "answer": "The main topic is..." }
```

Errors on either endpoint return an HTTP error status with a plain `detail`
message — never a raw stack trace — which the frontend shows in its error card.

## Known limitations

- Sessions (the RAG chain per video) live in an in-memory dict in `main.py`.
  They reset on server restart and won't work across multiple worker processes —
  fine for local dev, not for production. Swap in Redis or a DB-backed store
  before deploying.
- The `language` field is accepted by `/process` but isn't yet threaded into
  `process_audio_input` — wire it through once that function supports it.