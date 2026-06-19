import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import Atmosphere from './components/Atmosphere';
import LandingPage from './components/LandingPage';
import InvestigationScreen from './components/InvestigationScreen';
import ExecutiveBriefScreen from './components/ExecutiveBriefScreen';
import './App.css';

const API_BASE = 'http://127.0.0.1:8001';

const pageTransition = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
};

function App() {
  const [screen, setScreen] = useState(1);
  const [caseId, setCaseId] = useState(null);

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

  const resetToHome = () => {
    setScreen(1);
    setCaseId(null);
    setEventText('');
    setError(null);
  };

  return (
    <div className="app-container">
      <Atmosphere />

      <AnimatePresence mode="wait">
        {screen === 1 && (
          <motion.div key="landing" {...pageTransition}>
            <LandingPage
              onTrigger={handleTrigger}
              isSubmitting={isSubmitting}
              error={error}
            />
          </motion.div>
        )}

        {screen === 2 && (
          <motion.div key="investigation" {...pageTransition} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <InvestigationScreen
              caseId={caseId}
              onBack={resetToHome}
              onViewBrief={() => setScreen(3)}
            />
          </motion.div>
        )}

        {screen === 3 && (
          <motion.div key="brief" {...pageTransition}>
            <ExecutiveBriefScreen
              caseId={caseId}
              onBack={resetToHome}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
