# agents/coordinator.py
import asyncio
import logging
import json
import os
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
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

Always respond with valid JSON only. No prose, no markdown.
"""

async def main():
    # Load env variables from local and parent dir
    load_dotenv()
    parent_env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", ".env")
    if os.path.exists(parent_env):
        load_dotenv(parent_env)

    # Initialize the LLM based on available keys
    aiml_api_key = os.getenv("AIML_API_KEY")
    if aiml_api_key:
        logger.info("Initializing LLM via AIML API (gpt-4o)...")
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(
            model="gpt-4o",
            openai_api_key=aiml_api_key,
            openai_api_base="https://api.aimlapi.com/v1",
        )
    else:
        logger.info("Initializing LLM via direct Anthropic (claude-sonnet-4-5)...")
        from langchain_anthropic import ChatAnthropic
        llm = ChatAnthropic(model="claude-sonnet-4-5")

    adapter = LangGraphAdapter(
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