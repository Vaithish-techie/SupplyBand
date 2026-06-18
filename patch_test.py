import asyncio
from band.runtime.execution import ExecutionContext

original_resync = ExecutionContext._resync_pending_messages

async def patched_resync(self):
    print("Patched resync called!")
    return await original_resync(self)

ExecutionContext._resync_pending_messages = patched_resync

async def test():
    ctx = ExecutionContext(link=None, config=None, retry_tracker=None, room_id="123", dispatcher=None)
    # just checking if it patches
    pass

asyncio.run(test())
