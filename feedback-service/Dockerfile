FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN groupadd --gid 10001 feedback && useradd --uid 10001 --gid 10001 --no-create-home feedback
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py manage.py ./
USER 10001:10001
CMD ["gunicorn", "--bind", "127.0.0.1:8787", "--workers", "2", "--threads", "2", "--timeout", "20", "--worker-tmp-dir", "/tmp", "--max-requests", "1000", "--max-requests-jitter", "100", "--limit-request-line", "2048", "--limit-request-fields", "32", "app:create_app()"]
