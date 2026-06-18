import asyncio
from band.runtime.execution import ExecutionContext

print(hasattr(ExecutionContext, '_retry_processed_ack'))
