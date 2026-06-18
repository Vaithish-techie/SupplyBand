import React from 'react';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';

export default function PipelineStepper({ agentStates, isComplete }) {
  const steps = [
    {
      id: 'kickoff',
      label: 'Coordinator Kickoff',
      state: agentStates['coordinator']?.phase === 'pending' ? 'pending' : 'complete'
    },
    {
      id: 'event_intelligence',
      label: 'Event Intel',
      state: agentStates['event_intelligence']?.state || 'pending'
    },
    {
      id: 'supplier_impact',
      label: 'Supplier Impact',
      state: agentStates['supplier_impact']?.state || 'pending'
    },
    {
      id: 'finance_regulatory',
      label: 'Finance & Regulatory',
      state: (agentStates['financial_exposure']?.state === 'complete' && agentStates['regulatory_trade']?.state === 'complete') ? 'complete' :
             (agentStates['financial_exposure']?.state === 'processing' || agentStates['regulatory_trade']?.state === 'processing') ? 'processing' : 'pending'
    },
    {
      id: 'alt_sourcing',
      label: 'Alt Sourcing',
      state: agentStates['alt_sourcing']?.state || 'pending'
    },
    {
      id: 'executive_brief',
      label: 'Executive Brief',
      state: agentStates['coordinator']?.phase === 'executive_brief' ? 'complete' : (isComplete ? 'complete' : 'pending')
    }
  ];

  return (
    <div className="multi-agent-pipeline">
      <div className="pipeline-header">
        <h3 className="pipeline-title">Agent Processing Cluster</h3>
        <div className="pipeline-status">
          {isComplete ? (
            <span className="status-badge success">All Nodes Synchronized</span>
          ) : (
            <span className="status-badge computing"><Loader2 className="animate-spin inline mr-1" size={14} /> Neural Network Active</span>
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
                    <CheckCircle className="node-icon" size={24} />
                  ) : isProcessing ? (
                    <div className="processing-rings">
                      <div className="ring ring-1"></div>
                      <div className="ring ring-2"></div>
                      <Loader2 className="node-icon animate-spin" size={24} />
                    </div>
                  ) : (
                    <Circle className="node-icon" size={24} />
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
                  {isCompleteStep ? 'ANALYSIS COMPLETE' : isProcessing ? 'COMPUTING MATRICES...' : 'AWAITING INPUT...'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
