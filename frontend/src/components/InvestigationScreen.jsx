import { useState, useEffect } from 'react';
import { useInvestigation } from '../hooks/useInvestigation';
import PipelineStepper from './PipelineStepper';
import LiveLog from './LiveLog';
import { CheckCircle } from 'lucide-react';

export default function InvestigationScreen({ caseId, onBack, onViewBrief }) {
  const { messages, agentStates, isComplete } = useInvestigation(caseId);
  const [showPayoff, setShowPayoff] = useState(false);

  useEffect(() => {
    if (isComplete) {
      // Small delay to let the graph pulse before transitioning or showing the button
      setTimeout(() => setShowPayoff(true), 2500);
    }
  }, [isComplete]);

  return (
    <div className={`investigation-screen ${isComplete ? 'investigation-complete' : ''}`}>
      <header className="inv-header">
        <div className="case-badge">CASE: {caseId}</div>
        <h2>Live Agent Investigation</h2>
        <button className="glass-button small" onClick={onBack}>Cancel</button>
      </header>

      <div className="inv-layout">
        <div className="inv-graph-pane glass-panel">
          <PipelineStepper agentStates={agentStates} isComplete={isComplete} />
          
          {showPayoff && (
            <div className="payoff-overlay animate-fade-in">
              <div className="payoff-content glass-panel">
                <CheckCircle size={48} className="success-icon" />
                <h3>Investigation Concluded</h3>
                <p>Coordinator has synthesized the executive brief.</p>
                <button className="glass-button primary pulse-btn" onClick={onViewBrief}>
                  View Executive Brief
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="inv-log-pane glass-panel">
          <LiveLog messages={messages} />
        </div>
      </div>
    </div>
  );
}
