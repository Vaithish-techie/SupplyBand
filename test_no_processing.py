import asyncio
import os
import httpx
from band.config import load_agent_config

async def test():
    room_id = "9a431840-2645-4657-8c77-dd5b333a4f6e"
    # Find a message id from a different run that this agent NEVER processed
    msg_id = "0c9e68c0-a50c-4769-8584-245ae5fd311c"
    
    _, api_key = load_agent_config("alt_sourcing")
    
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"https://app.band.ai/api/v1/agent/chats/{room_id}/messages/{msg_id}/processed",
            headers={"x-api-key": api_key}
        )
        print("Processed without Processing:", r.status_code, r.text)

asyncio.run(test())
