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
from band import Agent
from band.adapters import LangGraphAdapter
from band.config import load_agent_config
from langchain_core.tools import tool

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [financial_exposure] %(message)s")
logger = logging.getLogger(__name__)

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
        name_lower = name.lower()
        for comp in financials:
            if comp["component_name"].lower() == name_lower:
                return comp
        # fallback: partial match
        for comp in financials:
            if name_lower in comp["component_name"].lower() or comp["component_name"].lower() in name_lower:
                return comp
        return None

    # Total daily revenue at risk (all affected components whose buffer < scenario_days)
    total_daily_revenue = sum(c["revenue_contribution_usd_per_day"] for c in financials)

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
        buffer = comp["inventory_buffer_days"]
        daily_cost = comp["daily_cost_of_shortage_usd"]

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
    affected_daily_revenue = sum(c["revenue_contribution_usd_per_day"] for c in matched_components)
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
        logger.info(f"Financial Exposure Agent received message: {msg.content[:100]}...")
        
        # Parse all messages in history to check state
        all_msgs = []
        for m in history:
            content = m.content
            if content.startswith("[") and "]: " in content:
                content = content.split("]: ", 1)[1]
            try:
                if "{" in content:
                    content = content[content.find("{"):content.rfind("}")+1]
                data = json.loads(content)
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
            all_msgs.append(current_data)
        except Exception:
            current_data = {}
            
        case_id = current_data.get("case_id")
        if not case_id:
            for d in reversed(all_msgs):
                if d.get("case_id"):
                    case_id = d.get("case_id")
                    break
                    
        if not case_id:
            import asyncio, random
            await asyncio.sleep(0.1 + random.random() * 0.4)
            return

        # Check if already responded
        already_responded = any(d.get("agent") == "financial_exposure" and d.get("case_id") == case_id and d.get("status") in ("complete", "insufficient_data", "escalate", "error") for d in all_msgs)
        if already_responded:
            import asyncio, random
            await asyncio.sleep(0.1 + random.random() * 0.4)
            return

        # Check for supplier_impact completion or failure
        supplier_impact_post = None
        for d in all_msgs:
            if d.get("agent") == "supplier_impact" and d.get("case_id") == case_id:
                supplier_impact_post = d
                break
                
        if not supplier_impact_post:
            import asyncio, random
            await asyncio.sleep(0.1 + random.random() * 0.4)
            return
            
        logger.info(f"Supplier impact post found for case {case_id}. Triggering LLM logic.")
        try:
            await super().on_message(msg, tools, history, participants_msg, contacts_msg, is_session_bootstrap=is_session_bootstrap, room_id=room_id)
        except Exception as e:
            logger.error(f"Terminal LLM failure: {e}")
            from datetime import datetime, timezone
            response = {
                "agent": "financial_exposure",
                "case_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "error",
                "findings": {},
                "confidence": "LOW",
                "flags": [f"Terminal LLM failure: {str(e)}"]
            }
            if hasattr(tools, 'send_message'):
                try:
                    p_str = participants_msg if isinstance(participants_msg, str) else getattr(participants_msg, "content", "[]")
                    participants_list = json.loads(p_str)
                    coord_handle = next((p.get("handle") for p in participants_list if "coordinator" in p.get("handle", "").lower()), "@coordinator")
                except:
                    coord_handle = "@coordinator"
                await tools.send_message(content=json.dumps(response), mentions=[coord_handle])

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
    agent = Agent.create(adapter=adapter, agent_id=agent_id, api_key=api_key)

    logger.info("Financial Exposure Agent running — waiting for supplier_impact post...")
    await agent.run()


if __name__ == "__main__":
    asyncio.run(main())
