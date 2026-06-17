"""
Financial Exposure Agent
------------------------
Wakes up when it sees a message with "agent": "supplier_impact" in the Band room.
Reads data/financials.json.
Calculates 3 risk scenarios: week1 (7 days), week3 (21 days), week6 (42 days).
Posts structured findings to the Band room following SCHEMA.md.

No LLM required — pure logic and JSON lookups.
"""

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
- Set the `mentions` argument to tag the supplier_impact agent (e.g. sender of the supplier_impact post).
- Only respond after you see "agent": "supplier_impact" in the room.
- Never invent numbers. All numbers come from your calculate_exposure tool.
- Output valid JSON only. No text before or after the JSON.
- confidence is always "HIGH" when calculation succeeds.
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


# ---------------------------------------------------------------------------
# Custom Adapter & Mock Fallback
# ---------------------------------------------------------------------------

def find_participant_handle(participants, name):
    name_lower = name.lower().replace("_", "-")
    for p in participants:
        p_name = (p.get("name") or "").lower()
        p_handle = (p.get("handle") or "").lower()
        if name_lower in p_name or name_lower in p_handle:
            return p.get("handle")
        
        # Fallbacks for specific agent handles
        if "regulatory" in name_lower and "regulatory" in p_handle:
            return p.get("handle")
        if "event" in name_lower and "event" in p_handle:
            return p.get("handle")
        if "supplier" in name_lower and "supplier" in p_handle:
            return p.get("handle")
        if "financial" in name_lower and "financial" in p_handle:
            return p.get("handle")
        if "sourcing" in name_lower and "sourcing" in p_handle:
            return p.get("handle")
        if "coordinator" in name_lower and "coordinator" in p_handle:
            return p.get("handle")
            
    return f"@{name}"


