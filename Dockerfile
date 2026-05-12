FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPYCACHEPREFIX=/tmp/pycache \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    poppler-utils \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r /app/requirements.txt

COPY . /app

RUN useradd --create-home --uid 10001 appuser && \
    mkdir -p /app/data /tmp/pycache && \
    chown -R appuser:appuser /app /tmp/pycache

USER appuser

EXPOSE 8080

CMD ["uvicorn", "backend.api:app", "--host", "0.0.0.0", "--port", "8080"]

