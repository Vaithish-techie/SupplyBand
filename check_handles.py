import asyncio
import httpx
import yaml

async def get_handles():
    with open('agent_config.yaml') as f:
        cfg = yaml.safe_load(f)
    key = list(cfg.values())[0]['api_key']
    
    async with httpx.AsyncClient() as client:
        r = await client.get(
            'https://app.band.ai/api/v1/agent/chats/0ed6ab44-a64e-4e60-910f-77f32b86a175/participants',
            headers={'x-api-key': key}
        )
        print([p.get('handle') for p in r.json().get('data', [])])

asyncio.run(get_handles())
