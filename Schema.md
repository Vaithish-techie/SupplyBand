# Band Message Schema — ALL agents must follow this

Every agent posts ONE message to the Band room in this format:

{
  "agent": "agent-name-here",
  "case_id": "CASE-001",
  "timestamp": "ISO8601 string",
  "status": "complete" | "escalate" | "insufficient_data",
  "findings": {
    // agent-specific fields go here
  },
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "flags": []  // list of critical issues needing attention
}

## Per-agent findings fields:

### event_intelligence
"findings": {
  "event_type": "natural_disaster|port_strike|tariff|sanctions",
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "location": "city, country",
  "affected_industries": ["semiconductor", "logistics"],
  "estimated_duration_weeks": 3,
  "summary": "one line plain english summary"
}

### supplier_impact
"findings": {
  "affected_tier1": 3,
  "affected_tier2": 7,
  "critical_path_suppliers": ["TSMC", "ASE Group"],
  "affected_components": ["A100 chips", "NAND flash"],
  "inventory_buffer_days": 12,
  "severity": "HIGH"
}

### financial_exposure
"findings": {
  "week1_risk_usd": 2000000,
  "week3_risk_usd": 47000000,
  "week6_risk_usd": 180000000,
  "revenue_at_risk_products": ["Product A", "Product B"],
  "margin_impact_pct": 8.3
}

### regulatory_trade
"findings": {
  "force_majeure_applicable": true,
  "insurer_notify_deadline_hours": 72,
  "export_controls": ["EAR99"],
  "tariff_implications": "none|minor|major",
  "compliance_actions": ["Notify insurer by Jan 17", "File force majeure with TSMC"]
}

### alt_sourcing
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