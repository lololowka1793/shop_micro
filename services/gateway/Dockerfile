# services/gateway/Dockerfile

FROM python:3.12-slim

WORKDIR /app

# Копируем общий requirements.txt из корня проекта
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Копируем код gateway-сервиса
COPY services/gateway /app

# Запускаем gateway на порту 8000 внутри контейнера
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
