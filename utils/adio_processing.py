from pathlib import Path
import logging
import os
import shutil
import subprocess
import tempfile
import time
import uuid

import av
import numpy as np
import soundfile as sf
import yt_dlp

BASE_DIR = Path(__file__).resolve().parent.parent
DOWNLOAD_DIR = BASE_DIR / "downloads"
DOWNLOAD_DIR.mkdir(exist_ok=True)
DEFAULT_COOKIES = BASE_DIR / "youtube_cookies.txt"

SAMPLE_RATE = 16000
CHUNK_MINUTES = 10
DOWNLOAD_ATTEMPTS = 3
DOWNLOAD_RETRY_BACKOFF_SECONDS = 1
FFMPEG_TIMEOUT_SECONDS = 180
logger = logging.getLogger(__name__)


class YouTubeDownloadError(RuntimeError):
    """A YouTube access restriction that the client can resolve."""


def get_js_runtime() -> dict[str, dict[str, str]]:
    runtime_names = {"deno", "node", "bun", "quickjs"}
    configured_name = os.getenv("YTDLP_JS_RUNTIME", "").strip().lower()
    if configured_name and configured_name not in runtime_names:
        raise ValueError(
            "YTDLP_JS_RUNTIME must be one of: deno, node, bun, quickjs."
        )

    configured_path = os.getenv("YTDLP_JS_RUNTIME_PATH", "").strip()
    if configured_path:
        executable_name = Path(configured_path).stem.lower()
        runtime_name = configured_name or {
            "qjs": "quickjs",
        }.get(executable_name, executable_name)
        if runtime_name not in runtime_names:
            raise ValueError(
                "Set YTDLP_JS_RUNTIME to deno, node, bun, or quickjs "
                "when using YTDLP_JS_RUNTIME_PATH."
            )
        runtime_path = Path(configured_path).expanduser()
        if not runtime_path.is_file():
            raise FileNotFoundError(
                f"JavaScript runtime not found: {runtime_path}"
            )
        return {runtime_name: {"path": str(runtime_path.resolve())}}

    executables = {
        "deno": ("deno",),
        "node": ("node",),
        "bun": ("bun",),
        "quickjs": ("qjs", "quickjs"),
    }
    search_order = (configured_name,) if configured_name else tuple(executables)
    for runtime_name in search_order:
        for executable in executables[runtime_name]:
            runtime_path = shutil.which(executable)
            if runtime_path:
                return {runtime_name: {"path": runtime_path}}

        if runtime_name == "deno":
            for executable in ("deno", "deno.exe"):
                runtime_path = Path.home() / ".deno" / "bin" / executable
                if runtime_path.is_file():
                    return {runtime_name: {"path": str(runtime_path)}}

    raise RuntimeError(
        "yt-dlp needs a JavaScript runtime to extract YouTube media. "
        "Install Deno or Node.js and add it to PATH, then restart the app."
    )


def get_cookie_file() -> Path | None:
    configured_path = os.getenv("YOUTUBE_COOKIES", "").strip()
    if configured_path:
        cookie_path = Path(configured_path).expanduser()
        if not cookie_path.is_file():
            raise FileNotFoundError(
                f"Configured YouTube cookies file not found: {cookie_path}"
            )
        return cookie_path
    return DEFAULT_COOKIES if DEFAULT_COOKIES.is_file() else None


def get_browser_cookie_source() -> tuple[str] | None:
    browser = os.getenv("YOUTUBE_COOKIES_FROM_BROWSER", "").strip().lower()
    if not browser:
        return None

    browser = {
        "google chrome": "chrome",
        "microsoft edge": "edge",
    }.get(browser, browser)

    supported_browsers = {
        "brave", "chrome", "chromium", "edge", "firefox", "opera", "safari",
        "vivaldi", "whale",
    }
    if browser not in supported_browsers:
        raise ValueError(
            "YOUTUBE_COOKIES_FROM_BROWSER must name a supported browser, such as chrome, edge, or firefox."
        )
    return (browser,)


def get_youtube_player_client(has_auth_cookies: bool) -> str | None:
    configured_client = os.getenv("YOUTUBE_PLAYER_CLIENT", "").strip().lower()
    if configured_client:
        return configured_client
    # yt-dlp's tv client currently routes through tv_downgraded with cookies,
    # which can fail with "The page needs to be reloaded". These clients avoid
    # that broken path while retaining authenticated extraction.
    return "default,web_embedded" if has_auth_cookies else None


