# Person 2 — Full Task Breakdown
## Supply Chain Disruption Intelligence Center

> You own: **Event Intelligence Agent** + **Supplier Impact Agent**
> Your agents form the critical first two steps of the specialist pipeline.
> Everything downstream (Financial, Regulatory, Sourcing) reads YOUR output.

---

## Day 0 Checklist (Before Writing Any Code)

- [ ] Clone the GitHub repo Person 1 sets up
- [ ] Run `conda activate aml-agents && pip install -r requirements.txt`
- [ ] Read `SCHEMA.md` — memorize the JSON format your agents must post
- [ ] DM Person 1 your Band agent UUIDs so they fill `agent_config.yaml`
- [ ] Confirm you can see the Band room from the dashboard
- [ ] Get `data/suppliers.json` from Person 4 (or stub it yourself for Day 1)

---

## Your Two Agents

### Agent A — Event Intelligence
**File:** `agents/event_intelligence.py`

**Job:** Read the raw disruption text from the Coordinator's kickoff message, classify it into a structured event object, and post it to the Band room.

**Trigger:** Wakes up when it sees in the Band room:
```json
{ "agent": "coordinator", "phase": "kickoff" }
```

**What it must output:**
```json
{
  "agent": "event_intelligence",
  "case_id": "CASE-001",
  "timestamp": "<ISO8601>",
  "status": "complete",
  "findings": {
    "event_type": "natural_disaster|port_strike|tariff|sanctions",
    "severity": "CRITICAL|HIGH|MEDIUM|LOW",
    "location": "city, country",
    "affected_industries": ["semiconductor", "logistics"],
    "estimated_duration_weeks": 3,
    "summary": "one line plain english summary"
  },
  "confidence": "HIGH|MEDIUM|LOW",
  "flags": []
}
```

**LLM tasks (system prompt):**
1. Extract event type from raw text
2. Classify severity (CRITICAL = >50% supply disruption for critical component)
3. Identify specific geography (city + country, not just region)
4. List affected industries
5. Estimate duration in weeks based on historical precedent
6. Set confidence based on how clear the input text is

---

### Agent B — Supplier Impact
**File:** `agents/supplier_impact.py`

**Job:** Given the structured event from Event Intelligence, map which suppliers in `data/suppliers.json` are affected, assess inventory buffer risk, identify critical path suppliers.

**Trigger:** Wakes up when it sees in the Band room:
```json
{ "agent": "event_intelligence", "status": "complete" }
```

**What it must output:**
```json
{
  "agent": "supplier_impact",
  "case_id": "CASE-001",
  "timestamp": "<ISO8601>",
  "status": "complete",
  "findings": {
    "affected_tier1": 3,
    "affected_tier2": 7,
    "critical_path_suppliers": ["TSMC", "ASE Group"],
    "affected_components": ["A100 chips", "NAND flash"],
    "inventory_buffer_days": 12,
    "severity": "HIGH"
  },
  "confidence": "HIGH|MEDIUM|LOW",
  "flags": ["TSMC offline = production halt in 12 days"]
}
```

**LLM tasks (system prompt):**
1. Read `suppliers.json` — filter by location matching the event geography
2. Separate Tier 1 (direct) from Tier 2 (suppliers of suppliers)
3. Identify which components are at risk
4. Estimate inventory buffer in days (days until production line halts)
5. Flag any single-source dependencies
6. Set severity: CRITICAL if buffer_days < 7, HIGH if < 21

---

## Full Implementation Checklist

### Event Intelligence Agent
- [ ] Band listener: poll room for coordinator kickoff message
- [ ] Parse `event_text` field from coordinator's message
- [ ] Write system prompt for Claude Sonnet (AI/ML API) to classify the event
- [ ] Validate LLM output matches schema before posting
- [ ] Post to Band room with correct JSON
- [ ] Edge case: vague events → confidence LOW, add flag
- [ ] Test with all 3 demo scenarios

