# agents/regulatory_trade.py
import asyncio
import logging
import json
import os
from datetime import datetime, timezone
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
     - Set the `mentions` argument to tag the coordinator agent or human operator (e.g., `["@vaithish7/coordinator"]` or `["@belugaok3"]`).

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
- Do NOT respond to messages from other agents unless the message is from `supplier_impact` with status `complete`. (Responding to human users who tag you is allowed and required).
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

async def main():
    # Load env variables from local and parent dir
    load_dotenv()
    parent_env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", ".env")
    if os.path.exists(parent_env):
        load_dotenv(parent_env)

    # Initialize the LLM based on available keys
    aiml_api_key = os.getenv("AIML_API_KEY")
    if aiml_api_key:
        logger.info("Initializing LLM via AIML API (gpt-4o-mini)...")
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            openai_api_key=aiml_api_key,
            openai_api_base="https://api.aimlapi.com/v1",
        )
    else:
        logger.info("Initializing LLM via direct Anthropic (claude-sonnet-4-5)...")
        from langchain_anthropic import ChatAnthropic
        llm = ChatAnthropic(model="claude-sonnet-4-5")

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


def check_is_mentioned(msg_content, agent_id, handle):
    if not msg_content:
        return False
    content_lower = msg_content.lower()
    if agent_id.lower() in content_lower:
        return True
    if "regulatory" in content_lower:
        return True
    if handle.lower() in content_lower:
        return True
    return False


def generate_mock_regulatory_trade(findings) -> tuple[dict, str, list[str]]:
    critical_path = findings.get("critical_path_suppliers", []) if findings else []
    critical_path_lower = [s.lower() for s in critical_path]
    
    if any("tsmc" in s for s in critical_path_lower) or any("ase" in s for s in critical_path_lower):
        return {
            "force_majeure_applicable": True,
            "insurer_notify_deadline_hours": 72,
            "export_controls": ["EAR99"],
            "tariff_implications": "none",
            "compliance_actions": [
                "Notify insurer by Jan 17",
                "File force majeure with TSMC"
            ]
        }, "HIGH", []
    elif any("la logistics" in s for s in critical_path_lower):
        return {
            "force_majeure_applicable": False,
            "insurer_notify_deadline_hours": 48,
            "export_controls": [],
            "tariff_implications": "none",
            "compliance_actions": [
                "Notify logistics insurer within 48 hours"
            ]
        }, "HIGH", []
    else:
        return {
            "force_majeure_applicable": False,
            "insurer_notify_deadline_hours": 24,
            "export_controls": [],
            "tariff_implications": "none",
            "compliance_actions": []
        }, "LOW", []


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

        # 1. Parse all messages in history + current
        all_msgs = []
        for m in history:
            content = m.content
            if content.startswith("[") and "]: " in content:
                parts = content.split("]: ", 1)
                sender = parts[0][1:]
                content = parts[1]
            else:
                sender = "regulatory_trade"
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

        # Get our agent ID and handle
        agent_id = "fa402438-d0f9-4d3b-8dc1-5e18f65fdc62"
        my_handle = find_participant_handle(tools.participants, "regulatory_trade")

        # Check if this is a direct mention (asks us a question)
        is_mention = check_is_mentioned(msg.content, agent_id, my_handle)
        if is_mention:
            logger.info("Direct mention detected. Invoking LLM for direct chat response.")
            await super().on_message(
                msg=msg,
                tools=tools,
                history=history,
                participants_msg=participants_msg,
                contacts_msg=contacts_msg,
                is_session_bootstrap=is_session_bootstrap,
                room_id=room_id
            )
            return

        # 2. Check for coordinator kickoff messages
        kickoffs = [data for sender, data in all_msgs if data.get("agent") == "coordinator" and data.get("phase") == "kickoff"]
        
        for kickoff in kickoffs:
            case_id = kickoff.get("case_id")
            if not case_id:
                continue

            # Check if we already responded to this case
            already_responded = False
            for sender, data in all_msgs:
                if data.get("agent") == "regulatory_trade" and data.get("case_id") == case_id and data.get("status") in ("complete", "escalate", "insufficient_data"):
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
                    "agent": "regulatory_trade",
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
                await self.process_regulatory_trade(case_id, supplier_impact_data.get("findings"), tools, msg, history, participants_msg, contacts_msg, is_session_bootstrap, room_id, supplier_impact_handle)
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
                            "agent": "regulatory_trade",
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

    async def process_regulatory_trade(self, case_id, supplier_findings, tools, msg, history, participants_msg, contacts_msg, is_session_bootstrap, room_id, supplier_impact_handle):
        # Check if regulations.json is missing
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        reg_path = os.path.join(base_dir, "data", "regulations.json")
        if not os.path.exists(reg_path):
            logger.error("regulations.json file is missing!")
            response_envelope = {
                "agent": "regulatory_trade",
                "case_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "insufficient_data",
                "findings": {},
                "confidence": "LOW",
                "flags": ["data/regulations.json file is missing"]
            }
            await tools.send_message(
                content=json.dumps(response_envelope, indent=2),
                mentions=[supplier_impact_handle]
            )
            return

        # Determine mode
        api_key = os.getenv("AIML_API_KEY")
        use_mock = not api_key or api_key.startswith("your_") or api_key == "key-from-band-dashboard"

        if use_mock:
            logger.info("Running in Mock Fallback Mode")
            findings, confidence, flags = generate_mock_regulatory_trade(supplier_findings)
            response_envelope = {
                "agent": "regulatory_trade",
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
            logger.info("Mock regulatory trade posted successfully.")
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
                "agent": "regulatory_trade",
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

if __name__ == "__main__":
    asyncio.run(main())
