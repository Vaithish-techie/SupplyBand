import React, { useState, useEffect, useRef } from 'react';
import Atmosphere from './components/Atmosphere';
import AgentCard from './components/AgentCard';
import ExecutiveBrief from './components/ExecutiveBrief';
import { Pulse, ArrowRight, Radio, Compass, Factory, ChartLineDown, Scales, Handshake, Cpu, GridFour, Cube, TerminalWindow, Monitor } from '@phosphor-icons/react';

const formatCurrency = (val) => {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
};

function TerminalConsole({ messages, loading }) {
  const terminalRef = useRef(null);
  const [terminalLines, setTerminalLines] = useState([]);
  const [commandInput, setCommandInput] = useState('');
  const processedMsgIds = useRef(new Set());

  // Sync incoming Band room messages to the terminal lines dynamically
  useEffect(() => {
    if (messages.length === 0) {
      processedMsgIds.current.clear();
      setTerminalLines([{
        time: new Date().toLocaleTimeString(),
        sender: 'SYSTEM',
        text: 'Awaiting disruption signal on Band room... Type /help for diagnostics.'
      }]);
      return;
    }

    const newLines = [];
    messages.forEach((m) => {
      const msgId = m.id || `${m.agent}-${m.timestamp}-${m.parsed?.phase}`;
      if (processedMsgIds.current.has(msgId)) return;
      processedMsgIds.current.add(msgId);

      const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
      const parsed = m.parsed || {};
      
      if (parsed.phase === 'kickoff') {
        newLines.push({ time, sender: 'coordinator', text: `Investigation started: ${parsed.case_id}` });
      } else if (parsed.agent === 'event_intelligence') {
        newLines.push({ time, sender: 'event_intel', text: `Classified as ${parsed.findings?.event_type} at ${parsed.findings?.location}.` });
      } else if (parsed.agent === 'supplier_impact') {
        newLines.push({ time, sender: 'supplier_impact', text: `Mapped components: ${parsed.findings?.affected_components?.join(', ')}. Runway: ${parsed.findings?.inventory_buffer_days} days.` });
      } else if (parsed.agent === 'financial_exposure') {
        newLines.push({ time, sender: 'financial_risk', text: `Exposure calculated: peak rate ${formatCurrency(parsed.findings?.week6_risk_usd)}. Margin: -${parsed.findings?.margin_impact_pct}%.` });
      } else if (parsed.agent === 'regulatory_trade') {
        newLines.push({ time, sender: 'compliance_trade', text: `Audited. Force Majeure: ${parsed.findings?.force_majeure_applicable ? 'APPLICABLE' : 'NOT DETECTED'}.` });
      } else if (parsed.agent === 'alt_sourcing') {
        newLines.push({ time, sender: 'alt_sourcing', text: `Sourcing scanned. Backup recommendation: ${parsed.findings?.recommended}.` });
      } else if (parsed.phase === 'executive_brief') {
        newLines.push({ time, sender: 'coordinator', text: `Brief synthesized. Verdict: ${parsed.verdict}. Resolution active.` });
      }
    });

    if (newLines.length > 0) {
      setTerminalLines(prev => [...prev, ...newLines]);
    }
  }, [messages]);

  useEffect(() => {
    if (loading && terminalLines.length === 1) {
      setTerminalLines(prev => [...prev, {
        time: new Date().toLocaleTimeString(),
        sender: 'SYSTEM',
        text: 'Booting multi-agent environment...'
      }]);
    }
  }, [loading]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines.length]);

  const handleCommandSubmit = (e) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    const cmd = commandInput.trim().toLowerCase();
    const time = new Date().toLocaleTimeString();

    // Append the operator's input
    setTerminalLines(prev => [...prev, { time, sender: 'operator', text: `$ ${commandInput}` }]);
    setCommandInput('');

    // Trigger mock diagnostics after a slight haptic pause
    setTimeout(() => {
      const respTime = new Date().toLocaleTimeString();
      if (cmd === '/help') {
        setTerminalLines(prev => [
          ...prev,
          { time: respTime, sender: 'system', text: 'Available diagnostic codes:' },
          { time: respTime, sender: 'system', text: '  /scan    - Ping infrastructure nodes' },
          { time: respTime, sender: 'system', text: '  /agents  - Query active orchestrators state' },
          { time: respTime, sender: 'system', text: '  /matrix  - Cascade core diagnostic grid' },
          { time: respTime, sender: 'system', text: '  /clear   - Flush current log queue' }
        ]);
      } else if (cmd === '/clear') {
        setTerminalLines([]);
      } else if (cmd === '/scan') {
        setTerminalLines(prev => [...prev, { time: respTime, sender: 'system', text: 'Initiating node ping...' }]);
        setTimeout(() => {
          setTerminalLines(prev => [...prev, { time: new Date().toLocaleTimeString(), sender: 'system', text: '▸ Shanghai Port Routing: SUCCESS (28ms)' }]);
        }, 250);
        setTimeout(() => {
          setTerminalLines(prev => [...prev, { time: new Date().toLocaleTimeString(), sender: 'system', text: '▸ Hsinchu Fab Routing: SUCCESS (42ms)' }]);
        }, 500);
        setTimeout(() => {
          setTerminalLines(prev => [...prev, { time: new Date().toLocaleTimeString(), sender: 'system', text: '▸ Shenzhen Logistics Hub: SUCCESS (51ms)' }]);
        }, 750);
        setTimeout(() => {
          setTerminalLines(prev => [...prev, { time: new Date().toLocaleTimeString(), sender: 'system', text: '▸ Core systems online. Route mesh stable.' }]);
        }, 1000);
      } else if (cmd === '/agents') {
        setTerminalLines(prev => [
          ...prev,
          { time: respTime, sender: 'system', text: 'Querying agent states...' },
          { time: respTime, sender: 'system', text: '  - coordinator          : ACTIVE (monitoring band)' },
          { time: respTime, sender: 'system', text: '  - event_intelligence   : COMPLETE' },
          { time: respTime, sender: 'system', text: '  - supplier_impact      : COMPLETE' },
          { time: respTime, sender: 'system', text: '  - financial_exposure   : COMPLETE' },
          { time: respTime, sender: 'system', text: '  - regulatory_trade     : COMPLETE' },
          { time: respTime, sender: 'system', text: '  - alt_sourcing         : COMPLETE' }
        ]);
      } else if (cmd === '/matrix') {
        setTerminalLines(prev => [...prev, { time: respTime, sender: 'system', text: 'Cascading core diagnostic grid...' }]);
        let count = 0;
        const interval = setInterval(() => {
          const randHex = Array.from({length: 8}, () => Math.floor(Math.random()*16).toString(16)).join('').toUpperCase();
          setTerminalLines(prev => [...prev, { time: new Date().toLocaleTimeString(), sender: 'diagnostics', text: `GRID-ADDR: 0x${randHex} ... PING OK` }]);
          count++;
          if (count >= 5) clearInterval(interval);
        }, 150);
      } else {
        setTerminalLines(prev => [...prev, { time: respTime, sender: 'system', text: `Command not recognized: "${cmd}". Type /help for assist.` }]);
      }
    }, 150);
  };

  return (
    <div className="shell-bezel mt-4" style={{ padding: '4px' }}>
      <div className="core-bezel" style={{ padding: '16px', background: 'rgba(5, 5, 6, 0.4)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <Radio size={12} className="text-accent" style={{ animation: 'pulse 1.5s infinite ease-in-out' }} />
            <span className="font-mono text-secondary" style={{ fontSize: '9px', letterSpacing: '0.1em', fontWeight: 600 }}>
              BAND ROOM TERMINAL
            </span>
          </div>
          <span className="tag" style={{ border: 'none', background: 'rgba(212, 255, 0, 0.05)', color: 'var(--color-accent)', padding: '2px 8px', fontSize: '8px' }}>
            INTERACTIVE
          </span>
        </div>
        
        <div ref={terminalRef} className="terminal-console" style={{ height: '140px' }}>
          {terminalLines.map((log, idx) => (
            <div key={idx} className="terminal-line">
              <span className="timestamp">[{log.time}]</span>
              <span className="sender">[{log.sender}]</span>
              <span>{log.text}</span>
            </div>
          ))}
          <div className="terminal-line">
            <span className="timestamp">[{new Date().toLocaleTimeString()}]</span>
            <span className="sender">[operator]</span>
            <span className="text-secondary">ready</span>
            <span className="terminal-cursor" />
          </div>
        </div>

        <form onSubmit={handleCommandSubmit} className="terminal-input-form" style={{ borderRadius: '6px', overflow: 'hidden' }}>
          <span className="terminal-prompt-token">&gt;</span>
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Enter diagnostics code (/help, /scan...)"
            className="terminal-prompt-input"
          />
        </form>
      </div>
    </div>
  );
}

function SurveillanceWidget() {
  const [coords, setCoords] = useState({ lat: '31.2304 N', lng: '121.4737 E' });
  const [pulsePos, setPulsePos] = useState({ x: 140, y: 45 });
  
  useEffect(() => {
    const interval = setInterval(() => {
      const latJitter = (31.2304 + (Math.random() - 0.5) * 0.005).toFixed(4);
      const lngJitter = (121.4737 + (Math.random() - 0.5) * 0.005).toFixed(4);
      setCoords({ lat: `${latJitter} N`, lng: `${lngJitter} E` });
      setPulsePos({
        x: Math.floor(100 + Math.random() * 80),
        y: Math.floor(30 + Math.random() * 40)
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="shell-bezel mt-4" style={{ padding: '4px' }}>
      <div className="core-bezel" style={{ padding: '16px', background: 'rgba(5, 5, 6, 0.4)', position: 'relative', overflow: 'hidden' }}>
        <div className="halftone-bg" />
        
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" style={{ animation: 'pulse 1s infinite ease-in-out' }} />
            <span className="font-mono text-secondary" style={{ fontSize: '9px', letterSpacing: '0.1em', fontWeight: 600 }}>
              SATELLITE SURVEILLANCE FEED [SHANGHAI]
            </span>
          </div>
          <span className="tag" style={{ border: 'none', background: 'rgba(212, 255, 0, 0.05)', color: 'var(--color-accent)', padding: '2px 8px', fontSize: '8px' }}>
            LIVE FEED
          </span>
        </div>

        <div style={{ position: 'relative', height: '110px', background: '#020203', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          
          <svg width="100%" height="100%" viewBox="0 0 300 110" style={{ overflow: 'visible' }}>
            <path d="M 10 10 L 80 10 L 90 40 L 40 40 Z" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <path d="M 120 20 L 220 20 L 200 60 L 140 60 Z" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            
            <path d="M 0 50 Q 150 70 300 40" fill="none" stroke="rgba(0, 229, 255, 0.05)" strokeWidth="8" strokeLinecap="round" />
            <path d="M 0 50 Q 150 70 300 40" fill="none" stroke="rgba(0, 229, 255, 0.15)" strokeWidth="1" strokeDasharray="3,3" />

            <line x1="0" y1="0" x2="300" y2="0" stroke="var(--color-accent)" strokeWidth="1" opacity="0.3" style={{ animation: 'scan 4s infinite linear' }} />
            
            <g transform={`translate(${pulsePos.x}, ${pulsePos.y})`}>
              <circle cx="0" cy="0" r="10" fill="none" stroke="var(--color-accent)" strokeWidth="1" opacity="0.4" style={{ animation: 'ping 2s infinite ease-out' }} />
              <circle cx="0" cy="0" r="3" fill="var(--color-accent)" />
              <text x="8" y="3" fill="var(--color-text-primary)" fontSize="7" fontFamily="var(--font-mono)">VESSEL-T52</text>
            </g>
          </svg>

          <div style={{ position: 'absolute', bottom: '6px', left: '8px', fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span>LAT: {coords.lat}</span>
            <span>LNG: {coords.lng}</span>
          </div>

          <div style={{ position: 'absolute', bottom: '6px', right: '8px', fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--color-text-secondary)' }}>
            <span>ZOOM: 16x | FOCUS: AUTO</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoConstructionWidget() {
  return (
    <div className="shell-bezel mt-4" style={{ padding: '4px' }}>
      <div className="core-bezel" style={{ padding: '16px', background: 'rgba(5, 5, 6, 0.4)', position: 'relative', overflow: 'hidden' }}>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="font-mono text-secondary" style={{ fontSize: '9px', letterSpacing: '0.1em', fontWeight: 600 }}>
              LOGO GEOMETRY CONSTRUCTION
            </span>
          </div>
          <span className="tag" style={{ border: 'none', background: 'rgba(212, 255, 0, 0.05)', color: 'var(--color-accent)', padding: '2px 8px', fontSize: '8px' }}>
            SYS-MARK
          </span>
        </div>

        <div style={{ position: 'relative', height: '110px', background: '#020203', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(0, 229, 255, 0.03) 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
          
          <svg width="150" height="90" viewBox="0 0 150 90" style={{ overflow: 'visible' }}>
            <line x1="10" y1="45" x2="140" y2="45" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3" />
            <line x1="75" y1="5" x2="75" y2="85" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3" />
            
            <circle cx="75" cy="45" r="30" fill="none" stroke="rgba(0, 229, 255, 0.15)" strokeWidth="0.75" />
            <circle cx="75" cy="45" r="22" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.75" strokeDasharray="2" />
            <circle cx="75" cy="45" r="10" fill="none" stroke="var(--color-accent)" strokeWidth="0.75" style={{ opacity: 0.3 }} />
            
            <line x1="30" y1="20" x2="120" y2="70" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="0.5" />
            <line x1="30" y1="70" x2="120" y2="20" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="0.5" />

            <g className="animate-rotate-blueprint">
              <rect x="53" y="44" width="44" height="2" fill="var(--color-accent)" opacity="0.8" transform="rotate(30 75 45)" />
              <rect x="53" y="44" width="44" height="2" fill="var(--color-accent)" opacity="0.8" transform="rotate(-30 75 45)" />
              <circle cx="75" cy="45" r="5" fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth="1.5" />
            </g>

            <path d="M 75 45 L 96 24" fill="none" stroke="var(--color-accent)" strokeWidth="0.75" />
            <text x="88" y="32" fill="var(--color-accent)" fontSize="6" fontFamily="var(--font-mono)">r=30px</text>

            <path d="M 95 45 A 20 20 0 0 0 91 33" fill="none" stroke="rgba(0, 229, 255, 0.3)" strokeWidth="0.75" />
            <text x="98" y="41" fill="rgba(0, 229, 255, 0.5)" fontSize="6" fontFamily="var(--font-mono)">30°</text>
          </svg>

          <div style={{ position: 'absolute', top: '6px', left: '8px', fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'rgba(255,255,255,0.2)' }}>
            <span>SCALE: 1:1.0</span>
          </div>
          <div style={{ position: 'absolute', bottom: '6px', right: '8px', fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'rgba(255,255,255,0.2)' }}>
            <span>ANGLE SEC: 0.523 RAD</span>
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
  const [activeTheme, setActiveTheme] = useState('hud');
  const [crtEnabled, setCrtEnabled] = useState(true);
  const [timeStr, setTimeStr] = useState(new Date().toLocaleTimeString());
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
    document.body.setAttribute('data-theme', activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '16px 24px', position: 'relative' }}>
      {crtEnabled && <div className="crt-overlay crt-flicker" />}
      <div className="blueprint-grid" />
      <Atmosphere />
      
      {/* Floating Header Navbar */}
      <header className="flex justify-between items-center" style={{
        position: 'sticky',
        top: '16px',
        zIndex: 100,
        background: 'rgba(10, 10, 12, 0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--card-border)',
        borderRadius: '9999px',
        padding: '12px 24px',
        width: '100%',
        maxWidth: '1300px',
        margin: '0 auto',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
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
        <div className="flex items-center gap-2" style={{ overflowX: 'auto', maxWidth: '45%' }}>
          {agentsList.map(agent => {
            const state = getAgentState(agent.key, agent.deps);
            return (
              <div 
                key={agent.key} 
                className="flex items-center gap-1.5" 
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: `1px solid ${state.active ? 'var(--color-accent)' : 'rgba(255,255,255,0.03)'}`,
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: state.active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  transition: 'all 0.3s var(--ease-fluid)'
                }}
              >
                <span>{agent.name}</span>
                <span 
                  className="w-1.5 h-1.5 rounded-full" 
                  style={{ 
                    background: state.color,
                    boxShadow: state.active ? '0 0 6px var(--color-accent)' : 'none',
                    animation: state.active ? 'pulse 1s infinite ease-in-out' : 'none'
                  }} 
                />
              </div>
            );
          })}
        </div>

        {/* Control Center */}
        <div className="flex items-center gap-3">
          {/* Theme selection buttons */}
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-full border border-white/5">
            <button 
              onClick={() => setActiveTheme('hud')}
              className="tag" 
              style={{ 
                border: 'none', 
                background: activeTheme === 'hud' ? 'rgba(212, 255, 0, 0.15)' : 'transparent',
                color: activeTheme === 'hud' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                fontSize: '8px', 
                padding: '4px 8px',
                cursor: 'pointer'
              }}
              title="Cybernetic HUD Mode"
            >
              <Cpu size={10} style={{ marginRight: '3px' }} /> HUD
            </button>
            <button 
              onClick={() => setActiveTheme('blueprint')}
              className="tag" 
              style={{ 
                border: 'none', 
                background: activeTheme === 'blueprint' ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
                color: activeTheme === 'blueprint' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                fontSize: '8px', 
                padding: '4px 8px',
                cursor: 'pointer'
              }}
              title="Technical Blueprint Mode"
            >
              <GridFour size={10} style={{ marginRight: '3px' }} /> BLUEPRINT
            </button>
            <button 
              onClick={() => setActiveTheme('onyx')}
              className="tag" 
              style={{ 
                border: 'none', 
                background: activeTheme === 'onyx' ? 'rgba(255, 51, 0, 0.15)' : 'transparent',
                color: activeTheme === 'onyx' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                fontSize: '8px', 
                padding: '4px 8px',
                cursor: 'pointer'
              }}
              title="Onyx Vantablack Mode"
            >
              <Cube size={10} style={{ marginRight: '3px' }} /> ONYX
            </button>
          </div>

          {/* CRT scanline toggler */}
          <button 
            onClick={() => setCrtEnabled(!crtEnabled)}
            className="tag" 
            style={{ 
              border: crtEnabled ? '1px solid var(--color-accent)' : '1px solid rgba(255,255,255,0.05)', 
              background: crtEnabled ? 'rgba(255,255,255,0.02)' : 'transparent',
              color: crtEnabled ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              fontSize: '8px', 
              padding: '4px 10px',
              cursor: 'pointer'
            }}
          >
            <Monitor size={10} style={{ marginRight: '3px' }} /> CRT {crtEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </header>

      {/* Telemetry subheader ribbon */}
      <div style={{
        width: '100%',
        maxWidth: '1300px',
        margin: '12px auto 0 auto',
        padding: '6px 24px',
        background: 'rgba(0, 0, 0, 0.15)',
        borderBottom: '1px dashed var(--color-rule)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: '9px',
        color: 'var(--color-text-secondary)'
      }}>
        <div className="flex gap-4">
          <span>[SYSTEM: ACTIVE]</span>
          <span>[COORD: 31.2304 N, 121.4737 E]</span>
          <span>[CASE_LIFECYCLE: {caseId ? caseId : 'STANDBY'}]</span>
        </div>
        <div className="flex gap-4">
          <span>[TIME: {timeStr}]</span>
          <span>[SHA: shria76f]</span>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <main style={{ 
        display: 'grid', 
        gridTemplateColumns: 'minmax(320px, 4fr) 7fr', 
        gap: '64px', 
        maxWidth: '1300px', 
        margin: '0 auto', 
        width: '100%', 
        padding: '64px 8px 80px 8px',
        zIndex: 1
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
                    e.target.style.borderColor = 'var(--color-accent)';
                    e.target.style.boxShadow = '0 0 0 2px var(--color-accent-dim)';
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

          {/* Interactive Terminal Logs panel */}
          <TerminalConsole messages={messages} loading={loading} />

          {/* Port Surveillance Widget */}
          <SurveillanceWidget />

          {/* Logo Construction Widget */}
          <LogoConstructionWidget />
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
              border: '1px dashed var(--color-rule)', 
              borderRadius: '24px',
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


