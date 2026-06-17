# agents/coordinator.py
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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

COORDINATOR_PROMPT = """
You are the Coordinator Agent for a Supply Chain Disruption Intelligence System.

Your job runs in TWO phases:

PHASE 1 — When you receive a raw disruption event from a human:
1. Acknowledge the event
2. Assign it a case ID (format: CASE-XXX)
3. Post a structured kickoff message telling all specialist agents to begin
4. Your kickoff message must include the raw event text and case ID

Post this exact JSON to the Band room:
{
  "agent": "coordinator",
  "case_id": "CASE-001",
  "phase": "kickoff",
  "event_text": "<raw event text here>",
  "instruction": "All specialist agents: analyze this event and post your findings",
  "agents_required": ["event_intelligence", "supplier_impact", "financial_exposure", "regulatory_trade", "alt_sourcing"]
}

PHASE 2 — When you see ALL 5 specialist agents have posted their findings:
1. Read all findings from the Band room
2. Write an executive brief summarizing the situation
3. Give a single verdict: AUTO_RESOLVE or ESCALATE_TO_HUMAN
4. List the top 3 recommended actions

Post this JSON:
{
  "agent": "coordinator",
  "case_id": "CASE-001",
  "phase": "executive_brief",
  "situation_summary": "plain english 2-3 sentence summary",
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
        try:
            content = msg.content
            if content.startswith("[") and "]: " in content:
                content = content.split("]: ", 1)[1]
            if "{" in content:
                content = content[content.find("{"):content.rfind("}")+1]
            data = json.loads(content)
        except Exception:
            data = {}

        # PHASE 1: Human operator kickoff
        is_backend_kickoff = data.get("agent") == "human_operator"
        is_direct_user_kickoff = msg.sender_type == "User" and not data.get("agent") and len(msg.content.strip()) > 10

        if is_backend_kickoff or is_direct_user_kickoff:
            logger.info("Received human operator message, sending Phase 1 kickoff...")
            
            if is_backend_kickoff:
                case_id = data.get("case_id", f"CASE-{int(datetime.now(timezone.utc).timestamp())}")
                event_text = data.get("event_text", "")
            else:
                import re
                highest_num = 0
                for m in history:
                    content = m.content
                    matches = re.findall(r"CASE-(\d+)", content)
                    for num_str in matches:
                        highest_num = max(highest_num, int(num_str))
                matches = re.findall(r"CASE-(\d+)", msg.content)
                for num_str in matches:
                    highest_num = max(highest_num, int(num_str))
                
                case_id = f"CASE-{highest_num + 1:03d}"
                event_text = re.sub(r"@\[\[[^\]]+\]\]\s*", "", msg.content).strip()
            
            kickoff_msg = {
                "agent": "coordinator",
                "case_id": case_id,
                "phase": "kickoff",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "event_text": event_text,
                "instruction": "All specialist agents: analyze this event and post your findings",
                "agents_required": ["event_intelligence", "supplier_impact", "financial_exposure", "regulatory_trade", "alt_sourcing"]
            }
            
            # Find specialist agents to mention
            mentions = []
            for p in tools.participants:
                handle = p.get("handle", "")
                if p.get("type") == "Agent" and "coordinator" not in handle.lower():
                    mentions.append(handle)
            
            await tools.send_message(
                content=json.dumps(kickoff_msg, indent=2),
                mentions=mentions
            )
            return

        # PHASE 2: Wait for all 5 specialists and then synthesize
        # Check if all specialists are done
        all_msgs = []
        for m in history:
            content = m.content
            if content.startswith("[") and "]: " in content:
                parts = content.split("]: ", 1)
                content = parts[1]
            try:
                msg_data = json.loads(content)
                all_msgs.append(msg_data)
            except:
                pass
        
        all_msgs.append(data)
        
        # Check if we have 5 complete
        case_id = data.get("case_id")
        if not case_id:
            return
            
        specialists = {"event_intelligence", "supplier_impact", "financial_exposure", "regulatory_trade", "alt_sourcing"}
        completed = set()
        for m in all_msgs:
            if m.get("case_id") == case_id and m.get("agent") in specialists and m.get("status") in ("complete", "insufficient_data"):
                completed.add(m.get("agent"))
        
        if len(completed) == 5:
            # Check if we already posted the brief
            for m in all_msgs:
                if m.get("agent") == "coordinator" and m.get("phase") == "executive_brief" and m.get("case_id") == case_id:
                    return # Already posted
                    
            logger.info("All 5 specialists complete. Calling LLM for Executive Brief...")
            try:
                # LLM call
                await super().on_message(
                    msg=msg, tools=tools, history=history, participants_msg=participants_msg, 
                    contacts_msg=contacts_msg, is_session_bootstrap=is_session_bootstrap, room_id=room_id
                )
            except Exception as e:
                logger.error(f"LLM call failed: {e}")

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