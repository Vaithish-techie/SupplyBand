"""
FastAPI backend — Person 1 owns this.
Gives the frontend a simple HTTP interface to trigger events,
poll the Band room, and log human approval decisions.

Run with: uvicorn backend:app --reload --port 8000
"""

import os
import httpx
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Supply Chain Intelligence API")

# Allow the frontend (running on a different port) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BAND_REST_URL = os.getenv("BAND_REST_URL", "https://app.band.ai")
BAND_ROOM_ID = os.getenv("BAND_ROOM_ID")  # the shared room all 6 agents live in
BAND_API_KEY = os.getenv("BAND_COORDINATOR_API_KEY")  # used to post as a human/system user

# In-memory store for case tracking (fine for a hackathon demo)
ACTIVE_CASES = {}


class TriggerEventRequest(BaseModel):
    event_text: str
    case_id: str | None = None


class ApproveActionRequest(BaseModel):
    case_id: str
    decision: str  # "approve" | "escalate"
    notes: str | None = None


@app.post("/trigger-event")
async def trigger_event(req: TriggerEventRequest):
    """
    Posts the raw disruption event into the Band room.
    The Coordinator agent picks this up and kicks off the pipeline.
    """
    case_id = req.case_id or f"CASE-{int(datetime.now().timestamp())}"

    payload = {
        "room_id": BAND_ROOM_ID,
        "message": {
            "agent": "human_operator",
            "case_id": case_id,
            "event_text": req.event_text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{BAND_REST_URL}/api/v1/messages",
                json=payload,
                headers={"Authorization": f"Bearer {BAND_API_KEY}"},
                timeout=10,
            )
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Band post failed: {e}")

    ACTIVE_CASES[case_id] = {"status": "investigating", "created_at": datetime.now(timezone.utc).isoformat()}
    return {"case_id": case_id, "status": "investigation_started"}


@app.get("/room-messages")
async def get_room_messages(case_id: str | None = None):
    """
    Fetches all messages in the Band room, optionally filtered by case_id.
    Frontend polls this every ~2 seconds to render the live feed.
    """
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{BAND_REST_URL}/api/v1/agent/chats/{BAND_ROOM_ID}/messages",
                headers={"Authorization": f"Bearer {BAND_API_KEY}"},
                params={"page": 1, "page_size": 100},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Band fetch failed: {e}")

    messages = data.get("messages", data if isinstance(data, list) else [])

    if case_id:
        messages = [m for m in messages if m.get("case_id") == case_id]

    return {"case_id": case_id, "messages": messages}


@app.post("/approve-action")
async def approve_action(req: ApproveActionRequest):
    """
    Human investigator approves or escalates the Coordinator's
    final recommendation. Logs the decision for the audit trail.
    """
    if req.case_id not in ACTIVE_CASES:
        raise HTTPException(status_code=404, detail="Unknown case_id")

    ACTIVE_CASES[req.case_id]["status"] = req.decision
    ACTIVE_CASES[req.case_id]["decided_at"] = datetime.now(timezone.utc).isoformat()
    ACTIVE_CASES[req.case_id]["notes"] = req.notes

    return {"case_id": req.case_id, "status": req.decision, "logged": True}


@app.get("/health")
async def health():
    return {"status": "ok"}