import urllib.request, json, time, sys

def run_test():
    # Trigger
    req = urllib.request.Request("http://localhost:8000/trigger-event", data=b'{"event_text": "Magnitude 7.4 earthquake strikes Hsinchu, Taiwan suspending TSMC production."}', headers={'Content-Type': 'application/json'})
    res = urllib.request.urlopen(req)
    case_id = json.loads(res.read().decode('utf-8'))['case_id']
    print(f"Triggered {case_id}")
    
    # Wait for completion
    for _ in range(20):
        time.sleep(5)
        status = json.loads(urllib.request.urlopen(f"http://localhost:8000/case-status?case_id={case_id}").read().decode('utf-8'))
        if status.get("investigation_complete"):
            break
    
    msgs = json.loads(urllib.request.urlopen(f"http://localhost:8000/room-messages?case_id={case_id}").read().decode('utf-8'))['messages']
    
    # Sanity check: Check if any agent posted another agent's message
    failed = False
    for m in msgs:
        sender = m.get('sender_name') or m.get('sender_type')
        parsed = m.get('parsed', {})
        if not parsed: continue
        
        agent_claimed = parsed.get('agent')
        # Map expected sender names
        # sender is usually something like "Coordinator", "Event Intelligence", etc.
        expected_substring = agent_claimed.replace('_', ' ').lower()
        if agent_claimed == "human_operator":
            continue # Human operator is posted by backend using event_intelligence key
        if expected_substring not in sender.lower() and agent_claimed not in sender.lower():
            if agent_claimed == "coordinator" and "coordinator" in sender.lower():
                pass
            else:
                print(f"FAIL: Message claimed to be from '{agent_claimed}', but was sent by '{sender}'. Message ID: {m['id']}")
                failed = True
                
    if not failed:
        print(f"PASS: No cross-posting detected for {case_id}.")
        return True
    return False

print("Running Test 1...")
if run_test():
    print("Running Test 2...")
    run_test()
