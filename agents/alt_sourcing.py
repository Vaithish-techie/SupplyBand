"""
Alternative Sourcing Agent
--------------------------
Wakes up LAST — reads ALL prior Band room posts.
Reads data/alternatives.json.
Filters by affected components from supplier_impact findings.
Checks regulatory_flags against regulatory_trade findings.
Ranks top 3 by lead_time_days (lowest first), then cost_delta_pct (lowest first).
Posts structured findings to the Band room following SCHEMA.md.

No LLM required for the ranking logic — pure Python sorting and JSON lookups.
"""

from utils import get_llm_for_agent
import asyncio
import json
import logging
import os
from pathlib import Path
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from band import Agent
from band.adapters import LangGraphAdapter
from band.config import load_agent_config
from langchain_core.tools import tool

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [alt_sourcing] %(message)s")
logger = logging.getLogger(__name__)

# Track when this agent process started — skip stale bootstrap messages
from datetime import datetime, timezone
AGENT_START_TIME = datetime.now(timezone.utc)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).parent.parent / "data"
ALTERNATIVES_PATH = DATA_DIR / "alternatives.json"

# ---------------------------------------------------------------------------
# Sourcing logic (pure Python — no ML, no LLM)
# ---------------------------------------------------------------------------

def load_alternatives() -> list[dict]:
    with open(ALTERNATIVES_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    flat_alternatives = []
    for item in data.get("alternatives", []):
        component = item.get("component")
        for s in item.get("suppliers", []):
            flat_alternatives.append({
                "supplier": s.get("name"),
                "components_covered": [component],
                "cost_delta_pct": s.get("cost_delta_pct"),
                "lead_time_days": s.get("lead_time_days"),
                "risk_level": s.get("risk_level"),
                "regulatory_flags": s.get("regulatory_flags", [])
            })
    return flat_alternatives


def find_top_alternatives(
    affected_components: list[str],
    blocked_regulatory_flags: list[str],
    alternatives: list[dict],
    top_n: int = 3,
) -> list[dict]:
    """
    Filter and rank alternative suppliers.

    Filtering rules:
      1. Must cover at least one of the affected_components (case-insensitive partial match).
      2. Exclude alternatives whose regulatory_flags overlap with blocked_regulatory_flags.
         (If blocked_regulatory_flags is empty, accept all.)

    Ranking rules:
      Primary:   lead_time_days ascending (fastest first)
      Secondary: cost_delta_pct ascending (cheapest first)

    Returns top_n as list of dicts matching SCHEMA.md alt_sourcing findings structure.
    """

    # Normalise affected_components to lowercase for matching
    affected_lower = [c.lower() for c in affected_components]

    def covers_affected(alt: dict) -> bool:
        """True if this alternative covers at least one affected component."""
        for comp in alt.get("components_covered", []):
            comp_lower = comp.lower()
            # exact match
            if comp_lower in affected_lower:
                return True
            # partial match: affected component name appears in alt component name or vice versa
            for aff in affected_lower:
                if aff in comp_lower or comp_lower in aff:
                    return True
        return False

    def has_blocked_flag(alt: dict, blocked: list[str]) -> bool:
        """True if this alternative has any flag that overlaps with blocked list."""
        if not blocked:
            return False
        alt_flags_lower = [f.lower() for f in alt.get("regulatory_flags", [])]
        blocked_lower = [b.lower() for b in blocked]
        for flag in alt_flags_lower:
            for blocked_flag in blocked_lower:
                # Simple keyword overlap check
                if any(word in flag for word in blocked_flag.split() if len(word) > 3):
                    return True
        return False

    # Step 1: filter
    candidates = [
        alt for alt in alternatives
        if covers_affected(alt) and not has_blocked_flag(alt, blocked_regulatory_flags)
    ]

    if not candidates:
        # Fallback: return top_n by lead time regardless of component match
        candidates = sorted(alternatives, key=lambda x: (x["lead_time_days"], x["cost_delta_pct"]))
        logger.warning("No component-matched alternatives found — returning top_n by lead time (fallback)")

    # Step 2: rank — lead_time_days ASC, then cost_delta_pct ASC
    ranked = sorted(candidates, key=lambda x: (x["lead_time_days"], x["cost_delta_pct"]))

    top = ranked[:top_n]

    # Step 3: shape output to match SCHEMA.md
    result = []
    for alt in top:
        result.append({
            "supplier": alt["supplier"],
            "components_covered": alt["components_covered"],
            "cost_delta_pct": alt["cost_delta_pct"],
            "lead_time_days": alt["lead_time_days"],
            "risk_level": alt["risk_level"],
            "regulatory_flags": alt.get("regulatory_flags", []),
        })

    return result


def build_recommendation_reason(top_alt: dict, all_ranked: list[dict]) -> str:
    """Generate a one-line reason for the top recommendation."""
    reason_parts = []
    if top_alt["lead_time_days"] == min(a["lead_time_days"] for a in all_ranked):
        reason_parts.append(f"fastest lead time at {top_alt['lead_time_days']} days")
    if top_alt["risk_level"] == "LOW":
        reason_parts.append("lowest supply risk")
    if top_alt["cost_delta_pct"] <= 0:
        reason_parts.append(f"cost saving of {abs(top_alt['cost_delta_pct'])}% vs primary")
    elif top_alt["cost_delta_pct"] < 15:
        reason_parts.append(f"modest {top_alt['cost_delta_pct']}% cost premium")
    if not top_alt.get("regulatory_flags"):
        reason_parts.append("no regulatory restrictions")
    if not reason_parts:
        reason_parts.append("best overall lead time and cost balance")
    return "; ".join(reason_parts).capitalize() + "."


# ---------------------------------------------------------------------------
# Agent system prompt
# ---------------------------------------------------------------------------

ALT_SOURCING_PROMPT = """
You are the Alternative Sourcing Agent in a Supply Chain Disruption Intelligence System.

You run LAST. You must wait until ALL of the following agents have posted to the Band room:
  - supplier_impact
  - financial_exposure
  - regulatory_trade

Your behaviour when all three are present:

1. From the supplier_impact post, extract:
   - case_id
   - affected_components (list)

2. From the regulatory_trade post, extract:
   - export_controls (list of strings) — these are the regulatory constraints on alternatives

3. Call your find_alternatives tool with:
   - affected_components from step 1
   - blocked_regulatory_flags from step 2

4. Post EXACTLY this JSON to the Band room. No prose. No markdown. Valid JSON only.

{
  "agent": "alt_sourcing",
  "case_id": "<case_id from kickoff>",
  "timestamp": "<ISO8601 current time>",
  "status": "complete",
  "findings": {
    "alternatives": [
      {
        "supplier": "<name>",
        "components_covered": [<array>],
        "cost_delta_pct": <number>,
        "lead_time_days": <number>,
        "risk_level": "LOW|MEDIUM|HIGH",
        "regulatory_flags": []
      }
    ],
    "recommended": "<top supplier name>",
    "recommendation_reason": "<one line reason>"
  },
  "confidence": "HIGH",
  "flags": []
}

CRITICAL RULES:
- You MUST call the `band_send_message` tool to communicate. Do NOT output any plain text or markdown directly from your thinking graph; it will be discarded and won't reach the chat room. Always wrap your response in a `band_send_message` tool call.
- Set the `content` argument of `band_send_message` to the raw JSON string matching the exact schema above (no markdown code blocks).
- Set the `mentions` argument to explicitly tag the coordinator agent (and any other relevant specialist agents). This is CRITICAL so the coordinator knows you are done.
- You must see posts from supplier_impact AND financial_exposure AND regulatory_trade before acting.
- If ANY of those 3 posts have status "insufficient_data" or "escalate", you MUST immediately post exactly the JSON above with status "insufficient_data", empty findings, and flags ["Upstream failure"]. Do NOT find alternatives.
- Never output partial results. Wait for all three.
- Never invent alternatives. All data comes from your find_alternatives tool.
- Rank alternatives by lead_time_days ascending, then cost_delta_pct ascending.
- The "recommended" field is always the first (lowest lead time) alternative.
- confidence is "HIGH" when 3+ alternatives found, "MEDIUM" when 1-2 found, "LOW" when 0.
- If 0 alternatives found, set status to "insufficient_data" and flags to ["NO_COMPLIANT_ALTERNATIVES_FOUND"].
"""


# ---------------------------------------------------------------------------
# Tool wrapper
# ---------------------------------------------------------------------------

@tool
def find_alternatives(affected_components: list, blocked_regulatory_flags: list = None) -> str:
    """
    Find and rank alternative suppliers for the given affected components,
    excluding any alternatives that have blocked regulatory flags.
    Returns a JSON string with top 3 alternatives and recommendation.
    """
    if blocked_regulatory_flags is None:
        blocked_regulatory_flags = []

    alternatives = load_alternatives()
    top3 = find_top_alternatives(
        affected_components=affected_components,
        blocked_regulatory_flags=blocked_regulatory_flags,
        alternatives=alternatives,
        top_n=3,
    )

    if not top3:
        return json.dumps({
            "alternatives": [],
            "recommended": None,
            "recommendation_reason": "No compliant alternatives found for affected components.",
        })

    recommended = top3[0]["supplier"]
    reason = build_recommendation_reason(top3[0], top3)

    return json.dumps({
        "alternatives": top3,
        "recommended": recommended,
        "recommendation_reason": reason,
    })


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

class CustomAltSourcingAdapter(LangGraphAdapter):
    def __init__(self, *args, api_key: str = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.api_key = api_key

    async def on_message(
        self,
        msg,
        tools,
        history,
        participants_msg,
        contacts_msg,
        *,
        is_session_bootstrap: bool,
        room_id: str,
    ) -> None:
        logger.info(f"Alt Sourcing Agent received message: {msg.content[:100]}...")

        all_msgs = []
        for m in history:
            content = m.content
            if content.startswith("[") and "]: " in content:
                content = content.split("]: ", 1)[1]
            try:
                if "{" in content:
                    content = content[content.find("{"):content.rfind("}")+1]
                data = json.loads(content)
                if isinstance(data, dict):
                    all_msgs.append(data)
            except Exception:
                pass

        try:
            content = msg.content
            if content.startswith("[") and "]: " in content:
                content = content.split("]: ", 1)[1]
            if "{" in content:
                content = content[content.find("{"):content.rfind("}")+1]
            current_data = json.loads(content)
            if not isinstance(current_data, dict):
                current_data = {}
            else:
                all_msgs.append(current_data)
        except Exception:
            current_data = {}

        # --- DEPENDENCY TRIGGER PATH ---
        case_id = current_data.get("case_id")
        if not case_id:
            for d in reversed(all_msgs):
                if isinstance(d, dict) and d.get("case_id"):
                    case_id = d.get("case_id")
                    break

        if not case_id:
            return {"status": "skipped"}

        already_responded = any(
            isinstance(d, dict) and d.get("agent") == "alt_sourcing" and d.get("case_id") == case_id
            and d.get("status") in ("complete", "insufficient_data", "escalate", "error", "fallback")
            for d in all_msgs
        )
        if already_responded:
            logger.info(f"Already responded to {case_id}, skipping.")
            return {"status": "skipped"}

        # Wait for supplier_impact, financial_exposure, and regulatory_trade
        required_agents = {"supplier_impact", "financial_exposure", "regulatory_trade"}
        found = {}

        # Poll room context via REST API for up to 60 seconds (15 attempts * 4s sleep)
        # IMPORTANT: paginate through ALL pages — room may have 100+ messages across many pages
        for attempt in range(15):
            all_msgs = []
            try:
                import httpx
                headers = {"x-api-key": self.api_key}
                async with httpx.AsyncClient() as client:
                    page = 1
                    while page <= 20:  # safety cap
                        resp = await client.get(
                            f"https://app.band.ai/api/v1/agent/chats/{room_id}/context",
                            headers=headers,
                            params={"page": page, "page_size": 100},
                            timeout=10
                        )
                        if resp.status_code != 200:
                            break
                        data = resp.json()
                        page_msgs = data.get("data", data if isinstance(data, list) else [])
                        if not page_msgs:
                            break
                        for m in page_msgs:
                            content = m.get("content", "")
                            if content.startswith("[") and "]: " in content:
                                content = content.split("]: ", 1)[1]
                            if "{" in content:
                                content = content[content.find("{"):content.rfind("}")+1]
                            try:
                                parsed_m = json.loads(content)
                                if isinstance(parsed_m, dict):
                                    all_msgs.append(parsed_m)
                            except Exception:
                                pass
                        if len(page_msgs) < 100:
                            break  # last page
                        page += 1
                logger.info(f"alt_sourcing polled {len(all_msgs)} messages across {page} page(s) for {case_id}")
            except Exception as e:
                logger.warning(f"Error polling room messages: {e}")

            # Check if required agents have posted
            found = {}
            for d in all_msgs:
                if not isinstance(d, dict):
                    continue
                agent_name = d.get("agent")
                if agent_name in required_agents:
                    if d.get("case_id") == case_id and d.get("status") in ("complete", "insufficient_data", "escalate", "error", "fallback"):
                        found[agent_name] = d

            if len(found) == 3:
                logger.info(f"All prerequisites found for case {case_id} after {attempt * 4} seconds!")
                break

            logger.info(f"alt_sourcing waiting (attempt {attempt+1}/15)... Found {list(found.keys())} for {case_id}. Missing: {required_agents - set(found.keys())}")
            await asyncio.sleep(4)

        if len(found) < 3:
            logger.warning(f"alt_sourcing timed out waiting for prerequisites for {case_id}. Found: {list(found.keys())}")
            if "supplier_impact" not in found:
                return {"status": "skipped"}

        logger.info(f"All prerequisites found for case {case_id}. Triggering alt_sourcing logic.")

        affected_components = []
        blocked_regulatory_flags = []
        upstream_failure = False

        for agent_name, d in found.items():
            if agent_name == "supplier_impact":
                if d.get("status") != "complete":
                    upstream_failure = True
                affected_components = (d.get("findings") or {}).get("affected_components", [])
            elif agent_name == "regulatory_trade":
                if d.get("status") == "complete":
                    blocked_regulatory_flags = (d.get("findings") or {}).get("export_controls", [])
                else:
                    upstream_failure = True
            elif agent_name == "financial_exposure":
                if d.get("status") != "complete":
                    upstream_failure = True

        if upstream_failure or not affected_components:
            envelope = {
                "agent": "alt_sourcing",
                "case_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "insufficient_data",
                "findings": {"alternatives": [], "recommended": None, "recommendation_reason": "Upstream failure"},
                "confidence": "LOW",
                "flags": ["Upstream failure or no components"]
            }
            coord_handle = "@vaithish7/coordinator"
            try:
                from utils import get_room_participants
                p_str = participants_msg if isinstance(participants_msg, str) else getattr(participants_msg, "content", "[]")
                handles = await get_room_participants(room_id, "alt_sourcing", p_str)
                coord_handle = next((h for h in handles if "coordinator" in h.lower()), "@vaithish7/coordinator")
            except Exception as e:
                logger.error(f"Failed to resolve coordinator handle: {e}")
            await tools.send_message(content=json.dumps(envelope, indent=2), mentions=[coord_handle])
            return {"status": "skipped"}

        try:
            alternatives = load_alternatives()
            top_alts = find_top_alternatives(affected_components, blocked_regulatory_flags, alternatives)
            recommended = top_alts[0]["supplier"] if top_alts else None
            reason = "Fastest lead time with lowest cost premium" if top_alts else "No alternatives found"
            envelope = {
                "agent": "alt_sourcing",
                "case_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "complete",
                "findings": {
                    "alternatives": top_alts,
                    "recommended": recommended,
                    "recommendation_reason": reason
                },
                "confidence": "HIGH",
                "flags": []
            }
        except Exception as e:
            logger.error(f"Alt sourcing calculation failed: {e}")
            envelope = {
                "agent": "alt_sourcing",
                "case_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "insufficient_data",
                "findings": {"alternatives": [], "recommended": None, "recommendation_reason": f"Error: {e}"},
                "confidence": "LOW",
                "flags": [str(e)]
            }

        coord_handle = "@vaithish7/coordinator"
        try:
            from utils import get_room_participants
            p_str = participants_msg if isinstance(participants_msg, str) else getattr(participants_msg, "content", "[]")
            handles = await get_room_participants(room_id, "alt_sourcing", p_str)
            coord_handle = next((h for h in handles if "coordinator" in h.lower()), "@vaithish7/coordinator")
        except Exception as e:
            logger.error(f"Failed to resolve coordinator handle: {e}")
        await tools.send_message(content=json.dumps(envelope, indent=2), mentions=[coord_handle])
        logger.info(f"Alt sourcing posted for {case_id}: {envelope['status']}")
        return {"status": "skipped"}



async def main():
    load_dotenv()

    alternatives = load_alternatives()
    logger.info(f"Loaded {len(alternatives)} alternative suppliers from alternatives.json")

    llm = get_llm_for_agent("alt_sourcing")
    logger.info("Using AI/ML API (primary) with Featherless AI (fallback)")

    agent_id, api_key = load_agent_config("alt_sourcing")

    adapter = CustomAltSourcingAdapter(
        llm=llm,
        checkpointer=InMemorySaver(),
        custom_section=ALT_SOURCING_PROMPT,
        additional_tools=[find_alternatives],
        api_key=api_key,
    )

    agent = Agent.create(adapter=adapter, agent_id=agent_id, api_key=api_key)

    logger.info("Alternative Sourcing Agent running...")
    await agent.run()


if __name__ == "__main__":
    asyncio.run(main())
