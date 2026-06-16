# Agents Reference — Supply Chain Disruption Intelligence Center

## Overview

Six agents. One coordinator. Five specialists. Each agent runs as an independent process, connected only through the shared Band room.

| # | Agent | File | Model | Owner | Trigger | Output |
|---|-------|------|-------|-------|---------|--------|
| 1 | Coordinator | coordinator.py | Claude Sonnet (AI/ML API) | Person 1 | Human input (kickoff) / all 5 specialists done (brief) | Kickoff JSON → Executive Brief |
| 2 | Event Intelligence | event_intelligence.py | Claude Sonnet (AI/ML API) | Person 2 | Coordinator kickoff | Structured event classification |
| 3 | Supplier Impact | supplier_impact.py | Llama 3.1 70B (Featherless) | Person 2 | Event Intelligence post | Affected suppliers + inventory risk |
| 4 | Financial Exposure | financial_exposure.py | Llama 3.1 70B (Featherless) | Person 4 | Supplier Impact post | Revenue at risk, margin impact |
| 5 | Regulatory & Trade | regulatory_trade.py | Claude Sonnet (AI/ML API) | Person 3 | Supplier Impact post | Force majeure, compliance deadlines |
| 6 | Alt Sourcing | alt_sourcing.py | Llama 3.1 70B (Featherless) | Person 4 | Supplier Impact post | Ranked alternative suppliers |

---

## Agent 1 — Coordinator

**Owner:** Person 1
**File:** `agents/coordinator.py`
**Model:** Claude Sonnet (AI/ML API) — needs strongest reasoning

**Phase 1 — Kickoff**
- Triggered by human operator posting a disruption event
- Assigns a case ID (format: CASE-001)
- Posts kickoff message to Band room with raw event text
- Instructions tell all 5 specialists to begin

**Phase 2 — Executive Brief**
- Triggered when all 5 specialists have posted to Band room
- Reads all findings
- Synthesizes into executive brief
- Issues verdict: AUTO_RESOLVE or ESCALATE_TO_HUMAN

**Kickoff output:**
```json
{
  "agent": "coordinator",
  "case_id": "CASE-001",
  "phase": "kickoff",
  "event_text": "<raw disruption text>",
  "instruction": "All specialist agents: analyze this event and post your findings",
  "agents_required": ["event_intelligence", "supplier_impact", "financial_exposure", "regulatory_trade", "alt_sourcing"]
}
```

**Executive brief output:**
```json
{
  "agent": "coordinator",
  "case_id": "CASE-001",
  "phase": "executive_brief",
  "situation_summary": "2-3 sentence plain english summary",
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "verdict": "ESCALATE_TO_HUMAN|AUTO_RESOLVE",
  "top_3_actions": [
    "Action 1 with deadline",
    "Action 2 with deadline",
    "Action 3 with deadline"
  ],
  "financial_exposure": "summarized from financial agent",
  "recommended_supplier": "from alt sourcing agent",
  "compliance_deadline": "most urgent deadline from regulatory agent"
}
```

---

## Agent 2 — Event Intelligence

**Owner:** Person 2
**File:** `agents/event_intelligence.py`
**Model:** Claude Sonnet (AI/ML API) — classification needs nuance
**Data dependency:** None — works from raw text only

**Trigger condition:**
```json
{ "agent": "coordinator", "phase": "kickoff" }
```

**Job:** Normalize raw disruption news into a structured event object. This becomes the shared baseline all other agents reference.

**Output findings:**
```json
{
  "event_type": "natural_disaster|port_strike|tariff|sanctions|geopolitical|pandemic",
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "location": "city, country",
  "affected_industries": ["semiconductor", "logistics"],
  "estimated_duration_weeks": 3,
  "summary": "one sentence plain english summary"
}
```

**Severity classification rules:**
- CRITICAL: >50% supply disruption for a critical component OR duration > 8 weeks
- HIGH: key supplier(s) affected, duration 3–8 weeks
- MEDIUM: partial disruption, duration < 3 weeks
- LOW: minor, likely self-resolving

**Confidence classification:**
- HIGH: clear event, specific location, known timeline
- MEDIUM: event clear but duration uncertain
- LOW: vague, unverified, or incomplete event text

---

## Agent 3 — Supplier Impact

**Owner:** Person 2
**File:** `agents/supplier_impact.py`
**Model:** Llama 3.1 70B (Featherless) — structured lookup task
**Data dependency:** `data/suppliers.json`

**Trigger condition:**
```json
{ "agent": "event_intelligence", "status": "complete" }
```

**Job:** Cross-reference the structured event with the supplier database. Identify which Tier 1 and Tier 2 suppliers are in the affected geography, map component exposure, and estimate how many days until production halts.

