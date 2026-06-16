# agents/event_intelligence.py
import asyncio
import json
import logging
from dotenv import load_dotenv
import os
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from thenvoi import Agent
from thenvoi.adapters import LangGraphAdapter
from thenvoi.config import load_agent_config
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

EVENT_INTELLIGENCE_PROMPT = """
You are the Event Intelligence Agent in a Supply Chain Disruption system.

You receive raw disruption event text. Your job is to classify it into a structured format.

You MUST call the tool 'band_send_message' to send your output to the room.
Mentions: You MUST mention the coordinator in the 'band_send_message' call.

Respond ONLY with valid JSON inside the 'content' parameter of 'band_send_message'. No prose, no markdown, no explanation outside the JSON.

Output format for the content:
{
  "agent": "event_intelligence",
  "case_id": "<use case_id from kickoff message>",
  "timestamp": "<current ISO8601 timestamp>",
  "status": "complete",
  "findings": {
    "event_type": "<natural_disaster|port_strike|tariff|sanctions|geopolitical|pandemic>",
    "severity": "<CRITICAL|HIGH|MEDIUM|LOW>",
    "location": "<city, country>",
    "affected_industries": ["<industry1>", "<industry2>"],
    "estimated_duration_weeks": <integer>,
    "summary": "<one sentence summary>"
  },
  "confidence": "<HIGH|MEDIUM|LOW>",
  "flags": []
}

Severity rules:
- CRITICAL: affects >50% of supply for critical component, or duration > 8 weeks
- HIGH: affects key suppliers, duration 3-8 weeks
- MEDIUM: partial disruption, duration < 3 weeks
- LOW: minor, likely self-resolving

Confidence rules:
- HIGH: clear event, specific location, known timeline
- MEDIUM: clear event but duration uncertain
- LOW: vague or unverified (if low, add "Insufficient event detail" to flags)
"""

def find_participant_handle(participants, name):
    for p in participants:
        p_name = p.get("name") or ""
        p_handle = p.get("handle") or ""
        if p_name == name or name in p_name or name in p_handle:
            return p_handle
    return f"@{name}"

def check_trigger_and_check_duplicate(msg, history, agent_name, trigger_agent, trigger_condition_func):
    all_msgs = []
    # Convert history messages
    for m in history:
        content = m.content
        if content.startswith("[") and "]: " in content:
            parts = content.split("]: ", 1)
            sender = parts[0][1:]
            content = parts[1]
        else:
            sender = agent_name
        try:
            data = json.loads(content)
        except Exception:
            data = {}
        all_msgs.append((sender, data))

    # Append the current message
    try:
        current_data = json.loads(msg.content)
    except Exception:
        current_data = {}
    all_msgs.append((msg.sender_name or msg.sender_type, current_data))

    # Find the most recent trigger message
    trigger_msg_data = None
    for sender, data in reversed(all_msgs):
        if trigger_condition_func(data):
            trigger_msg_data = data
            break

    if not trigger_msg_data:
        return None, False

    # Check if we already responded to this case_id
    case_id = trigger_msg_data.get("case_id")
    already_responded = False
    for sender, data in all_msgs:
        if data.get("agent") == agent_name and data.get("case_id") == case_id and data.get("status") in ("complete", "escalate", "insufficient_data"):
            already_responded = True
            break

    return trigger_msg_data, already_responded

def generate_mock_event_findings(event_text):
    text = event_text.lower() if event_text else ""
    if "earthquake" in text or "hsinchu" in text or "taiwan" in text or "tsmc" in text:
        return {
            "event_type": "natural_disaster",
            "severity": "CRITICAL",
            "location": "Hsinchu, Taiwan",
            "affected_industries": ["semiconductor", "logistics"],
            "estimated_duration_weeks": 6,
            "summary": "Magnitude 7.4 earthquake strikes Hsinchu, Taiwan suspending TSMC production."
        }, "HIGH", []
    elif "strike" in text or "los angeles" in text or "dockworkers" in text:
        return {
            "event_type": "port_strike",
            "severity": "HIGH",
            "location": "Los Angeles, USA",
            "affected_industries": ["logistics"],
            "estimated_duration_weeks": 4,
            "summary": "Dockworkers strike at Port of Los Angeles halts container operations."
        }, "HIGH", []
    elif "sanctions" in text or "chinese" in text or "sanction" in text:
        return {
            "event_type": "sanctions",
            "severity": "HIGH",
            "location": "China",
            "affected_industries": ["semiconductor"],
            "estimated_duration_weeks": 12,
            "summary": "US Treasury imposes new sanctions on Chinese semiconductor manufacturers."
        }, "HIGH", []
    else:
        # Vague input fallback
        return {
            "event_type": "geopolitical",
            "severity": "LOW",
            "location": "unknown",
            "affected_industries": ["unknown"],
            "estimated_duration_weeks": 1,
            "summary": "Unknown or vague disruption event reported."
        }, "LOW", ["Insufficient event detail"]

