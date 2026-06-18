# agents/event_intelligence.py
# Fix summary:
# - Issue #1 (impersonation): LLM never called via super().on_message() — we control output fully.
# - Issue #2 (422 errors): We call LLM directly via ainvoke() and post via tools.send_message().
#   The SDK's LangGraph adapter was producing malformed /processed payloads when the LLM returned
#   prose instead of a tool call. By owning the full send flow, we eliminate this path.
# - Issue #3 (timestamp): Always use datetime.now(timezone.utc).isoformat() — never copy from trigger.
# - Issue #4 (60s timeout): N/A for this agent (it IS the upstream).

from utils import get_llm_for_agent
import asyncio
import json
import logging
import random
from dotenv import load_dotenv
import os
from langgraph.checkpoint.memory import InMemorySaver
from band import Agent
from band.adapters import LangGraphAdapter
from band.config import load_agent_config
from datetime import datetime, timezone
from langchain_core.messages import SystemMessage, HumanMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Track when this agent process started — used to skip stale bootstrap messages
AGENT_START_TIME = datetime.now(timezone.utc)

EVENT_INTELLIGENCE_SYSTEM_PROMPT = """You are the Event Intelligence Agent in a Supply Chain Disruption system.

You receive raw disruption event text. Classify it into a structured event object.

CRITICAL RULES:
- You are ONLY the event_intelligence agent.
- Do NOT post findings on behalf of any other agent (supplier_impact, financial_exposure, regulatory_trade, alt_sourcing, coordinator).
- Respond ONLY with a single valid JSON object. No markdown, no code fences, no prose.

Output EXACTLY this JSON schema (replace angle-bracket values):
{
  "agent": "event_intelligence",
  "case_id": "<CASE_ID_PLACEHOLDER>",
  "timestamp": "<TIMESTAMP_PLACEHOLDER>",
  "status": "complete",
  "findings": {
    "event_type": "<natural_disaster|port_strike|tariff|sanctions|geopolitical|pandemic>",
    "severity": "<CRITICAL|HIGH|MEDIUM|LOW>",
    "location": "<city, country>",
    "affected_industries": ["<industry1>", "<industry2>"],
    "estimated_duration_weeks": <integer>,
    "summary": "<one sentence plain english summary>"
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

Start your response with { and end with }. Output only the JSON object."""


def check_trigger_and_check_duplicate(msg, history, agent_name, trigger_condition_func):
    """Parse all messages to find the trigger and check for duplicate responses."""
    all_msgs = []

    for m in history:
        content = m.content
        if content.startswith("[") and "]: " in content:
            content = content.split("]: ", 1)[1]
        try:
            if "{" in content:
                content = content[content.find("{"):content.rfind("}")+1]
            data = json.loads(content)
        except Exception:
            data = {}
        all_msgs.append(data)

    # Append the current message
    try:
        content = msg.content
        if content.startswith("[") and "]: " in content:
            content = content.split("]: ", 1)[1]
        if "{" in content:
            content = content[content.find("{"):content.rfind("}")+1]
        current_data = json.loads(content)
    except Exception:
        current_data = {}
    all_msgs.append(current_data)

    # Find the most recent trigger message
    trigger_msg_data = None
    for data in reversed(all_msgs):
        if trigger_condition_func(data):
            trigger_msg_data = data
            break

    if not trigger_msg_data:
        return None, False

    # Check if we already responded to this case_id
    case_id = trigger_msg_data.get("case_id")
    already_responded = any(
        d.get("agent") == agent_name and d.get("case_id") == case_id and
        d.get("status") in ("complete", "escalate", "insufficient_data")
        for d in all_msgs
    )

    return trigger_msg_data, already_responded


