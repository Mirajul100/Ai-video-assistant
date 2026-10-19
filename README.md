# Lumen.ai

Lumen.ai turns YouTube videos and uploaded documents into transcripts, summaries,
key points, study questions, and an interactive Q&A lesson. The FastAPI backend
serves the frontend and API; user accounts and lesson history are stored in
SQLite by default, with PostgreSQL available through configuration.

## Features

- Email/password registration and login, plus Google sign-in.
- YouTube audio download, conversion to mono 16 kHz WAV, chunked transcription
  with Gemini, and generated lesson material.
- Document processing for PDF, DOCX, PPTX, TXT, and Markdown files.
- Authenticated lesson history, lesson retrieval, and questions grounded in the
  lesson transcript.
- A browser frontend served at the backend root URL.

## Requirements

- Python 3.10 or later.
- A Gemini API key for transcription and the AI lesson features.
- Deno, Node.js, Bun, or QuickJS on `PATH` for YouTube extraction with yt-dlp.
- Google OAuth 2.0 Web client ID to enable Google sign-in. Email/password auth
  does not require Google OAuth.
- A C/C++ build environment may be needed by some Python packages on platforms
  without compatible prebuilt wheels.

The `requirements.txt` includes the Python dependencies. YouTube cookies are
optional and are only needed for videos that require an authenticated session.

## Windows quick start

Run these commands in PowerShell from the repository directory:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item example.env .env
```

Edit `.env` as described below, then start the app from the repository root:

```powershell
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Open <http://127.0.0.1:8000>. FastAPI's interactive API documentation is at
<http://127.0.0.1:8000/docs>.

Use another Python launch command if `py -3.12` is not installed. On macOS or
Linux, create and activate the virtual environment with `python3 -m venv .venv`
and `source .venv/bin/activate`.

## YouTube JavaScript runtime

The previous Windows failure came from assuming Deno was at a fixed Unix-style
path. The app now discovers Deno, Node.js, Bun, or QuickJS from `PATH` and also
checks Deno's standard Windows install location. Restart the backend after
installing a runtime so its updated `PATH` is visible.

Check that the executable is available in PowerShell:

```powershell
Get-Command deno, node, bun, qjs -ErrorAction SilentlyContinue
```

The app will use an available runtime automatically when `YTDLP_JS_RUNTIME` is
blank. Set that variable to `deno`, `node`, `bun`, or `quickjs` to choose one
explicitly. If needed, set `YTDLP_JS_RUNTIME_PATH` to the full executable path;
when specifying a path, also set `YTDLP_JS_RUNTIME` if the executable name does
not identify the runtime. The extractor uses yt-dlp's `ejs:npm` remote
component, so the first extraction may need internet access.

## Configuration

Copy `example.env` to `.env` and set the values needed by the features you use.
The backend loads `.env` from the repository directory.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Required for Gemini transcription and AI-generated lesson content. |
| `GEMINI_MODEL1` | Optional Gemini model override used by the transcription/summarization modules. |
| `SECRET_KEY` | Required for authentication token signing. Use a private random value of at least 32 bytes. |
| `GOOGLE_CLIENT_ID` | Optional Google OAuth 2.0 Web client ID; required for Google sign-in. |
| `DATABASE_URL` | Optional PostgreSQL connection URL. Without it, the app uses SQLite. |
| `SQLITE_PATH` | Optional SQLite database path; defaults to `lumen.db` in the repository directory. |
| `CORS_ORIGINS` | Comma-separated allowed browser origins. Defaults include localhost ports 5500 and 8000. |
| `YTDLP_JS_RUNTIME` | Optional runtime selection: `deno`, `node`, `bun`, or `quickjs`. Blank means auto-detect. |
| `YTDLP_JS_RUNTIME_PATH` | Optional full path to the selected JavaScript runtime executable. |
| `YOUTUBE_COOKIES` | Optional path to a Netscape-format cookie file for restricted videos. |
| `YOUTUBE_COOKIES_FROM_BROWSER` | Optional local browser name (`chrome`, `edge`, or `firefox`, for example) used to read an authenticated YouTube session. |
| `YOUTUBE_PLAYER_CLIENT` | Optional yt-dlp YouTube client override. The app defaults to `tv` when authenticated cookies are available. |