class CustomEventIntelligenceAdapter(LangGraphAdapter):
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
        logger.info(f"Event Intelligence Agent received message: {msg.content[:100]}...")
        
        # Check trigger condition and duplicates
        trigger_msg_data, already_responded = check_trigger_and_check_duplicate(
            msg, history, "event_intelligence", "coordinator",
            lambda data: data.get("agent") == "coordinator" and data.get("phase") == "kickoff"
        )
        
        if not trigger_msg_data:
            logger.info("Trigger kickoff message not found. Skipping.")
            return
            
        case_id = trigger_msg_data.get("case_id")
        if already_responded:
            logger.info(f"Already responded to case {case_id}. Skipping.")
            return
            
        logger.info(f"Processing kickoff event for case {case_id}")
        
        # Get raw event text
        event_text = trigger_msg_data.get("event_text")
        
        # Determine mode
        api_key = os.getenv("AIML_API_KEY")
        use_mock = not api_key or api_key.startswith("your_") or api_key == "key-from-band-dashboard"
        
        coordinator_handle = find_participant_handle(tools.participants, "coordinator")
        
        if use_mock:
            logger.info("Running in Mock Fallback Mode")
            findings, confidence, flags = generate_mock_event_findings(event_text)
            
            response_envelope = {
                "agent": "event_intelligence",
                "case_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "complete",
                "findings": findings,
                "confidence": confidence,
                "flags": flags
            }
            
            await tools.send_message(
                content=json.dumps(response_envelope, indent=2),
                mentions=[coordinator_handle]
            )
            logger.info("Mock event intelligence posted successfully.")
            return
            
        logger.info("Running in LLM Mode")
        try:
            # Check for vague/empty input
            if not event_text or len(event_text.strip()) < 10:
                # Post with low confidence
                findings, confidence, flags = generate_mock_event_findings(event_text)
                response_envelope = {
                    "agent": "event_intelligence",
                    "case_id": case_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "status": "complete",
                    "findings": findings,
                    "confidence": "LOW",
                    "flags": ["Insufficient event detail"]
                }
                await tools.send_message(
                    content=json.dumps(response_envelope, indent=2),
                    mentions=[coordinator_handle]
                )
                logger.info("Vague event intelligence posted successfully.")
                return

            # Let LLM handle it, we call super
            # First, check if LLM call succeeds, retry once on error
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
                "agent": "event_intelligence",
                "case_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "insufficient_data",
                "findings": {},
                "confidence": "LOW",
                "flags": [f"LLM analysis failed: {str(e)}"]
            }
            await tools.send_message(
                content=json.dumps(response_envelope, indent=2),
                mentions=[coordinator_handle]
            )

async def main():
    load_dotenv()
    
    # Check if key is dummy or empty, and use a dummy ChatOpenAI model if so,
    # because LangGraphAdapter builds LLM immediately and would crash if api_key is missing.
    api_key = os.getenv("AIML_API_KEY")
    if not api_key or api_key.startswith("your_") or api_key == "key-from-band-dashboard":
        api_key = "dummy-key"
        
    adapter = CustomEventIntelligenceAdapter(
        llm=ChatOpenAI(
            model="anthropic/claude-3-5-sonnet",
            api_key=api_key,
            base_url="https://api.aimlapi.com/v1"
        ),
        checkpointer=InMemorySaver(),
        custom_section=EVENT_INTELLIGENCE_PROMPT,
    )
    agent_id, api_key_config = load_agent_config("event_intelligence")
    agent = Agent.create(adapter=adapter, agent_id=agent_id, api_key=api_key_config)
    logger.info("Event Intelligence Agent running...")
    await agent.run()

if __name__ == "__main__":
    asyncio.run(main())
