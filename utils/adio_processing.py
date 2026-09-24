from pathlib import Path
import av
import numpy as np
import soundfile as sf
import yt_dlp

BASE_DIR = Path(__file__).resolve().parent.parent
DOWNLOAD_DIR = BASE_DIR / "downloads"
DOWNLOAD_DIR.mkdir(exist_ok=True)
COOKIES = BASE_DIR / "youtube_cookies.txt"
DENO = Path.home() / ".deno/bin/deno"

SAMPLE_RATE = 16000
CHUNK_MINUTES = 10


def download_audio_from_youtube(url: str) -> str:
    if not COOKIES.exists():
        raise FileNotFoundError(f"Cookies not found: {COOKIES}")
    if not DENO.exists():
        raise FileNotFoundError(f"Deno not found: {DENO}")

    opts = {
        "format": "bestaudio/best",
        "outtmpl": str(DOWNLOAD_DIR / "audio_%(id)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": False,
        "cookiefile": str(COOKIES),
        "js_runtimes": {
            "deno": {"path": str(DENO)},
        },
        "remote_components": ["ejs:npm"],
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_id = info["id"]
            path = Path(ydl.prepare_filename(info))

            if path.exists():
                return str(path)

            files = list(DOWNLOAD_DIR.glob(f"audio_{video_id}.*"))
            files = [f for f in files if not f.name.endswith(".part")]

            if files:
                return str(files[0])

            raise FileNotFoundError(
                f"Downloaded file not found for {video_id}"
            )
    except Exception as e:
        raise RuntimeError(f"YouTube download failed: {e}") from e


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

    return np.concatenate(samples).astype(np.int16)


def convert_audio_to_wav(input_file: str) -> str:
    path = Path(input_file)
    output = path.with_name(f"{path.stem}_converted.wav")
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
    path = Path(wav_file)
    audio = decode_audio(str(path))

    chunk_size = SAMPLE_RATE * 60 * chunk_length_minutes
    chunks = []

    for i in range(0, len(audio), chunk_size):
        chunk = audio[i:i + chunk_size]
        output = path.with_name(
            f"{path.stem}_chunk_{len(chunks) + 1}.wav"
        )

        sf.write(
            str(output),
            chunk,
            SAMPLE_RATE,
            subtype="PCM_16",
        )

        chunks.append(str(output))

    return chunks


def process_audio_input(source: str) -> list[str]:
    source = source.strip()

    if not source:
        raise ValueError("Audio source is empty")

    if source.startswith(("http://", "https://")):
        audio_file = download_audio_from_youtube(source)
    else:
        audio_file = source

    wav_file = convert_audio_to_wav(audio_file)
    return split_audio_into_chunks(wav_file)
