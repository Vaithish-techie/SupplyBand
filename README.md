---
title: SupplyBand — Supply Chain Disruption Intelligence Center
emoji: 🚨
colorFrom: indigo
colorTo: purple
sdk: docker
pinned: false
app_port: 7860
---

# SupplyBand · Supply Chain Disruption Intelligence Center

A multi-agent system that analyses supply chain disruptions in real time using six Band AI agents orchestrated by a coordinator.

## Required Secrets (set in Space Settings → Secrets)

| Secret | Description |
|---|---|
| `BAND_COORDINATOR_API_KEY` | Coordinator agent Band API key |
| `AIML_API_KEY` | AI/ML API key (Claude Sonnet agents) |
| `FEATHERLESS_API_KEY` | Featherless API key (Llama 3.1 70B agents) |

> If you prefer to mount `agent_config.yaml` directly, see the Dockerfile for the expected path (`/app/agent_config.yaml`).

## Architecture

- **Port 7860**: Nginx serves the React SPA and proxies `/api/*` to FastAPI
- **Port 8000** (internal): FastAPI backend bridge to the Band room
- All six Band agents run as supervised background processes inside the same container

## Local development

```bash
# Backend
pip install -r requirements.txt
uvicorn backend:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev          # VITE_API_BASE=http://localhost:8000 is set in .env.local
```

## Docker (local)

```bash
docker build -t supplyband .
docker run -p 7860:7860 \
  -e BAND_COORDINATOR_API_KEY=<your-key> \
  -e AIML_API_KEY=<your-key> \
  -e FEATHERLESS_API_KEY=<your-key> \
  supplyband
# Open http://localhost:7860
```
