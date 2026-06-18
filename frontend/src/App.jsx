import { useState } from 'react';
import { Activity } from 'lucide-react';
import axios from 'axios';
import InvestigationScreen from './components/InvestigationScreen';
import ExecutiveBriefScreen from './components/ExecutiveBriefScreen';
import './App.css';

const API_BASE = 'http://localhost:8000';

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
