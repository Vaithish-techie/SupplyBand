### 1. `alt_sourcing.py` Detection Logic (Working)
```python
        while True:
            found = set()
            for d in all_msgs:
                if not isinstance(d, dict):
                    continue
                agent_name = d.get("agent")
                if agent_name == "supplier_impact" or agent_name == "financial_exposure" or agent_name == "regulatory_trade":
                    if d.get("case_id") == case_id and d.get("status") in ("complete", "insufficient_data", "escalate", "error", "fallback"):
                        found.add(agent_name)

            if "supplier_impact" in found and "financial_exposure" in found and "regulatory_trade" in found:
                break
```

### 2. `financial_exposure.py` Detection Logic (Failing)
```python
        while True:
            supplier_impact_data = None
            for d in all_msgs:
                if isinstance(d, dict) and d.get("agent") == "supplier_impact" and d.get("case_id") == case_id:
                    supplier_impact_data = d
                    break
            
            if supplier_impact_data:
                break
```
