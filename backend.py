"""
FastAPI backend — Person 1 owns this.
Gives the frontend a simple HTTP interface to trigger events,
poll the Band room, and log human approval decisions.

Run with: uvicorn backend:app --reload --port 8000
"""

import os
import httpx
import json
import yaml
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

# Helper function to resolve room configuration
def get_room_config():
    api_key = os.getenv("BAND_COORDINATOR_API_KEY")
    room_id = os.getenv("BAND_ROOM_ID")
    
    if not api_key:
        try:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            config_path = os.path.join(base_dir, "agent_config.yaml")
            if os.path.exists(config_path):
                with open(config_path, "r") as f:
                    config = yaml.safe_load(f)
                api_key = config.get("coordinator", {}).get("api_key")
        except Exception as e:
            print(f"Error loading agent_config.yaml: {e}")

    # Fallback default if not defined
    if not api_key:
        api_key = "dummy-key"
        
    return api_key, room_id

BAND_API_KEY, BAND_ROOM_ID = get_room_config()

async def resolve_room_id(client, api_key):
    global BAND_ROOM_ID
    if BAND_ROOM_ID:
        return BAND_ROOM_ID
    try:
        url = f"{BAND_REST_URL}/api/v1/agent/chats"
        headers = {"x-api-key": api_key}
        resp = await client.get(url, headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            chats = data.get("chats", data.get("data", data if isinstance(data, list) else []))
            if chats:
                BAND_ROOM_ID = chats[0].get("id")
                return BAND_ROOM_ID
    except Exception as e:
        print(f"Failed to resolve room id: {e}")
    return "unknown"

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
    api_key = BAND_API_KEY

    async with httpx.AsyncClient() as client:
        room_id = await resolve_room_id(client, api_key)
        if not room_id or room_id == "unknown":
            raise HTTPException(status_code=500, detail="Unable to resolve BAND_ROOM_ID")

        # Fetch list of participants to find someone to mention (other than the coordinator)
        mention_participant = None
        try:
            p_resp = await client.get(
                f"{BAND_REST_URL}/api/v1/agent/chats/{room_id}/participants",
                headers={"x-api-key": api_key},
                timeout=10
            )
            if p_resp.status_code == 200:
                participants = p_resp.json().get("data", [])
                for p in participants:
                    if "coordinator" not in p.get("handle", "").lower():
                        mention_participant = {"id": p.get("id"), "handle": p.get("handle")}
                        break
        except Exception as e:
            print(f"Failed to fetch participants: {e}")

        # Fallback default peer to mention if participants endpoint failed or only coordinator is there
        if not mention_participant:
            mention_participant = {
                "id": "2cd4de36-fbe1-470d-964b-63082dfb0a8d",
                "handle": "rshricharan29/event-intelligence"
            }

        inner_payload = {
            "agent": "human_operator",
            "case_id": case_id,
            "event_text": req.event_text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        url = f"{BAND_REST_URL}/api/v1/agent/chats/{room_id}/messages"
        payload = {
            "message": {
                "content": json.dumps(inner_payload),
                "mentions": [mention_participant]
            }
        }

        try:
            resp = await client.post(
                url,
                json=payload,
                headers={"x-api-key": api_key, "content-type": "application/json"},
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
    api_key = BAND_API_KEY
    async with httpx.AsyncClient() as client:
        room_id = await resolve_room_id(client, api_key)
        if not room_id or room_id == "unknown":
            raise HTTPException(status_code=500, detail="Unable to resolve BAND_ROOM_ID")

        try:
            resp = await client.get(
                f"{BAND_REST_URL}/api/v1/agent/chats/{room_id}/messages",
                headers={"x-api-key": api_key},
                params={"page": 1, "page_size": 100},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Band fetch failed: {e}")

    messages = data.get("data", data.get("messages", data if isinstance(data, list) else []))

    if case_id:
        filtered_messages = []
        for m in messages:
            content = m.get("content", "")
            try:
                content_json = json.loads(content)
                if content_json.get("case_id") == case_id:
                    filtered_messages.append(m)
            except Exception:
                if m.get("case_id") == case_id:
                    filtered_messages.append(m)
        messages = filtered_messages

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