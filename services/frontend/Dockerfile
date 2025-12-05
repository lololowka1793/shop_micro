# ---------- Стадия сборки (Node + Vite) ----------
FROM node:20-alpine AS build

WORKDIR /app

# 1) Копируем package.json и package-lock.json, чтобы npm install кешировался
COPY frontend/package*.json ./

RUN npm install

# 2) Копируем весь фронт
COPY frontend ./

# 3) Сборка Vite (будет папка dist/)
RUN npm run build

# ---------- Стадия запуска (Nginx, статика) ----------
FROM nginx:alpine

# Кладём собранный фронт в стандартную папку Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# По умолчанию Nginx слушает 80 порт
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