### Supplier Impact Agent
- [ ] Band listener: poll room for event_intelligence post
- [ ] Load `data/suppliers.json`
- [ ] Inject supplier data + event findings into LLM prompt
- [ ] Write system prompt for Llama 3.1 70B (Featherless) to map impact
- [ ] Validate output schema before posting
- [ ] Post to Band room
- [ ] Test with all 3 demo scenarios

---

## Supplier Data Stub (use until Person 4 delivers)

```json
{
  "suppliers": [
    {
      "id": "SUP-001",
      "name": "TSMC",
      "tier": 1,
      "location": { "city": "Hsinchu", "country": "Taiwan" },
      "components": ["A100 chips", "H100 chips"],
      "is_sole_source": true,
      "inventory_buffer_days": 12
    },
    {
      "id": "SUP-002",
      "name": "Samsung Austin",
      "tier": 1,
      "location": { "city": "Austin", "country": "USA" },
      "components": ["NAND flash", "DRAM"],
      "is_sole_source": false,
      "inventory_buffer_days": 30
    },
    {
      "id": "SUP-003",
      "name": "ASE Group",
      "tier": 2,
      "location": { "city": "Kaohsiung", "country": "Taiwan" },
      "components": ["chip packaging", "testing"],
      "is_sole_source": false,
      "inventory_buffer_days": 21
    }
  ]
}
```

---

## Code Skeleton — Event Intelligence

```python
# agents/event_intelligence.py
import asyncio
import json
import logging
from dotenv import load_dotenv
import os
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from thenvoi import Agent
from thenvoi.adapters import LangGraphAdapter
from thenvoi.config import load_agent_config

logger = logging.getLogger(__name__)

EVENT_INTELLIGENCE_PROMPT = """
You are the Event Intelligence Agent in a Supply Chain Disruption system.

You receive raw disruption event text. Your job is to classify it into a structured format.

Respond ONLY with valid JSON — no prose, no markdown, no explanation.

Output format:
{
  "agent": "event_intelligence",
  "case_id": "<use case_id from kickoff message>",
  "timestamp": "<current ISO8601 timestamp>",
  "status": "complete",
  "findings": {
    "event_type": "<natural_disaster|port_strike|tariff|sanctions|geopolitical|pandemic>",
    "severity": "<CRITICAL|HIGH|MEDIUM|LOW>",
    "location": "<city, country>",
    "affected_industries": ["<industry1>", "<industry2>"],
    "estimated_duration_weeks": <integer>,
    "summary": "<one sentence summary>"
  },
  "confidence": "<HIGH|MEDIUM|LOW>",
  "flags": []
}

Severity rules:
- CRITICAL: affects >50% of supply for critical component, or duration > 8 weeks
- HIGH: affects key suppliers, duration 3-8 weeks
- MEDIUM: partial disruption, duration < 3 weeks
- LOW: minor, likely self-resolving

Confidence rules:
- HIGH: clear event, specific location, known timeline
- MEDIUM: clear event but duration uncertain
- LOW: vague or unverified

Only respond with the JSON object. No other text.
"""

async def main():
    load_dotenv()
    adapter = LangGraphAdapter(
        llm=ChatOpenAI(
            model="anthropic/claude-3-5-sonnet",
            api_key=os.getenv("AIML_API_KEY"),
            base_url="https://api.aimlapi.com/v1"
        ),
        checkpointer=InMemorySaver(),
        custom_section=EVENT_INTELLIGENCE_PROMPT,
    )
    agent_id, api_key = load_agent_config("event_intelligence")
    agent = Agent.create(adapter=adapter, agent_id=agent_id, api_key=api_key)
    logger.info("Event Intelligence Agent running...")
    await agent.run()

if __name__ == "__main__":
    asyncio.run(main())
```

---

## Code Skeleton — Supplier Impact

