# test_agents.py
import sys
import os
import asyncio
import json
from datetime import datetime, timezone

# Add workspace and agents folder to path
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), "agents"))

# Set dummy keys so agents run in Mock Fallback Mode
os.environ["AIML_API_KEY"] = "your_dummy"
os.environ["FEATHERLESS_API_KEY"] = "your_dummy"

from agents.event_intelligence import CustomEventIntelligenceAdapter, generate_mock_event_findings
from agents.supplier_impact import CustomSupplierImpactAdapter, generate_mock_supplier_impact
from agents.financial_exposure import CustomFinancialExposureAdapter
from agents.regulatory_trade import CustomRegulatoryTradeAdapter
from agents.alt_sourcing import CustomAltSourcingAdapter

# Mock PlatformMessage
class MockPlatformMessage:
    def __init__(self, content, sender_name="system", sender_type="System"):
        self.content = content
        self.sender_name = sender_name
        self.sender_type = sender_type
        self.id = "msg-123"
        self.room_id = "room-abc"
        self.created_at = datetime.now(timezone.utc)

# Mock LangChain message for history
class MockLangChainMessage:
    def __init__(self, sender, content):
        self.content = f"[{sender}]: {content}"

# Mock AgentTools
class MockAgentTools:
    def __init__(self, name):
        self.name = name
        self.participants = [
            {"id": "c-123", "name": "coordinator", "type": "Agent", "handle": "@system/coordinator"},
            {"id": "e-456", "name": "event_intelligence", "type": "Agent", "handle": "@system/event_intelligence"},
            {"id": "s-789", "name": "supplier_impact", "type": "Agent", "handle": "@system/supplier_impact"},
        ]
        self.sent_messages = []

    async def send_message(self, content, mentions=None):
        self.sent_messages.append({"content": content, "mentions": mentions})
        print(f"[{self.name} -> send_message] Sent to room with mentions {mentions}:")
        print(content)
        return {"id": "msg-sent"}

