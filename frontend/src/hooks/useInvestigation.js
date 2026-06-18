import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export function useInvestigation(caseId) {
  const [messages, setMessages] = useState([]);
  const [agentStates, setAgentStates] = useState({});
  const [isComplete, setIsComplete] = useState(false);
  
  // Track when an agent first enters "processing"
  const processingStartTimes = useRef({});

  useEffect(() => {
    if (!caseId) return;

    let isMounted = true;
    const fetchMessages = async () => {
      try {
        const response = await axios.get(`${API_BASE}/room-messages?case_id=${caseId}`);
        if (isMounted) {
          const fetchedMsgs = (response.data.messages || []).map(m => {
            const parsed = m.parsed || {};
            return {
              ...m,
              ...parsed,
              raw_content: m.content,
              timestamp: parsed.timestamp || m.inserted_at || new Date().toISOString()
            };
          });
          setMessages(fetchedMsgs);
          
          // Map agent states
          const newStates = deriveAgentStates(fetchedMsgs, processingStartTimes.current);
          setAgentStates(newStates);
          
          if (newStates.coordinator?.phase === 'executive_brief') {
            setIsComplete(true);
          }
        }
      } catch (err) {
        console.error("Error fetching investigation messages:", err);
      }
    };

    fetchMessages();
    const intervalId = setInterval(fetchMessages, 2000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [caseId]);

  return { messages, agentStates, isComplete };
}

function deriveAgentStates(messages, startTimes) {
  const posts = {};
  messages.forEach(msg => {
    if (msg.agent) {
      if (msg.agent === 'coordinator' && msg.phase === 'kickoff') {
        posts['coordinator_kickoff'] = msg;
      } else if (msg.agent === 'coordinator' && msg.phase === 'executive_brief') {
        posts['coordinator_brief'] = msg;
      } else {
        posts[msg.agent] = msg;
      }
    }
  });

  const now = Date.now();
  const states = {};

  const getProcessingState = (agentName, isReady) => {
    if (posts[agentName]) {
      const msg = posts[agentName];
      const s = msg.status === 'complete' ? 'complete' : 'error';
      return { state: s, findings: msg.findings, confidence: msg.confidence, flags: msg.flags };
    }
    if (isReady) {
      if (!startTimes[agentName]) startTimes[agentName] = now;
      const elapsed = now - startTimes[agentName];
      return { state: elapsed > 25000 ? 'delayed' : 'processing' };
    }
    return { state: 'pending' };
  };

  states['coordinator'] = { 
    state: posts['coordinator_brief'] ? 'complete' : (posts['coordinator_kickoff'] ? 'processing' : 'pending'),
    phase: posts['coordinator_brief'] ? 'executive_brief' : (posts['coordinator_kickoff'] ? 'kickoff' : 'pending'),
  };

  const isKickoff = !!posts['coordinator_kickoff'];
  states['event_intelligence'] = getProcessingState('event_intelligence', isKickoff);

  const isEventIntelDone = posts['event_intelligence']?.status === 'complete';
  states['supplier_impact'] = getProcessingState('supplier_impact', isEventIntelDone);

  const isSupplierImpactDone = posts['supplier_impact']?.status === 'complete';
  states['financial_exposure'] = getProcessingState('financial_exposure', isSupplierImpactDone);
  states['regulatory_trade'] = getProcessingState('regulatory_trade', isSupplierImpactDone);

  const isAltSourcingReady = isSupplierImpactDone && posts['financial_exposure'] && posts['regulatory_trade'];
  states['alt_sourcing'] = getProcessingState('alt_sourcing', isAltSourcingReady);

  return states;
}