**Output findings:**
```json
{
  "affected_tier1": 3,
  "affected_tier2": 7,
  "critical_path_suppliers": ["TSMC", "ASE Group"],
  "affected_components": ["A100 chips", "NAND flash"],
  "inventory_buffer_days": 12,
  "severity": "HIGH"
}
```

**Severity rules:**
- CRITICAL: inventory_buffer_days < 7 OR sole-source supplier offline
- HIGH: inventory_buffer_days < 21 OR multiple tier-1 suppliers affected
- MEDIUM: tier-2 affected, buffer > 21 days
- LOW: minor, alternatives readily available

**flags field:** Must include a flag for any sole-source supplier that is in the affected geography.

---

## Agent 4 — Financial Exposure

**Owner:** Person 4
**File:** `agents/financial_exposure.py`
**Model:** Llama 3.1 70B (Featherless) — calculation task
**Data dependency:** `data/financials.json`

**Trigger condition:**
```json
{ "agent": "supplier_impact", "status": "complete" }
```

**Job:** Translate supplier impact into dollar risk. Calculate revenue at risk across time horizons (week 1, week 3, week 6), identify which products are affected, and estimate margin impact.

**Output findings:**
```json
{
  "week1_risk_usd": 2000000,
  "week3_risk_usd": 47000000,
  "week6_risk_usd": 180000000,
  "revenue_at_risk_products": ["Product A", "Product B"],
  "margin_impact_pct": 8.3
}
```

---

## Agent 5 — Regulatory & Trade

**Owner:** Person 3
**File:** `agents/regulatory_trade.py`
**Model:** Claude Sonnet (AI/ML API) — needs nuance for legal language
**Data dependency:** `data/regulations.json`

**Trigger condition:**
```json
{ "agent": "supplier_impact", "status": "complete" }
```

**Job:** Assess legal and compliance implications. Determine if force majeure clauses apply, identify notification deadlines, check export control implications, and flag compliance actions required.

**Output findings:**
```json
{
  "force_majeure_applicable": true,
  "insurer_notify_deadline_hours": 72,
  "export_controls": ["EAR99"],
  "tariff_implications": "none|minor|major",
  "compliance_actions": [
    "Notify insurer by Jan 17",
    "File force majeure with TSMC"
  ]
}
```

---

## Agent 6 — Alternative Sourcing

**Owner:** Person 4
**File:** `agents/alt_sourcing.py`
**Model:** Llama 3.1 70B (Featherless) — ranking/matching task
**Data dependency:** `data/alternatives.json`

**Trigger condition:** Reads ALL prior posts — waits for supplier_impact, financial_exposure, and regulatory_trade before posting.

**Job:** Identify substitute suppliers for the affected components. Rank by cost delta and lead time. Flag any regulatory issues with alternatives. Give a single recommendation.

**Output findings:**
```json
{
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

---

## Shared Message Schema

All agents post this envelope structure to the Band room:

```json
{
  "agent": "<agent-name>",
  "case_id": "CASE-001",
  "timestamp": "<ISO8601>",
  "status": "complete | escalate | insufficient_data",
  "findings": { /* agent-specific — see above */ },
  "confidence": "HIGH | MEDIUM | LOW",
  "flags": ["list of critical issues"]
}
```

**Rules:**
- `status: "escalate"` means the agent found something requiring immediate human attention (overrides coordinator AUTO_RESOLVE)
- `status: "insufficient_data"` means the agent couldn't complete analysis — coordinator must note this in the brief
- `flags` is never null — use empty array `[]` if nothing to flag
- `confidence` reflects how certain the agent is, not how severe the situation is

---

## Startup Sequence

```
./run_all.sh
  │
  ├── coordinator.py starts
  │     └── connects to Band room
  │
  ├── (sleep 2 seconds)
  │
  ├── event_intelligence.py starts    ─┐
  ├── supplier_impact.py starts        │ all start simultaneously
  ├── financial_exposure.py starts     │ all polling Band room
  ├── regulatory_trade.py starts       │ waiting for their triggers
  └── alt_sourcing.py starts          ─┘
```

Coordinator connects first so it's ready to receive the human's event input before specialists start polling.

---

## Error Handling (all agents)

| Situation | Expected behavior |
|-----------|-------------------|
| LLM returns invalid JSON | Retry once, then post status: "insufficient_data" |
| Data file missing | Post status: "insufficient_data" with flag explaining what's missing |
| Event text too vague | Post with confidence: "LOW" and flag: "Insufficient event detail" |
| Upstream agent post missing | Wait up to 60s, then post with status: "insufficient_data" |

Never crash silently. Always post to the Band room, even if status is failure.