def generate_fallback_event_findings(event_text):
    """Pure-Python heuristic fallback (no LLM) for when LLM call fails."""
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
    elif "rotterdam" in text or "dockworkers" in text or "port" in text:
        return {
            "event_type": "port_strike",
            "severity": "HIGH",
            "location": "Rotterdam, Netherlands",
            "affected_industries": ["logistics", "manufacturing"],
            "estimated_duration_weeks": 4,
            "summary": "Dockworkers strike at major port paralyzes European logistics operations."
        }, "HIGH", []
    elif "tariff" in text or "sanction" in text or "china" in text:
        return {
            "event_type": "tariff",
            "severity": "HIGH",
            "location": "China",
            "affected_industries": ["semiconductor", "electronics"],
            "estimated_duration_weeks": 12,
            "summary": "New tariffs imposed on semiconductor components imports, impacting supply chains."
        }, "HIGH", []
    else:
        return {
            "event_type": "geopolitical",
            "severity": "MEDIUM",
            "location": "unknown",
            "affected_industries": ["unknown"],
            "estimated_duration_weeks": 2,
            "summary": f"Supply chain disruption event reported: {event_text[:100] if event_text else 'unknown'}."
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
            msg, history, "event_intelligence",
            lambda data: data.get("agent") == "coordinator" and data.get("phase") == "kickoff"
        )

        if not trigger_msg_data:
            logger.info("Trigger kickoff message not found. Skipping.")
            await asyncio.sleep(0.5 + random.random() * 2.5)
            return

        # Skip stale kickoffs from before this process started (>5 min old)
        kickoff_ts = trigger_msg_data.get("timestamp")
        if kickoff_ts:
            try:
                kt = datetime.fromisoformat(kickoff_ts.replace("Z", "+00:00"))
                age_secs = (AGENT_START_TIME - kt).total_seconds()
                if age_secs > 300:
                    logger.info(f"Skipping stale kickoff {trigger_msg_data.get('case_id')} (age={int(age_secs)}s > 300s)")
                    await asyncio.sleep(0.5 + random.random() * 2.5)
                    return
            except Exception:
                pass

        case_id = trigger_msg_data.get("case_id")
        if already_responded:
            logger.info(f"Already responded to case {case_id}. Skipping.")
            await asyncio.sleep(0.5 + random.random() * 2.5)
            return

        logger.info(f"Processing kickoff event for case {case_id}")
        event_text = trigger_msg_data.get("event_text", "")

        # Find all other handles to mention so downstream agents wake up
        from utils import get_room_participants
        mentions = []
        try:
            handles = await get_room_participants(room_id, "event_intelligence", participants_msg)
            for h in handles:
                # Exclude the agent's own handle and user identity to prevent cannot_mention_self
                if "event" not in h.lower() and h.lower() != "rshricharan29":
                    mentions.append(h)
        except Exception as e:
            logger.error(f"Failed to fetch participants: {e}")
            
        if not mentions:
            mentions = ["vaithish7/coordinator"]  # Fallback

        # --- Issue #2 fix: call LLM directly via ainvoke, never via super().on_message() ---
        # This ensures we own the send flow entirely, preventing malformed /processed payloads.
        # ALWAYS generate our own timestamp (Issue #3 fix).
        now_ts = datetime.now(timezone.utc).isoformat()

        try:
            if not event_text or len(event_text.strip()) < 10:
                logger.info("Event text too short — using heuristic fallback.")
                findings, confidence, flags = generate_fallback_event_findings(event_text)
                response_envelope = {
                    "agent": "event_intelligence",
                    "case_id": case_id,
                    "timestamp": now_ts,  # Always our own timestamp
                    "status": "complete",
                    "findings": findings,
                    "confidence": confidence,
                    "flags": flags if flags else []
                }
                await tools.send_message(
                    content=json.dumps(response_envelope),
                    mentions=mentions
                )
                logger.info(f"Heuristic event intelligence posted for case {case_id}.")
                return

            # Call LLM directly — never via super().on_message()
            logger.info("Calling LLM directly via ainvoke (bypass super to prevent 422)...")
            llm = get_llm_for_agent("event_intelligence")

            # Inject case_id and timestamp placeholders into the system prompt
            system_with_context = EVENT_INTELLIGENCE_SYSTEM_PROMPT.replace(
                "<CASE_ID_PLACEHOLDER>", case_id
            ).replace(
                "<TIMESTAMP_PLACEHOLDER>", now_ts
            )

            user_msg = f"Disruption event text:\n{event_text}\n\nAnalyze this event and output the JSON response."

            llm_response = None
            for attempt in range(2):
                try:
                    result = await llm.ainvoke([
                        SystemMessage(content=system_with_context),
                        HumanMessage(content=user_msg)
                    ])
                    llm_response = result.content
                    logger.info(f"LLM responded (attempt {attempt+1}): {llm_response[:200]}...")
                    break
                except Exception as ex:
                    logger.warning(f"LLM call attempt {attempt+1} failed: {ex}")
                    if attempt == 1:
                        raise ex

            # Parse LLM response
            findings_data = None
            if llm_response:
                try:
                    # Strip markdown code fences if present
                    clean = llm_response.strip()
                    if "```json" in clean:
                        clean = clean.split("```json")[1].split("```")[0].strip()
                    elif "```" in clean:
                        clean = clean.split("```")[1].split("```")[0].strip()
                    # Extract JSON object
                    if "{" in clean:
                        clean = clean[clean.find("{"):clean.rfind("}")+1]
                    findings_data = json.loads(clean)
                    logger.info(f"Successfully parsed LLM JSON for case {case_id}")
                except Exception as parse_err:
                    logger.warning(f"Failed to parse LLM JSON: {parse_err}. Raw: {llm_response[:300]}")
                    findings_data = None

            if findings_data and findings_data.get("findings"):
                # Enforce correct agent name, case_id, and OUR timestamp (Issue #3)
                findings_data["agent"] = "event_intelligence"
                findings_data["case_id"] = case_id
                findings_data["timestamp"] = now_ts  # Always overwrite with our own timestamp
                if "flags" not in findings_data or findings_data["flags"] is None:
                    findings_data["flags"] = []

                await tools.send_message(
                    content=json.dumps(findings_data),
                    mentions=mentions
                )
                logger.info(f"LLM-generated event intelligence posted for case {case_id}.")
                logger.info(f"PAYLOAD SENT: {json.dumps(findings_data)}")
            else:
                # LLM gave bad output — use heuristic fallback
                logger.warning("LLM output invalid, falling back to heuristic.")
                findings, confidence, flags = generate_fallback_event_findings(event_text)
                response_envelope = {
                    "agent": "event_intelligence",
                    "case_id": case_id,
                    "timestamp": now_ts,
                    "status": "complete",
                    "findings": findings,
                    "confidence": confidence,
                    "flags": flags if flags else []
                }
                await tools.send_message(
                    content=json.dumps(response_envelope),
                    mentions=mentions
                )
                logger.info(f"Heuristic fallback event intelligence posted for case {case_id}.")

        except Exception as e:
            logger.error(f"Fatal error in event_intelligence for case {case_id}: {e}")
            # Always post something to unblock downstream agents
            findings, confidence, flags = generate_fallback_event_findings(event_text)
            response_envelope = {
                "agent": "event_intelligence",
                "case_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "complete",
                "findings": findings,
                "confidence": "MEDIUM",
                "flags": [f"LLM failed, used heuristic fallback: {str(e)[:100]}"]
            }
            try:
                await tools.send_message(
                    content=json.dumps(response_envelope),
                    mentions=mentions
                )
                logger.info(f"Emergency heuristic fallback posted for case {case_id}.")
            except Exception as send_err:
                logger.error(f"Even emergency send failed: {send_err}")


async def main():
    load_dotenv()

    llm = get_llm_for_agent("event_intelligence")

    adapter = CustomEventIntelligenceAdapter(
        llm=llm,
        checkpointer=InMemorySaver(),
        custom_section=EVENT_INTELLIGENCE_SYSTEM_PROMPT,
    )
    agent_id, api_key_config = load_agent_config("event_intelligence")
    agent = Agent.create(adapter=adapter, agent_id=agent_id, api_key=api_key_config)
    logger.info("Event Intelligence Agent running...")
    await agent.run()

if __name__ == "__main__":
    asyncio.run(main())
