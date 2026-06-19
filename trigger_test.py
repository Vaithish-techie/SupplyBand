import urllib.request
import json
import time

url_trigger = "http://localhost:8000/trigger-event"
payload = {
    "event_text": "Magnitude 7.4 earthquake strikes Hsinchu, Taiwan suspending TSMC production."
}

print("1. Triggering disruption event via backend API...")
req = urllib.request.Request(
    url_trigger,
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST"
)

try:
    with urllib.request.urlopen(req) as res:
        resp_data = json.loads(res.read().decode("utf-8"))
        case_id = resp_data.get("case_id")
        print(f"Disruption triggered! case_id: {case_id}")
except Exception as e:
    print(f"Error triggering event: {e}")
    exit(1)

print("\n2. Polling case status...")
start_time = time.time()
while time.time() - start_time < 90:
    time.sleep(3)
    status_url = f"http://localhost:8000/case-status?case_id={case_id}"
    try:
        with urllib.request.urlopen(status_url) as res:
            status_data = json.loads(res.read().decode("utf-8"))
            complete = status_data.get("investigation_complete")
            posted = status_data.get("agents_posted", [])
            pending = status_data.get("agents_pending", [])
            print(f"Elapsed: {int(time.time() - start_time)}s | Posted: {posted} | Pending: {pending}")
            if complete:
                print("\n========================================================")
                print("SUCCESS: Investigation pipeline completed successfully!")
                print("Executive Brief Verdict:", status_data.get("verdict"))
                print("Severity Level:", status_data.get("severity"))
                print("========================================================")
                break
    except Exception as e:
        print(f"Status poll error: {e}")

# Clean up
print("Test run complete.")
