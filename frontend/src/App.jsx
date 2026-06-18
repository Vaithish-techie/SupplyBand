import { useState } from 'react';
import { Activity } from 'lucide-react';
import axios from 'axios';
import InvestigationScreen from './components/InvestigationScreen';
import ExecutiveBriefScreen from './components/ExecutiveBriefScreen';
import './App.css';

const API_BASE = 'http://localhost:8000';

const PRESETS = [
  {
    title: 'Taiwan Earthquake',
    text: 'Magnitude 7.4 earthquake strikes Hsinchu, Taiwan suspending TSMC production.'
  },
  {
    title: 'Rotterdam Port Strike',
    text: 'Dockworkers at Port of Rotterdam announce indefinite strike starting immediately, paralyzing European logistics.'
  },
  {
    title: 'US-China Tariff Escalation',
    text: 'New 40% tariff imposed on all semiconductor components imported from China, effective immediately.'
  }
];

function App() {
  const [screen, setScreen] = useState(1);
  const [caseId, setCaseId] = useState(null);
  
  // Screen 1 State
  const [eventText, setEventText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleTrigger = async (textToSubmit) => {
    if (!textToSubmit.trim()) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await axios.post(`${API_BASE}/trigger-event`, {
        event_text: textToSubmit
      });
      
      setCaseId(response.data.case_id);
      setScreen(2);
    } catch (err) {
      console.error('Trigger error:', err);
      setError('Failed to trigger investigation. Please make sure the backend is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>SupplyChain Intelligence</h1>
        <p>Live Multi-Agent Disruption Analysis</p>
      </header>

      {screen === 1 && (
        <div className="trigger-screen animate-fade-in">
          <div className="glass-panel input-section">
            <div className="input-header">
              <Activity className="input-icon" size={24} />
              <h2>New Disruption Event</h2>
            </div>
            
            <textarea 
              className="glass-input" 
              rows={5}
              placeholder="Paste raw disruption news or intel here..."
              value={eventText}
              onChange={(e) => setEventText(e.target.value)}
              disabled={isSubmitting}
            />
            
            {error && <div style={{color: '#ff5252', fontSize: '0.9rem'}}>{error}</div>}
            
            <div className="submit-btn-wrapper">
              <button 
                className={`glass-button primary ${isSubmitting ? 'processing-indicator' : ''}`}
                onClick={() => handleTrigger(eventText)}
                disabled={isSubmitting || !eventText.trim()}
              >
                {isSubmitting ? 'Initializing Agents...' : 'Start Investigation'}
              </button>
            </div>
          </div>

          <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Quick Scenarios</h3>
          <div className="presets-grid">
            {PRESETS.map((preset, idx) => (
              <div 
                key={idx} 
                className="glass-panel preset-card"
                onClick={() => {
                  setEventText(preset.text);
                  handleTrigger(preset.text);
                }}
              >
                <h3>{preset.title}</h3>
                <p>{preset.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {screen === 2 && (
        <InvestigationScreen caseId={caseId} onBack={() => {setScreen(1); setCaseId(null); setEventText('');}} onViewBrief={() => setScreen(3)} />
      )}

      {screen === 3 && (
        <ExecutiveBriefScreen caseId={caseId} onBack={() => {setScreen(1); setCaseId(null); setEventText('');}} />
      )}
    </div>
  );
}

export default App;
