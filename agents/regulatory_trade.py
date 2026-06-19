# agents/regulatory_trade.py
from utils import get_llm_for_agent
import asyncio
import logging
import json
import os
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.memory import InMemorySaver
from band import Agent, SessionConfig
from band.adapters import LangGraphAdapter
from band.config import load_agent_config
from langchain_core.tools import tool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Track when this agent process started — skip stale bootstrap messages
from datetime import datetime, timezone
AGENT_START_TIME = datetime.now(timezone.utc)

# System prompt for the regulatory trade agent
AGENT_PROMPT = """
You are the Regulatory Trade Agent in a Supply Chain Disruption Intelligence System.

WAKE UP & RESPONSE LOGIC:
You must respond in the following two scenarios:

Scenario 1: Pipeline Trigger (Message from supplier_impact)
- When you see a Band message where the "agent" field is "supplier_impact" and the "status" field is "complete".
- Your action:
  1. Read the supplier_impact's findings from the room context.
  2. Call the tool `get_regulatory_data` to read the regulations database from `data/regulations.json`.
  3. Cross-reference the findings with the regulations database to determine force majeure, insurer notification deadlines, export controls, tariff implications, and compliance actions.
  4. Call the `band_send_message` tool to post your findings.
     - Set the `content` argument to a raw, valid JSON string matching the exact schema below (no markdown code blocks, no other text).
     - Set the `mentions` argument to explicitly tag the coordinator agent (e.g., `["@vaithish7/coordinator"]`). This is CRITICAL so the coordinator knows you are done.

Expected findings JSON schema:
{
  "agent": "regulatory_trade",
  "case_id": "<copy the case_id from the supplier_impact message>",
  "timestamp": "<current ISO8601 timestamp>",
  "status": "complete",
  "findings": {
    "force_majeure_applicable": <boolean>,
    "insurer_notify_deadline_hours": <integer>,
    "export_controls": [<string>, ...],
    "tariff_implications": "none" | "minor" | "major",
    "compliance_actions": [<string>, ...]
  },
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "flags": []
}

Scenario 2: Direct Chat / Mention
- When a human user in the room directly mentions you (e.g., tags `@Regulatory Agent` or `@belugaok3/regulatory-agent` or asks you a question).
- Your action:
  1. Call the `band_send_message` tool to send a text response back.
  2. Set the `content` argument to a friendly, helpful text response answering their question or greeting them.
  3. Set the `mentions` argument to tag the user who mentioned you (e.g., `["@belugaok3"]` or `["@sreedarsan0311"]`).

CRITICAL RULES:
- You MUST call the `band_send_message` tool to communicate. Do NOT output any plain text or markdown directly from your thinking graph; it will be discarded and won't reach the chat room. Always wrap your response in a `band_send_message` tool call.
- Do NOT respond to messages from other agents unless the message is from `supplier_impact`. 
- If `supplier_impact` has status "insufficient_data" or "escalate", you MUST immediately post exactly the JSON above with status "insufficient_data", empty findings, and flags ["Upstream failure"].
"""

@tool
def get_regulatory_data() -> str:
    """Read the regulatory database from data/regulations.json. 
    Use this to look up regulations, export controls, force majeure rules, insurer notification deadlines, 
    and tariff implications for suppliers, components, and countries."""
    try:
        # Resolve path relative to project root
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        reg_path = os.path.join(base_dir, "data", "regulations.json")
        if not os.path.exists(reg_path):
            return "Error: data/regulations.json file does not exist."
        with open(reg_path, "r", encoding="utf-8") as f:
            content = f.read().strip()
            return content if content else "{}"
    except Exception as e:
        return f"Error reading regulations: {e}"

def load_regulations():
    try:
        reg_data_str = get_regulatory_data.invoke({})
        return json.loads(reg_data_str) if reg_data_str and reg_data_str.strip().startswith("{") else {}
    except Exception as e:
        logger.error(f"Failed to load regulations: {e}")
        return {}

