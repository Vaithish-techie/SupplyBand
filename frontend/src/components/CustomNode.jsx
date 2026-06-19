import { Handle, Position } from '@xyflow/react';
import { Globe, Truck, DollarSign, Scale, Zap, Cpu, Loader2 } from 'lucide-react';

export function AgentNode({ id, data }) {
  const { label, state, confidence } = data;
  
  let stateClass = '';
  let statusText = 'AWAITING INPUT';
  
  if (state === 'processing') {
    stateClass = 'node-processing';
    statusText = 'PROCESSING...';
  }
  if (state === 'delayed') {
    stateClass = 'node-delayed';
    statusText = 'COMPUTING MATRICES...';
  }
  if (state === 'complete') {
    stateClass = 'node-complete';
    statusText = 'ANALYSIS COMPLETE';
  }
  if (state === 'error' || state === 'escalate' || state === 'insufficient_data') {
    stateClass = 'node-error';
    statusText = 'ESCALATED / ERROR';
  }
  if (state === 'pending') {
    stateClass = 'node-pending';
    statusText = 'STANDBY';
  }

  // Choose icon based on label/id
  const getIcon = () => {
    const term = (id || label || '').toLowerCase();
    if (term.includes('event')) return <Globe size={15} className="node-type-icon" />;
    if (term.includes('supplier')) return <Truck size={15} className="node-type-icon" />;
    if (term.includes('finance') || term.includes('financial')) return <DollarSign size={15} className="node-type-icon" />;
    if (term.includes('regulatory') || term.includes('compliance')) return <Scale size={15} className="node-type-icon" />;
    if (term.includes('alt') || term.includes('sourcing')) return <Zap size={15} className="node-type-icon" />;
    return null;
  };

  return (
    <div className={`custom-node agent-node ${stateClass}`}>
      <Handle type="target" position={Position.Top} className="hidden-handle" />
      <div className="node-header">
        {getIcon()}
        <span className="node-label">{label}</span>
      </div>
      <div className="node-footer">
        {state === 'processing' && <Loader2 size={10} className="node-spinner animate-spin" />}
        <span className="node-status-text">{statusText}</span>
      </div>
      {state === 'processing' && <span className="node-pulse"></span>}
      {state === 'complete' && confidence && (
        <div className={`confidence-badge conf-${confidence.toLowerCase()}`}>
          {confidence}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="hidden-handle" />
    </div>
  );
}

export function CoordinatorNode({ data }) {
  const { label, state, isComplete } = data;
  
  let statusText = 'STANDBY';
  if (state === 'processing') statusText = 'ORCHESTRATING...';
  if (isComplete) statusText = 'CONCLUDED';
  
  return (
    <div className={`custom-node coordinator-node ${isComplete ? 'coord-concluded' : (state === 'processing' ? 'coord-active' : '')}`}>
      <div className="coord-inner">
        <Cpu size={18} className="coord-icon" />
        <div className="coord-content">
          <span className="node-label">{label}</span>
          <span className="node-status-text">{statusText}</span>
        </div>
      </div>
      {state === 'processing' && <span className="node-pulse"></span>}
      <Handle type="source" position={Position.Bottom} className="hidden-handle" />
    </div>
  );
}
