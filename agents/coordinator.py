# agents/coordinator.py
from utils import get_llm_for_agent
import asyncio
import logging
import json
import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from band import Agent
from band.adapters import LangGraphAdapter
from band.config import load_agent_config
import httpx
import time
from langchain_core.messages import SystemMessage, HumanMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

COORDINATOR_PROMPT = """
You are the Coordinator Agent and Senior Supply Chain Analyst for a Disruption Intelligence System.

Your job runs in TWO phases:

PHASE 1 — When you receive a raw disruption event from a human:
1. Acknowledge the event
2. Assign it a case ID (format: CASE-XXX)
3. Post a structured kickoff message telling all specialist agents to begin
4. Your kickoff message must include the raw event text and case ID

Post this exact JSON to the Band room:
{
  "agent": "coordinator",
  "case_id": "<use the exact case_id given in your system instructions or the triggering message>",
  "phase": "kickoff",
  "event_text": "<raw event text here>",
  "instruction": "All specialist agents: analyze this event and post your findings",
  "agents_required": ["event_intelligence", "supplier_impact", "financial_exposure", "regulatory_trade", "alt_sourcing"]
}

PHASE 2 — When you see ALL specialist agents have posted their findings:
1. Read all findings from the Band room carefully.
2. Write a highly detailed, professional, multi-paragraph situation overview summarizing the entire event. It must synthesize concrete data from ALL 4 specialist agents (Supplier Impact, Financial Exposure, Regulatory, and Alternative Sourcing) into a comprehensive final report. Do not just output 2-3 sentences. Write a senior-level analysis.
3. Give a single verdict: AUTO_RESOLVE or ESCALATE_TO_HUMAN
4. List the top 3 recommended actions

Post this JSON:
{
  "agent": "coordinator",
  "case_id": "<use the actual case_id you are managing>",
  "phase": "executive_brief",
  "situation_summary": "Highly detailed, professional, multi-paragraph situation overview synthesizing all data.",
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "verdict": "ESCALATE_TO_HUMAN|AUTO_RESOLVE",
  "top_3_actions": [
    "Action 1 with deadline",
    "Action 2 with deadline",
    "Action 3 with deadline"
  ],
  "financial_exposure": "summarized from financial agent",
  "recommended_supplier": "from alt sourcing agent",
  "compliance_deadline": "most urgent deadline from regulatory agent"
}

Respond with raw JSON only. Do not use markdown code fences. Do not add
any prose before or after the JSON. Start your response with { and end
with }.

CRITICAL RULES:
- You MUST call the `band_send_message` tool to communicate. Do NOT output any plain text or markdown directly from your thinking graph; it will be discarded and won't reach the chat room. Always wrap your response in a `band_send_message` tool call.
- Set the `content` argument of `band_send_message` to the raw JSON string matching the exact schema above.
- Set the `mentions` argument to tag the relevant participants (e.g., human operator or specialist agents).
"""

import json
from datetime import datetime, timezone

