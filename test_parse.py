import json

content = """@[[1234]] New event for case CASE-123: Magnitude 7.4 earthquake
{"agent": "human_operator", "case_id": "CASE-123"}"""

if "[" in content and "]: " in content:
    content = content.split("]: ", 1)[1]
if "{" in content:
    content = content[content.find("{"):content.rfind("}")+1]
try:
    data = json.loads(content)
    print("SUCCESS", data)
except Exception as e:
    print("ERROR", e)
