# agents/supplier_impact.py
import asyncio
import json
import logging
from dotenv import load_dotenv
import os
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from band import Agent
from band.adapters import LangGraphAdapter
from band.config import load_agent_config
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def load_suppliers():
    with open("data/suppliers.json") as f:
        return json.load(f)

SUPPLIER_IMPACT_PROMPT_TEMPLATE = """
You are the Supplier Impact Agent in a Supply Chain Disruption system.

WAKE UP CONDITION: Only respond when you see a Band message where 
"agent" field equals "event_intelligence" and status is "complete".

You receive:
1. A structured event classification from Event Intelligence
2. The full supplier database

Your job: map which suppliers are affected and quantify the risk.

Supplier database:
{suppliers_json}

You MUST respond by calling the tool 'band_send_message'.
Mentions: You MUST mention the event_intelligence agent in the 'band_send_message' call.

Respond ONLY with valid JSON inside the 'content' parameter of 'band_send_message'. No prose, no markdown, no explanation outside the JSON.

Output format for the content:
{{
  "agent": "supplier_impact",
  "case_id": "<use same case_id as input>",
  "timestamp": "<current ISO8601 timestamp>",
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
  "flags": ["<critical issues>"]
}}

Severity rules:
- CRITICAL: buffer_days < 7 OR sole-source supplier offline
- HIGH: buffer_days < 21 OR multiple tier-1 suppliers affected
- MEDIUM: tier-2 affected, buffer > 21 days
- LOW: minor disruption, alternatives exist

Always flag sole-source suppliers that are offline.
"""

def find_participant_handle(participants, name):
    for p in participants:
        p_name = p.get("name") or ""
        p_handle = p.get("handle") or ""
        if p_name == name or name in p_name or name in p_handle:
            return p_handle
    return f"@{name}"

def generate_mock_supplier_impact(event_findings):
    event_type = event_findings.get("event_type") if event_findings else ""
    location = event_findings.get("location", "").lower() if event_findings else ""
    summary = event_findings.get("summary", "").lower() if event_findings else ""
    
    if "taiwan" in location or "hsinchu" in location or "earthquake" in summary:
        return {
            "affected_tier1": 1,
            "affected_tier2": 1,
            "critical_path_suppliers": ["TSMC", "ASE Group"],
            "affected_components": ["A100 chips", "H100 chips", "chip packaging", "testing"],
            "inventory_buffer_days": 12,
            "severity": "CRITICAL"
        }, "HIGH", ["TSMC offline = production halt in 12 days", "Sole-source supplier TSMC affected in Taiwan"]
    elif "los angeles" in location or "strike" in summary or "port" in summary:
        return {
            "affected_tier1": 1,
            "affected_tier2": 0,
            "critical_path_suppliers": ["LA Logistics Corp"],
            "affected_components": ["shipping container transport", "logistics hub"],
            "inventory_buffer_days": 5,
            "severity": "CRITICAL"
        }, "HIGH", ["LA Logistics Corp strike causes critical logistics halt in 5 days"]
    elif "china" in location or "sanctions" in summary:
        return {
            "affected_tier1": 0,
            "affected_tier2": 1,
            "critical_path_suppliers": ["ASE Group"],
            "affected_components": ["chip packaging", "testing"],
            "inventory_buffer_days": 21,
            "severity": "HIGH"
        }, "HIGH", []
    else:
        # Generic fallback
        return {
            "affected_tier1": 0,
            "affected_tier2": 0,
            "critical_path_suppliers": [],
            "affected_components": [],
            "inventory_buffer_days": 30,
            "severity": "LOW"
        }, "LOW", ["Unknown trigger location"]

