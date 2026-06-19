import asyncio
import httpx
from band.config import load_agent_config

async def main():
    agent_id, api_key = load_agent_config("coordinator")
    async with httpx.AsyncClient() as client:
        # Create a new room
        r = await client.post(
            "https://app.band.ai/api/v1/agent/chats",
            headers={"x-api-key": api_key},
            json={}
        )
        print("Create room:", r.status_code, r.text)

asyncio.run(main())
