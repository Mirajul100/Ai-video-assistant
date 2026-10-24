FROM python:3.12-slim

WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive \
    DENO_INSTALL=/usr/local

# System dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libpq-dev \
    gcc \
    g++ \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Deno for yt-dlp
RUN curl -fsSL https://deno.land/install.sh | sh

ENV PATH=/usr/local/bin:$PATH

# Upgrade pip tools
RUN python -m pip install --upgrade pip setuptools wheel

# Install CPU-only PyTorch
# Prevents large NVIDIA/CUDA packages on AWS CPU server
RUN pip install --no-cache-dir \
    torch \
    --index-url https://download.pytorch.org/whl/cpu

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Use a non-root runtime and keep generated application data writable.
RUN groupadd --system lumen && useradd --system --gid lumen --create-home lumen \
    && mkdir -p /app/downloads /app/vector_db \
    && chown -R lumen:lumen /app

USER lumen

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"]

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