def download_audio_from_youtube(url: str) -> str:
    js_runtimes = get_js_runtime()
    cookie_file = get_cookie_file()
    browser_cookie_source = get_browser_cookie_source()
    player_client = get_youtube_player_client(
        bool(cookie_file or browser_cookie_source)
    )
    job_id = uuid.uuid4().hex
    active_player_client = player_client
    base_opts = {
        "format": "bestaudio/best",
        "noplaylist": True,
        "js_runtimes": js_runtimes,
        "remote_components": ["ejs:npm"],
        "quiet": True,
        "no_warnings": False,
        "retries": 3,
        "sleep_interval_requests": 1,
    }
    if cookie_file:
        base_opts["cookiefile"] = str(cookie_file)
    elif browser_cookie_source:
        base_opts["cookiesfrombrowser"] = browser_cookie_source

    last_error = None
    for attempt in range(1, DOWNLOAD_ATTEMPTS + 1):
        prefix = f"audio_{job_id}_{attempt}_"
        opts = {
            **base_opts,
            "outtmpl": str(DOWNLOAD_DIR / f"{prefix}%(id)s.%(ext)s"),
        }
        if active_player_client:
            opts["extractor_args"] = {
                "youtube": {
                    "player_client": [
                        client.strip()
                        for client in active_player_client.split(",")
                        if client.strip()
                    ]
                }
            }
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
                if not info or not info.get("id"):
                    raise ValueError("yt-dlp returned no media information")

                video_id = info["id"]
                path = Path(ydl.prepare_filename(info))
                if not path.is_file():
                    files = [
                        f for f in DOWNLOAD_DIR.glob(f"{prefix}{video_id}.*")
                        if f.is_file() and not f.name.endswith((".part", ".ytdl"))
                    ]
                    path = files[0] if files else path
                _validate_downloaded_audio(path)
                return str(path)
        except Exception as error:
            last_error = error
            error_text = str(error).lower()
            if (
                "the page needs to be reloaded" in error_text
                and active_player_client != "default,web_embedded"
            ):
                active_player_client = "default,web_embedded"
                logger.warning(
                    "YouTube rejected the configured player client; retrying with default and web_embedded clients."
                )
            logger.warning(
                "YouTube audio download attempt %d/%d failed (%s).",
                attempt,
                DOWNLOAD_ATTEMPTS,
                type(error).__name__,
            )
            _cleanup_download_attempt(prefix)
            if attempt < DOWNLOAD_ATTEMPTS:
                time.sleep(DOWNLOAD_RETRY_BACKOFF_SECONDS * attempt)

    error_text = str(last_error)
    logger.error("YouTube audio download failed after %d attempts (%s).", DOWNLOAD_ATTEMPTS, type(last_error).__name__)
    if "Could not copy Chrome cookie database" in error_text:
        raise YouTubeDownloadError(
            "Chrome is still using its cookie database. Close every Chrome window, end any remaining "
            "chrome.exe processes in Task Manager, then retry. Alternatively, sign in with Edge or Firefox "
            "and set YOUTUBE_COOKIES_FROM_BROWSER=edge or firefox in .env."
        ) from last_error
    if "HTTP Error 429" in error_text or "Sign in to confirm you're not a bot" in error_text:
        raise YouTubeDownloadError(
            "YouTube temporarily blocked this download. Sign in to YouTube in a local browser, set "
            "YOUTUBE_COOKIES_FROM_BROWSER=chrome (or edge/firefox) in .env, restart the app, and try again."
        ) from last_error
    if "HTTP Error 403" in error_text:
        raise YouTubeDownloadError(
            "YouTube rejected the media URL. Refresh youtube_cookies.txt by signing in to YouTube and "
            "exporting the cookies again, then retry."
        ) from last_error
    raise RuntimeError(
        f"YouTube download failed after {DOWNLOAD_ATTEMPTS} attempts: {error_text}"
    ) from last_error


def _cleanup_download_attempt(prefix: str) -> None:
    """Remove only files produced by this uniquely named download attempt."""
    for candidate in DOWNLOAD_DIR.glob(f"{prefix}*"):
        if candidate.is_file():
            candidate.unlink(missing_ok=True)


def _validate_downloaded_audio(path: Path) -> None:
    if not path.is_file() or path.stat().st_size == 0:
        raise ValueError("Downloaded audio file is missing or empty")

    try:
        with av.open(str(path), mode="r") as container:
            has_audio = bool(container.streams.audio)
    except Exception as error:
        raise ValueError("Downloaded media is unreadable or truncated") from error
    if not has_audio:
        raise ValueError("Downloaded media has no audio stream")