class CustomSupplierImpactAdapter(LangGraphAdapter):
    async def on_message(
        self,
        msg,
        tools,
        history,
        participants_msg,
        contacts_msg,
        *,
        is_session_bootstrap: bool,
        room_id: str,
    ) -> None:
        logger.info(f"Supplier Impact Agent received message: {msg.content[:100]}...")

        # 1. Parse all messages in history + current
        all_msgs = []
        for m in history:
            content = m.content
            if content.startswith("[") and "]: " in content:
                parts = content.split("]: ", 1)
                sender = parts[0][1:]
                content = parts[1]
            else:
                sender = "supplier_impact"
            try:
                data = json.loads(content)
            except Exception:
                data = {}
            all_msgs.append((sender, data))

        try:
            current_data = json.loads(msg.content)
        except Exception:
            current_data = {}
        all_msgs.append((msg.sender_name or msg.sender_type, current_data))

        # 2. Check for coordinator kickoff messages
        kickoffs = [data for sender, data in all_msgs if data.get("agent") == "coordinator" and data.get("phase") == "kickoff"]
        
        # Process each kickoff case
        for kickoff in kickoffs:
            case_id = kickoff.get("case_id")
            if not case_id:
                continue

            # Check if we already responded to this case
            already_responded = False
            for sender, data in all_msgs:
                if data.get("agent") == "supplier_impact" and data.get("case_id") == case_id and data.get("status") in ("complete", "escalate", "insufficient_data"):
                    already_responded = True
                    break

            if already_responded:
                continue

            # Check if there is a completed event intelligence post for this case
            event_intel = None
            for sender, data in all_msgs:
                if data.get("agent") == "event_intelligence" and data.get("case_id") == case_id and data.get("status") == "complete":
                    event_intel = data
                    break

            event_intel_handle = find_participant_handle(tools.participants, "event_intelligence")

            # If event_intel is found, process it!
            if event_intel:
                logger.info(f"Trigger event_intelligence complete found for case {case_id}. Processing.")
                await self.process_supplier_impact(case_id, event_intel.get("findings"), tools, msg, history, participants_msg, contacts_msg, is_session_bootstrap, room_id, event_intel_handle)
                return

            # If no event_intel found, check if coordinator kickoff was > 60 seconds ago
            kickoff_timestamp = kickoff.get("timestamp")
            if kickoff_timestamp:
                try:
                    kickoff_time = datetime.fromisoformat(kickoff_timestamp.replace("Z", "+00:00"))
                    current_time = datetime.now(timezone.utc)
                    elapsed = (current_time - kickoff_time).total_seconds()
                    if elapsed > 60:
                        logger.warning(f"Upstream agent event_intelligence missing after {elapsed}s (>60s) for case {case_id}. Posting insufficient_data.")
                        response_envelope = {
                            "agent": "supplier_impact",
                            "case_id": case_id,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "status": "insufficient_data",
                            "findings": {},
                            "confidence": "LOW",
                            "flags": [f"Upstream agent event_intelligence post missing after 60s (elapsed={int(elapsed)}s)"]
                        }
                        await tools.send_message(
                            content=json.dumps(response_envelope, indent=2),
                            mentions=[event_intel_handle]
                        )
                        return
                except Exception as ex:
                    logger.error(f"Error parsing kickoff timestamp: {ex}")

    async def process_supplier_impact(self, case_id, findings, tools, msg, history, participants_msg, contacts_msg, is_session_bootstrap, room_id, event_intel_handle):
        # Check if suppliers.json is missing
        if not os.path.exists("data/suppliers.json"):
            logger.error("suppliers.json file is missing!")
            response_envelope = {
                "agent": "supplier_impact",
                "case_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "insufficient_data",
                "findings": {},
                "confidence": "LOW",
                "flags": ["data/suppliers.json file is missing"]
            }
            await tools.send_message(
                content=json.dumps(response_envelope, indent=2),
                mentions=[event_intel_handle]
            )
            return

        # Load suppliers
        try:
            suppliers = load_suppliers()
        except Exception as e:
            logger.error(f"Error loading suppliers: {e}")
            response_envelope = {
                "agent": "supplier_impact",
                "case_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "insufficient_data",
                "findings": {},
                "confidence": "LOW",
                "flags": [f"Error loading data/suppliers.json: {str(e)}"]
            }
            await tools.send_message(
                content=json.dumps(response_envelope, indent=2),
                mentions=[event_intel_handle]
            )
            return

        # Determine mode
        api_key = os.getenv("FEATHERLESS_API_KEY")
        use_mock = not api_key or api_key.startswith("your_") or api_key == "key-from-band-dashboard"

        if use_mock:
            logger.info("Running in Mock Fallback Mode")
            impact_findings, confidence, flags = generate_mock_supplier_impact(findings)
            
            response_envelope = {
                "agent": "supplier_impact",
                "case_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "complete",
                "findings": impact_findings,
                "confidence": confidence,
                "flags": flags
            }
            await tools.send_message(
                content=json.dumps(response_envelope, indent=2),
                mentions=[event_intel_handle]
            )
            logger.info("Mock supplier impact posted successfully.")
            return

        logger.info("Running in LLM Mode")
        try:
            # Let LLM handle it, we call super
            # First, check if LLM call succeeds, retry once on error
            retries = 1
            while retries >= 0:
                try:
                    await super().on_message(
                        msg=msg,
                        tools=tools,
                        history=history,
                        participants_msg=participants_msg,
                        contacts_msg=contacts_msg,
                        is_session_bootstrap=is_session_bootstrap,
                        room_id=room_id
                    )
                    break
                except Exception as ex:
                    logger.warning(f"LLM call failed (retries left={retries}): {ex}")
                    retries -= 1
                    if retries < 0:
                        raise ex
        except Exception as e:
            logger.error(f"Error executing LLM call, posting insufficient_data: {e}")
            response_envelope = {
                "agent": "supplier_impact",
                "case_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "insufficient_data",
                "findings": {},
                "confidence": "LOW",
                "flags": [f"LLM analysis failed: {str(e)}"]
            }
            await tools.send_message(
                content=json.dumps(response_envelope, indent=2),
                mentions=[event_intel_handle]
            )

async def main():
    load_dotenv()
    
    # Check if suppliers.json exists before loading it at startup,
    # otherwise fallback to empty suppliers.
    try:
        suppliers = load_suppliers()
    except Exception:
        suppliers = {"suppliers": []}
        
    prompt = SUPPLIER_IMPACT_PROMPT_TEMPLATE.format(
        suppliers_json=json.dumps(suppliers, indent=2)
    )
    
    # Check if key is dummy or empty, and use a dummy ChatOpenAI model if so.
    api_key = os.getenv("FEATHERLESS_API_KEY")
    if not api_key or api_key.startswith("your_") or api_key == "key-from-band-dashboard":
        api_key = "dummy-key"
        
    adapter = CustomSupplierImpactAdapter(
        llm=ChatOpenAI(
            model="meta-llama/Meta-Llama-3.1-70B-Instruct",
            api_key=api_key,
            base_url="https://api.featherless.ai/v1"
        ),
        checkpointer=InMemorySaver(),
        custom_section=prompt,
    )
    agent_id, api_key_config = load_agent_config("supplier_impact")
    agent = Agent.create(adapter=adapter, agent_id=agent_id, api_key=api_key_config)
    logger.info("Supplier Impact Agent running...")
    await agent.run()

if __name__ == "__main__":
    asyncio.run(main())
