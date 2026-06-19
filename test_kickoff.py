import urllib.request
import json

req = urllib.request.Request(
    "http://127.0.0.1:8001/trigger-event",
    data=json.dumps({"event_text": "A massive earthquake hit Hsinchu, Taiwan, disrupting semiconductor manufacturing operations."}).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST"
)
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode())
except Exception as e:
    print(e)