```python
# agents/supplier_impact.py
import asyncio
import json
import logging
from dotenv import load_dotenv
import os
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from thenvoi import Agent
from thenvoi.adapters import LangGraphAdapter
from thenvoi.config import load_agent_config

logger = logging.getLogger(__name__)

def load_suppliers():
    with open("data/suppliers.json") as f:
        return json.load(f)

SUPPLIER_IMPACT_PROMPT_TEMPLATE = """
You are the Supplier Impact Agent in a Supply Chain Disruption system.

You receive:
1. A structured event classification from Event Intelligence
2. The full supplier database

Your job: map which suppliers are affected and quantify the risk.

Supplier database:
{suppliers_json}

Respond ONLY with valid JSON — no prose, no markdown.

Output format:
{{
  "agent": "supplier_impact",
  "case_id": "<same case_id as input>",
  "timestamp": "<ISO8601>",
  "status": "complete",
  "findings": {{
    "affected_tier1": <count>,
    "affected_tier2": <count>,
    "critical_path_suppliers": ["<name>"],
    "affected_components": ["<component>"],
    "inventory_buffer_days": <days until first line halt>,
    "severity": "<CRITICAL|HIGH|MEDIUM|LOW>"
  }},
  "confidence": "<HIGH|MEDIUM|LOW>",
  "flags": ["<critical issue>"]
}}

Severity rules:
- CRITICAL: buffer_days < 7 OR sole-source supplier offline
- HIGH: buffer_days < 21 OR multiple tier-1 suppliers affected
- MEDIUM: tier-2 affected, buffer > 21 days
- LOW: minor disruption, alternatives exist

Always flag sole-source suppliers that are offline.
Only respond with the JSON object.
"""

async def main():
    load_dotenv()
    suppliers = load_suppliers()
    prompt = SUPPLIER_IMPACT_PROMPT_TEMPLATE.format(
        suppliers_json=json.dumps(suppliers, indent=2)
    )
    adapter = LangGraphAdapter(
        llm=ChatOpenAI(
            model="meta-llama/Meta-Llama-3.1-70B-Instruct",
            api_key=os.getenv("FEATHERLESS_API_KEY"),
            base_url="https://api.featherless.ai/v1"
        ),
        checkpointer=InMemorySaver(),
        custom_section=prompt,
    )
    agent_id, api_key = load_agent_config("supplier_impact")
    agent = Agent.create(adapter=adapter, agent_id=agent_id, api_key=api_key)
    logger.info("Supplier Impact Agent running...")
    await agent.run()

if __name__ == "__main__":
    asyncio.run(main())
```

---

## Demo Scenarios to Test Against

**Scenario 1 — Taiwan Earthquake**
Input: `"Magnitude 7.4 earthquake strikes Hsinchu, Taiwan. TSMC reports fab damage. Production suspended indefinitely."`
Expected findings: `event_type: "natural_disaster", severity: "CRITICAL", location: "Hsinchu, Taiwan", estimated_duration_weeks: 6`

**Scenario 2 — Port Strike**
Input: `"Dockworkers strike at Port of Los Angeles. All container operations halted. No resolution timeline given."`
Expected findings: `event_type: "port_strike", severity: "HIGH", location: "Los Angeles, USA"`

**Scenario 3 — Sanctions**
Input: `"US Treasury imposes new sanctions on Chinese semiconductor manufacturers effective immediately."`
Expected findings: `event_type: "sanctions", severity: "HIGH", location: "China"`

---

## Coordination Protocol

| When | Action |
|------|--------|
| Day 0 | Share Band agent UUIDs with Person 1 |
| Day 0 | Sync with Person 4 on `suppliers.json` schema |
| Day 1 AM | Event Intelligence connects and reads coordinator kickoff |
| Day 1 PM | Supplier Impact reads Event Intel post and replies |
| Day 1 EOD | End-to-end flow working for Scenario 1 |
| Day 2 | All 3 scenarios tested, error handling added |

**Critical:** Person 3's Regulatory agent triggers off your Supplier Impact post. Schema drift on your side = their agent breaks. Always validate against `SCHEMA.md` before pushing.

---

## Done When

1. Event Intelligence reads coordinator kickoff → posts structured event JSON
2. Supplier Impact reads that post → maps affected suppliers → posts to Band
3. Both produce valid JSON matching `SCHEMA.md` exactly
4. All 3 demo scenarios work correctly
5. Agents handle vague input gracefully — confidence LOW, no crash
