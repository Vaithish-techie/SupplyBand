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
    headers = kwargs.get("headers", {})
    api_key = headers.get("X-API-Key") or headers.get("Authorization")
    # Mask api_key to only show first 8 chars for security
    masked_key = f"{api_key[-8:]}" if isinstance(api_key, str) else str(api_key)
    
    if "messages" in str(url):
        logger.info(f"MONKEYPATCH: {method} {url} | Key: {masked_key}")
    
    return await _orig_request(self, method, url, **kwargs)

httpx.AsyncClient.request = _mock_request
