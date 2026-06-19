import asyncio
import os
import httpx
from band.config import load_agent_config

async def test():
    room_id = "9a431840-2645-4657-8c77-dd5b333a4f6e"
    
    _, api_key = load_agent_config("event_intelligence")
    
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"https://app.band.ai/api/v1/agent/chats/{room_id}/messages/next",
            headers={"x-api-key": api_key}
        )
        print("NEXT (Event Intel):", r.status_code)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, dict) and "data" in data:
                print("Msg ID:", data["data"]["id"])
            else:
                print(data)

asyncio.run(test())
