import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInvestigation } from '../hooks/useInvestigation';
import AgentGraph from './AgentGraph';
import LiveLog from './LiveLog';
import { CheckCircle, ArrowLeft } from '@phosphor-icons/react';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
};

export default function InvestigationScreen({ caseId, onBack, onViewBrief }) {
  const { messages, agentStates, isComplete } = useInvestigation(caseId);
  const [showPayoff, setShowPayoff] = useState(false);

  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => setShowPayoff(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  return (
    <div className="investigation-screen">
      <motion.header className="inv-header" {...fadeUp}>
        <div className="case-badge">Case: {caseId}</div>
        <h2>Live agent investigation</h2>
        <button className="btn btn-sm" onClick={onBack}>
          <ArrowLeft weight="bold" size={14} />
          Cancel
        </button>
      </motion.header>

      <div className="inv-layout">
        <div className="inv-graph-pane">
          <AgentGraph agentStates={agentStates} isComplete={isComplete} />

          <AnimatePresence>
            {showPayoff && (
              <motion.div
                className="payoff-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.div
                  className="payoff-content double-bezel-outer"
                  initial={{ opacity: 0, scale: 0.95, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.15, ease: [0.32, 0.72, 0, 1] }}
                  style={{ width: '90%', maxWidth: '400px', padding: '6px' }}
                >
                  <div className="double-bezel-inner" style={{ padding: 'var(--space-xl)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <CheckCircle weight="duotone" size={48} className="success-icon" />
                    <h3 style={{ margin: 'var(--space-md) 0 var(--space-xs) 0' }}>Investigation concluded</h3>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)', fontSize: 'var(--size-small)', textAlign: 'center' }}>
                      Coordinator has synthesized the executive brief.
                    </p>
                    <button
                      className="btn btn-accent pulse-btn w-full"
                      onClick={onViewBrief}
                    >
                      View executive brief
                      <ArrowLeft weight="bold" size={16} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="inv-log-pane">
          <LiveLog messages={messages} />
        </div>
      </div>
    </div>
  );
}
