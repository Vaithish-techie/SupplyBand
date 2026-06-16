#!/usr/bin/env python3
"""
monitor.py — Poll the Band room for a given case_id and validate
all 6 agent messages against the schema defined in SCHEMA.md.

Usage:
    python monitor.py [case_id]         # poll until all 6 agents fire or timeout
    python monitor.py [case_id] --dump  # dump all raw messages for the case_id
"""

import asyncio
import sys
import json
import os
import re
import yaml
import httpx
from datetime import datetime, timezone

BAND_REST_URL = "https://app.band.ai"
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "agent_config.yaml")

AGENT_ORDER = [
    "coordinator",          # phase: kickoff
    "event_intelligence",
    "supplier_impact",
    "financial_exposure",
    "regulatory_trade",
    "alt_sourcing",
    "coordinator",          # phase: executive_brief
]

REQUIRED_AGENTS = ["event_intelligence", "supplier_impact", "financial_exposure", "regulatory_trade", "alt_sourcing"]

SCHEMA = {
    "event_intelligence": {
        "required_finding_keys": ["event_type", "severity", "location", "affected_industries", "estimated_duration_weeks", "summary"],
        "valid_statuses": ["complete", "escalate", "insufficient_data"],
    },
    "supplier_impact": {
        "required_finding_keys": ["affected_tier1", "affected_tier2", "critical_path_suppliers", "affected_components", "inventory_buffer_days", "severity"],
        "valid_statuses": ["complete", "escalate", "insufficient_data"],
    },
    "financial_exposure": {
        "required_finding_keys": ["week1_risk_usd", "week3_risk_usd", "week6_risk_usd", "revenue_at_risk_products", "margin_impact_pct"],
        "valid_statuses": ["complete", "escalate", "insufficient_data"],
    },
    "regulatory_trade": {
        "required_finding_keys": ["force_majeure_applicable", "insurer_notify_deadline_hours", "export_controls", "tariff_implications", "compliance_actions"],
        "valid_statuses": ["complete", "escalate", "insufficient_data"],
    },
    "alt_sourcing": {
        "required_finding_keys": ["alternatives", "recommended", "recommendation_reason"],
        "valid_statuses": ["complete", "escalate", "insufficient_data"],
    },
}

SEVERITY_VALUES = {"CRITICAL", "HIGH", "MEDIUM", "LOW"}
CONFIDENCE_VALUES = {"HIGH", "MEDIUM", "LOW"}
VERDICT_VALUES = {"ESCALATE_TO_HUMAN", "AUTO_RESOLVE"}

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def load_api_key():
    with open(CONFIG_PATH) as f:
        config = yaml.safe_load(f)
    return config["coordinator"]["api_key"]

