FROM python:3.12-slim

WORKDIR /app

# requirements.txt лежит в корне репозитория, поэтому контекст билда = .
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Копируем только код auth-сервиса
COPY services/auth /app

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
