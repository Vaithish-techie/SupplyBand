import asyncio
import os
import httpx
from band.config import load_agent_config

async def test():
    room_id = "9a431840-2645-4657-8c77-dd5b333a4f6e"
    msg_id = "0d4210d2-c076-4ce7-80d3-13407ae57f3c"
    _, api_key = load_agent_config("alt_sourcing")
    
    async with httpx.AsyncClient() as client:
        # Try to process
        r1 = await client.post(
            f"https://app.band.ai/api/v1/agent/chats/{room_id}/messages/{msg_id}/processing",
            headers={"x-api-key": api_key}
        )
        print("Processing:", r1.status_code, r1.text)
        
        # Try to send state
        r_state = await client.post(
            f"https://app.band.ai/api/v1/agent/chats/{room_id}/events",
            headers={"x-api-key": api_key},
            json={"message_type": "agent_state", "content": '{"status": "skipped"}'}
        )
        print("State:", r_state.status_code, r_state.text)

        # Try to mark processed
        r2 = await client.post(
            f"https://app.band.ai/api/v1/agent/chats/{room_id}/messages/{msg_id}/processed",
            headers={"x-api-key": api_key}
        )
        print("Processed:", r2.status_code, r2.text)

asyncio.run(test())
