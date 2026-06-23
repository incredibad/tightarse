FROM node:20 AS frontend-build

RUN apt-get update -qq && apt-get install -y -qq librsvg2-bin

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .
RUN rsvg-convert -w 192 -h 192 public/icon.svg -o public/icons/icon-192.png && \
    rsvg-convert -w 512 -h 512 public/icon.svg -o public/icons/icon-512.png
RUN npm run build


FROM python:3.12-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend-build /app/dist ./frontend

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7382"]
