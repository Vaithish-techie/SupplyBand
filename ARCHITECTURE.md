# Architecture — Global Supply Chain Disruption Intelligence Center

## System Overview

A multi-agent intelligence system that transforms raw disruption news into actionable executive briefings. Six agents orchestrated through a shared Band room, each owning a distinct analytical domain.

**Stack:**
- Orchestration: Band (multi-agent room protocol)
- LLM Backbone (Heterogeneous):
  - Coordinator, Event Intelligence, Regulatory & Trade: Claude Sonnet via AI/ML API (needs reasoning/nuance)
  - Supplier Impact, Financial Exposure, Alt Sourcing: Llama 3.1 70B via Featherless API (structured tasks)
- Framework: LangGraph + LangChain (Anthropic / OpenAI client models)
- Frontend: React (polling Band room via FastAPI)
- Data: JSON flat files (suppliers, financials, regulations, alternatives)

---

## Agent Pipeline

```
Raw disruption text (from human operator)
              |
              v
    ┌─────────────────┐
    │   COORDINATOR   │  ← Person 1
    │   (Band room    │
    │    orchestrator)│
    └────────┬────────┘
             │  posts kickoff { phase: "kickoff", event_text: "..." }
             v
    ┌─────────────────┐
    │ EVENT INTEL     │  ← Person 2
    │ classifies:     │
    │ type, severity, │
    │ geography,      │
    │ industries,     │
    │ duration        │
    └────────┬────────┘
             │  posts structured event object
             v
    ┌─────────────────┐
    │ SUPPLIER IMPACT │  ← Person 2
    │ maps:           │
    │ affected T1/T2, │
    │ components,     │
    │ inventory buffer│
    └────────┬────────┘
             │  posts supplier risk object
             │
    ┌────────┴───────────────────────────┐
    │         ALL 3 READ SUPPLIER POST   │
    v                v                   v
┌──────────┐  ┌──────────┐  ┌──────────────┐
│FINANCIAL │  │REGULATORY│  │   ALT        │
│EXPOSURE  │  │& TRADE   │  │   SOURCING   │
│          │  │          │  │              │
│revenue   │  │force     │  │alternatives, │
│at risk,  │  │majeure,  │  │cost delta,   │
│margin    │  │sanctions,│  │lead time     │
│impact    │  │deadlines │  │              │
│Person 4  │  │Person 3  │  │ Person 4     │
└────┬─────┘  └─────┬────┘  └──────┬───────┘
     │               │              │
     └───────────────┴──────────────┘
                     │
                     │  all 5 specialists have posted
                     v
            ┌─────────────────┐
            │   COORDINATOR   │
            │   (Phase 2)     │
            │   synthesizes   │
            │   executive     │
            │   brief +       │
            │   verdict       │
            └────────┬────────┘
                     │
                     v
            ┌─────────────────┐
            │  REACT FRONTEND │  ← Person 3
            │  polls /api/    │
            │  room-messages  │
            │  every 2s       │
            │  card per agent │
            └─────────────────┘
```

---

## Band Room Message Flow

Band is the shared pub/sub layer. Every agent reads the room and posts back. No direct agent-to-agent calls.

| Step | Who Posts | Who Reads |
|------|-----------|-----------|
| 1 | Coordinator (kickoff) | Event Intelligence |
| 2 | Event Intelligence | Supplier Impact |
| 3 | Supplier Impact | Financial, Regulatory, Alt Sourcing (all 3 simultaneously) |
| 4 | Financial Exposure | Coordinator |
| 5 | Regulatory & Trade | Coordinator |
| 6 | Alt Sourcing | Coordinator |
| 7 | Coordinator (executive brief) | Frontend, Human operator |

---

## Message Schema (all agents must follow)

```json
{
  "agent": "<agent-name>",
  "case_id": "CASE-001",
  "timestamp": "<ISO8601>",
  "status": "complete | escalate | insufficient_data",
  "findings": { /* agent-specific fields */ },
  "confidence": "HIGH | MEDIUM | LOW",
  "flags": ["critical issues needing attention"]
}
```

Full per-agent findings schemas are in `SCHEMA.md`.

---

## Directory Structure

```
supply-chain-intelligence/
├── agents/
│   ├── coordinator.py          ← Person 1
│   ├── event_intelligence.py   ← Person 2
│   ├── supplier_impact.py      ← Person 2
│   ├── financial_exposure.py   ← Person 4
│   ├── regulatory_trade.py     ← Person 3
│   └── alt_sourcing.py         ← Person 4
├── data/
│   ├── suppliers.json          ← Person 4
│   ├── financials.json         ← Person 4
│   ├── regulations.json        ← Person 4
│   ├── alternatives.json       ← Person 4
│   └── scenarios.json          ← Person 4 (3 demo cases)
├── frontend/                   ← Person 3
│   └── src/
├── agent_config.yaml           ← Person 1 (Band UUIDs + keys, gitignored)
├── SCHEMA.md                   ← Person 1 (shared contract)
├── requirements.txt            ← Person 1
├── run_all.sh                  ← Person 1
└── .env                        ← each person locally (gitignored)
```

---

## Coordinator — Two-Phase Logic

**Phase 1 (kickoff):** Triggered by human input. Assigns case ID, posts kickoff JSON to Band room.

**Phase 2 (executive brief):** Triggered when all 5 specialist agents have posted. Synthesizes findings into a single executive brief with:
- 2-3 sentence situation summary
- Severity verdict (CRITICAL/HIGH/MEDIUM/LOW)
- Decision: AUTO_RESOLVE or ESCALATE_TO_HUMAN
- Top 3 recommended actions with deadlines
- Financial exposure summary
- Recommended supplier from alt sourcing
- Most urgent compliance deadline

---

## Frontend Architecture

- React app polls `GET /api/room-messages` every 2 seconds
- FastAPI backend wraps Band room API
- One card per agent message, color-coded by agent name
- Cards appear in real-time as agents post
- Final card = Coordinator executive brief with verdict badge

---

## Demo Scenarios

Three pre-built scenarios in `data/scenarios.json`:

| # | Scenario | Primary Industry | Expected Severity |
|---|----------|-----------------|-------------------|
| 1 | Taiwan earthquake (TSMC fab damage) | Semiconductor | CRITICAL |
| 2 | LA port dockworkers strike | Logistics | HIGH |
| 3 | US sanctions on Chinese chip makers | Semiconductor | HIGH |

---

## Environment Setup

```bash
# shared across all teammates
conda activate aml-agents
pip install -r requirements.txt

# .env (local only, never commit)
AIML_API_KEY=your_key
FEATHERLESS_API_KEY=your_key

# run all 6 agents
./run_all.sh
```

---

## Key Design Decisions

**Why Event Intelligence is first:** Raw news text is messy. Having one agent normalize it into structured JSON means the other 4 specialists all start from the same clean baseline — no duplicate parsing logic.

**Why Band room (not direct calls):** Agents post and read from a shared room. This means the Coordinator can see everything, the frontend can display everything, and adding a 7th agent later requires zero changes to existing agents.

**Why flat JSON data files:** Fastest to stub, easy to modify for demos, no database setup required in a hackathon context.

**Why LangGraph + InMemorySaver:** Gives each agent internal state management and the ability to handle multi-turn reasoning without external state stores.
