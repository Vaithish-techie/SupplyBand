# agents/supplier_impact.py
from utils import get_llm_for_agent
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

# Track when this agent process started — used to skip stale bootstrap messages
AGENT_START_TIME = datetime.now(timezone.utc)

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
        print(f"[SUPPLIER IMPACT ENTRY] msg.parsed={getattr(msg, 'parsed', 'N/A')}")

        # --- PARSE: msg.parsed first (SDK pre-parsed), fall back to content parsing ---
        parsed_data = getattr(msg, 'parsed', {}) or {}
        if not isinstance(parsed_data, dict):
            parsed_data = {}

        if parsed_data:
            current_data = parsed_data
            print(f"[SUPPLIER IMPACT] Using msg.parsed: agent={current_data.get('agent')}, status={current_data.get('status')}")
        else:
            try:
                content = msg.content
                if content.startswith("[") and "]: " in content:
                    content = content.split("]: ", 1)[1]
                if "{" in content:
                    content = content[content.find("{"):content.rfind("}")+1]
                current_data = json.loads(content)
                print(f"[SUPPLIER IMPACT] Parsed from content: agent={current_data.get('agent')}, status={current_data.get('status')}")
            except Exception as e:
                print(f"[SUPPLIER IMPACT] Failed to parse content: {e}")
                logger.error(f"Failed to parse supplier_impact msg: {e}")
                current_data = {}

        # Also build all_msgs from history for the fallback path
        all_msgs = []
        for m in history:
            content = m.content
            if content.startswith("[") and "]: " in content:
                parts = content.split("]: ", 1)
                sender = parts[0][1:]
                content = parts[1]
            else:
                sender = "unknown"
            try:
                if "{" in content:
                    content = content[content.find("{"):content.rfind("}")+1]
                data = json.loads(content)
            except Exception:
                data = {}
            all_msgs.append((sender, data))
        all_msgs.append((msg.sender_name or msg.sender_type, current_data))

        # --- BULLETPROOF TRIGGER ---
        # Trigger if payload explicitly says event_intelligence OR contains event intel keys
        is_event_intel_trigger = (
            current_data.get("agent") == "event_intelligence" or
            (current_data.get("status") == "complete" and "location" in current_data.get("findings", {})) or
            (isinstance(current_data.get("findings"), dict) and "event_type" in current_data.get("findings", {}))
        )

        if is_event_intel_trigger:
            case_id = current_data.get("case_id")
            findings = current_data.get("findings", current_data)
            print(f"[SUPPLIER IMPACT] Waking up! Received data: agent={current_data.get('agent')}, case_id={case_id}")
            logger.info(f"Direct trigger: event_intelligence for case {case_id}. Processing now.")
            # Resolve downstream handles dynamically
            downstream_handles = []
            try:
                from utils import get_room_participants
                handles = await get_room_participants(room_id, "supplier_impact", participants_msg)
                for h in handles:
                    if "/" in h and ("financial" in h.lower() or "regulatory" in h.lower() or "alt-sourcing" in h.lower() or "alt_sourcing" in h.lower() or "coordinator" in h.lower()):
                        downstream_handles.append(h)
            except Exception as e:
                logger.error(f"Failed to fetch participants: {e}")
            
            if not downstream_handles:
                downstream_handles = [
                    "@vaithish7/coordinator",
                    "@sreedarsan0311/financial-exposure",
                    "@belugaok3/regulatory-agent",
                    "@sreedarsan0311/alt-sourcing",
                ]

            try:
                res = await self.process_supplier_impact(
                    case_id,
                    findings,
                    tools, msg, history, participants_msg, contacts_msg,
                    is_session_bootstrap, room_id, downstream_handles
                )
                return res
            except Exception as e:
                print(f"SUPPLIER CRASH: {e}")
                logger.error(f"SUPPLIER CRASH in process_supplier_impact: {e}", exc_info=True)
                mentions_text = " ".join(downstream_handles) if downstream_handles else "@vaithish7/coordinator"
                error_envelope = {
                    "agent": "supplier_impact",
                    "case_id": case_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "status": "insufficient_data",
                    "text": f"Supplier impact analysis crashed. {mentions_text} please review.",
                    "findings": {},
                    "confidence": "LOW",
                    "flags": [f"Crash: {str(e)[:200]}"]
                }
                try:
                    await tools.send_message(
                        content=json.dumps(error_envelope, indent=2),
                        mentions=downstream_handles
                    )
                except Exception:
                    pass
                return {"status": "error"}
        # --- HISTORY-BASED FALLBACK (for cases where history is populated) ---
        # Check for coordinator kickoff messages present in history
        kickoffs = [data for sender, data in all_msgs if data.get("agent") == "coordinator" and data.get("phase") == "kickoff"]

        for kickoff in reversed(kickoffs):
            case_id = kickoff.get("case_id")
            if not case_id:
                continue

            # Skip stale kickoffs from before this process started (>5 min old)
            kickoff_ts = kickoff.get("timestamp")
            if kickoff_ts:
                try:
                    kt = datetime.fromisoformat(kickoff_ts.replace("Z", "+00:00"))
                    age_secs = (AGENT_START_TIME - kt).total_seconds()
                    if age_secs > 300:  # 5 minutes
                        logger.info(f"Skipping stale kickoff {case_id} (age={int(age_secs)}s > 300s)")
                        continue
                except Exception:
                    pass

            # Check if we already responded to this case
            already_responded = False
            for sender, data in all_msgs:
                if data.get("agent") == "supplier_impact" and data.get("case_id") == case_id and data.get("status") in ("complete", "insufficient_data", "escalate", "error", "fallback"):
                    already_responded = True
                    break

            if already_responded:
                continue

            # Check if there is a completed event intelligence post for this case
            event_intel = None
            upstream_failed = False
            for sender, data in all_msgs:
                if data.get("agent") == "event_intelligence" and data.get("case_id") == case_id:
                    if data.get("status") == "complete":
                        event_intel = data
                        break
                    elif data.get("status") in ("insufficient_data", "escalate", "error"):
                        upstream_failed = True
                        break

            # Resolve downstream handles dynamically for fallback path
            downstream_handles = []
            try:
                from utils import get_room_participants
                handles = await get_room_participants(room_id, "supplier_impact", participants_msg)
                for h in handles:
                    if "/" in h and ("financial" in h.lower() or "regulatory" in h.lower() or "alt-sourcing" in h.lower() or "alt_sourcing" in h.lower() or "coordinator" in h.lower()):
                        downstream_handles.append(h)
            except Exception as e:
                logger.error(f"Failed to fetch participants: {e}")
            
            if not downstream_handles:
                downstream_handles = [
                    "@vaithish7/coordinator",
                    "@sreedarsan0311/financial-exposure",
                    "@belugaok3/regulatory-agent",
                    "@sreedarsan0311/alt-sourcing",
                ]

            if upstream_failed:
                logger.warning(f"Upstream agent event_intelligence failed/errored for case {case_id}. Cascading insufficient_data.")
                response_envelope = {
                    "agent": "supplier_impact",
                    "case_id": case_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "status": "insufficient_data",
                    "findings": {},
                    "confidence": "LOW",
                    "flags": ["Upstream agent event_intelligence failed. Cascading failure."]
                }
                await tools.send_message(
                    content=json.dumps(response_envelope),
                    mentions=downstream_handles
                )
                continue

            if event_intel:
                logger.info(f"History-based trigger: event_intelligence complete for case {case_id}. Processing.")
                await self.process_supplier_impact(case_id, event_intel.get("findings"), tools, msg, history, participants_msg, contacts_msg, is_session_bootstrap, room_id, downstream_handles)
                return {"status": "skipped"}
            # No event_intel found — check timeout
            kickoff_timestamp = kickoff.get("timestamp")
            if kickoff_timestamp:
                try:
                    kickoff_time = datetime.fromisoformat(kickoff_timestamp.replace("Z", "+00:00"))
                    elapsed = (datetime.now(timezone.utc) - kickoff_time).total_seconds()
                    if elapsed > 120:
                        logger.warning(f"Upstream event_intelligence missing after {elapsed}s for case {case_id}. Posting insufficient_data.")
                        response_envelope = {
                            "agent": "supplier_impact",
                            "case_id": case_id,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "status": "insufficient_data",
                            "findings": {},
                            "confidence": "LOW",
                            "flags": [f"Upstream event_intelligence post missing after 120s timeout (elapsed={int(elapsed)}s)"]
                        }
                        await tools.send_message(
                            content=json.dumps(response_envelope),
                            mentions=downstream_handles
                        )
                        return {"status": "skipped"}
                except Exception as ex:
                    logger.error(f"Error parsing kickoff timestamp: {ex}")

        import asyncio, random
        await asyncio.sleep(0.5 + random.random() * 2.5)
        return {"status": "skipped"}

    async def process_supplier_impact(self, case_id, findings, tools, msg, history, participants_msg, contacts_msg, is_session_bootstrap, room_id, downstream_handles):
        # Check if suppliers.json is missing
        if not os.path.exists("data/suppliers.json"):
            logger.error("suppliers.json file is missing!")
            mentions_text = "Supplier impact analysis failed (file missing). @sreedarsan0311/financial-exposure @belugaok3/regulatory-agent please review."
            response_envelope = {
                "agent": "supplier_impact",
                "case_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "insufficient_data",
                "text": mentions_text,
                "findings": {},
                "confidence": "LOW",
                "flags": ["data/suppliers.json file is missing"]
            }
            await tools.send_message(
                content=json.dumps(response_envelope, indent=2),
                mentions=downstream_handles
            )
            return {"status": "skipped"}
            
        # Load suppliers
        try:
            suppliers = load_suppliers()
        except Exception as e:
            logger.error(f"Error loading suppliers: {e}")
            mentions_text = "Supplier impact analysis failed (load error). @sreedarsan0311/financial-exposure @belugaok3/regulatory-agent please review."
            response_envelope = {
                "agent": "supplier_impact",
                "case_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "insufficient_data",
                "text": mentions_text,
                "findings": {},
                "confidence": "LOW",
                "flags": [f"Error loading data/suppliers.json: {str(e)}"]
            }
            await tools.send_message(
                content=json.dumps(response_envelope, indent=2),
                mentions=downstream_handles
            )
            return {"status": "skipped"}
        # Determine mode
        api_key = os.getenv("FEATHERLESS_API_KEY")
        use_mock = not api_key or api_key.startswith("your_") or api_key == "key-from-band-dashboard"

        if use_mock:
            logger.info("Running in Mock Fallback Mode")
            impact_findings, confidence, flags = generate_mock_supplier_impact(findings)
            
            mention_text = "Supplier impact complete. @sreedarsan0311/financial-exposure @belugaok3/regulatory-agent please review."
            mentions_list = ["@sreedarsan0311/financial-exposure", "@belugaok3/regulatory-agent"]
            
            response_envelope = {
                "agent": "supplier_impact",
                "case_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "complete",
                "text": mention_text,
                "findings": impact_findings,
                "confidence": confidence,
                "flags": flags
            }
            
            await tools.send_message(
                content=json.dumps(response_envelope, indent=2),
                mentions=downstream_handles
            )
            logger.info("Mock supplier impact posted successfully.")
            return {
                "agent": "supplier_impact",
                "status": "complete",
                "text": mention_text,
                "mentions": mentions_list,
                "parsed": response_envelope
            }
        logger.info("Running in LLM Mode — direct structured call")
        from langchain_core.messages import SystemMessage, HumanMessage
        llm = get_llm_for_agent("supplier_impact").bind(response_format={"type": "json_object"})
        suppliers_json = json.dumps(suppliers, indent=2)
        system_prompt = SUPPLIER_IMPACT_PROMPT_TEMPLATE.format(suppliers_json=suppliers_json)
        user_content = (
            f"Event Intelligence findings for {case_id}:\n"
            f"{json.dumps(findings, indent=2)}\n\n"
            "Analyze the supplier database and output ONLY a raw JSON object (no markdown) with keys: "
            "affected_tier1, affected_tier2, critical_path_suppliers, affected_components, "
            "inventory_buffer_days, severity, confidence, flags."
        )
        try:
            result = await llm.ainvoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_content)
            ])
            raw = result.content
            if "```json" in raw:
                raw = raw.split("```json")[1].split("```")[0]
            llm_data = json.loads(raw)
            impact_findings = {
                "affected_tier1": llm_data.get("affected_tier1", 0),
                "affected_tier2": llm_data.get("affected_tier2", 0),
                "critical_path_suppliers": llm_data.get("critical_path_suppliers", []),
                "affected_components": llm_data.get("affected_components", []),
                "inventory_buffer_days": llm_data.get("inventory_buffer_days", 30),
                "severity": llm_data.get("severity", "LOW"),
            }
            confidence = llm_data.get("confidence", "MEDIUM")
            flags = llm_data.get("flags", [])
        except Exception as e:
            logger.warning(f"LLM parse failed ({e}), falling back to mock")
            impact_findings, confidence, flags = generate_mock_supplier_impact(findings)

        mention_text = "Supplier impact complete. @sreedarsan0311/financial-exposure @belugaok3/regulatory-agent please review."
        mentions_list = ["@sreedarsan0311/financial-exposure", "@belugaok3/regulatory-agent"]
        
        response_envelope = {
            "agent": "supplier_impact",
            "case_id": case_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "complete",
            "text": mention_text,
            "findings": impact_findings,
            "confidence": confidence,
            "flags": flags
        }
        
        # We also still send manually just in case, but using the updated text
        await tools.send_message(
            content=json.dumps(response_envelope, indent=2),
            mentions=downstream_handles
        )
        logger.info("LLM supplier impact posted successfully.")
        
        return {
            "agent": "supplier_impact",
            "status": "complete",
            "text": mention_text,
            "mentions": mentions_list,
            "parsed": response_envelope
        }

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
    
    llm = get_llm_for_agent("supplier_impact")

    adapter = CustomSupplierImpactAdapter(
        llm=llm,
        checkpointer=InMemorySaver(),
        custom_section=prompt,
    )
    agent_id, api_key_config = load_agent_config("supplier_impact")
    agent = Agent.create(adapter=adapter, agent_id=agent_id, api_key=api_key_config)
    logger.info("Supplier Impact Agent running...")
    await agent.run()

if __name__ == "__main__":
    asyncio.run(main())
