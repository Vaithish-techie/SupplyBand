import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import PipelineVisualizer from './components/PipelineVisualizer';
import AgentCard from './components/AgentCard';
import ExecutiveBriefPanel from './components/ExecutiveBriefPanel';
import { getCaseStatus, getRoomMessages } from './services/api';
import { Terminal, Clock, Activity, MessageSquare } from 'lucide-react';

export default function App() {
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [agentsPosted, setAgentsPosted] = useState([]);
  const [agentsPending, setAgentsPending] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState('');

  const pollingRef = useRef(null);

  // Stop polling helper
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
  };

  // Start polling helper
  const startPolling = (caseId) => {
    stopPolling();
    setIsPolling(true);
    setIsComplete(false);
    setAgentsPosted([]);
    setAgentsPending([]);
    setMessages([]);
    setError('');

    async function poll() {
      try {
        // 1. Fetch Case Status
        const status = await getCaseStatus(caseId);
        setAgentsPosted(status.agents_posted || []);
        setAgentsPending(status.agents_pending || []);
        setIsComplete(status.investigation_complete);

        // 2. Fetch Room Messages
        const roomMsgs = await getRoomMessages(caseId);
        setMessages(roomMsgs.messages || []);

        if (status.investigation_complete) {
          stopPolling();
        }
      } catch (err) {
        console.error('Polling error:', err);
        setError('Error syncing with Band room: ' + err.message);
      }
    }

    // Run first iteration immediately
    poll();
    // Then set interval
    pollingRef.current = setInterval(poll, 2500);
  };

  // Handle case triggered
  const handleCaseTriggered = (caseId, text) => {
    setSelectedCaseId(caseId);
    startPolling(caseId);
  };

  // Clear polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, []);

  // Map messages to specific specialist keys
  const getMessageForAgent = (agentKey) => {
    // Return the latest parsed message for this agent
    return messages.find(m => {
      const parsed = m.parsed;
      if (!parsed) return false;
      if (agentKey === 'coordinator_kickoff') {
        return parsed.agent === 'coordinator' && parsed.phase === 'kickoff';
      }
      return parsed.agent === agentKey;
    });
  };

  const kickoffMsg = getMessageForAgent('coordinator_kickoff');
  const briefMsg = getMessageForAgent('coordinator_brief');

  const specialistKeys = [
    'event_intelligence',
    'supplier_impact',
    'financial_exposure',
    'regulatory_trade',
    'alt_sourcing'
  ];

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
      
      {/* Header Panel */}
      <Header 
        onCaseTriggered={handleCaseTriggered} 
        selectedCaseId={selectedCaseId} 
        isPolling={isPolling} 
      />

      {/* Main Content Layout */}
      {selectedCaseId ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Pipeline Visualizer (full width) */}
          <PipelineVisualizer 
            agentsPosted={agentsPosted} 
            agentsPending={agentsPending} 
          />

          {error && (
            <div style={{
              background: 'rgba(255, 0, 122, 0.08)',
              border: '1px solid rgba(255, 0, 122, 0.2)',
              color: 'var(--neon-pink)',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px'
            }}>
              {error}
            </div>
          )}

          {/* Core Panel Grid: Left column (Cards), Right column (Decision / Live Feed) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '24px',
            alignItems: 'start'
          }}>
            
            {/* Specialist Findings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '-8px' }}>
                <Activity size={16} style={{ color: 'var(--neon-purple)' }} />
                <h2 style={{ fontSize: '15px', color: '#9aa0b9', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', margin: 0 }}>
                  Specialist Intelligence Postings
                </h2>
              </div>
              
              {specialistKeys.map(key => (
                <AgentCard
                  key={key}
                  agentKey={key}
                  rawMessage={getMessageForAgent(key)}
                  isPending={agentsPending.includes(key)}
                  isPosted={agentsPosted.includes(key)}
                />
              ))}
            </div>

            {/* Control Deck and Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'sticky', top: '24px' }}>
              
              {/* Executive Brief */}
              <ExecutiveBriefPanel
                caseId={selectedCaseId}
                briefData={briefMsg}
                isComplete={isComplete}
              />

              {/* Live Terminal Chat Feed */}
              <div className="glass-panel" style={{
                padding: '20px',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                  <Terminal size={16} style={{ color: 'var(--neon-cyan)' }} />
                  Live Band Room Transmission Logs
                </h3>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  background: 'rgba(0, 0, 0, 0.4)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.03)',
                }}>
                  {messages.length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>
                      Waiting for incoming packet transmissions...
                    </div>
                  ) : (
                    [...messages].reverse().map((msg, idx) => {
                      const agentName = msg.parsed?.agent || 'unknown';
                      const timestamp = msg.parsed?.timestamp || msg.created_at;
                      const content = msg.content;
                      
                      const nameColors = {
                        coordinator: 'var(--neon-blue)',
                        event_intelligence: 'var(--neon-purple)',
                        supplier_impact: 'var(--neon-pink)',
                        financial_exposure: 'var(--neon-orange)',
                        regulatory_trade: 'var(--neon-cyan)',
                        alt_sourcing: 'var(--neon-green)',
                        human_operator: '#fff'
                      };

                      return (
                        <div key={idx} style={{ 
                          fontSize: '12px', 
                          fontFamily: 'monospace', 
                          borderBottom: '1px solid rgba(255,255,255,0.02)',
                          paddingBottom: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                            <span style={{ fontWeight: 700, color: nameColors[agentName] || '#9aa0b9' }}>
                              [{agentName.toUpperCase()}]
                            </span>
                            <span style={{ color: '#475569' }}>
                              {timestamp ? new Date(timestamp).toLocaleTimeString() : ''}
                            </span>
                          </div>
                          <div style={{ color: '#94a3b8', wordBreak: 'break-all', lineHeight: 1.4 }}>
                            {content.length > 180 ? content.slice(0, 180) + '...' : content}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

          </div>

        </div>
      ) : (
        /* Empty Dashboard State */
        <div className="glass-panel" style={{
          padding: '60px 24px',
          textAlign: 'center',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(139, 92, 246, 0.05)',
            border: '1px solid rgba(139, 92, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-primary-light)',
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.1)',
            marginBottom: '8px'
          }}>
            <MessageSquare size={32} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-display)', margin: 0 }}>
            Establish Event Disruption Case
          </h2>
          <p style={{ fontSize: '14px', color: '#9aa0b9', maxWidth: '450px', margin: 0, lineHeight: 1.6 }}>
            No active investigation has been loaded. Select a preset disruption from the header control panel above, or type custom scenario parameters to trigger the multi-agent orchestration.
          </p>
        </div>
      )}

    </div>
  );
}
