import re

with open('agents/utils.py', 'r') as f:
    content = f.read()

patch = """
# MONKEYPATCH ExecutionContext to prevent infinite loops and 422 spam
from band.runtime.execution import ExecutionContext
import asyncio
import logging

_orig_retry_processed_ack = ExecutionContext._retry_processed_ack

async def _mock_retry_processed_ack(self, message_id: str) -> bool:
    if message_id not in self._processed_ack_pending_ids:
        return False

    self._processed_ack_pending_ids.move_to_end(message_id)
    durable_processed = await self.link.mark_processed(self.room_id, message_id)
    if durable_processed:
        self._retry_tracker.mark_success(message_id)
        self._remember_processed_message(message_id)
        return True

    retries = self._processed_ack_retry_counts.get(message_id, 0) + 1
    self._processed_ack_retry_counts[message_id] = retries
    
    # HARD CAP: 5 times
    if retries >= 5:
        logger = logging.getLogger("band")
        logger.warning(
            "ExecutionContext %s: processed ack retry budget exhausted for message %s (5 retries); keeping local completion marker",
            self.room_id,
            message_id,
        )
        self._retry_tracker.mark_success(message_id)
        self._remember_processed_message(message_id)
        return True

    return False

ExecutionContext._retry_processed_ack = _mock_retry_processed_ack

# Also monkeypatch _get_next_message to sleep if it keeps getting the same message
_orig_get_next_message = ExecutionContext._get_next_message

async def _mock_get_next_message(self):
    msg = await _orig_get_next_message(self)
    if msg is not None:
        if not hasattr(self, '_last_seen_msg'):
            self._last_seen_msg = None
            self._same_msg_count = 0
            
        if self._last_seen_msg == msg.id:
            self._same_msg_count += 1
            if self._same_msg_count > 5:
                await asyncio.sleep(2)  # Sleep to prevent tight loop DDOS
        else:
            self._last_seen_msg = msg.id
            self._same_msg_count = 1
    return msg

ExecutionContext._get_next_message = _mock_get_next_message
"""

if "_mock_retry_processed_ack" not in content:
    with open('agents/utils.py', 'a') as f:
        f.write("\n" + patch + "\n")
