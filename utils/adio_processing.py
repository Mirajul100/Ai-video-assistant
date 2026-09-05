import os
import yt_dlp
from pydub import AudioSegment

DOWNLOAD_DIR = "downloads"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

def download_audio_from_youtube(url: str) -> str:
    # First try without cookies
    ydl_opts_without_cookies = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(DOWNLOAD_DIR, 'audio_%(id)s.%(ext)s'),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
            'preferredquality': '192',
        }],
        'quiet': True,
    }
    
    # Then try with cookies if needed
    ydl_opts_with_cookies = {
        **ydl_opts_without_cookies,
        'cookiesfrombrowser': ('chrome',),
    }
    
    # Try without cookies first
    try:
        with yt_dlp.YoutubeDL(ydl_opts_without_cookies) as ydl:
            info_dict = ydl.extract_info(url, download=True)
            audio_file_path = ydl.prepare_filename(info_dict).replace('.webm', '.wav').replace('.m4a', '.wav').replace('.mp3', '.wav')
            return audio_file_path
    except Exception as e:
        print(f"Download without cookies failed: {e}")
        print("Trying with Chrome cookies...")
        
        # Try with cookies
        try:
            with yt_dlp.YoutubeDL(ydl_opts_with_cookies) as ydl:
                info_dict = ydl.extract_info(url, download=True)
                audio_file_path = ydl.prepare_filename(info_dict).replace('.webm', '.wav').replace('.m4a', '.wav').replace('.mp3', '.wav')
                return audio_file_path
        except Exception as e:
            print(f"Download with cookies also failed: {e}")
            raise

# Convert audio file to WAV format with mono channel and 16kHz sample rate
def convert_audio_to_wav(input_file: str) -> str:
    output_file = os.path.splitext(input_file)[0] + "_converted.wav"
    audio = AudioSegment.from_file(input_file)
    audio = audio.set_channels(1)  # Convert to mono
    audio = audio.set_frame_rate(16000)  # Set sample rate to 16kHz
    audio.export(output_file, format="wav")
    return output_file

# Chunk audio file into smaller segments of specified length (in minutes)
def chunk_audio_file(input_file: str, chunk_length: int = 10) -> list:
    audio = AudioSegment.from_file(input_file)
    chunks_ms = chunk_length * 60 * 1000
    chunks = []
    for i , start in enumerate(range(0, len(audio), chunks_ms)):
        chunk = audio[start:start + chunks_ms]
        chunk_file_path = f"{os.path.splitext(input_file)[0]}_chunk_{i}.wav"
        chunk.export(chunk_file_path, format="wav")
        chunks.append(chunk_file_path)
    return chunks

# Process audio input from a URL or local file path
def process_audio_input(source: str) -> list:
    if source.startswith("http://") or source.startswith("https://") or source.startswith("https://www.youtube.com"):
        audio_file = download_audio_from_youtube(source)
    else:
        audio_file = source

    converted_file = convert_audio_to_wav(audio_file)
    chunks = chunk_audio_file(converted_file)
    return chunks