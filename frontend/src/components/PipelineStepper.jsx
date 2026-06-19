import React from 'react';
import {
  CheckCircle,
  Circle,
  CircleNotch,
  Lightning
} from '@phosphor-icons/react';

export default function PipelineStepper({ agentStates, isComplete }) {
  const steps = [
    {
      id: 'kickoff',
      label: 'Coordinator kickoff',
      state: agentStates['coordinator']?.phase === 'pending' ? 'pending' : 'complete'
    },
    {
      id: 'event_intelligence',
      label: 'Event intelligence',
      state: agentStates['event_intelligence']?.state || 'pending'
    },
    {
      id: 'supplier_impact',
      label: 'Supplier impact',
      state: agentStates['supplier_impact']?.state || 'pending'
    },
    {
      id: 'finance_regulatory',
      label: 'Finance and regulatory',
      state: (agentStates['financial_exposure']?.state === 'complete' && agentStates['regulatory_trade']?.state === 'complete') ? 'complete' :
             (agentStates['financial_exposure']?.state === 'processing' || agentStates['regulatory_trade']?.state === 'processing') ? 'processing' : 'pending'
    },
    {
      id: 'alt_sourcing',
      label: 'Alternative sourcing',
      state: agentStates['alt_sourcing']?.state || 'pending'
    },
    {
      id: 'executive_brief',
      label: 'Executive brief',
      state: agentStates['coordinator']?.phase === 'executive_brief' ? 'complete' : (isComplete ? 'complete' : 'pending')
    }
  ];

  return (
    <div className="multi-agent-pipeline">
      <div className="pipeline-header">
        <h3 className="pipeline-title">Agent processing cluster</h3>
        <div className="pipeline-status">
          {isComplete ? (
            <span className="status-badge success">
              <Lightning weight="fill" size={12} />
              All nodes synchronized
            </span>
          ) : (
            <span className="status-badge computing">
              <CircleNotch weight="bold" size={12} className="animate-spin" />
              Processing active
            </span>
          )}
        </div>
      </div>

      <div className="pipeline-track">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const isCompleteStep = step.state === 'complete';
          const isProcessing = step.state === 'processing' || step.state === 'delayed';

          return (
            <div key={step.id} className={`agent-node ${step.state}`}>
              <div className="node-connector-wrapper">
                <div className={`node-core ${isCompleteStep ? 'core-complete' : isProcessing ? 'core-processing' : 'core-pending'}`}>
                  {isCompleteStep ? (
                    <CheckCircle weight="fill" className="node-icon" size={20} />
                  ) : isProcessing ? (
                    <div className="processing-rings">
                      <div className="ring ring-1"></div>
                      <div className="ring ring-2"></div>
                      <CircleNotch weight="bold" className="node-icon animate-spin" size={18} />
                    </div>
                  ) : (
                    <Circle weight="regular" className="node-icon" size={18} />
                  )}
                </div>
                {!isLast && (
                  <div className={`data-stream ${isCompleteStep ? 'stream-active' : ''}`}>
                    <div className="stream-particles"></div>
                  </div>
                )}
              </div>

              <div className="node-info-panel">
                <div className="node-label">{step.label}</div>
                <div className="node-status-text">
                  {isCompleteStep ? 'Analysis complete' : isProcessing ? 'Computing...' : 'Awaiting input'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