Generate a suitable local token secret with:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Keep `.env` and any YouTube cookie file private; do not commit them. To enable
Google sign-in, configure the Google OAuth client as a Web application and add
the browser origin used to open the app (for example,
`http://127.0.0.1:8000`) to its authorized JavaScript origins. The same client
ID must be set in the backend's `GOOGLE_CLIENT_ID`.

## YouTube 429 or bot check

If YouTube returns HTTP 429 or asks you to sign in to confirm you are not a
bot, sign in to YouTube in a local browser and add its name to `.env`:

```env
YOUTUBE_COOKIES_FROM_BROWSER=chrome
```

Use `edge` or `firefox` when that is the browser where you are signed in.
Restart the backend after changing `.env`. This reads the local browser session
only while downloading the requested video; it does not store browser cookies
in the project. Alternatively, set `YOUTUBE_COOKIES` to a private
Netscape-format cookie file.

When authenticated requests return HTTP 403, the app automatically uses yt-dlp's
`tv` YouTube client. It avoids web media URLs that may require a Proof of Origin
(PO) token. If 403 remains, refresh `youtube_cookies.txt` by exporting cookies
again after signing in to YouTube.

If yt-dlp reports that it cannot copy Chrome's cookie database, Chrome still
has the database locked. Close every Chrome window, then use Task Manager to
end any remaining `chrome.exe` processes before retrying. If Chrome continues
to lock the database, sign in to YouTube with Edge or Firefox and set
`YOUTUBE_COOKIES_FROM_BROWSER=edge` or `YOUTUBE_COOKIES_FROM_BROWSER=firefox`.

When PostgreSQL is configured, install the listed `psycopg2-binary` dependency
and ensure the database is reachable. If `local_auth.db` exists, startup
migrates legacy account records into the selected shared database while
preserving user IDs where no conflicting account exists.

## API

All lesson and authentication endpoints use JSON except document upload, which
uses multipart form data. Protected endpoints require
`Authorization: Bearer <token>`.

| Method and path | Authentication | Purpose |
| --- | --- | --- |
| `GET /health` | No | Basic process health response. |
| `GET /auth/config` | No | Returns the configured public Google client ID. |
| `POST /auth/register` | No | Creates an email/password account. |
| `POST /auth/login` | No | Signs in with email and password. |
| `POST /auth/google` | No | Verifies a Google ID token and signs in or links an account. |
| `POST /process` | Yes | Processes a YouTube URL and creates a lesson. |
| `POST /process-document` | Yes | Processes one supported document upload. |
| `GET /history` | Yes | Lists the current user's saved lessons. |
| `GET /lesson/{session_id}` | Yes | Returns a saved lesson and restores its Q&A session. |
| `POST /ask` | Yes | Answers a question about a saved lesson. |

Example video request:

```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "language": "english"
}
```

Example question request:

```json
{
  "session_id": "LESSON_SESSION_ID",
  "question": "What are the main points?"
}
```

Document uploads accept `.pdf`, `.docx`, `.pptx`, `.txt`, and `.md`, with a
50 MiB server-side limit. The API returns structured HTTP errors when a request
fails; check the backend log for the detailed server-side exception.

## Data and generated files

- SQLite data is stored in the repository-root `lumen.db` by default, or at the
  path configured by `SQLITE_PATH`.
- Downloaded and converted audio files are kept under `downloads/` only while
  the request is running; generated chunks are removed after processing.
- The vector store is written under `vector_db/`.
- Lesson Q&A chains are held in process memory. They are restored from the
  transcript when a saved lesson is opened, but in-memory chat history is lost
  when the server restarts.

## Development notes and limitations

- Start Uvicorn from the repository root so the `main`, `core`, and `utils`
  imports resolve.
- The current in-memory session registry is limited to 50 recent sessions and
  is not shared across multiple worker processes. Use a shared session store
  before running multiple workers.
- AI and YouTube features depend on third-party services, network access, valid
  API credentials, model availability, and applicable service quotas.
- The `/process` request includes a `language` field, but transcription currently
  asks Gemini to translate non-English audio into English; the request language
  is not yet used to select an output language.
- The optional transcription cache helper is not wired into the main processing
  endpoint.
