import asyncio
import os
import httpx
from band.config import load_agent_config

async def test():
    room_id = "9a431840-2645-4657-8c77-dd5b333a4f6e"
    msg_id = "0d4210d2-c076-4ce7-80d3-13407ae57f3c" 
    
    _, api_key = load_agent_config("event_intelligence")
    
    async with httpx.AsyncClient() as client:
        # maybe there's a GET /messages/{msg_id} endpoint?
        r = await client.get(
            f"https://app.band.ai/api/v1/agent/chats/{room_id}/messages/{msg_id}",
            headers={"x-api-key": api_key}
        )
        print("GET (Event Intel):", r.status_code, r.text)

asyncio.run(test())
