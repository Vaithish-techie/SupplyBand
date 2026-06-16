# Band Message Schema — ALL agents must follow this exactly

Every agent posts ONE JSON message to the Band room per turn.
No prose outside the JSON. No markdown code fences.

## Base structure (all agents)

```json
{
  "agent": "agent-name-here",
  "case_id": "CASE-001",
  "timestamp": "2024-01-15T10:23:00Z",
  "status": "complete | escalate | insufficient_data",
  "findings": { },
  "confidence": "HIGH | MEDIUM | LOW",
  "flags": []
}
```

## coordinator (Phase 1 — kickoff)
```json
{
  "agent": "coordinator",
  "case_id": "CASE-001",
  "phase": "kickoff",
  "event_text": "<raw event text>",
  "instruction": "All specialist agents: analyze and post findings",
  "agents_required": ["event_intelligence", "supplier_impact",
                       "financial_exposure", "regulatory_trade", "alt_sourcing"]
}
```

## coordinator (Phase 2 — executive brief, after all 5 report)
```json
{
  "agent": "coordinator",
  "case_id": "CASE-001",
  "phase": "executive_brief",
  "situation_summary": "2-3 sentence plain english summary",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW",
  "verdict": "ESCALATE_TO_HUMAN | AUTO_RESOLVE",
  "top_3_actions": ["action 1 + deadline", "action 2 + deadline", "action 3 + deadline"],
  "financial_exposure": "summarized from financial agent",
  "recommended_supplier": "from alt sourcing agent",
  "compliance_deadline": "most urgent deadline from regulatory agent"
}
```

## event_intelligence
Wakes on: coordinator, phase=kickoff
```json
"findings": {
  "event_type": "natural_disaster | port_strike | tariff | sanctions",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW",
  "location": "city, country",
  "affected_industries": ["semiconductor", "logistics"],
  "estimated_duration_weeks": 3,
  "summary": "one line plain english summary"
}
```

## supplier_impact
Wakes on: event_intelligence, status=complete
```json
"findings": {
  "affected_tier1": 3,
  "affected_tier2": 7,
  "critical_path_suppliers": ["TSMC", "ASE Group"],
  "affected_components": ["A100 chips", "NAND flash"],
  "inventory_buffer_days": 12,
  "severity": "HIGH"
}
```

## financial_exposure
Wakes on: supplier_impact, status=complete
```json
"findings": {
  "week1_risk_usd": 2000000,
  "week3_risk_usd": 47000000,
  "week6_risk_usd": 180000000,
  "revenue_at_risk_products": ["Product A", "Product B"],
  "margin_impact_pct": 8.3
}
```

## regulatory_trade
Wakes on: supplier_impact, status=complete (runs parallel to financial_exposure)
```json
"findings": {
  "force_majeure_applicable": true,
  "insurer_notify_deadline_hours": 72,
  "export_controls": ["EAR99"],
  "tariff_implications": "none | minor | major",
  "compliance_actions": ["Notify insurer by Jan 17", "File force majeure with TSMC"]
}
```

## alt_sourcing
Wakes on: financial_exposure AND regulatory_trade, both status=complete
```json
"findings": {
  "alternatives": [
    {
      "supplier": "Samsung Austin",
      "components_covered": ["A100 chips"],
      "cost_delta_pct": 12,
      "lead_time_days": 8,
      "risk_level": "LOW",
      "regulatory_flags": []
    }
  ],
  "recommended": "Samsung Austin",
  "recommendation_reason": "Fastest lead time, lowest cost premium"
}
```

## Rules everyone must follow

1. Never respond to your own previous message.
2. Never respond unless your specific wake-up condition is met.
3. Always copy the case_id forward — never invent a new one.
4. Always use real ISO8601 timestamps.
5. If you can't find enough data to answer confidently, set
   status="insufficient_data" and explain in flags[], don't guess.