"""
Financial Exposure Agent
------------------------
Wakes up when it sees a message with "agent": "supplier_impact" in the Band room.
Reads data/financials.json.
Calculates 3 risk scenarios: week1 (7 days), week3 (21 days), week6 (42 days).
Posts structured findings to the Band room following SCHEMA.md.

No LLM required — pure logic and JSON lookups.
"""

from utils import get_llm_for_agent
import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from band import Agent, SessionConfig
from band.adapters import LangGraphAdapter
from band.config import load_agent_config
from langchain_core.tools import tool

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [financial_exposure] %(message)s")
logger = logging.getLogger(__name__)

# Track when this agent process started — skip stale bootstrap messages
AGENT_START_TIME = datetime.now(timezone.utc)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).parent.parent / "data"
FINANCIALS_PATH = DATA_DIR / "financials.json"

# ---------------------------------------------------------------------------
# Risk calculation logic (pure Python — no ML, no LLM)
# ---------------------------------------------------------------------------

def load_financials() -> list[dict]:
    with open(FINANCIALS_PATH, "r", encoding="utf-8") as f:
        fin_data = json.load(f)
    
    # Load suppliers.json to get buffer days for each component
    suppliers_path = FINANCIALS_PATH.parent / "suppliers.json"
    try:
        with open(suppliers_path, "r", encoding="utf-8") as f:
            sup_data = json.load(f)
    except Exception:
        sup_data = {"suppliers": []}
    
    # Map component name -> inventory buffer days
    comp_buffers = {}
    for supplier in sup_data.get("suppliers", []):
        buf = supplier.get("inventory_buffer_days", 14)
        for comp in supplier.get("components", []):
            comp_buffers[comp] = min(comp_buffers.get(comp, 999), buf)

    # Construct list of components dynamically based on products_using and buffers
    products = fin_data.get("products", [])
    all_components = set()
    for p in products:
        for c in p.get("components_required", []):
            all_components.add(c)
    
    components_list = []
    for comp_name in all_components:
        products_using = [p["name"] for p in products if comp_name in p.get("components_required", [])]
        daily_rev = sum((p.get("weekly_revenue_usd", 0) / 7.0) for p in products if comp_name in p.get("components_required", []))
        buf_days = comp_buffers.get(comp_name, 14)
        
        components_list.append({
            "component_name": comp_name,
            "revenue_contribution_usd_per_day": daily_rev,
            "inventory_buffer_days": buf_days,
            "daily_cost_of_shortage_usd": daily_rev,
            "products_using": products_using
        })
    
    return components_list


