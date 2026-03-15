# ============================================
# MediCore AI Service — Dockerfile
# ============================================
# Build:  docker build -t medicore-ai-service .
# Run:    docker run -p 8001:8001 --env-file .env medicore-ai-service
# ============================================

FROM python:3.11-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# ── Install dependencies ─────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ── Copy application source ──────────────────
COPY . .

# ── Expose default port ──────────────────────
EXPOSE 8001

# ── Run with uvicorn ─────────────────────────
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
