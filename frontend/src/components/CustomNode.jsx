import { Handle, Position } from '@xyflow/react';

export function AgentNode({ data }) {
  const { label, state, confidence } = data;
  
  let stateClass = '';
  if (state === 'processing') stateClass = 'node-processing';
  if (state === 'delayed') stateClass = 'node-delayed';
  if (state === 'complete') stateClass = 'node-complete';
  if (state === 'error' || state === 'escalate' || state === 'insufficient_data') stateClass = 'node-error';
  if (state === 'pending') stateClass = 'node-pending';

  return (
    <div className={`custom-node agent-node ${stateClass}`}>
      <Handle type="target" position={Position.Top} className="hidden-handle" />
      <div className="node-content">
        <span className="node-label">{label}</span>
        {state === 'processing' && <span className="node-pulse"></span>}
        {state === 'delayed' && <span className="node-delayed-indicator">working...</span>}
      </div>
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
  
  return (
    <div className={`custom-node coordinator-node ${isComplete ? 'coord-concluded' : (state === 'processing' ? 'coord-active' : '')}`}>
      <div className="coord-inner">
        <span className="coord-icon">♛</span>
        <span className="node-label">{label}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="hidden-handle" />
    </div>
  );
}
