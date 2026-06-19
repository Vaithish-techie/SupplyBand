import re

def fix(fname):
    with open(fname, "r") as f:
        c = f.read()
    
    # 1. Replace the loop
    old_loop = """        while True:
            supplier_impact_data = None
            for d in all_msgs:
                if isinstance(d, dict) and d.get("agent") == "supplier_impact" and d.get("case_id") == case_id:
                    supplier_impact_data = d
                    break
            
            if supplier_impact_data:
                break"""
    
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
                break"""
    c = c.replace(old_loop, new_loop)
    
    # 2. Add stale kickoff check right before already_responded
    stale = """        kickoff_ts = current_data.get("timestamp")
        if kickoff_ts:
            try:
                from datetime import datetime, timezone
                kt = datetime.fromisoformat(kickoff_ts.replace("Z", "+00:00"))
                if (datetime.now(timezone.utc) - kt).total_seconds() > 300:
                    return {"status": "skipped"}
            except Exception:
                pass
                
        already_responded"""
    c = c.replace("        already_responded", stale, 1)

    # 3. Add supplier_impact_data extraction after waking up
    wake = 'print(f"\\n[DEBUG FINANCIAL_EXPOSURE] WAKING UP! RECEIVED DATA.\\n")'
    if wake not in c:
        wake = 'print(f"\\n[DEBUG REGULATORY_TRADE] WAKING UP! RECEIVED DATA.\\n")'
        
    extract = """supplier_impact_data = None
        for d in reversed(all_msgs):
            if isinstance(d, dict) and d.get("agent") == "supplier_impact" and d.get("case_id") == case_id:
                if d.get("status") in ("complete", "insufficient_data", "escalate", "error", "fallback"):
                    supplier_impact_data = d
                    break"""
    
    c = c.replace(wake, wake + "\n        " + extract)

    with open(fname, "w") as f:
        f.write(c)

fix("agents/financial_exposure.py")
fix("agents/regulatory_trade.py")
