import asyncio
from band.config import load_agent_config

print("Event Intelligence:", load_agent_config("event_intelligence")[0])
print("Alt Sourcing:", load_agent_config("alt_sourcing")[0])
