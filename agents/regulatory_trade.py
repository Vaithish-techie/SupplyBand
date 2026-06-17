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
        logger.info(f"Regulatory Trade Agent received message: {msg.content[:100]}...")
        
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
        already_responded = any(d.get("agent") == "regulatory_trade" and d.get("case_id") == case_id and d.get("status") in ("complete", "insufficient_data", "escalate", "error") for d in all_msgs)
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
                "agent": "regulatory_trade",
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
