import os
import logging
import langchain
from langchain_openai import ChatOpenAI

langchain.debug = True
logger = logging.getLogger(__name__)

def get_llm_for_agent(agent_name: str):
    """
    Returns the appropriate ChatOpenAI instance for the given agent.
    Checks environment variables to determine whether to use AIML API
    as primary. Fails fast if aiml key is not provided.
    """
    aiml_key = os.getenv("AIML_API_KEY", "").strip()
    # Check for dummy values previously used
    if aiml_key.startswith("your_") or aiml_key == "key-from-band-dashboard" or aiml_key == "dummy-key":
        aiml_key = ""
        
    # featherless_key = os.getenv("FEATHERLESS_API_KEY", "").strip()
    # if featherless_key.startswith("your_") or featherless_key == "dummy-key":
    #     featherless_key = ""

    if not aiml_key:
        raise ValueError(
            f"Startup Error for {agent_name}: AIML_API_KEY is missing from environment variables. "
            "Please provide a valid API key."
        )

    # NOTE: Featherless fallback has been disabled because open models tested
    # were either gated (requiring HuggingFace OAuth) or had unreliable 
    # tool-calling formatting within our testing timeframe.
    # featherless_llm = ChatOpenAI(
    #     model="meta-llama/Meta-Llama-3-8B-Instruct",
    #     openai_api_key=featherless_key or "dummy-key",
    #     openai_api_base="https://api.featherless.ai/v1",
    #     max_retries=1
    # ) if featherless_key else None

    logger.info(f"[{agent_name}] Initializing LLM via AIML API (primary=gpt-4o-mini, fallback=gpt-4o)...")
    primary_llm = ChatOpenAI(
        model="gpt-4o-mini",
        openai_api_key=aiml_key,
        openai_api_base="https://api.aimlapi.com/v1",
        max_retries=1
    )
    
    fallback_llm = ChatOpenAI(
        model="gpt-4o",
        openai_api_key=aiml_key,
        openai_api_base="https://api.aimlapi.com/v1",
        max_retries=1
    )
    
    return primary_llm.with_fallbacks([fallback_llm])

# --- Monkeypatch httpx for debugging ---
import httpx
import logging
logger = logging.getLogger("httpx_monkeypatch")

_orig_request = httpx.AsyncClient.request

async def _mock_request(self, method, url, **kwargs):
    # Print the API Key from headers
    headers = kwargs.get("headers") or {}
    
    # Handle httpx.Headers which might not have get like a normal dict
    if hasattr(headers, "get"):
        api_key = headers.get("X-API-Key") or headers.get("Authorization")
    else:
        api_key = None
        
    # Mask api_key to only show first 8 chars for security
    masked_key = f"{api_key[-8:]}" if isinstance(api_key, str) else str(api_key)
    
    if "messages" in str(url):
        logger.info(f"MONKEYPATCH: {method} {url} | Key: {masked_key}")
    
    return await _orig_request(self, method, url, **kwargs)

httpx.AsyncClient.request = _mock_request

import json
import re
from band.config import load_agent_config

async def get_room_participants(room_id: str, agent_name: str, participants_msg_fallback: str) -> list[str]:
    """
    Fetches the list of participant handles from the Band API (PRIMARY).
    Falls back to regex-parsing the markdown participants_msg (SECONDARY).
    Returns a list of handles with @ prefix (e.g. ['@john/agent', '@mary']).
    """
    import httpx
    handles = []
    # 1. PRIMARY: Fetch from Band API
    try:
        _, api_key = load_agent_config(agent_name)
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://app.band.ai/api/v1/agent/chats/{room_id}/participants",
                headers={"x-api-key": api_key},
                timeout=5.0
            )
            if resp.status_code == 200:
                data = resp.json()
                # data is typically a list of participant objects, or an object with "data" list
                p_list = data.get("data", data) if isinstance(data, dict) else data
                for p in p_list:
                    if isinstance(p, dict):
                        h = p.get("handle")
                        if h:
                            # Normalize: always prefix with @ for Band mentions
                            if not h.startswith("@"):
                                h = f"@{h}"
                            handles.append(h)
                if handles:
                    logger.info(f"[get_room_participants] API returned (normalized): {handles}")
                    return handles
            else:
                logger.warning(f"Failed to fetch participants via API: HTTP {resp.status_code}")
    except Exception as e:
        logger.warning(f"Error fetching participants via API: {e}")

    # 2. SECONDARY: Parse the markdown fallback string
    logger.info("Falling back to regex parsing of participants_msg")
    try:
        p_str = participants_msg_fallback if isinstance(participants_msg_fallback, str) else getattr(participants_msg_fallback, "content", "")
        # Matches "- @handle —" or "- @handle"
        found = re.findall(r'- (@[^\s]+)', p_str)
        if found:
            # remove formatting artifacts like "—" if captured
            found = [f.rstrip('—').strip() for f in found]
            handles.extend(found)
            return handles
    except Exception as e:
        logger.error(f"Failed to regex parse participants_msg: {e}")

    return handles


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
            "ExecutionContext %s: processed ack retry budget exhausted for message %s (5 retries); forcing mark_failed to clear it from /next",
            self.room_id,
            message_id,
        )
        try:
            await self.link.mark_failed(self.room_id, message_id, "Stuck in /next queue, 422 processed ack")
        except Exception:
            pass
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
        if not hasattr(self, '_msg_seen_counts'):
            self._msg_seen_counts = {}
            
        count = self._msg_seen_counts.get(msg.id, 0) + 1
        self._msg_seen_counts[msg.id] = count
        
        if count > 5:
            await asyncio.sleep(2)  # Sleep to prevent tight loop DDOS
            if count == 6:
                import logging
                log = logging.getLogger("band")
                log.error(f"Message {msg.id} STUCK in /next. Forcing mark_failed to clear it.")
                try:
                    await self.link.mark_failed(self.room_id, msg.id, "Stuck in /next queue")
                except Exception:
                    pass
    return msg

ExecutionContext._get_next_message = _mock_get_next_message

