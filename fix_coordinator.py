import json

def parse_llm_output(content):
    if not content: return None
    if "{" not in content: return None
    start = content.find("{")
    end = content.rfind("}") + 1
    try:
        return json.loads(content[start:end])
    except:
        return None
