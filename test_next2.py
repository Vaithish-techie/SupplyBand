import asyncio
import os
import httpx
import json
from band.config import load_agent_config

async def test():
    room_id = "9a431840-2645-4657-8c77-dd5b333a4f6e"
    _, api_key = load_agent_config("event_intelligence")
    
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"https://app.band.ai/api/v1/agent/chats/{room_id}/messages/next",
            headers={"x-api-key": api_key}
        )
        if r.status_code == 200:
            print(json.dumps(r.json(), indent=2))
        else:
            print(r.status_code, r.text)

asyncio.run(test())
