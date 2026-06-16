# SupplyBand

A multi-agent orchestration tool using Band to resolve supply chain disruptions and trade compliance.

## Agent LLM Configuration

The system uses a heterogeneous LLM architecture optimized for reasoning strength vs. task efficiency:

*   **Coordinator** (`coordinator.py`): Claude Sonnet via AI/ML API (needs strongest reasoning)
*   **Event Intelligence** (`event_intelligence.py`): Claude Sonnet via AI/ML API (classification needs nuance)
*   **Supplier Impact** (`supplier_impact.py`): Llama 3.1 70B via Featherless API (structured lookup task)
*   **Financial Exposure** (`financial_exposure.py`): Llama 3.1 70B via Featherless API (calculation task)
*   **Regulatory & Trade** (`regulatory_trade.py`): Claude Sonnet via AI/ML API (needs nuance for legal language)
*   **Alt Sourcing** (`alt_sourcing.py`): Llama 3.1 70B via Featherless API (ranking/matching task)

## Environment Setup

Create a `.env` file in the root directory and configure the following keys:

```env
AIML_API_KEY=your_aiml_api_key
FEATHERLESS_API_KEY=your_featherless_api_key
```