class CustomRegulatoryTradeAdapter(LangGraphAdapter):
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

        print(f"\n[DEBUG REGULATORY_TRADE] on_message fired. parsed agent={parsed_data.get('agent','?')} status={parsed_data.get('status','?')}\n")

        # Normalize hyphens to underscores to guarantee a match
        agent_sender = parsed_data.get('agent', '').replace('-', '_')

        if agent_sender == 'supplier_impact':
            print(f"\n[DEBUG REGULATORY_TRADE] WAKING UP! RECEIVED DATA.\n")
            case_id = parsed_data.get("case_id")
            if not case_id:
                return {"status": "skipped"}
                
            try:
                sup_status = parsed_data.get("status")
                affected_components = (parsed_data.get("findings") or {}).get("affected_components", [])

                if sup_status in ("insufficient_data", "escalate", "error", "fallback") or not affected_components:
                    envelope = {
                        "agent": "regulatory_trade",
                        "case_id": case_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "status": "insufficient_data",
                        "findings": {},
                        "confidence": "LOW",
                        "flags": ["Upstream supplier_impact failure or no components"]
                    }
                else:
                    reg_data = load_regulations()
                    # Determine regulatory findings based on event type / location
                    event_type = ""
                    location = ""
                    for d in history:
                        content = d.content
                        if content.startswith("[") and "]: " in content:
                            content = content.split("]: ", 1)[1]
                        if "{" in content:
                            content = content[content.find("{"):content.rfind("}")+1]
                        try:
                            parsed_d = json.loads(content)
                            if isinstance(parsed_d, dict) and parsed_d.get("agent") == "event_intelligence" and parsed_d.get("case_id") == case_id:
                                event_type = (parsed_d.get("findings") or {}).get("event_type", "")
                                location = (parsed_d.get("findings") or {}).get("location", "")
                                break
                        except Exception:
                            pass

                    force_majeure = True
                    insurer_hours = 72
                    export_controls = []
                    tariff_implications = "none"
                    compliance_actions = []

                    for rule in reg_data.get("rules", []):
                        search_str = (event_type + " " + location).lower()
                        matched = False
                        for k in rule.get("keywords", []):
                            k_lower = str(k).lower().strip()
                            if k_lower in search_str or search_str in k_lower or any(word in search_str for word in k_lower.split()):
                                matched = True
                                break
                        if matched:
                            force_majeure = rule.get("force_majeure", force_majeure)
                            insurer_hours = int(rule.get("insurer_notify_deadline_hours") or insurer_hours)
                            export_controls = rule.get("export_controls", export_controls)
                            tariff_implications = rule.get("tariff_implications", tariff_implications)
                            compliance_actions = rule.get("compliance_actions", compliance_actions)

                    if not compliance_actions:
                        compliance_actions = [
                            f"Notify insurer within {insurer_hours} hours",
                            "File force majeure notice with affected suppliers"
                        ]

                    envelope = {
                        "agent": "regulatory_trade",
                        "case_id": case_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "status": "complete",
                        "findings": {
                            "force_majeure_applicable": force_majeure,
                            "insurer_notify_deadline_hours": insurer_hours,
                            "export_controls": export_controls,
                            "tariff_implications": tariff_implications,
                            "compliance_actions": compliance_actions
                        },
                        "confidence": "MEDIUM",
                        "flags": []
                    }

                coord_handle = "@vaithish7/coordinator"
                await tools.send_message(content=json.dumps(envelope, indent=2), mentions=[coord_handle])
                print(f"[REGULATORY_TRADE] Final payload posted for {case_id}")
            except Exception as e:
                logger.error(f"FATAL ERROR: {e}")
                error_envelope = {
                    "agent": "regulatory_trade",
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
    # Load env variables from local and parent dir
    load_dotenv()
    parent_env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", ".env")
    if os.path.exists(parent_env):
        load_dotenv(parent_env)

    # Initialize the LLM with fallbacks
    from langchain_openai import ChatOpenAI
    llm = get_llm_for_agent("regulatory_trade")
    logger.info("Initializing LLM via AIML API (primary) and Featherless (fallback)...")

    # Add wrapper for logging LLM inputs and outputs (both sync and async)
    original_ainvoke = llm.ainvoke
    async def wrapped_ainvoke(messages, *args, **kwargs):
        logger.info("[LLM INPUT (ASYNC)] Messages: %s", messages)
        resp = await original_ainvoke(messages, *args, **kwargs)
        logger.info("[LLM OUTPUT (ASYNC)] Response: %s", resp)
        return resp
    object.__setattr__(llm, "ainvoke", wrapped_ainvoke)

    original_invoke = llm.invoke
    def wrapped_invoke(messages, *args, **kwargs):
        logger.info("[LLM INPUT (SYNC)] Messages: %s", messages)
        resp = original_invoke(messages, *args, **kwargs)
        logger.info("[LLM OUTPUT (SYNC)] Response: %s", resp)
        return resp
    object.__setattr__(llm, "invoke", wrapped_invoke)

    # Create the adapter with selected LLM and the get_regulatory_data tool
    adapter = CustomRegulatoryTradeAdapter(
        llm=llm,
        checkpointer=InMemorySaver(),
        custom_section=AGENT_PROMPT,
        additional_tools=[get_regulatory_data],
    )

    # Load agent configurations for regulatory_trade
    agent_id, api_key = load_agent_config("regulatory_trade")
    session_config = SessionConfig(enable_context_hydration=False)
    agent = Agent.create(
        adapter=adapter,
        agent_id=agent_id,
        api_key=api_key,
        session_config=session_config,
    )

    logger.info("Regulatory Trade Agent running...")
    await agent.run()

if __name__ == "__main__":
    asyncio.run(main())
