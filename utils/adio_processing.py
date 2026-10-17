from pathlib import Path
import os
import shutil
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


def download_audio_from_youtube(url: str) -> str:
    js_runtimes = get_js_runtime()
    cookie_file = get_cookie_file()
    job_id = uuid.uuid4().hex
    opts = {
        "format": "bestaudio/best",
        "outtmpl": str(DOWNLOAD_DIR / f"audio_{job_id}_%(id)s.%(ext)s"),
        "noplaylist": True,
        "js_runtimes": js_runtimes,
        "remote_components": ["ejs:npm"],
        "quiet": True,
        "no_warnings": False,
    }
    if cookie_file:
        opts["cookiefile"] = str(cookie_file)

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)

            video_id = info["id"]
            path = Path(ydl.prepare_filename(info))

            if path.exists():
                return str(path)

            files = [
                f for f in DOWNLOAD_DIR.glob(f"audio_{job_id}_{video_id}.*")
                if not f.name.endswith(".part")
            ]

            if files:
                return str(files[0])

            raise FileNotFoundError(
                f"Downloaded file not found for {video_id}"
            )

    except Exception as e:
        for partial_file in DOWNLOAD_DIR.glob(f"audio_{job_id}_*"):
            partial_file.unlink(missing_ok=True)
        raise RuntimeError(
            f"YouTube download failed: {e}"
        ) from e


def decode_audio(input_file: str) -> np.ndarray:
    container = av.open(input_file)
    stream = next(
        (s for s in container.streams if s.type == "audio"),
        None,
    )

    if stream is None:
        container.close()
        raise ValueError("No audio stream found")

    resampler = av.audio.resampler.AudioResampler(
        format="s16",
        layout="mono",
        rate=SAMPLE_RATE,
    )

    samples = []

    try:
        for frame in container.decode(audio=stream.index):
            frames = resampler.resample(frame)
            if not isinstance(frames, list):
                frames = [frames]

            for f in frames:
                if f is not None:
                    a = f.to_ndarray()
                    samples.append(a[0] if a.ndim == 2 else a)

        frames = resampler.resample(None)
        if not isinstance(frames, list):
            frames = [frames]

        for f in frames:
            if f is not None:
                a = f.to_ndarray()
                samples.append(a[0] if a.ndim == 2 else a)
    finally:
        container.close()

    if not samples:
        raise ValueError("Could not decode audio")

    return np.concatenate(samples).astype(np.int16, copy=False)


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
    finally:
        if wav_file:
            Path(wav_file).unlink(missing_ok=True)
        if is_remote and audio_file:
            Path(audio_file).unlink(missing_ok=True)
