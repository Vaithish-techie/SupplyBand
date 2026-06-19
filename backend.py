"""
FastAPI backend — Supply Chain Disruption Intelligence Center
Provides the frontend with a simple HTTP interface to trigger events,
poll the Band room, check case status, and log human approval decisions.

Run with: python -m uvicorn backend:app --reload --port 8000
"""

import os
import re
import httpx
import json
import yaml
import asyncio
import logging
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [backend] %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Supply Chain Intelligence API",
    description="Backend bridge between the frontend UI and the Band multi-agent room.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Configuration — loaded from agent_config.yaml (same auth pattern as agents)
# ---------------------------------------------------------------------------

BAND_REST_URL = "https://app.band.ai"

def load_config() -> tuple[str, str | None]:
    """
    Load coordinator API key from agent_config.yaml (same source agents use).
    BAND_COORDINATOR_API_KEY env var overrides the yaml if set.
    Returns (api_key, room_id_override_or_None)
    """
    api_key = os.getenv("BAND_COORDINATOR_API_KEY")
    room_id = os.getenv("BAND_ROOM_ID")  # optional override

    if not api_key:
        try:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            config_path = os.path.join(base_dir, "agent_config.yaml")
            with open(config_path) as f:
                config = yaml.safe_load(f)
            api_key = config.get("coordinator", {}).get("api_key")
        except Exception as e:
            logger.warning(f"Could not load agent_config.yaml: {e}")

    if not api_key:
        raise RuntimeError(
            "No Band API key found. Set BAND_COORDINATOR_API_KEY env var "
            "or populate agent_config.yaml coordinator.api_key."
        )
    return api_key, room_id


BAND_API_KEY, _ROOM_ID_OVERRIDE = load_config()
_cached_room_id: str | None = _ROOM_ID_OVERRIDE

# In-memory case store (fine for hackathon demo)
ACTIVE_CASES: dict[str, dict] = {}

# Names of all 6 expected agent posts for a complete investigation
EXPECTED_AGENTS = {
    "coordinator_kickoff",  # coordinator phase=kickoff
    "event_intelligence",
    "supplier_impact",
    "financial_exposure",
    "regulatory_trade",
    "alt_sourcing",
    "coordinator_brief",    # coordinator phase=executive_brief
}

SPECIALIST_AGENTS = {
    "event_intelligence",
    "supplier_impact",
    "financial_exposure",
    "regulatory_trade",
    "alt_sourcing",
}

# ---------------------------------------------------------------------------
# Band API helpers
# ---------------------------------------------------------------------------

def _band_headers() -> dict:
    return {"x-api-key": BAND_API_KEY, "content-type": "application/json"}


async def _get_room_id(client: httpx.AsyncClient) -> str:
    """Resolve the shared Band room ID — cached after first successful fetch."""
    global _cached_room_id
    if _cached_room_id:
        return _cached_room_id

    try:
        r = await client.get(
            f"{BAND_REST_URL}/api/v1/agent/chats",
            headers={"x-api-key": BAND_API_KEY},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
        chats = data.get("chats", data.get("data", data if isinstance(data, list) else []))
        if not chats:
            raise HTTPException(status_code=503, detail="No Band rooms found for this API key.")
        _cached_room_id = chats[0]["id"]
        logger.info(f"Resolved Band room_id: {_cached_room_id}")
        return _cached_room_id
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Band API timed out resolving room ID.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=503, detail=f"Band API error: {e.response.status_code} — {e.response.text[:200]}")


async def _fetch_participants(client: httpx.AsyncClient, room_id: str) -> list[dict]:
    """Fetch all participants (users + agents) in the Band room."""
    try:
        r = await client.get(
            f"{BAND_REST_URL}/api/v1/agent/chats/{room_id}/participants",
            headers={"x-api-key": BAND_API_KEY},
            timeout=10,
        )
        r.raise_for_status()
        return r.json().get("data", [])
    except Exception as e:
        logger.warning(f"Could not fetch participants: {e}")
        return []


async def _fetch_messages(client: httpx.AsyncClient, room_id: str, page_size: int = 100) -> list[dict]:
    """
    Fetch all messages from the Band room via the /context endpoint.
    The Band API caps page_size at 100 messages per page regardless of the parameter.
    Paginates through all pages to ensure the latest messages are fetched.
    """
    all_messages = []
    page = 1
    try:
        while True:
            r = await client.get(
                f"{BAND_REST_URL}/api/v1/agent/chats/{room_id}/context",
                headers={"x-api-key": BAND_API_KEY},
                params={"page": page, "page_size": page_size},
                timeout=15,
            )
            r.raise_for_status()
            data = r.json()
            page_msgs = data.get("data", data if isinstance(data, list) else [])
            if not page_msgs:
                break
            all_messages.extend(page_msgs)
            if len(page_msgs) < page_size:
                break
            page += 1
            if page > 20:  # safety cap
                break
        return all_messages
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Band API timed out fetching message history.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=503, detail=f"Band context fetch failed: {e.response.status_code} — {e.response.text[:200]}")


