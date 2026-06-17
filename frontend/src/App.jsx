import React, { useState, useEffect, useRef } from 'react';
import Atmosphere from './components/Atmosphere';
import AgentCard from './components/AgentCard';
import ExecutiveBrief from './components/ExecutiveBrief';
import { Activity } from 'lucide-react';

function App() {
  const [messages, setMessages] = useState([]);
  const [caseId, setCaseId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const endOfMessagesRef = useRef(null);

  const fetchMessages = async (currentCase) => {
    try {
      const url = currentCase 
        ? `http://localhost:8000/room-messages?case_id=${currentCase}` 
        : `http://localhost:8000/room-messages`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  };

  useEffect(() => {
    fetchMessages(caseId);
    const interval = setInterval(() => {
      fetchMessages(caseId);
    }, 2000);
    return () => clearInterval(interval);
  }, [caseId]);

  // Auto-scroll removed for better UX

  const handleTrigger = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/trigger-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_text: inputValue })
      });
      if (res.ok) {
        const data = await res.json();
        setCaseId(data.case_id);
        setInputValue('');
      }
    } catch (err) {
      console.error("Failed to trigger event", err);
    } finally {
      setLoading(false);
    }
  };

  const agentMessages = messages.filter(m => m.parsed && m.parsed.agent && m.parsed.phase !== 'executive_brief');
  const briefMessage = messages.find(m => m.parsed && m.parsed.phase === 'executive_brief');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Atmosphere />
      
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 4fr) 7fr', gap: '80px', maxWidth: '1440px', margin: '0 auto', width: '100%', padding: '80px 40px' }}>
        
        {/* Static Left Column */}
        <div style={{ position: 'sticky', top: '64px', height: 'fit-content' }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity size={20} className="text-accent" />
            <span className="font-mono text-secondary" style={{ letterSpacing: '0.1em', fontSize: '12px' }}>SUPPLYBAND INTELLIGENCE</span>
          </div>
          <h1 className="font-display mb-4" style={{ fontSize: 'var(--size-display-lg)', lineHeight: '1.1' }}>
            Disruption <br/>
            <span style={{ color: 'transparent', WebkitTextStroke: '1px var(--color-text-primary)' }}>Monitor</span>
          </h1>
          <p className="text-secondary mb-8" style={{ fontSize: '18px', lineHeight: '1.6' }}>
            Autonomous multi-agent synthesis of supply chain risks, component exposure, and regulatory compliance.
          </p>

          <form onSubmit={handleTrigger} style={{ background: 'var(--color-surface-mid)', padding: '24px', borderRadius: '4px', border: '1px solid var(--color-rule)' }}>
            <h3 className="font-mono text-primary mb-3" style={{ fontSize: '13px', letterSpacing: '0.05em' }}>NEW INVESTIGATION</h3>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Paste raw news text, analyst report, or disruption alert here..."
              style={{
                width: '100%',
                height: '120px',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--color-rule)',
                borderRadius: '4px',
                color: 'var(--color-text-primary)',
                padding: '12px',
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                resize: 'none',
                marginBottom: '16px'
              }}
            />
            <button
              type="submit"
              disabled={loading || !inputValue.trim()}
              style={{
                width: '100%',
                padding: '12px',
                background: inputValue.trim() ? 'var(--color-text-primary)' : 'var(--color-surface-hi)',
                color: inputValue.trim() ? 'var(--color-surface)' : 'var(--color-text-secondary)',
                border: 'none',
                borderRadius: '2px',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? 'INITIALIZING...' : 'ANALYZE EVENT'}
            </button>
          </form>

          {caseId && (
            <div className="mt-4 font-mono text-secondary" style={{ fontSize: '12px' }}>
              Active Case: <span className="text-accent">{caseId}</span>
            </div>
          )}
        </div>

        {/* Live Right Column */}
        <div style={{ paddingBottom: '128px' }}>
          {agentMessages.length === 0 && !briefMessage && (
            <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--color-rule)', borderRadius: '4px' }}>
              <span className="font-mono text-secondary">AWAITING SIGNAL...</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {agentMessages.map((msg, idx) => (
              <AgentCard key={msg.id || idx} message={msg} index={idx} />
            ))}
          </div>

          {briefMessage && (
            <ExecutiveBrief brief={briefMessage} />
          )}
          
          <div ref={endOfMessagesRef} />
        </div>

      </div>
    </div>
  );
}

export default App;
