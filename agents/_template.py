# agents/_template.py — copy this for each of the 5 specialist agents

from utils import get_llm_for_agent
import asyncio
import logging
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.memory import InMemorySaver
from thenvoi import Agent
from thenvoi.adapters import LangGraphAdapter
from thenvoi.config import load_agent_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# TEAMMATE: fill this in with your agent's specific prompt
AGENT_PROMPT = """
You are the [AGENT NAME] Agent.

WAKE UP CONDITION: Only respond when you see a Band message where 
"agent" field equals "[previous_agent_name]" and status is "complete".

Your job: [describe what this agent does]

Read the [previous_agent_name]'s findings from the room context.
Then post this exact JSON structure to Band:

{
  "agent": "[your_agent_name]",
  "case_id": "<use the same case_id from the message you're responding to>",
  "timestamp": "<current ISO8601 timestamp>",
  "status": "complete",
  "findings": {
    // fill in per SCHEMA.md
  },
  "confidence": "HIGH|MEDIUM|LOW",
  "flags": []
}

Always respond with valid JSON only. No prose, no markdown, no explanation outside the JSON.
"""

async def main():
    load_dotenv()

    adapter = LangGraphAdapter(
        llm=ChatAnthropic(model="claude-sonnet-4-5"),
        checkpointer=InMemorySaver(),
        custom_section=AGENT_PROMPT,
    )

    # TEAMMATE: change "template" to your agent name matching agent_config.yaml
    agent_id, api_key = load_agent_config("template")
    agent = Agent.create(adapter=adapter, agent_id=agent_id, api_key=api_key)

    logger.info("[AGENT NAME] Agent running...")
    await agent.run()

if __name__ == "__main__":
    asyncio.run(main())