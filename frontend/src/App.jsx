import React, { useState, useEffect, useRef } from 'react';
import Atmosphere from './components/Atmosphere';
import AgentCard from './components/AgentCard';
import ExecutiveBrief from './components/ExecutiveBrief';
import { Pulse, ArrowRight, Radio, Compass, Factory, ChartLineDown, Scales, Handshake } from '@phosphor-icons/react';

const formatCurrency = (val) => {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
};

function TerminalConsole({ messages, loading }) {
  const terminalRef = useRef(null);

  const getTerminalLogs = () => {
    const logs = [];
    
    if (messages.length === 0 && !loading) {
      logs.push({
        time: new Date().toLocaleTimeString(),
        sender: 'SYSTEM',
        text: 'Awaiting disruption signal on Band room...'
      });
    }

    messages.forEach((m) => {
      const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
      const parsed = m.parsed || {};
      
      if (parsed.phase === 'kickoff') {
        logs.push({
          time,
          sender: 'coordinator',
          text: `Investigation started: ${parsed.case_id}`
        });
      } else if (parsed.agent === 'event_intelligence') {
        logs.push({
          time,
          sender: 'event_intel',
          text: `Classified as ${parsed.findings?.event_type} at ${parsed.findings?.location}.`
        });
      } else if (parsed.agent === 'supplier_impact') {
        logs.push({
          time,
          sender: 'supplier_impact',
          text: `Mapped components: ${parsed.findings?.affected_components?.join(', ')}. Runway: ${parsed.findings?.inventory_buffer_days} days.`
        });
      } else if (parsed.agent === 'financial_exposure') {
        logs.push({
          time,
          sender: 'financial_risk',
          text: `Exposure calculated: peak rate ${formatCurrency(parsed.findings?.week6_risk_usd)}. Margin: -${parsed.findings?.margin_impact_pct}%.`
        });
      } else if (parsed.agent === 'regulatory_trade') {
        logs.push({
          time,
          sender: 'compliance_trade',
          text: `Audited. Force Majeure: ${parsed.findings?.force_majeure_applicable ? 'APPLICABLE' : 'NOT DETECTED'}.`
        });
      } else if (parsed.agent === 'alt_sourcing') {
        logs.push({
          time,
          sender: 'alt_sourcing',
          text: `Sourcing scanned. Backup recommendation: ${parsed.findings?.recommended}.`
        });
      } else if (parsed.phase === 'executive_brief') {
        logs.push({
          time,
          sender: 'coordinator',
          text: `Brief synthesized. Verdict: ${parsed.verdict}. Resolution active.`
        });
      }
    });

    if (loading && logs.length === 0) {
      logs.push({
        time: new Date().toLocaleTimeString(),
        sender: 'SYSTEM',
        text: 'Booting multi-agent environment...'
      });
    }

    return logs;
  };

  const logs = getTerminalLogs();

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs.length]);

  return (
    <div className="shell-bezel mt-4" style={{ padding: '4px' }}>
      <div className="core-bezel" style={{ padding: '16px', background: 'rgba(5, 5, 6, 0.4)' }}>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-1.5">
            <Radio size={12} className="text-accent" style={{ animation: 'pulse 1.5s infinite ease-in-out' }} />
            <span className="font-mono text-secondary" style={{ fontSize: '9px', letterSpacing: '0.1em', fontWeight: 600 }}>
              BAND ROOM TERMINAL
            </span>
          </div>
          <span className="tag" style={{ border: 'none', background: 'rgba(212, 255, 0, 0.05)', color: 'var(--color-accent)', padding: '2px 8px', fontSize: '8px' }}>
            LOGS
          </span>
        </div>
        
        <div ref={terminalRef} className="terminal-console">
          {logs.map((log, idx) => (
            <div key={idx} className="terminal-line">
              <span className="timestamp">[{log.time}]</span>
              <span className="sender">[{log.sender}]</span>
              <span>{log.text}</span>
            </div>
          ))}
          <div className="terminal-line">
            <span className="timestamp">[{new Date().toLocaleTimeString()}]</span>
            <span className="sender">[system]</span>
            <span className="text-secondary">active listening</span>
            <span className="terminal-cursor" />
          </div>
        </div>
      </div>
    </div>
  );
}

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

  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  };

  const agentMessages = messages.filter(m => m.parsed && m.parsed.agent && m.parsed.phase !== 'executive_brief');
  const briefMessage = messages.find(m => m.parsed && m.parsed.phase === 'executive_brief');

  // Compute live agent status
  const hasMsg = (agent) => messages.some(m => m.parsed?.agent === agent);
  
  const getAgentState = (agent, deps = []) => {
    if (hasMsg(agent)) return { label: 'COMPLETED', color: 'rgba(212, 255, 0, 0.4)', active: false };
    if (loading || (caseId && !briefMessage)) {
      if (deps.length === 0 || deps.every(d => hasMsg(d))) {
        return { label: 'PROCESSING', color: '#FF5A00', active: true };
      }
    }
    return { label: 'STANDBY', color: 'rgba(255,255,255,0.15)', active: false };
  };

  const agentsList = [
    { key: 'event_intelligence', name: 'Event Intel', icon: <Compass size={12} />, deps: [] },
    { key: 'supplier_impact', name: 'Supplier Impact', icon: <Factory size={12} />, deps: ['event_intelligence'] },
    { key: 'financial_exposure', name: 'Financial Risk', icon: <ChartLineDown size={12} />, deps: ['supplier_impact'] },
    { key: 'regulatory_trade', name: 'Compliance', icon: <Scales size={12} />, deps: ['supplier_impact'] },
    { key: 'alt_sourcing', name: 'Alt Sourcing', icon: <Handshake size={12} />, deps: ['supplier_impact', 'financial_exposure', 'regulatory_trade'] }
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '16px 24px' }}>
      <Atmosphere />
      
      {/* Floating Header Navbar */}
      <header className="flex justify-between items-center" style={{
        position: 'sticky',
        top: '16px',
        zIndex: 100,
        background: 'rgba(10, 10, 12, 0.6)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '9999px',
        padding: '12px 24px',
        width: '100%',
        maxWidth: '1300px',
        margin: '0 auto'
      }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent" style={{ animation: 'pulse 1.5s infinite ease-in-out' }} />
            <span className="font-mono" style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>
              SUPPLYBAND
            </span>
          </div>
          
          {/* Animated Waveform Visualizer */}
          <div className="flex items-center gap-0.5" style={{ height: '16px' }}>
            <div className="waveform-bar" style={{ animationDelay: '0s' }} />
            <div className="waveform-bar" style={{ animationDelay: '0.15s' }} />
            <div className="waveform-bar" style={{ animationDelay: '0.3s' }} />
            <div className="waveform-bar" style={{ animationDelay: '0.45s' }} />
          </div>
        </div>

        {/* Live Agent Dashboard Status tags */}
        <div className="flex items-center gap-2" style={{ overflowX: 'auto', maxWidth: '60%' }}>
          {agentsList.map(agent => {
            const state = getAgentState(agent.key, agent.deps);
            return (
              <div 
                key={agent.key} 
                className="flex items-center gap-1.5" 
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: `1px solid ${state.active ? 'rgba(255, 90, 0, 0.4)' : 'rgba(255,255,255,0.03)'}`,
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: state.active ? '#FF5A00' : 'var(--color-text-secondary)',
                  transition: 'all 0.3s var(--ease-fluid)'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}>{agent.icon}</span>
                <span>{agent.name}</span>
                <span 
                  className="w-1 h-1 rounded-full" 
                  style={{ 
                    background: state.color,
                    boxShadow: state.active ? '0 0 6px #FF5A00' : 'none',
                    animation: state.active ? 'pulse 1s infinite ease-in-out' : 'none'
                  }} 
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="tag" style={{ border: 'none', background: 'rgba(255,255,255,0.02)', fontSize: '10px' }}>
            STATUS: ACTIVE
          </span>
        </div>
      </header>

      {/* Main Dashboard Grid */}
      <main style={{ 
        display: 'grid', 
        gridTemplateColumns: 'minmax(320px, 4fr) 7fr', 
        gap: '64px', 
        maxWidth: '1300px', 
        margin: '0 auto', 
        width: '100%', 
        padding: '64px 8px 80px 8px' 
      }}>
        
        {/* Left Column (Sticky Sidebar) */}
        <div style={{ position: 'sticky', top: '96px', height: 'fit-content' }}>
          <div className="flex items-center gap-1 mb-2">
            <Pulse size={16} className="text-accent" style={{ animation: 'pulse 2s infinite ease-in-out' }} />
            <span className="font-mono text-secondary" style={{ letterSpacing: '0.15em', fontSize: '10px', fontWeight: 600 }}>
              DECISION ORCHESTRATION
            </span>
          </div>
          
          <h1 className="font-display mb-3" style={{ fontSize: 'var(--size-display-lg)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: '1.05' }}>
            Disruption <br/>
            <span style={{ color: 'transparent', WebkitTextStroke: '1px var(--color-text-primary)' }}>Monitor</span>
          </h1>
          
          <p className="text-secondary mb-4" style={{ fontSize: '15px', lineHeight: '1.6', fontWeight: 400, maxWidth: '340px' }}>
            Autonomous multi-agent synthesis of supply chain risks, component exposure, and trade compliance.
          </p>

          {/* Mouse-Tracking Spotlight Form */}
          <div 
            className="spotlight-card shell-bezel" 
            onMouseMove={handleMouseMove}
            style={{ transition: 'all 0.4s var(--ease-fluid)' }}
          >
            <div className="core-bezel" style={{ padding: '20px' }}>
              <div className="flex items-center gap-2 mb-3">
                <Radio size={14} className="text-secondary" />
                <h3 className="font-mono text-secondary" style={{ fontSize: '11px', letterSpacing: '0.1em', fontWeight: 600 }}>
                  NEW INVESTIGATION
                </h3>
              </div>
              
              <form onSubmit={handleTrigger} className="flex flex-col">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Paste raw disruption news text or incident report..."
                  style={{
                    width: '100%',
                    height: '110px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    borderRadius: '8px',
                    color: 'var(--color-text-primary)',
                    padding: '12px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    resize: 'none',
                    marginBottom: '16px',
                    outline: 'none',
                    transition: 'all 0.3s var(--ease-fluid)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(212, 255, 0, 0.4)';
                    e.target.style.boxShadow = '0 0 0 2px rgba(212, 255, 0, 0.05)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.04)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                
                <button
                  type="submit"
                  disabled={loading || !inputValue.trim()}
                  className="btn-island"
                  style={{ width: '100%' }}
                >
                  <span>{loading ? 'Initializing...' : 'Analyze Event'}</span>
                  <div className="icon-circle">
                    <ArrowRight size={14} weight="bold" />
                  </div>
                </button>
              </form>
            </div>
          </div>

          {caseId && (
            <div className="mt-3 font-mono text-secondary flex items-center gap-2" style={{ fontSize: '11px', paddingLeft: '8px' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent" style={{ animation: 'pulse 1.5s infinite ease-in-out' }} />
              Active Case: <span className="text-accent" style={{ fontWeight: 600 }}>{caseId}</span>
            </div>
          )}

          {/* Terminal Logs panel */}
          <TerminalConsole messages={messages} loading={loading} />
        </div>

        {/* Right Column (Timeline & Brief) */}
        <div style={{ paddingBottom: '128px' }}>
          {agentMessages.length === 0 && !briefMessage && (
            <div style={{ 
              height: '360px', 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center', 
              border: '1px dashed rgba(255, 255, 255, 0.04)', 
              borderRadius: '16px',
              background: 'rgba(255,255,255,0.003)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Laser line sweep animation */}
              <div className="scanner-line" />
              
              <div className="w-3 h-3 rounded-full bg-accent mb-3" style={{ animation: 'pulse 1.5s infinite ease-in-out' }} />
              <span className="font-mono text-secondary" style={{ fontSize: '11px', letterSpacing: '0.15em' }}>
                SYSTEM SCANNING FOR EVENTS...
              </span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {agentMessages.map((msg, idx) => (
              <AgentCard key={msg.id || idx} message={msg} index={idx} handleMouseMove={handleMouseMove} />
            ))}
          </div>

          {briefMessage && (
            <ExecutiveBrief brief={briefMessage} messages={messages} handleMouseMove={handleMouseMove} />
          )}
          
          <div ref={endOfMessagesRef} />
        </div>

      </main>
    </div>
  );
}

export default App;


