import os
import requests
import json
api_key = os.getenv("AIML_API_KEY")
res = requests.get("https://api.aimlapi.com/v1/models", headers={"Authorization": f"Bearer {api_key}"})
models = res.json().get("data", [])
for m in models:
    if "claude" in m.get("id", "").lower() or "claude" in m.get("name", "").lower():
        print(m.get("id"))
