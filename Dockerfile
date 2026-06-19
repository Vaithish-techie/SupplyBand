# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build the React frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# Install dependencies first (cached layer)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --prefer-offline

# Copy source and build
# VITE_API_BASE is set to empty string so all API calls go to /api (proxied by Nginx)
COPY frontend/ .
RUN VITE_API_BASE="/api" npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Final image: Python + Nginx + supervisor
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim

# Install system deps: Nginx + supervisor (to manage multiple processes)
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# ── Python dependencies ───────────────────────────────────────────────────────
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir "pyyaml" "python-multipart"

# ── Application source ────────────────────────────────────────────────────────
COPY backend.py ./
COPY agents/ ./agents/
COPY data/ ./data/

# ── Copy compiled frontend into Nginx's web root ──────────────────────────────
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# ── Nginx config ──────────────────────────────────────────────────────────────
COPY deploy/nginx.conf /etc/nginx/nginx.conf

# ── Supervisor config (keeps Nginx + uvicorn alive) ──────────────────────────
COPY deploy/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# ── Startup script ────────────────────────────────────────────────────────────
COPY deploy/start.sh /start.sh
RUN chmod +x /start.sh

# Hugging Face Spaces requires port 7860
EXPOSE 7860

# supervisord manages everything
CMD ["/start.sh"]
