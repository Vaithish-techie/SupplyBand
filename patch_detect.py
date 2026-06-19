import sys

def patch_file(filename):
    with open(filename, "r") as f:
        content = f.read()

    # Find the while True: loop
    loop_start = content.find("while True:")
    loop_end = content.find("elapsed = (datetime.now", loop_start)
    if loop_end == -1:
        loop_end = content.find("print(f\"[", loop_start)
    
    new_loop = """        while True:
            found = set()
            for d in all_msgs:
                if not isinstance(d, dict):
                    continue
                agent_name = d.get("agent")
                if agent_name == "supplier_impact":
                    if d.get("case_id") == case_id and d.get("status") in ("complete", "insufficient_data", "escalate", "error", "fallback"):
                        found.add(agent_name)

            if "supplier_impact" in found:
                break
                
"""
    content = content[:loop_start] + new_loop + content[loop_end:]
    
    # Now fix supplier_impact_data assignment AFTER the loop
    waking_up_idx = content.find("print(f\"\\n[DEBUG ")
    if waking_up_idx != -1:
        extract_logic = """
        supplier_impact_data = None
        for d in reversed(all_msgs):
            if isinstance(d, dict) and d.get("agent") == "supplier_impact" and d.get("case_id") == case_id:
                if d.get("status") in ("complete", "insufficient_data", "escalate", "error", "fallback"):
                    supplier_impact_data = d
                    break
        """
        content = content[:waking_up_idx] + extract_logic.lstrip() + content[waking_up_idx:]
    
    # Add stale case skip
    if "already_responded = any" in content:
        skip_logic = """
        # --- STALE CASE FIX ---
        # Skip if the kickoff is older than 5 minutes so we don't get stuck on old crashed runs
        kickoff_ts = current_data.get("timestamp")
        if kickoff_ts:
            try:
                from datetime import datetime, timezone
                kt = datetime.fromisoformat(kickoff_ts.replace("Z", "+00:00"))
                if (datetime.now(timezone.utc) - kt).total_seconds() > 300:
                    return {"status": "skipped"}
            except Exception:
                pass
        # ----------------------
        
"""
        idx = content.find("already_responded = any")
        content = content[:idx] + skip_logic + content[idx:]
        
    with open(filename, "w") as f:
        f.write(content)

patch_file("agents/financial_exposure.py")
patch_file("agents/regulatory_trade.py")
