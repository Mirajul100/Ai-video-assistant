import os
from pathlib import Path

import av
import numpy as np
import soundfile as sf
import yt_dlp


DOWNLOAD_DIR = Path("downloads")
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

SAMPLE_RATE = 16000
CHANNELS = 1
CHUNK_LENGTH_MINUTES = 10


def download_audio_from_youtube(url: str) -> str:
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": str(DOWNLOAD_DIR / "audio_%(id)s.%(ext)s"),
        "quiet": True,
        "noplaylist": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            file_path = Path(ydl.prepare_filename(info))
            return str(file_path)

    except Exception as first_error:
        print(f"Download without cookies failed: {first_error}")
        print("Trying with Chrome cookies...")

        ydl_opts["cookiesfrombrowser"] = ("chrome",)

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                file_path = Path(ydl.prepare_filename(info))
                return str(file_path)

        except Exception as second_error:
            print(f"Download with Chrome cookies also failed: {second_error}")
            raise RuntimeError(
                f"YouTube download failed.\n"
                f"Without cookies: {first_error}\n"
                f"With Chrome cookies: {second_error}"
            ) from second_error


def decode_audio(input_file: str) -> np.ndarray:
    container = av.open(input_file)

    audio_stream = next(
        (stream for stream in container.streams if stream.type == "audio"),
        None,
    )

    if audio_stream is None:
        container.close()
        raise ValueError(f"No audio stream found in: {input_file}")

    resampler = av.audio.resampler.AudioResampler(
        format="s16",
        layout="mono",
        rate=SAMPLE_RATE,
    )

    samples = []

    try:
        for frame in container.decode(audio=audio_stream.index):
            resampled_frames = resampler.resample(frame)

            if not isinstance(resampled_frames, list):
                resampled_frames = [resampled_frames]

            for resampled_frame in resampled_frames:
                array = resampled_frame.to_ndarray()

                if array.ndim == 2:
                    array = array[0]

                samples.append(array)

        flushed_frames = resampler.resample(None)

        if not isinstance(flushed_frames, list):
            flushed_frames = [flushed_frames]

        for resampled_frame in flushed_frames:
            array = resampled_frame.to_ndarray()

            if array.ndim == 2:
                array = array[0]

            samples.append(array)

    finally:
        container.close()

    if not samples:
        raise ValueError(f"Could not decode audio from: {input_file}")

    audio = np.concatenate(samples).astype(np.int16)

    return audio


def convert_audio_to_wav(input_file: str) -> str:
    input_path = Path(input_file)

    output_file = input_path.with_name(
        f"{input_path.stem}_converted.wav"
    )

    audio = decode_audio(str(input_path))

    sf.write(
        str(output_file),
        audio,
        SAMPLE_RATE,
        subtype="PCM_16",
    )

    return str(output_file)


def chunk_audio_file(
    input_file: str,
    chunk_length: int = CHUNK_LENGTH_MINUTES,
) -> list[str]:
    audio, sample_rate = sf.read(
        input_file,
        dtype="int16",
    )

    if audio.ndim > 1:
        audio = audio[:, 0]

    chunk_samples = chunk_length * 60 * sample_rate

    chunks = []

    input_path = Path(input_file)

    for index, start in enumerate(
        range(0, len(audio), chunk_samples)
    ):
        end = start + chunk_samples

        chunk = audio[start:end]

        if len(chunk) == 0:
            continue

        chunk_file_path = input_path.with_name(
            f"{input_path.stem}_chunk_{index}.wav"
        )

        sf.write(
            str(chunk_file_path),
            chunk,
            sample_rate,
            subtype="PCM_16",
        )

        chunks.append(str(chunk_file_path))

    return chunks


def process_audio_input(source: str) -> list[str]:
    if source.startswith(("http://", "https://")):
        audio_file = download_audio_from_youtube(source)
    else:
        audio_file = source

    if not os.path.exists(audio_file):
        raise FileNotFoundError(
            f"Audio file not found: {audio_file}"
        )

    converted_file = convert_audio_to_wav(audio_file)

    chunks = chunk_audio_file(
        converted_file,
        chunk_length=CHUNK_LENGTH_MINUTES,
    )

    return chunks