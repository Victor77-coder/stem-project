FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# pyreaddbc não publica wheel para todas as arquiteturas (ex.: Linux arm64); o compilador só fica no build.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libc6-dev \
    && pip install 'pyreaddbc>=1.2,<2' 'dbfread>=2.0,<3' \
    && apt-get purge -y gcc libc6-dev \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY workers /app/workers

RUN mkdir -p /app/.data \
    && useradd --create-home --uid 1000 stem \
    && chown -R stem:stem /app/.data
USER stem

ENTRYPOINT ["python", "-m", "workers"]