def generate_mock_financial_exposure(affected_components: list[str]) -> tuple[dict, str, list[str]]:
    financials = load_financials()
    result = calculate_financial_exposure(affected_components, financials)
    return result, "HIGH", []


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

        # 1. Parse all messages in history + current
        all_msgs = []
        for m in history:
            content = m.content
            if content.startswith("[") and "]: " in content:
                parts = content.split("]: ", 1)
                sender = parts[0][1:]
                content = parts[1]
            else:
                sender = "financial_exposure"
            try:
                if "{" in content:
                    content = content[content.find("{"):content.rfind("}")+1]
                data = json.loads(content)
            except Exception:
                data = {}
            all_msgs.append((sender, data))

        try:
            content = msg.content
            if content.startswith("[") and "]: " in content:
                content = content.split("]: ", 1)[1]
            if "{" in content:
                content = content[content.find("{"):content.rfind("}")+1]
            current_data = json.loads(content)
        except Exception:
            current_data = {}
        all_msgs.append((msg.sender_name or msg.sender_type, current_data))

        # 2. Check for coordinator kickoff messages
        kickoffs = [data for sender, data in all_msgs if data.get("agent") == "coordinator" and data.get("phase") == "kickoff"]
        
        for kickoff in kickoffs:
            case_id = kickoff.get("case_id")
            if not case_id:
                continue

            # Check if we already responded to this case
            already_responded = False
            for sender, data in all_msgs:
                if data.get("agent") == "financial_exposure" and data.get("case_id") == case_id and data.get("status") in ("complete", "escalate", "insufficient_data"):
                    already_responded = True
                    break

            if already_responded:
                continue

            # Check if there is a completed supplier impact post for this case
            supplier_impact_data = None
            supplier_impact_failed = None
            for sender, data in all_msgs:
                if data.get("agent") == "supplier_impact" and data.get("case_id") == case_id:
                    if data.get("status") == "complete":
                        supplier_impact_data = data
                    elif data.get("status") in ("insufficient_data", "escalate"):
                        supplier_impact_failed = data
                    break

            supplier_impact_handle = find_participant_handle(tools.participants, "supplier_impact")

            if supplier_impact_failed:
                logger.warning(f"Upstream agent supplier_impact failed for case {case_id} with status: {supplier_impact_failed.get('status')}. Propagating failure.")
                response_envelope = {
                    "agent": "financial_exposure",
                    "case_id": case_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "status": "insufficient_data",
                    "findings": {},
                    "confidence": "LOW",
                    "flags": [f"Upstream agent supplier_impact failed with status: {supplier_impact_failed.get('status')}"]
                }
                await tools.send_message(
                    content=json.dumps(response_envelope, indent=2),
                    mentions=[supplier_impact_handle]
                )
                return

            if supplier_impact_data:
                logger.info(f"Trigger supplier_impact complete found for case {case_id}. Processing.")
                await self.process_financial_exposure(case_id, supplier_impact_data.get("findings"), tools, msg, history, participants_msg, contacts_msg, is_session_bootstrap, room_id, supplier_impact_handle)
                return

            # Check 60s timeout from coordinator kickoff
            kickoff_timestamp = kickoff.get("timestamp")
            if kickoff_timestamp:
                try:
                    kickoff_time = datetime.fromisoformat(kickoff_timestamp.replace("Z", "+00:00"))
                    current_time = datetime.now(timezone.utc)
                    elapsed = (current_time - kickoff_time).total_seconds()
                    if elapsed > 60:
                        logger.warning(f"Upstream agent supplier_impact missing after {elapsed}s (>60s) for case {case_id}. Posting insufficient_data.")
                        response_envelope = {
                            "agent": "financial_exposure",
                            "case_id": case_id,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "status": "insufficient_data",
                            "findings": {},
                            "confidence": "LOW",
                            "flags": [f"Upstream agent supplier_impact post missing after 60s (elapsed={int(elapsed)}s)"]
                        }
                        await tools.send_message(
                            content=json.dumps(response_envelope, indent=2),
                            mentions=[supplier_impact_handle]
                        )
                        return
                except Exception as ex:
                    logger.error(f"Error parsing kickoff timestamp: {ex}")

    async def process_financial_exposure(self, case_id, supplier_findings, tools, msg, history, participants_msg, contacts_msg, is_session_bootstrap, room_id, supplier_impact_handle):
        # Determine mode
        api_key = os.getenv("AIML_API_KEY")
        use_mock = not api_key or api_key.startswith("your_") or api_key == "key-from-band-dashboard"

        affected_components = supplier_findings.get("affected_components", []) if supplier_findings else []

        if use_mock:
            logger.info("Running in Mock Fallback Mode")
            findings, confidence, flags = generate_mock_financial_exposure(affected_components)
            response_envelope = {
                "agent": "financial_exposure",
                "case_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "complete",
                "findings": findings,
                "confidence": confidence,
                "flags": flags
            }
            await tools.send_message(
                content=json.dumps(response_envelope, indent=2),
                mentions=[supplier_impact_handle]
            )
            logger.info("Mock financial exposure posted successfully.")
            return

        logger.info("Running in LLM Mode")
        try:
            retries = 1
            while retries >= 0:
                try:
                    await super().on_message(
                        msg=msg,
                        tools=tools,
                        history=history,
                        participants_msg=participants_msg,
                        contacts_msg=contacts_msg,
                        is_session_bootstrap=is_session_bootstrap,
                        room_id=room_id
                    )
                    break
                except Exception as ex:
                    logger.warning(f"LLM call failed (retries left={retries}): {ex}")
                    retries -= 1
                    if retries < 0:
                        raise ex
        except Exception as e:
            logger.error(f"Error executing LLM call, posting insufficient_data: {e}")
            response_envelope = {
                "agent": "financial_exposure",
                "case_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "insufficient_data",
                "findings": {},
                "confidence": "LOW",
                "flags": [f"LLM analysis failed: {str(e)}"]
            }
            await tools.send_message(
                content=json.dumps(response_envelope, indent=2),
                mentions=[supplier_impact_handle]
            )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def main():
    load_dotenv()

    financials = load_financials()
    logger.info(f"Loaded {len(financials)} components from financials.json")

    # Primary LLM: AI/ML API
    try:
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            openai_api_key=os.getenv("AIML_API_KEY"),
            openai_api_base="https://api.aimlapi.com/v1",
        )
        logger.info("Using AI/ML API (primary)")
    except Exception:
        # Fallback: Featherless
        llm = ChatOpenAI(
            model="meta-llama/Llama-3.1-8B-Instruct",
            openai_api_key=os.getenv("FEATHERLESS_API_KEY"),
            openai_api_base="https://api.featherless.ai/v1",
        )
        logger.info("Using Featherless AI (fallback)")

    # Use check_trigger custom adapter
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