_BAND_MENTION_RE = re.compile(r"@\[\[[^\]]+\]\]\s*")

def _parse_agent_message(raw_msg: dict) -> dict | None:
    """
    Safely parse the JSON content of a Band context message.

    Band agents (and the coordinator relay) sometimes prepend or append
    @[[uuid]] mention markup to the raw JSON string. Strip these before
    attempting the JSON parse so agent envelopes are always found.
    """
    content = raw_msg.get("content", "")
    # First try raw parse (no markup)
    try:
        return json.loads(content)
    except Exception:
        pass
    # Strip Band @[[uuid]] mention markup and retry
    stripped = _BAND_MENTION_RE.sub("", content).strip()
    try:
        return json.loads(stripped)
    except Exception:
        return None


def _filter_by_case(messages: list[dict], case_id: str) -> list[dict]:
    """Return only messages whose parsed JSON has the given case_id."""
    result = []
    for m in messages:
        data = _parse_agent_message(m)
        if data and data.get("case_id") == case_id:
            result.append(m)
    return result


# ---------------------------------------------------------------------------
# Request/Response models
# ---------------------------------------------------------------------------

class TriggerEventRequest(BaseModel):
    event_text: str
    case_id: str | None = None


class ApproveActionRequest(BaseModel):
    case_id: str
    decision: str   # "approve" | "escalate"
    notes: str | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Liveness check — also verifies Band API key resolves a room."""
    try:
        async with httpx.AsyncClient() as client:
            room_id = await _get_room_id(client)
        return {
            "status": "ok",
            "band_room_id": room_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except HTTPException as e:
        return {"status": "degraded", "detail": e.detail}


def _get_event_intel_api_key() -> str:
    """Load event_intelligence API key from agent_config.yaml as fallback to post trigger."""
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        config_path = os.path.join(base_dir, "agent_config.yaml")
        with open(config_path) as f:
            config = yaml.safe_load(f)
        key = config.get("event_intelligence", {}).get("api_key")
        if key:
            return key
    except Exception as e:
        logger.warning(f"Could not load event_intelligence API key: {e}")
    return BAND_API_KEY


@app.post("/trigger-event")
async def trigger_event(req: TriggerEventRequest):
    """
    Post a raw disruption event into the Band room as the human operator.
    The Coordinator agent picks this up and kicks off the investigation pipeline.

    Returns the case_id so the frontend can start polling /room-messages and /case-status.
    """
    case_id = req.case_id or f"CASE-{int(datetime.now(timezone.utc).timestamp())}"

    async with httpx.AsyncClient() as client:
        room_id = await _get_room_id(client)
        participants = await _fetch_participants(client, room_id)

        # Find the coordinator agent to @mention — we will post using event_intelligence key
        # to avoid cannot_mention_self on both sides.
        mention = None
        for p in participants:
            handle = p.get("handle", "")
            pid = p.get("id", "")
            if "coordinator" in handle.lower() and p.get("type") == "Agent":
                mention = {"id": pid, "handle": handle}
                break

        if not mention:
            # Fallback: mention any agent that isn't event_intelligence
            for p in participants:
                if p.get("type") == "Agent" and "event" not in p.get("handle", "").lower():
                    mention = {"id": p["id"], "handle": p["handle"]}
                    break

        if not mention:
            raise HTTPException(
                status_code=503,
                detail="Could not find a participant to mention in the Band room."
            )

        inner_payload = {
            "agent": "human_operator",
            "case_id": case_id,
            "event_text": req.event_text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # Load event_intelligence's key to post so the coordinator agent can receive it
        event_intel_key = _get_event_intel_api_key()
        post_headers = {"x-api-key": event_intel_key, "content-type": "application/json"}

        try:
            r = await client.post(
                f"{BAND_REST_URL}/api/v1/agent/chats/{room_id}/messages",
                json={"message": {"content": json.dumps(inner_payload), "mentions": [mention]}},
                headers=post_headers,
                timeout=10,
            )
            r.raise_for_status()
        except httpx.TimeoutException:
            raise HTTPException(status_code=503, detail="Band API timed out posting the event.")
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Band rejected the post: {e.response.status_code} — {e.response.text[:300]}"
            )

    ACTIVE_CASES[case_id] = {
        "status": "investigating",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "event_text": req.event_text,
    }
    logger.info(f"Triggered investigation for {case_id}")
    return {
        "case_id": case_id,
        "status": "investigation_started",
        "room_id": room_id,
        "mentioned_agent": mention["handle"],
    }


@app.get("/room-messages")
async def get_room_messages(case_id: str | None = Query(default=None)):
    """
    Fetch messages from the Band room. If case_id is given, filters to only
    messages belonging to that investigation. Frontend polls this every ~2s
    to render the live agent feed.

    Each message's 'parsed' field contains the decoded agent JSON if valid.
    """
    async with httpx.AsyncClient() as client:
        room_id = await _get_room_id(client)
        messages = await _fetch_messages(client, room_id)

    enriched = []
    for m in messages:
        parsed = _parse_agent_message(m)
        enriched.append({**m, "parsed": parsed})

    if case_id:
        enriched = [m for m in enriched if m.get("parsed") and m["parsed"].get("case_id") == case_id]

    return {
        "case_id": case_id,
        "room_id": _cached_room_id,
        "message_count": len(enriched),
        "messages": enriched,
    }


@app.get("/case-status")
async def case_status(case_id: str = Query(..., description="The case_id to check")):
    """
    Returns whether an investigation is complete (all 6 agents have posted)
    or still in progress, by scanning which agents have posted for this case_id.

    Response includes:
    - agents_posted: list of agent names that have posted
    - agents_pending: list of agents that haven't posted yet
    - investigation_complete: bool — all 5 specialists AND coordinator brief done
    - verdict: the coordinator's final verdict if available
    - severity: the coordinator's overall severity if available
    """
    async with httpx.AsyncClient() as client:
        room_id = await _get_room_id(client)
        messages = await _fetch_messages(client, room_id)

    agents_posted: dict[str, dict] = {}   # agent_key -> parsed message

    for raw in messages:
        data = _parse_agent_message(raw)
        if not data or data.get("case_id") != case_id:
            continue

        agent = data.get("agent")
        phase = data.get("phase")

        if agent == "coordinator":
            if phase == "kickoff":
                agents_posted["coordinator_kickoff"] = data
            elif phase == "executive_brief":
                agents_posted["coordinator_brief"] = data
        elif agent in SPECIALIST_AGENTS:
            agents_posted[agent] = data

    specialists_done = all(a in agents_posted for a in SPECIALIST_AGENTS)
    brief_done = "coordinator_brief" in agents_posted
    investigation_complete = specialists_done and brief_done

    # Extract verdict and severity from executive brief if available
    verdict = None
    severity = None
    if brief_done:
        brief = agents_posted["coordinator_brief"]
        verdict = brief.get("verdict")
        severity = brief.get("severity")

    pending = sorted(
        (EXPECTED_AGENTS - set(agents_posted.keys())) - {"coordinator_kickoff"}
    )

    # Build per-agent summary
    agent_summaries = {}
    for key, data in agents_posted.items():
        agent_summaries[key] = {
            "status": data.get("status"),
            "confidence": data.get("confidence"),
            "flags": data.get("flags", []),
            "timestamp": data.get("timestamp"),
        }

    return {
        "case_id": case_id,
        "investigation_complete": investigation_complete,
        "specialists_done": specialists_done,
        "brief_done": brief_done,
        "verdict": verdict,
        "severity": severity,
        "agents_posted": sorted(agents_posted.keys()),
        "agents_pending": pending,
        "agent_details": agent_summaries,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/approve-action")
async def approve_action(req: ApproveActionRequest):
    """
    Record a human investigator's approval or escalation decision for a case.
    Logs the decision in ACTIVE_CASES for audit trail.

    Works for any case_id — if the case isn't in ACTIVE_CASES (e.g. triggered
    manually via Band UI), it creates the record automatically.
    """
    if req.case_id not in ACTIVE_CASES:
        # Allow approvals for cases triggered directly via Band UI
        ACTIVE_CASES[req.case_id] = {
            "status": "unknown",
            "created_at": None,
            "note": "Case created by approve-action (triggered outside backend)",
        }

    ACTIVE_CASES[req.case_id]["status"] = req.decision
    ACTIVE_CASES[req.case_id]["decided_at"] = datetime.now(timezone.utc).isoformat()
    ACTIVE_CASES[req.case_id]["notes"] = req.notes

    logger.info(f"Case {req.case_id} decision: {req.decision}")
    return {
        "case_id": req.case_id,
        "decision": req.decision,
        "logged": True,
        "decided_at": ACTIVE_CASES[req.case_id]["decided_at"],
    }