async def test_event_intelligence():
    print("==================================================")
    print("TESTING EVENT INTELLIGENCE AGENT")
    print("==================================================")
    
    # Pass graph_factory to avoid LangGraphAdapter validation crash
    adapter = CustomEventIntelligenceAdapter(graph_factory=lambda x: None)
    adapter.agent_name = "event_intelligence"
    adapter.agent_description = "Classifies events"
    adapter.features = None
    
    # 1. Trigger with kickoff message
    kickoff_payload = {
        "agent": "coordinator",
        "case_id": "CASE-001",
        "phase": "kickoff",
        "event_text": "Magnitude 7.4 earthquake strikes Hsinchu, Taiwan. TSMC reports fab damage. Production suspended indefinitely.",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    msg = MockPlatformMessage(json.dumps(kickoff_payload), sender_name="coordinator")
    tools = MockAgentTools("event_intelligence")
    history = []
    
    await adapter.on_message(
        msg=msg,
        tools=tools,
        history=history,
        participants_msg=None,
        contacts_msg=None,
        is_session_bootstrap=True,
        room_id="room-123"
    )
    
    assert len(tools.sent_messages) == 1, "Should have posted one message"
    sent_data = json.loads(tools.sent_messages[0]["content"])
    assert sent_data["case_id"] == "CASE-001"
    assert sent_data["status"] == "complete"
    assert sent_data["findings"]["event_type"] == "natural_disaster"
    assert sent_data["findings"]["severity"] == "CRITICAL"
    print("OK: Kickoff processing test passed")

    # 2. Test duplicate skip
    # Add our previous response to the history
    history.append(MockLangChainMessage("coordinator", json.dumps(kickoff_payload)))
    history.append(MockLangChainMessage("event_intelligence", json.dumps(sent_data)))
    
    tools.sent_messages.clear()
    await adapter.on_message(
        msg=msg,
        tools=tools,
        history=history,
        participants_msg=None,
        contacts_msg=None,
        is_session_bootstrap=False,
        room_id="room-123"
    )
    assert len(tools.sent_messages) == 0, "Should have skipped duplicate execution"
    print("OK: Duplicate prevention test passed")

async def test_supplier_impact():
    print("==================================================")
    print("TESTING SUPPLIER IMPACT AGENT")
    print("==================================================")
    
    # Pass graph_factory to avoid LangGraphAdapter validation crash
    adapter = CustomSupplierImpactAdapter(graph_factory=lambda x: None)
    adapter.agent_name = "supplier_impact"
    adapter.agent_description = "Analyzes supplier risk"
    adapter.features = None
    
    # 1. Trigger with event_intelligence complete message
    kickoff_payload = {
        "agent": "coordinator",
        "case_id": "CASE-001",
        "phase": "kickoff",
        "event_text": "Magnitude 7.4 earthquake strikes Hsinchu, Taiwan. TSMC reports fab damage.",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    event_intel_payload = {
        "agent": "event_intelligence",
        "case_id": "CASE-001",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "complete",
        "findings": {
            "event_type": "natural_disaster",
            "severity": "CRITICAL",
            "location": "Hsinchu, Taiwan",
            "affected_industries": ["semiconductor"],
            "estimated_duration_weeks": 6,
            "summary": "Earthquake in Taiwan"
        },
        "confidence": "HIGH",
        "flags": []
    }
    
    msg = MockPlatformMessage(json.dumps(event_intel_payload), sender_name="event_intelligence")
    tools = MockAgentTools("supplier_impact")
    history = [
        MockLangChainMessage("coordinator", json.dumps(kickoff_payload))
    ]
    
    await adapter.on_message(
        msg=msg,
        tools=tools,
        history=history,
        participants_msg=None,
        contacts_msg=None,
        is_session_bootstrap=True,
        room_id="room-123"
    )
    
    assert len(tools.sent_messages) == 1, "Should have posted one message"
    sent_data = json.loads(tools.sent_messages[0]["content"])
    assert sent_data["case_id"] == "CASE-001"
    assert sent_data["status"] == "complete"
    assert sent_data["findings"]["affected_tier1"] == 1
    assert "TSMC" in sent_data["findings"]["critical_path_suppliers"]
    print("OK: Upstream trigger processing test passed")

    # 2. Test 60s timeout handling for missing event_intelligence
    # Kickoff is 70 seconds in the past
    past_timestamp = datetime.now(timezone.utc).replace(second=0).isoformat().replace("+00:00", "Z")
    # Let's adjust kickoff timestamp manually
    import datetime as dt
    past_time = datetime.now(timezone.utc) - dt.timedelta(seconds=70)
    kickoff_payload_old = kickoff_payload.copy()
    kickoff_payload_old["timestamp"] = past_time.isoformat().replace("+00:00", "Z")
    
    msg_random = MockPlatformMessage(json.dumps({"some": "other_message"}), sender_name="someone_else")
    tools.sent_messages.clear()
    history_old = [
        MockLangChainMessage("coordinator", json.dumps(kickoff_payload_old))
    ]
    
    await adapter.on_message(
        msg=msg_random,
        tools=tools,
        history=history_old,
        participants_msg=None,
        contacts_msg=None,
        is_session_bootstrap=True,
        room_id="room-123"
    )
    
    assert len(tools.sent_messages) == 1, "Should have posted timeout insufficient_data message"
    sent_data_timeout = json.loads(tools.sent_messages[0]["content"])
    assert sent_data_timeout["status"] == "insufficient_data"
    assert "missing" in sent_data_timeout["flags"][0]
    print("OK: Missing upstream 60s timeout test passed")

async def test_financial_exposure():
    print("==================================================")
    print("TESTING FINANCIAL EXPOSURE AGENT")
    print("==================================================")
    adapter = CustomFinancialExposureAdapter(graph_factory=lambda x: None)
    adapter.agent_name = "financial_exposure"
    adapter.agent_description = "Calculates financial exposure"
    adapter.features = None

    # Test trigger
    kickoff_payload = {
        "agent": "coordinator",
        "case_id": "CASE-001",
        "phase": "kickoff",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    supplier_impact_payload = {
        "agent": "supplier_impact",
        "case_id": "CASE-001",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "complete",
        "findings": {
            "affected_components": ["A100 chips"]
        }
    }
    msg = MockPlatformMessage(json.dumps(supplier_impact_payload), sender_name="supplier_impact")
    tools = MockAgentTools("financial_exposure")
    history = [
        MockLangChainMessage("coordinator", json.dumps(kickoff_payload))
    ]
    await adapter.on_message(msg=msg, tools=tools, history=history, participants_msg=None, contacts_msg=None, is_session_bootstrap=True, room_id="room-123")
    assert len(tools.sent_messages) == 1, "Should have posted one message"
    sent_data = json.loads(tools.sent_messages[0]["content"])
    assert sent_data["case_id"] == "CASE-001"
    assert sent_data["status"] == "complete"
    print("OK: Trigger processing test passed")

    # Test failure propagation
    supplier_impact_fail_payload = {
        "agent": "supplier_impact",
        "case_id": "CASE-001",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "insufficient_data",
        "findings": {}
    }
    msg_fail = MockPlatformMessage(json.dumps(supplier_impact_fail_payload), sender_name="supplier_impact")
    tools.sent_messages.clear()
    await adapter.on_message(msg=msg_fail, tools=tools, history=history, participants_msg=None, contacts_msg=None, is_session_bootstrap=True, room_id="room-123")
    assert len(tools.sent_messages) == 1, "Should have propagated failure"
    sent_data_fail = json.loads(tools.sent_messages[0]["content"])
    assert sent_data_fail["status"] == "insufficient_data"
    print("OK: Failure propagation test passed")


async def test_regulatory_trade():
    print("==================================================")
    print("TESTING REGULATORY TRADE AGENT")
    print("==================================================")
    adapter = CustomRegulatoryTradeAdapter(graph_factory=lambda x: None)
    adapter.agent_name = "regulatory_trade"
    adapter.features = None

    # Test trigger
    kickoff_payload = {
        "agent": "coordinator",
        "case_id": "CASE-001",
        "phase": "kickoff",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    supplier_impact_payload = {
        "agent": "supplier_impact",
        "case_id": "CASE-001",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "complete",
        "findings": {
            "critical_path_suppliers": ["TSMC"]
        }
    }
    msg = MockPlatformMessage(json.dumps(supplier_impact_payload), sender_name="supplier_impact")
    tools = MockAgentTools("regulatory_trade")
    history = [
        MockLangChainMessage("coordinator", json.dumps(kickoff_payload))
    ]
    await adapter.on_message(msg=msg, tools=tools, history=history, participants_msg=None, contacts_msg=None, is_session_bootstrap=True, room_id="room-123")
    assert len(tools.sent_messages) == 1
    sent_data = json.loads(tools.sent_messages[0]["content"])
    assert sent_data["status"] == "complete"
    assert sent_data["findings"]["force_majeure_applicable"] is True
    print("OK: Trigger processing test passed")


async def test_alt_sourcing():
    print("==================================================")
    print("TESTING ALT SOURCING AGENT")
    print("==================================================")
    adapter = CustomAltSourcingAdapter(graph_factory=lambda x: None)
    adapter.agent_name = "alt_sourcing"
    adapter.features = None

    # Test trigger (all 3 complete)
    kickoff_payload = {
        "agent": "coordinator",
        "case_id": "CASE-001",
        "phase": "kickoff",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    supplier_impact_payload = {
        "agent": "supplier_impact",
        "case_id": "CASE-001",
        "status": "complete",
        "findings": {
            "affected_components": ["A100 chips"]
        }
    }
    financial_exposure_payload = {
        "agent": "financial_exposure",
        "case_id": "CASE-001",
        "status": "complete",
        "findings": {}
    }
    regulatory_trade_payload = {
        "agent": "regulatory_trade",
        "case_id": "CASE-001",
        "status": "complete",
        "findings": {
            "export_controls": []
        }
    }
    msg = MockPlatformMessage(json.dumps(regulatory_trade_payload), sender_name="regulatory_trade")
    tools = MockAgentTools("alt_sourcing")
    history = [
        MockLangChainMessage("coordinator", json.dumps(kickoff_payload)),
        MockLangChainMessage("supplier_impact", json.dumps(supplier_impact_payload)),
        MockLangChainMessage("financial_exposure", json.dumps(financial_exposure_payload))
    ]
    await adapter.on_message(msg=msg, tools=tools, history=history, participants_msg=None, contacts_msg=None, is_session_bootstrap=True, room_id="room-123")
    assert len(tools.sent_messages) == 1
    sent_data = json.loads(tools.sent_messages[0]["content"])
    assert sent_data["status"] == "complete"
    print("OK: Trigger processing test passed")

async def main():
    await test_event_intelligence()
    await test_supplier_impact()
    await test_financial_exposure()
    await test_regulatory_trade()
    await test_alt_sourcing()
    print("ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())
