"""
FastAPI backend — Supply Chain Disruption Intelligence Center
Provides the frontend with a simple HTTP interface to trigger events,
poll the Band room, check case status, and log human approval decisions.

Features a full Mock Demo Mode for offline validation and interactive simulations.

Run with: python -m uvicorn backend:app --reload --port 8001
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
# Configuration & Mock Mode Handling
# ---------------------------------------------------------------------------

BAND_REST_URL = "https://app.band.ai"
MOCK_MODE = False

def load_config() -> tuple[str | None, str | None]:
    global MOCK_MODE
    api_key = os.getenv("BAND_COORDINATOR_API_KEY")
    room_id = os.getenv("BAND_ROOM_ID")  # optional override

    if not api_key:
        try:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            config_path = os.path.join(base_dir, "agent_config.yaml")
            if os.path.exists(config_path):
                with open(config_path) as f:
                    config = yaml.safe_load(f)
                api_key = config.get("coordinator", {}).get("api_key")
            else:
                logger.warning("agent_config.yaml not found. Activating MOCK DEMO MODE.")
                MOCK_MODE = True
        except Exception as e:
            logger.warning(f"Could not load agent_config.yaml: {e}. Activating MOCK DEMO MODE.")
            MOCK_MODE = True

    if not api_key and not MOCK_MODE:
        MOCK_MODE = True
        
    return api_key, room_id


BAND_API_KEY, _ROOM_ID_OVERRIDE = load_config()
_cached_room_id: str | None = _ROOM_ID_OVERRIDE or ("MOCK_ROOM_ID" if MOCK_MODE else None)

# In-memory case store
ACTIVE_CASES: dict[str, dict] = {}
MOCK_ROOM_MESSAGES: dict[str, list[dict]] = {}

# Names of all 6 expected agent posts for a complete investigation
EXPECTED_AGENTS = {
    "coordinator_kickoff",
    "event_intelligence",
    "supplier_impact",
    "financial_exposure",
    "regulatory_trade",
    "alt_sourcing",
    "coordinator_brief",
}

SPECIALIST_AGENTS = {
    "event_intelligence",
    "supplier_impact",
    "financial_exposure",
    "regulatory_trade",
    "alt_sourcing",
}

# ---------------------------------------------------------------------------
# Band API helpers (Production Mode)
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
    """Fetch recent messages from the Band room context."""
    all_messages = []
    try:
        for page in [1, 2, 3]:
            r = await client.get(
                f"{BAND_REST_URL}/api/v1/agent/chats/{room_id}/context",
                headers={"x-api-key": BAND_API_KEY},
                params={"page": page, "page_size": page_size},
                timeout=15,
            )
            r.raise_for_status()
            data = r.json()
            page_msgs = data.get("data", data if isinstance(data, list) else [])
            all_messages.extend(page_msgs)
            if len(page_msgs) == 0:
                break
        return all_messages
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Band API timed out fetching message history.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=503, detail=f"Band context fetch failed: {e.response.status_code} — {e.response.text[:200]}")


_BAND_MENTION_RE = re.compile(r"@\[\[[^\]]+\]\]\s*")

def _parse_agent_message(raw_msg: dict) -> dict | None:
    """Safely parse the JSON content of a Band message envelope."""
    content = raw_msg.get("content", "")
    try:
        return json.loads(content)
    except Exception:
        pass
    stripped = _BAND_MENTION_RE.sub("", content).strip()
    try:
        return json.loads(stripped)
    except Exception:
        return None

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
# Mock Simulation Telemetry Database
# ---------------------------------------------------------------------------

MOCK_DISRUPTIONS = {
    "taiwan": {
        "event_intelligence": {
            "event_type": "natural_disaster",
            "severity": "CRITICAL",
            "location": "Hsinchu, Taiwan",
            "affected_industries": ["semiconductor", "logistics"],
            "estimated_duration_weeks": 8,
            "summary": "TSMC Hsinchu fabs suspended following magnitude 7.4 earthquake."
        },
        "supplier_impact": {
            "affected_tier1": 1,
            "affected_tier2": 3,
            "critical_path_suppliers": ["TSMC Fab 18"],
            "affected_components": ["A100 AI Chips", "H100 AI Chips"],
            "inventory_buffer_days": 12,
            "severity": "CRITICAL"
        },
        "supplier_impact_flags": ["Sole-source component TSMC Fab 18 offline! Buffer days (12) < 21"],
        "financial_exposure": {
            "week1_risk_usd": 15000000,
            "week3_risk_usd": 105000000,
            "week6_risk_usd": 630000000,
            "revenue_at_risk_products": ["Enterprise AI Server Clusters"],
            "margin_impact_pct": 14.5
        },
        "regulatory_trade": {
            "force_majeure_applicable": True,
            "insurer_notify_deadline_hours": 72,
            "export_controls": ["EAR99"],
            "tariff_implications": "none",
            "compliance_actions": [
                "Notify business insurer of TSMC force majeure within 72 hours",
                "File formal claim for component delay with TSMC supply panel"
            ]
        },
        "alt_sourcing": {
            "alternatives": [
                {
                    "supplier": "Samsung Austin (Texas, USA)",
                    "components_covered": ["A100 AI Chips"],
                    "cost_delta_pct": 18.0,
                    "lead_time_days": 12,
                    "risk_level": "LOW",
                    "regulatory_flags": ["US Domestic Fab - Safe Regulatory Profile"]
                },
                {
                    "supplier": "Intel Foundry (Arizona, USA)",
                    "components_covered": ["A100 AI Chips"],
                    "cost_delta_pct": 25.0,
                    "lead_time_days": 20,
                    "risk_level": "LOW",
                    "regulatory_flags": ["US Domestic Fab - Safe Regulatory Profile"]
                }
            ],
            "recommended": "Samsung Austin (Texas, USA)",
            "recommendation_reason": "Bypasses geographical disruption with low lead-time delta."
        },
        "coordinator_brief": {
            "situation_summary": "Magnitude 7.4 earthquake in Hsinchu, Taiwan has halted TSMC Fab 18 production. Supply buffer is 12 days, presenting critical risk to Enterprise AI Servers with $630M at risk by week 6.",
            "severity": "CRITICAL",
            "verdict": "ESCALATE_TO_HUMAN",
            "top_3_actions": [
                "Initiate Samsung Austin secondary source contract within 48h",
                "Notify insurers of potential cargo delay within 72h limit",
                "Reallocate remaining H100 buffer inventory to Tier-1 cloud accounts"
            ],
            "financial_exposure": "$630.00M Week 6 risk, 14.5% margin drop",
            "recommended_supplier": "Samsung Austin (Texas, USA)",
            "compliance_deadline": "Notify insurer by Jan 22 (72 hours)"
        }
    },
    "rotterdam": {
        "event_intelligence": {
            "event_type": "port_strike",
            "severity": "HIGH",
            "location": "Rotterdam, Netherlands",
            "affected_industries": ["logistics", "industrial"],
            "estimated_duration_weeks": 4,
            "summary": "Port of Rotterdam dockworkers declare indefinite strike, disrupting European logistics routing."
        },
        "supplier_impact": {
            "affected_tier1": 2,
            "affected_tier2": 4,
            "critical_path_suppliers": ["Rotterdam Euro-Gateway"],
            "affected_components": ["European Logistics Routing"],
            "inventory_buffer_days": 15,
            "severity": "HIGH"
        },
        "supplier_impact_flags": ["Logistics gateway strike! Remaining supply buffer (15) < 21"],
        "financial_exposure": {
            "week1_risk_usd": 5000000,
            "week3_risk_usd": 25000000,
            "week6_risk_usd": 120000000,
            "revenue_at_risk_products": ["Global Trade Logistics Revenue"],
            "margin_impact_pct": 4.2
        },
        "regulatory_trade": {
            "force_majeure_applicable": True,
            "insurer_notify_deadline_hours": 48,
            "export_controls": ["None"],
            "tariff_implications": "minor",
            "compliance_actions": [
                "File Force Majeure notice with Rotterdam logistics union",
                "Reroute cargo manifests to Antwerp port system within 48h"
            ]
        },
        "alt_sourcing": {
            "alternatives": [
                {
                    "supplier": "Port of Antwerp (Belgium)",
                    "components_covered": ["European Logistics Routing"],
                    "cost_delta_pct": 20.0,
                    "lead_time_days": 4,
                    "risk_level": "MEDIUM",
                    "regulatory_flags": ["Subject to EU overflow congestion regulations"]
                },
                {
                    "supplier": "Port of Hamburg (Germany)",
                    "components_covered": ["European Logistics Routing"],
                    "cost_delta_pct": 25.0,
                    "lead_time_days": 5,
                    "risk_level": "LOW",
                    "regulatory_flags": []
                }
            ],
            "recommended": "Port of Antwerp (Belgium)",
            "recommendation_reason": "Lowest lead-time delta bypassing direct strike disruption."
        },
        "coordinator_brief": {
            "situation_summary": "Indefinite dockworker strike at Port of Rotterdam has halted European logistics routing. Supply buffer is 15 days, presenting high risk to European cargo with $120M at risk by week 6.",
            "severity": "HIGH",
            "verdict": "ESCALATE_TO_HUMAN",
            "top_3_actions": [
                "Reroute incoming shipments to Port of Antwerp within 48h",
                "Invoke cargo insurance FM notifications before the 48h deadline",
                "Notify European customers of potential 5-day delivery shifts"
            ],
            "financial_exposure": "$120.00M Week 6 risk, 4.2% margin drop",
            "recommended_supplier": "Port of Antwerp (Belgium)",
            "compliance_deadline": "Notify insurer by Jan 21 (48 hours)"
        }
    },
    "tariff": {
        "event_intelligence": {
            "event_type": "tariff",
            "severity": "HIGH",
            "location": "Washington DC, USA",
            "affected_industries": ["semiconductor", "automotive"],
            "estimated_duration_weeks": 24,
            "summary": "New 40% tariff imposed on semiconductor components imported from China, effective immediately."
        },
        "supplier_impact": {
            "affected_tier1": 3,
            "affected_tier2": 5,
            "critical_path_suppliers": ["Foxconn Shenzhen"],
            "affected_components": ["Server Motherboards"],
            "inventory_buffer_days": 18,
            "severity": "HIGH"
        },
        "supplier_impact_flags": ["Multiple Tier-1 suppliers affected! Supply buffer (18) < 21"],
        "financial_exposure": {
            "week1_risk_usd": 8000000,
            "week3_risk_usd": 54000000,
            "week6_risk_usd": 340000000,
            "revenue_at_risk_products": ["Enterprise AI Server Clusters"],
            "margin_impact_pct": 6.8
        },
        "regulatory_trade": {
            "force_majeure_applicable": False,
            "insurer_notify_deadline_hours": 120,
            "export_controls": ["Section 301"],
            "tariff_implications": "major",
            "compliance_actions": [
                "File tariff exclusion request with USTR",
                "Reclassify Motherboard import tariff codes under US-HTS regulations"
            ]
        },
        "alt_sourcing": {
            "alternatives": [
                {
                    "supplier": "Samsung Austin (Texas, USA)",
                    "components_covered": ["Server Motherboards"],
                    "cost_delta_pct": 18.0,
                    "lead_time_days": 12,
                    "risk_level": "LOW",
                    "regulatory_flags": ["US Domestic Fab - Safe Regulatory Profile"]
                }
            ],
            "recommended": "Samsung Austin (Texas, USA)",
            "recommendation_reason": "Bypasses Section 301 China tariffs with domestic safe profile."
        },
        "coordinator_brief": {
            "situation_summary": "New 40% import tariff on Chinese semiconductor components threatens Motherboard supply. Supply buffer is 18 days, with $340M exposure by week 6.",
            "severity": "HIGH",
            "verdict": "AUTO_RESOLVE",
            "top_3_actions": [
                "Reroute Motherboard assembly contracts to Samsung Austin within 72h",
                "File HTS code reclassification paperwork with US Customs",
                "Submit tariff exclusion applications to USTR before deadline"
            ],
            "financial_exposure": "$340.00M Week 6 risk, 6.8% margin drop",
            "recommended_supplier": "Samsung Austin (Texas, USA)",
            "compliance_deadline": "File customs review by Jan 24"
        }
    }
}

async def simulate_mock_pipeline(case_id: str, event_text: str):
    """Simulates agent pipeline step-by-step in mock mode."""
    logger.info(f"Starting mock agent simulation for {case_id}")
    
    # Infer scenario type
    ev_lower = event_text.lower()
    if "taiwan" in ev_lower or "earthquake" in ev_lower:
        scenario = "taiwan"
    elif "rotterdam" in ev_lower or "strike" in ev_lower:
        scenario = "rotterdam"
    elif "tariff" in ev_lower or "china" in ev_lower:
        scenario = "tariff"
    else:
        scenario = "taiwan"  # default fallback
        
    data = MOCK_DISRUPTIONS[scenario]
    
    # Helper to construct envelope
    def make_envelope(agent: str, status: str, findings: dict, phase: str = None, flags: list = None, confidence: str = "HIGH") -> dict:
        env = {
            "agent": agent,
            "case_id": case_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": status,
            "findings": findings,
            "confidence": confidence,
            "flags": flags or []
        }
        if phase:
            env["phase"] = phase
        return env

    await asyncio.sleep(2)
    
    # 1. Coordinator Kickoff
    MOCK_ROOM_MESSAGES[case_id].append({
        "content": json.dumps({
            "agent": "coordinator",
            "case_id": case_id,
            "phase": "kickoff",
            "event_text": event_text,
            "instruction": "All specialist agents: analyze this event and post your findings",
            "agents_required": ["event_intelligence", "supplier_impact", "financial_exposure", "regulatory_trade", "alt_sourcing"]
        }),
        "inserted_at": datetime.now(timezone.utc).isoformat()
    })
    logger.info(f"Simulated Coordinator Kickoff for {case_id}")
    await asyncio.sleep(3)

    # 2. Event Intelligence
    MOCK_ROOM_MESSAGES[case_id].append({
        "content": json.dumps(make_envelope(
            agent="event_intelligence",
            status="complete",
            findings=data["event_intelligence"]
        )),
        "inserted_at": datetime.now(timezone.utc).isoformat()
    })
    logger.info(f"Simulated Event Intelligence for {case_id}")
    await asyncio.sleep(3)

    # 3. Supplier Impact
    MOCK_ROOM_MESSAGES[case_id].append({
        "content": json.dumps(make_envelope(
            agent="supplier_impact",
            status="complete",
            findings=data["supplier_impact"],
            flags=data.get("supplier_impact_flags", [])
        )),
        "inserted_at": datetime.now(timezone.utc).isoformat()
    })
    logger.info(f"Simulated Supplier Impact for {case_id}")
    await asyncio.sleep(3)

    # 4. Financial Exposure & Regulatory (Parallel)
    MOCK_ROOM_MESSAGES[case_id].append({
        "content": json.dumps(make_envelope(
            agent="financial_exposure",
            status="complete",
            findings=data["financial_exposure"]
        )),
        "inserted_at": datetime.now(timezone.utc).isoformat()
    })
    MOCK_ROOM_MESSAGES[case_id].append({
        "content": json.dumps(make_envelope(
            agent="regulatory_trade",
            status="complete",
            findings=data["regulatory_trade"]
        )),
        "inserted_at": datetime.now(timezone.utc).isoformat()
    })
    logger.info(f"Simulated Finance & Regulatory for {case_id}")
    await asyncio.sleep(3)

    # 5. Alternative Sourcing
    MOCK_ROOM_MESSAGES[case_id].append({
        "content": json.dumps(make_envelope(
            agent="alt_sourcing",
            status="complete",
            findings=data["alt_sourcing"]
        )),
        "inserted_at": datetime.now(timezone.utc).isoformat()
    })
    logger.info(f"Simulated Alt Sourcing for {case_id}")
    await asyncio.sleep(3)

    # 6. Coordinator Executive Brief
    MOCK_ROOM_MESSAGES[case_id].append({
        "content": json.dumps({
            "agent": "coordinator",
            "case_id": case_id,
            "phase": "executive_brief",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "complete",
            "findings": data["coordinator_brief"],
            "confidence": "HIGH",
            "flags": []
        }),
        "inserted_at": datetime.now(timezone.utc).isoformat()
    })
    logger.info(f"Simulated Coordinator brief for {case_id}")

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Liveness check — also verifies Band API key resolves a room if in prod."""
    if MOCK_MODE:
        return {
            "status": "ok",
            "mode": "MOCK_DEMO",
            "band_room_id": "MOCK_ROOM_ID",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
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
    """
    case_id = req.case_id or f"CASE-{int(datetime.now(timezone.utc).timestamp())}"

    if MOCK_MODE:
        MOCK_ROOM_MESSAGES[case_id] = [
            {
                "content": json.dumps({
                    "agent": "human_operator",
                    "case_id": case_id,
                    "event_text": req.event_text,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }),
                "inserted_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        ACTIVE_CASES[case_id] = {
            "status": "investigating",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "event_text": req.event_text,
        }
        # Start mock simulation in the background
        asyncio.create_task(simulate_mock_pipeline(case_id, req.event_text))
        return {
            "case_id": case_id,
            "status": "investigation_started",
            "room_id": "MOCK_ROOM_ID",
            "mentioned_agent": "coordinator",
            "mode": "MOCK_DEMO"
        }

    async with httpx.AsyncClient() as client:
        room_id = await _get_room_id(client)
        participants = await _fetch_participants(client, room_id)

        mention = None
        for p in participants:
            handle = p.get("handle", "")
            pid = p.get("id", "")
            if "coordinator" in handle.lower() and p.get("type") == "Agent":
                mention = {"id": pid, "handle": handle}
                break

        if not mention:
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
    """Fetch messages from the Band room context (or mock storage)."""
    if MOCK_MODE:
        enriched = []
        if case_id and case_id in MOCK_ROOM_MESSAGES:
            for m in MOCK_ROOM_MESSAGES[case_id]:
                parsed = _parse_agent_message(m)
                enriched.append({**m, "parsed": parsed, "inserted_at": m.get("inserted_at")})
        return {
            "case_id": case_id,
            "room_id": "MOCK_ROOM_ID",
            "message_count": len(enriched),
            "messages": enriched,
            "mode": "MOCK_DEMO"
        }

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
    """Checks the status of the investigation case (all 6 agents posted or pending)."""
    if MOCK_MODE:
        messages = []
        if case_id in MOCK_ROOM_MESSAGES:
            messages = MOCK_ROOM_MESSAGES[case_id]
    else:
        async with httpx.AsyncClient() as client:
            room_id = await _get_room_id(client)
            messages = await _fetch_messages(client, room_id)

    agents_posted: dict[str, dict] = {}

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

    verdict = None
    severity = None
    if brief_done:
        brief = agents_posted["coordinator_brief"]
        verdict = brief.get("verdict")
        severity = brief.get("severity")

    pending = sorted(
        (EXPECTED_AGENTS - set(agents_posted.keys())) - {"coordinator_kickoff"}
    )

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
    """Record a human investigator's approval or escalation decision for a case."""
    if req.case_id not in ACTIVE_CASES:
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