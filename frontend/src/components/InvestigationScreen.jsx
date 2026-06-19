import { useState, useEffect } from 'react';
import { useInvestigation } from '../hooks/useInvestigation';
import PipelineStepper from './PipelineStepper';
import AgentGraph from './AgentGraph';
import LiveLog from './LiveLog';
import { CheckCircle } from 'lucide-react';

export default function InvestigationScreen({ caseId, onBack, onViewBrief }) {
  const { messages, agentStates, isComplete } = useInvestigation(caseId);
  const [showPayoff, setShowPayoff] = useState(false);
  const [viewMode, setViewMode] = useState('graph');

  useEffect(() => {
    if (isComplete) {
      // Small delay to let the graph pulse before transitioning or showing the button
      setTimeout(() => setShowPayoff(true), 2500);
    }
  }, [isComplete]);

  // Extract operator alert description
  const kickoffMsg = messages.find(
    m => m.agent === 'human_operator' || (m.agent === 'coordinator' && m.phase === 'kickoff')
  );
  const rawEventText = kickoffMsg ? (kickoffMsg.event_text || kickoffMsg.raw_content || '') : '';
  // Clean up any JSON markup from the operator text
  const cleanedEventText = rawEventText.replace(/@\[\[.*?\]\]/g, '').replace(/[{}[\]"]/g, '').trim();

  return (
    <div className={`investigation-screen ${isComplete ? 'investigation-complete' : ''}`}>
      <header className="inv-header">
        <div className="case-badge">CASE: {caseId}</div>
        <h2>Live Agent Investigation</h2>
        <button className="glass-button small" onClick={onBack}>Cancel</button>
      </header>

      {cleanedEventText && (
        <div className="intel-ticker-bar glass-panel animate-fade-in">
          <div className="ticker-label">
            <span className="ticker-pulse-dot"></span>
            ACTIVE DISRUPTION INTEL
          </div>
          <p className="ticker-content" title={cleanedEventText}>{cleanedEventText}</p>
        </div>
      )}

      <div className="inv-layout">
        <div className="inv-graph-pane glass-panel">
          <div className="graph-container-header">
            <h3>Agent Processing Cluster</h3>
            <div className="view-toggle-wrapper">
              <button 
                className={`view-toggle-btn ${viewMode === 'graph' ? 'active' : ''}`}
                onClick={() => setViewMode('graph')}
              >
                Network Graph
              </button>
              <button 
                className={`view-toggle-btn ${viewMode === 'pipeline' ? 'active' : ''}`}
                onClick={() => setViewMode('pipeline')}
              >
                Linear Track
              </button>
            </div>
          </div>
          
          <div className="graph-pane-body">
            {viewMode === 'graph' ? (
              <AgentGraph agentStates={agentStates} isComplete={isComplete} />
            ) : (
              <PipelineStepper agentStates={agentStates} isComplete={isComplete} />
            )}
          </div>
          
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
