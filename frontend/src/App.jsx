import { useState } from 'react';
import { Activity } from 'lucide-react';
import axios from 'axios';
import InvestigationScreen from './components/InvestigationScreen';
import ExecutiveBriefScreen from './components/ExecutiveBriefScreen';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

import LandingPage from './components/LandingPage';

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
      <div className="app-atmosphere">
        <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" className="atmosphere-svg">
          <defs>
            <radialGradient id="glow-gold" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#C8960A" stopOpacity="0.07" />
              <stop offset="100%" stopColor="#C8960A" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="glow-violet" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#5B4FBD" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#5B4FBD" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="150" cy="180" r="380" fill="url(#glow-gold)"   className="blob-1" />
          <circle cx="820" cy="720" r="420" fill="url(#glow-violet)" className="blob-2" />
        </svg>
      </div>

      {screen === 1 && (
        <LandingPage 
          onTrigger={handleTrigger} 
          isSubmitting={isSubmitting} 
          error={error} 
        />
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
