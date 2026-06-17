import React, { useState, useEffect } from 'react';
import { Globe, AlertTriangle, ShieldCheck, Play, Loader } from 'lucide-react';
import { checkHealth, triggerEvent } from '../services/api';

const PRESETS = [
  {
    id: "SCENARIO-1",
    name: "Taiwan Earthquake",
    text: "Magnitude 7.4 earthquake strikes Hsinchu, Taiwan. TSMC reports fab damage. Production suspended indefinitely."
  },
  {
    id: "SCENARIO-2",
    name: "Port Strike",
    text: "Dockworkers strike at Port of Los Angeles. All container operations halted. No resolution timeline given."
  },
  {
    id: "SCENARIO-3",
    name: "Sanctions",
    text: "US Treasury imposes new sanctions on Chinese semiconductor manufacturers effective immediately."
  }
];

export default function Header({ onCaseTriggered, selectedCaseId, isPolling }) {
  const [backendStatus, setBackendStatus] = useState('checking'); // 'ok' | 'degraded' | 'checking'
  const [selectedScenario, setSelectedScenario] = useState('');
  const [customText, setCustomText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function checkStatus() {
      try {
        const health = await checkHealth();
        setBackendStatus(health.status === 'ok' ? 'ok' : 'degraded');
      } catch (err) {
        setBackendStatus('degraded');
      }
    }
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleScenarioChange = (e) => {
    const val = e.target.value;
    setSelectedScenario(val);
    if (val) {
      const preset = PRESETS.find(p => p.id === val);
      setCustomText(preset ? preset.text : '');
    }
  };

  const handleTrigger = async (e) => {
    e.preventDefault();
    if (!customText.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await triggerEvent(customText);
      if (res.case_id) {
        onCaseTriggered(res.case_id, customText);
        setSelectedScenario('');
        setCustomText('');
      }
    } catch (err) {
      setError(err.message || 'Failed to trigger event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="glass-panel" style={{
      padding: '16px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      marginBottom: '24px',
      borderRadius: '16px',
    }}>
      {/* Title & Connection Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Globe size={24} style={{ color: 'var(--neon-blue)', filter: 'drop-shadow(0 0 8px rgba(0, 210, 255, 0.5))' }} />
          <h1 className="title-gradient" style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}>
            SupplyChain Disruption Intelligence Center
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#9aa0b9', fontWeight: 500 }}>API Bridge:</span>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            color: backendStatus === 'ok' ? 'var(--neon-green)' : 'var(--neon-pink)',
            backgroundColor: backendStatus === 'ok' ? 'rgba(5, 243, 173, 0.08)' : 'rgba(255, 0, 122, 0.08)',
            padding: '3px 8px',
            borderRadius: '4px',
            border: `1px solid ${backendStatus === 'ok' ? 'rgba(5, 243, 173, 0.2)' : 'rgba(255, 0, 122, 0.2)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            animation: backendStatus === 'checking' ? 'pulse-glow-yellow 1.5s infinite' : 'none'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: backendStatus === 'ok' ? 'var(--neon-green)' : backendStatus === 'checking' ? 'var(--neon-yellow)' : 'var(--neon-pink)',
            }} />
            {backendStatus === 'ok' ? 'ONLINE' : backendStatus === 'checking' ? 'CONNECTING' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Preset Injection Control Panel */}
      <form onSubmit={handleTrigger} style={{
        background: 'rgba(0,0,0,0.2)',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={15} style={{ color: 'var(--neon-yellow)' }} /> Inject Disruption Scenario:
          </span>
          <select 
            value={selectedScenario} 
            onChange={handleScenarioChange}
            disabled={loading}
            style={{
              flex: 1,
              minWidth: '200px',
              background: 'rgba(16, 18, 35, 0.8)',
              border: '1px solid var(--color-border)',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '6px',
              outline: 'none',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            <option value="">-- Choose Preset or Write Custom Event --</option>
            {PRESETS.map(preset => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
          <input 
            type="text" 
            placeholder="Type raw disruption event here... (e.g. 'Tariffs raised on import components by 10%')"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            required
            disabled={loading}
            style={{
              flex: 1,
              background: 'rgba(16, 18, 35, 0.8)',
              border: '1px solid var(--color-border)',
              color: '#fff',
              padding: '10px 16px',
              borderRadius: '8px',
              outline: 'none',
              fontSize: '13px'
            }}
          />
          <button 
            type="submit" 
            className="btn-neon" 
            disabled={loading || !customText.trim() || backendStatus !== 'ok'}
            style={{ padding: '0 20px', fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            {loading ? <Loader size={15} className="animate-spin" /> : <Play size={15} />}
            Trigger Investigation
          </button>
        </div>

        {error && (
          <div style={{ fontSize: '12px', color: 'var(--neon-pink)', fontWeight: 500 }}>
            Error: {error}
          </div>
        )}

        {selectedCaseId && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#9aa0b9', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', marginTop: '4px' }}>
            <span>Active Investigation Case: <strong style={{ color: '#fff' }}>{selectedCaseId}</strong></span>
            {isPolling && (
              <span style={{ color: 'var(--neon-yellow)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="status-dot processing" style={{ width: '6px', height: '6px' }} />
                Listening to Band Room...
              </span>
            )}
          </div>
        )}
      </form>
    </header>
  );
}