async def fetch_messages(client, api_key, room_id):
    resp = await client.get(
        f"{BAND_REST_URL}/api/v1/agent/chats/{room_id}/context",
        headers={"x-api-key": api_key},
        params={"page": 1, "page_size": 100},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("data", data.get("messages", data if isinstance(data, list) else []))

async def fetch_room_id(client, api_key):
    resp = await client.get(
        f"{BAND_REST_URL}/api/v1/agent/chats",
        headers={"x-api-key": api_key},
        params={"page": 1, "page_size": 100},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    chats = data.get("chats", data.get("data", data if isinstance(data, list) else []))
    if not chats:
        raise RuntimeError("No Band rooms found for this API key.")
    return chats[0]["id"]

_BAND_MENTION_RE = re.compile(r"@\[\[[^\]]+\]\]\s*")

def parse_message(raw_msg):
    content = raw_msg.get("content", "")
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

def validate_envelope(data, agent_name):
    errors = []
    # Top-level required keys
    for key in ["agent", "case_id", "timestamp", "status", "findings", "confidence", "flags"]:
        if key not in data:
            errors.append(f"Missing top-level key: '{key}'")

    # Status value
    status = data.get("status")
    schema = SCHEMA.get(agent_name, {})
    valid_statuses = schema.get("valid_statuses", ["complete", "escalate", "insufficient_data"])
    if status not in valid_statuses:
        errors.append(f"Invalid status: '{status}' (expected one of {valid_statuses})")

    # Confidence value
    confidence = data.get("confidence")
    if confidence not in CONFIDENCE_VALUES:
        errors.append(f"Invalid confidence: '{confidence}' (expected HIGH/MEDIUM/LOW)")

    # flags must be a list
    if "flags" in data and not isinstance(data["flags"], list):
        errors.append("'flags' must be a list")

    # findings keys
    findings = data.get("findings", {})
    if status == "complete":
        for key in schema.get("required_finding_keys", []):
            if key not in findings:
                errors.append(f"findings missing required key: '{key}'")
        # Type checks for common fields
        if "severity" in findings and findings["severity"] not in SEVERITY_VALUES:
            errors.append(f"findings.severity invalid: '{findings['severity']}'")

    # ISO8601 timestamp check (basic)
    ts = data.get("timestamp", "")
    try:
        datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        errors.append(f"Invalid ISO8601 timestamp: '{ts}'")

    return errors

def validate_coordinator_brief(data):
    errors = []
    for key in ["situation_summary", "severity", "verdict", "top_3_actions", "financial_exposure", "recommended_supplier", "compliance_deadline"]:
        if key not in data:
            errors.append(f"executive_brief missing key: '{key}'")
    verdict = data.get("verdict")
    if verdict not in VERDICT_VALUES:
        errors.append(f"Invalid verdict: '{verdict}'")
    severity = data.get("severity")
    if severity not in SEVERITY_VALUES:
        errors.append(f"Invalid severity: '{severity}'")
    actions = data.get("top_3_actions", [])
    if not isinstance(actions, list) or len(actions) == 0:
        errors.append("'top_3_actions' must be a non-empty list")
    return errors

def summarize_agent(data, agent_name, case_id):
    lines = []
    msg_agent = data.get("agent", "unknown")
    msg_case  = data.get("case_id", "?")
    status    = data.get("status", "?")
    confidence = data.get("confidence", "?")
    flags = data.get("flags", [])
    findings = data.get("findings", {})

    # Case ID mismatch
    case_match = msg_case == case_id
    cm_flag = f"{GREEN}✓{RESET}" if case_match else f"{RED}✗ CASE_ID MISMATCH (got {msg_case}){RESET}"

    lines.append(f"  Agent:      {BOLD}{msg_agent}{RESET}")
    lines.append(f"  Case ID:    {msg_case}  {cm_flag}")
    lines.append(f"  Status:     {status}")
    lines.append(f"  Confidence: {confidence}")

    # Schema validation
    errors = validate_envelope(data, agent_name)
    if errors:
        lines.append(f"  {RED}Schema errors:{RESET}")
        for e in errors:
            lines.append(f"    {RED}✗ {e}{RESET}")
    else:
        lines.append(f"  {GREEN}✓ Schema valid{RESET}")

    if flags:
        lines.append(f"  {YELLOW}Flags:{RESET}")
        for f in flags:
            lines.append(f"    - {f}")

    # Key findings summary
    if findings and status == "complete":
        lines.append(f"  Key findings:")
        for k, v in list(findings.items())[:6]:
            lines.append(f"    {k}: {v}")

    return "\n".join(lines)

async def monitor(case_id, dump_raw=False, poll_timeout_sec=90, poll_interval_sec=3):
    api_key = load_api_key()

    print(f"\n{BOLD}{CYAN}=== Monitor: Watching case_id={case_id} ==={RESET}")
    print(f"Polling Band REST API every {poll_interval_sec}s, timeout={poll_timeout_sec}s\n")

    deadline = asyncio.get_event_loop().time() + poll_timeout_sec

    async with httpx.AsyncClient() as client:
        room_id = await fetch_room_id(client, api_key)
        print(f"Room ID: {room_id}\n")

        seen_agents = {}   # agent_name -> parsed data (latest)
        coordinator_brief = None

        while asyncio.get_event_loop().time() < deadline:
            messages = await fetch_messages(client, api_key, room_id)

            for raw in messages:
                data = parse_message(raw)
                if data is None:
                    continue
                if data.get("case_id") != case_id:
                    continue

                agent = data.get("agent")
                phase = data.get("phase")

                if agent == "coordinator":
                    if phase == "kickoff":
                        if "coordinator_kickoff" not in seen_agents:
                            seen_agents["coordinator_kickoff"] = data
                    elif phase == "executive_brief":
                        coordinator_brief = data
                        seen_agents["coordinator_brief"] = data
                elif agent in REQUIRED_AGENTS:
                    seen_agents[agent] = data

            # Print current progress
            all_specialists = all(a in seen_agents for a in REQUIRED_AGENTS)
            brief_done = "coordinator_brief" in seen_agents

            print(f"\r[{datetime.now().strftime('%H:%M:%S')}] Agents seen: {sorted(seen_agents.keys())}   ", end="", flush=True)

            if all_specialists and brief_done:
                break

            await asyncio.sleep(poll_interval_sec)

        print("\n")

        # ------ REPORT ------
        print(f"{BOLD}{'='*60}{RESET}")
        print(f"{BOLD}VERIFICATION REPORT — case_id: {case_id}{RESET}")
        print(f"{BOLD}{'='*60}{RESET}\n")

        # 1. Coordinator kickoff
        if "coordinator_kickoff" in seen_agents:
            print(f"{GREEN}[1] Coordinator KICKOFF{RESET}")
            d = seen_agents["coordinator_kickoff"]
            print(f"  event_text: {str(d.get('event_text',''))[:80]}...")
            agents_required = d.get("agents_required", [])
            missing = [a for a in REQUIRED_AGENTS if a not in agents_required]
            if missing:
                print(f"  {YELLOW}⚠ agents_required is missing: {missing}{RESET}")
            else:
                print(f"  {GREEN}✓ agents_required includes all 5 specialists{RESET}")
        else:
            print(f"{RED}[1] Coordinator KICKOFF — NOT FOUND{RESET}")

        print()

        # 2-6. Specialists in order
        specialist_order = ["event_intelligence", "supplier_impact", "financial_exposure", "regulatory_trade", "alt_sourcing"]
        labels = {
            "event_intelligence": "[2] Event Intelligence",
            "supplier_impact":    "[3] Supplier Impact",
            "financial_exposure": "[4] Financial Exposure",
            "regulatory_trade":   "[5] Regulatory & Trade",
            "alt_sourcing":       "[6] Alt Sourcing",
        }
        for idx, agent in enumerate(specialist_order):
            label = labels[agent]
            if agent in seen_agents:
                status_color = GREEN if seen_agents[agent].get("status") == "complete" else YELLOW
                print(f"{status_color}{label} — {seen_agents[agent].get('status','?').upper()}{RESET}")
                print(summarize_agent(seen_agents[agent], agent, case_id))
            else:
                print(f"{RED}{label} — DID NOT FIRE{RESET}")
            print()

        # 7. Coordinator executive brief
        if coordinator_brief:
            print(f"{GREEN}[7] Coordinator EXECUTIVE BRIEF{RESET}")
            errs = validate_coordinator_brief(coordinator_brief)
            if errs:
                for e in errs:
                    print(f"  {RED}✗ {e}{RESET}")
            else:
                print(f"  {GREEN}✓ Schema valid{RESET}")
            print(f"  Verdict:   {BOLD}{coordinator_brief.get('verdict','?')}{RESET}")
            print(f"  Severity:  {coordinator_brief.get('severity','?')}")
            print(f"  Summary:   {coordinator_brief.get('situation_summary','')[:120]}")
            print(f"  Actions:   {coordinator_brief.get('top_3_actions', [])}")
        else:
            print(f"{RED}[7] Coordinator EXECUTIVE BRIEF — DID NOT FIRE (all 5 specialists must post first){RESET}")

        print(f"\n{BOLD}{'='*60}{RESET}")

        # Raw dump mode
        if dump_raw:
            print(f"\n{BOLD}--- RAW MESSAGES FOR {case_id} ---{RESET}")
            messages = await fetch_messages(client, api_key, room_id)
            for raw in messages:
                data = parse_message(raw)
                if data and data.get("case_id") == case_id:
                    print(json.dumps(data, indent=2))
                    print("---")

if __name__ == "__main__":
    args = sys.argv[1:]
    dump = "--dump" in args
    args = [a for a in args if not a.startswith("--")]

    if not args:
        print("Usage: python monitor.py <case_id> [--dump]")
        sys.exit(1)

    case_id = args[0]
    asyncio.run(monitor(case_id, dump_raw=dump))
