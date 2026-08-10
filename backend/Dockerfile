FROM python:3.12-slim
WORKDIR /app

RUN addgroup --system jats && adduser --system --ingroup jats jats

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

RUN chown -R jats:jats /app
USER jats

EXPOSE 8080
# ${PORT:-8080}, not a hardcoded port, so this image also works unmodified on hosts that inject
# their own PORT at runtime (e.g. Render's Docker runtime) - docker-compose doesn't set PORT, so
# local dev is unaffected and still gets 8080.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