def calculate_financial_exposure(affected_components: list[str], financials: list[dict]) -> dict:
    """
    For each affected component that has stock below the disruption horizon,
    compute the daily shortage cost * (disruption_days - buffer_days).

    Three scenarios:
      week1 → disruption resolves in 7 days
      week3 → disruption resolves in 21 days
      week6 → disruption resolves in 42 days
    """
    week1_risk = 0.0
    week3_risk = 0.0
    week6_risk = 0.0
    at_risk_products: list[str] = []

    # Build a lookup by component_name (case-insensitive, partial match allowed)
    def find_component(name: str) -> dict | None:
        name_lower = name.lower().strip()
        for comp in financials:
            if comp.get("component_name", "").lower().strip() == name_lower:
                return comp
        # fallback: partial match
        for comp in financials:
            comp_name_lower = comp.get("component_name", "").lower().strip()
            if name_lower in comp_name_lower or comp_name_lower in name_lower:
                return comp
        return None

    # Total daily revenue at risk (all affected components whose buffer < scenario_days)
    total_daily_revenue = sum(float(c.get("revenue_contribution_usd_per_day") or 0) for c in financials)

    matched_components = []
    for comp_name in affected_components:
        comp = find_component(comp_name)
        if comp is None:
            logger.warning(f"Component not found in financials: {comp_name}")
            continue
        matched_components.append(comp)
        at_risk_products.extend(comp.get("products_using", []))

    # De-duplicate products
    at_risk_products = list(dict.fromkeys(at_risk_products))

    if not matched_components:
        # No matched components — return zero risk
        return {
            "week1_risk_usd": 0,
            "week3_risk_usd": 0,
            "week6_risk_usd": 0,
            "revenue_at_risk_products": [],
            "margin_impact_pct": 0.0,
        }

    for comp in matched_components:
        buffer = int(comp.get("inventory_buffer_days") or 30)
        daily_cost = float(comp.get("daily_cost_of_shortage_usd") or 0)

        # Week 1 (7 days): shortage only accrues after buffer exhausted
        shortage_days_w1 = max(0, 7 - buffer)
        week1_risk += daily_cost * shortage_days_w1

        # Week 3 (21 days)
        shortage_days_w3 = max(0, 21 - buffer)
        week3_risk += daily_cost * shortage_days_w3

        # Week 6 (42 days)
        shortage_days_w6 = max(0, 42 - buffer)
        week6_risk += daily_cost * shortage_days_w6

    # Margin impact: estimated as % of total daily revenue that is at risk by week6
    affected_daily_revenue = sum(float(c.get("revenue_contribution_usd_per_day") or 0) for c in matched_components)
    margin_impact_pct = round((affected_daily_revenue / total_daily_revenue) * 100, 1) if total_daily_revenue else 0.0

    return {
        "week1_risk_usd": round(week1_risk),
        "week3_risk_usd": round(week3_risk),
        "week6_risk_usd": round(week6_risk),
        "revenue_at_risk_products": at_risk_products,
        "margin_impact_pct": margin_impact_pct,
    }


# ---------------------------------------------------------------------------
# Agent system prompt — instructs LLM to trigger financial analysis
# ---------------------------------------------------------------------------

FINANCIAL_EXPOSURE_PROMPT = """
You are the Financial Exposure Agent in a Supply Chain Disruption Intelligence System.

Your behaviour:

1. WAIT AND LISTEN: Monitor the Band room for a message where "agent" equals "supplier_impact".

2. When you see that message, extract:
   - case_id from the message
   - affected_components list from the findings field

3. Call your calculate_exposure tool with those affected_components.

4. Post EXACTLY this JSON to the Band room. No prose. No markdown. Valid JSON only.

{
  "agent": "financial_exposure",
  "case_id": "<case_id from kickoff>",
  "timestamp": "<ISO8601 current time>",
  "status": "complete",
  "findings": {
    "week1_risk_usd": <number>,
    "week3_risk_usd": <number>,
    "week6_risk_usd": <number>,
    "revenue_at_risk_products": [<array of product names>],
    "margin_impact_pct": <number>
  },
  "confidence": "HIGH",
  "flags": []
}

CRITICAL RULES:
- You MUST call the `band_send_message` tool to communicate. Do NOT output any plain text or markdown directly from your thinking graph; it will be discarded and won't reach the chat room. Always wrap your response in a `band_send_message` tool call.
- Set the `content` argument of `band_send_message` to the raw JSON string matching the exact schema above (no markdown code blocks).
- Set the `mentions` argument to explicitly tag the coordinator agent and the supplier_impact agent (e.g. sender of the supplier_impact post). This is CRITICAL so the coordinator knows you are done.
- Only respond after you see "agent": "supplier_impact" in the room.
- If the "supplier_impact" post has status "insufficient_data" or "escalate", you MUST immediately post the JSON above with status "insufficient_data", empty findings, and flags ["Upstream failure"]. Do NOT calculate exposure.
- If affected_components is empty, set status to "insufficient_data" and post with zero values.
"""


# ---------------------------------------------------------------------------
# Tool wrapper the LLM can call (LangGraph tool node pattern)
# ---------------------------------------------------------------------------