class CustomCoordinatorAdapter(LangGraphAdapter):
    async def on_message(
        self, msg, tools, history, participants_msg, contacts_msg, *, is_session_bootstrap: bool, room_id: str
    ) -> None:
        print(f"[COORDINATOR ENTRY] Message received. Parsed data: {getattr(msg, 'parsed', 'None')}")

        # Parse from msg.parsed first (preferred), fall back to content parsing
        data = {}
        if isinstance(getattr(msg, 'parsed', None), dict):
            data = msg.parsed
            print(f"[COORDINATOR] Using msg.parsed directly: agent={data.get('agent')}")
        else:
            try:
                content = msg.content
                if content.startswith("[") and "]: " in content:
                    content = content.split("]: ", 1)[1]
                if "{" in content:
                    content = content[content.find("{"):content.rfind("}")+1]
                data = json.loads(content)
                print(f"[COORDINATOR] Parsed from msg.content: agent={data.get('agent')}")
            except Exception as e:
                print(f"[COORDINATOR] Failed to parse msg.content: {e}")
                logger.error(f"Failed to parse coordinator msg: {e}")
                data = {}

        logger.info(f"DEBUG COORDINATOR PARSED: {data}")

        # PHASE 1: Human operator kickoff
        if data.get("agent") == "human_operator":
            logger.info("Received human operator message, sending Phase 1 kickoff...")
            print(f"[COORDINATOR] PHASE 1 triggered for case {data.get('case_id')}")
            case_id = data.get("case_id", f"CASE-{int(datetime.now(timezone.utc).timestamp())}")
            event_text = data.get("event_text", "")
            
            kickoff_msg = {
                "agent": "coordinator",
                "case_id": case_id,
                "phase": "kickoff",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "event_text": event_text,
                "instruction": "Specialist agents: please begin your respective analyses independently. ONLY respond with your own specific agent's findings.",
                "agents_required": ["event_intelligence", "supplier_impact", "financial_exposure", "regulatory_trade", "alt_sourcing"]
            }
            
            # Find specialist agents to mention using API or fallback
            mentions = []
            from utils import get_room_participants
            try:
                handles = await get_room_participants(room_id, "coordinator", participants_msg)
                logger.info(f"[PARTICIPANTS_DEBUG] Extracted handles: {handles}")
                print(f"[COORDINATOR] Participant handles (normalized): {handles}")
                
                for h in handles:
                    if "/" in h and "coordinator" not in h.lower():
                        mentions.append(h)
            except Exception as e:
                logger.error(f"Failed to fetch participants: {e}")
                print(f"[COORDINATOR] ERROR fetching participants: {e}")
            
            # If no mentions found, use hardcoded real handles
            if not mentions:
                print("[COORDINATOR] No mentions resolved — using hardcoded fallback handles")
                mentions = [
                    "@rshricharan29/event-intelligence",
                    "@rshricharan29/supplier-impact",
                    "@sreedarsan0311/financial-exposure",
                    "@belugaok3/regulatory-agent",
                    "@sreedarsan0311/alt-sourcing",
                ]

            print(f"[COORDINATOR] Posting kickoff with mentions: {mentions}")
            try:
                await tools.send_message(
                    content=json.dumps(kickoff_msg, indent=2),
                    mentions=mentions
                )
                print(f"[COORDINATOR] Kickoff posted successfully for {case_id}")
            except Exception as send_err:
                print(f"[COORDINATOR] FATAL: send_message failed: {type(send_err).__name__}: {send_err}")
                logger.error(f"FATAL: Coordinator kickoff send_message failed: {send_err}")
                raise

            
            # Spawn a non-blocking timeout task to poll completion and wake the coordinator
            import asyncio
            async def monitor_completion(case_id_param, m_list):
                room_data = None
                is_timeout = False
                start_time = datetime.now(timezone.utc)
                
                # Strictly wait for alt_sourcing and others
                while True:
                    await asyncio.sleep(5)
                    if (datetime.now(timezone.utc) - start_time).total_seconds() > 180:
                        logger.warning("Timeout waiting for specialists. Generating brief anyway.")
                        is_timeout = True
                        break
                    try:
                        async with httpx.AsyncClient() as client:
                            resp = await client.get(f"http://localhost:8000/case-status?case_id={case_id_param}")
                            if resp.status_code == 200:
                                room_data = resp.json()
                                if room_data.get("specialists_done"):
                                    logger.info("All 5 specialists complete. Calling LLM for Executive Brief...")
                                    break
                    except Exception as e:
                        logger.warning(f"Error polling case status: {e}")
                        
                # We fetch ALL room messages to feed to LLM
                messages = []
                try:
                    async with httpx.AsyncClient() as client:
                        resp = await client.get(f"http://localhost:8000/room-messages?case_id={case_id_param}")
                        if resp.status_code == 200:
                            messages = resp.json().get("messages", [])
                except Exception as e:
                    logger.error(f"Failed to fetch room messages: {e}")

                findings_text = ""
                for m in messages:
                    if m.get("parsed") and m["parsed"].get("agent") in ["event_intelligence", "supplier_impact", "financial_exposure", "regulatory_trade", "alt_sourcing", "coordinator"]:
                        findings_text += f"\n--- Message from {m['parsed']['agent']} ---\n{json.dumps(m['parsed'], indent=2)}\n"

                prompt_text = COORDINATOR_PROMPT + f"\n\nYOUR ASSIGNED CASE ID IS: {case_id_param}\n\n=== CHAT HISTORY ===\n" + findings_text
                
                llm = get_llm_for_agent("coordinator").bind(response_format={"type": "json_object"})
                try:
                    result = await llm.ainvoke([
                        SystemMessage(content=prompt_text),
                        HumanMessage(content="All specialists have finished or timed out. Please generate the final Executive Brief JSON. Output ONLY raw JSON. No markdown.")
                    ])
                    content = result.content
                    if "```json" in content:
                        content = content.split("```json")[1].split("```")[0]
                    elif "```" in content:
                        content = content.split("```")[1].split("```")[0]
                    content = content.strip()
                    
                    try:
                        json.loads(content)
                    except json.JSONDecodeError as e:
                        logger.error(f"Malformed JSON from coordinator LLM: {e}. Retrying once...")
                        result = await llm.ainvoke([
                            SystemMessage(content=prompt_text),
                            HumanMessage(content="The last response was invalid JSON. Please generate the final Executive Brief JSON. Output ONLY valid raw JSON without markdown.")
                        ])
                        content = result.content
                        if "```json" in content:
                            content = content.split("```json")[1].split("```")[0]
                        elif "```" in content:
                            content = content.split("```")[1].split("```")[0]
                        content = content.strip()
                        json.loads(content) # if it fails here, it falls through to terminal failure
                        
                    if hasattr(tools, 'send_message'):
                        await tools.send_message(content=content, mentions=m_list)
                except Exception as e:
                    logger.error(f"Terminal LLM failure during brief generation: {e}")
                    response = {
                        "agent": "coordinator",
                        "case_id": case_id_param,
                        "phase": "executive_brief",
                        "situation_summary": f"Failed to generate Executive Brief due to LLM error. Timeout status: {is_timeout}.",
                        "severity": "CRITICAL",
                        "verdict": "ESCALATE_TO_HUMAN",
                        "top_3_actions": ["Investigate LLM pipeline failure immediately."],
                        "financial_exposure": "Unknown",
                        "recommended_supplier": "Unknown",
                        "compliance_deadline": "Unknown"
                    }
                    if hasattr(tools, 'send_message'):
                        await tools.send_message(content=json.dumps(response), mentions=m_list)
            
            asyncio.create_task(monitor_completion(case_id, mentions))
            return {"status": "skipped"}
        # Phase 2 is now handled entirely by the background task monitor_completion
        return {"status": "skipped"}
async def main():
    # Load env variables from local and parent dir
    load_dotenv()
    parent_env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", ".env")
    if os.path.exists(parent_env):
        load_dotenv(parent_env)

    llm = get_llm_for_agent("coordinator")

    adapter = CustomCoordinatorAdapter(
        llm=llm,
        checkpointer=InMemorySaver(),
        custom_section=COORDINATOR_PROMPT,
    )

    agent_id, api_key = load_agent_config("coordinator")
    agent = Agent.create(adapter=adapter, agent_id=agent_id, api_key=api_key)

    logger.info("Coordinator Agent running...")
    await agent.run()

if __name__ == "__main__":
    asyncio.run(main())