def decode_audio(input_file: str) -> np.ndarray:
    try:
        with av.open(str(input_file), mode="r") as container:
            audio_streams = container.streams.audio
            if not audio_streams:
                raise ValueError("No audio stream found")
            stream = audio_streams[0]
            resampler = av.audio.resampler.AudioResampler(
                format="s16",
                layout="mono",
                rate=SAMPLE_RATE,
            )
            samples = []

            for frame in container.decode(audio=stream):
                frames = resampler.resample(frame)
                if not isinstance(frames, list):
                    frames = [frames]

                for resampled_frame in frames:
                    if resampled_frame is not None:
                        array = resampled_frame.to_ndarray()
                        samples.append(array[0] if array.ndim == 2 else array)

            frames = resampler.resample(None)
            if not isinstance(frames, list):
                frames = [frames]
            for resampled_frame in frames:
                if resampled_frame is not None:
                    array = resampled_frame.to_ndarray()
                    samples.append(array[0] if array.ndim == 2 else array)

        if not samples:
            raise ValueError("Could not decode audio: stream was empty")
        audio = np.concatenate(samples).astype(np.int16, copy=False)
        if audio.size == 0:
            raise ValueError("Could not decode audio: stream was empty")
        return audio
    except Exception as pyav_error:
        logger.warning(
            "PyAV could not decode audio from %s (%s); trying FFmpeg.",
            Path(input_file).name,
            type(pyav_error).__name__,
        )
        try:
            return _decode_audio_with_ffmpeg(input_file)
        except Exception as ffmpeg_error:
            logger.error(
                "Audio decoding failed for %s (PyAV: %s; FFmpeg: %s).",
                Path(input_file).name,
                type(pyav_error).__name__,
                type(ffmpeg_error).__name__,
            )
            raise RuntimeError(
                f"Unable to decode audio from {Path(input_file).name}. "
                f"PyAV failed ({type(pyav_error).__name__}); FFmpeg failed ({ffmpeg_error})."
            ) from ffmpeg_error


def _decode_audio_with_ffmpeg(input_file: str) -> np.ndarray:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise FileNotFoundError("FFmpeg executable was not found on PATH")

    source = Path(input_file)
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix=f"{source.stem}_",
            suffix="_ffmpeg.wav",
            dir=str(source.parent),
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)

        try:
            result = subprocess.run(
                [
                    ffmpeg,
                    "-nostdin",
                    "-v", "error",
                    "-y",
                    "-i", str(source),
                    "-vn",
                    "-ac", "1",
                    "-ar", str(SAMPLE_RATE),
                    "-c:a", "pcm_s16le",
                    str(temporary_path),
                ],
                capture_output=True,
                text=True,
                timeout=FFMPEG_TIMEOUT_SECONDS,
                check=False,
            )
        except subprocess.TimeoutExpired as error:
            logger.error("FFmpeg timed out while converting %s.", source.name)
            raise TimeoutError("FFmpeg audio conversion timed out") from error

        if result.returncode != 0:
            stderr = (result.stderr or "").strip()
            logger.error("FFmpeg conversion failed for %s (exit %s).", source.name, result.returncode)
            raise RuntimeError(
                f"FFmpeg exited with code {result.returncode}"
                + (f": {stderr[-1000:]}" if stderr else "")
            )

        if not temporary_path.is_file() or temporary_path.stat().st_size == 0:
            raise ValueError("FFmpeg produced no WAV output")
        info = sf.info(str(temporary_path))
        if (
            info.frames <= 0
            or info.samplerate != SAMPLE_RATE
            or info.channels != 1
            or info.subtype != "PCM_16"
        ):
            raise ValueError("FFmpeg output is not nonempty mono 16 kHz PCM-16 WAV")
        audio, sample_rate = sf.read(str(temporary_path), dtype="int16")
        if sample_rate != SAMPLE_RATE or audio.size == 0:
            raise ValueError("FFmpeg WAV output could not be read")
        return np.asarray(audio, dtype=np.int16)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def convert_audio_to_wav(input_file: str) -> str:
    path = Path(input_file)
    output = path.with_name(f"{path.stem}_{uuid.uuid4().hex}_converted.wav")
    audio = decode_audio(str(path))

    sf.write(
        str(output),
        audio,
        SAMPLE_RATE,
        subtype="PCM_16",
    )

    return str(output)


def split_audio_into_chunks(
    wav_file: str,
    chunk_length_minutes: int = CHUNK_MINUTES,
) -> list[str]:
    if chunk_length_minutes <= 0:
        raise ValueError("Chunk length must be greater than zero minutes.")

    path = Path(wav_file)
    audio = decode_audio(str(path))

    chunk_size = SAMPLE_RATE * 60 * chunk_length_minutes
    chunks = []
    chunk_run_id = uuid.uuid4().hex

    try:
        for i in range(0, len(audio), chunk_size):
            chunk = audio[i:i + chunk_size]
            output = path.with_name(
                f"{path.stem}_{chunk_run_id}_chunk_{len(chunks) + 1}.wav"
            )
            chunks.append(str(output))

            sf.write(
                str(output),
                chunk,
                SAMPLE_RATE,
                subtype="PCM_16",
            )
    except Exception:
        for chunk in chunks:
            Path(chunk).unlink(missing_ok=True)
        raise

    return chunks


def process_audio_input(source: str) -> list[str]:
    source = source.strip()

    if not source:
        raise ValueError("Audio source is empty")

    is_remote = source.startswith(("http://", "https://"))
    audio_file = None
    wav_file = None
    try:
        audio_file = download_audio_from_youtube(source) if is_remote else source
        wav_file = convert_audio_to_wav(audio_file)
        return split_audio_into_chunks(wav_file)
    except Exception as error:
        logger.error("Audio processing failed (%s).", type(error).__name__)
        raise
    finally:
        if wav_file:
            Path(wav_file).unlink(missing_ok=True)
        if is_remote and audio_file:
            Path(audio_file).unlink(missing_ok=True)