@tool
def calculate_exposure(affected_components: list[str]) -> str:
    """
    Calculate financial exposure for a list of affected component names.
    Returns a JSON string with week1, week3, week6 risk figures.
    """
    financials = load_financials()
    result = calculate_financial_exposure(affected_components, financials)
    return json.dumps(result)


class CustomFinancialExposureAdapter(LangGraphAdapter):
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
        # Try msg.parsed first; fall back to parsing raw msg.content
        parsed_data = getattr(msg, 'parsed', {}) or {}
        if not parsed_data:
            try:
                raw = getattr(msg, 'content', '') or ''
                if raw.startswith('[') and ']: ' in raw:
                    raw = raw.split(']: ', 1)[1]
                if '{' in raw:
                    raw = raw[raw.find('{'):raw.rfind('}')+1]
                parsed_data = json.loads(raw) if raw else {}
                if not isinstance(parsed_data, dict):
                    parsed_data = {}
            except Exception:
                parsed_data = {}

        print(f"\n[DEBUG FINANCIAL_EXPOSURE] on_message fired. parsed agent={parsed_data.get('agent','?')} status={parsed_data.get('status','?')}\n")

        # Normalize hyphens to underscores to guarantee a match
        agent_sender = parsed_data.get('agent', '').replace('-', '_')

        if agent_sender == 'supplier_impact':
            print(f"\n[DEBUG FINANCIAL_EXPOSURE] WAKING UP! RECEIVED DATA.\n")
            case_id = parsed_data.get("case_id")
            if not case_id:
                return {"status": "skipped"}
                
            try:
                sup_status = parsed_data.get("status")
                affected_components = (parsed_data.get("findings") or {}).get("affected_components", [])

                if sup_status in ("insufficient_data", "escalate", "error", "fallback") or not affected_components:
                    findings = {"week1_risk_usd": 0, "week3_risk_usd": 0, "week6_risk_usd": 0,
                                "revenue_at_risk_products": [], "margin_impact_pct": 0.0}
                    status = "insufficient_data"
                    flags = ["Upstream supplier_impact failure or no components"]
                else:
                    financials = load_financials()
                    findings = calculate_financial_exposure(affected_components, financials)
                    status = "complete"
                    flags = []

                envelope = {
                    "agent": "financial_exposure",
                    "case_id": case_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "status": status,
                    "findings": findings,
                    "confidence": "HIGH" if status == "complete" else "LOW",
                    "flags": flags
                }
                
                coord_handle = "@vaithish7/coordinator"
                await tools.send_message(content=json.dumps(envelope, indent=2), mentions=[coord_handle])
                print(f"[FINANCIAL_EXPOSURE] Final payload posted for {case_id}: {status}")
            except Exception as e:
                logger.error(f"FATAL ERROR: {e}")
                error_envelope = {
                    "agent": "financial_exposure",
                    "case_id": case_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "status": "error",
                    "findings": {},
                    "confidence": "LOW",
                    "flags": [f"Crash: {str(e)[:100]}"]
                }
                await tools.send_message(content=json.dumps(error_envelope, indent=2), mentions=["@vaithish7/coordinator"])
        
        return {"status": "skipped"}

async def main():
    load_dotenv()

    financials = load_financials()
    logger.info(f"Loaded {len(financials)} components from financials.json")

    llm = get_llm_for_agent("financial_exposure")
    logger.info("Using AI/ML API (primary) with Featherless AI (fallback)")

    adapter = CustomFinancialExposureAdapter(
        llm=llm,
        checkpointer=InMemorySaver(),
        custom_section=FINANCIAL_EXPOSURE_PROMPT,
        additional_tools=[calculate_exposure],
    )

    agent_id, api_key = load_agent_config("financial_exposure")
    session_config = SessionConfig(enable_context_hydration=False)
    agent = Agent.create(
        adapter=adapter,
        agent_id=agent_id,
        api_key=api_key,
        session_config=session_config,
    )

    logger.info("Financial Exposure Agent running — waiting for supplier_impact post...")
    await agent.run()


if __name__ == "__main__":
    asyncio.run(main())
