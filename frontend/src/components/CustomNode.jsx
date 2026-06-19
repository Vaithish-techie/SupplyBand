import { Handle, Position } from '@xyflow/react';
import { Globe, Truck, DollarSign, Scale, Zap, Cpu, Loader2, CheckCircle, XCircle } from 'lucide-react';

/* ── icon map ── */
const getIcon = (id, label, size = 14) => {
  const term = (id || label || '').toLowerCase();
  if (term.includes('event'))                            return <Globe     size={size} />;
  if (term.includes('supplier'))                         return <Truck     size={size} />;
  if (term.includes('finance') || term.includes('financial')) return <DollarSign size={size} />;
  if (term.includes('regulatory') || term.includes('compliance')) return <Scale size={size} />;
  if (term.includes('alt') || term.includes('sourcing')) return <Zap      size={size} />;
  return null;
};

/* ── Agent Node ── */
export function AgentNode({ id, data }) {
  const { label, state, confidence } = data;

  let stateClass  = 'node-pending';
  let statusText  = 'STANDBY';
  let statusColor = 'var(--text-3)';

  if (state === 'processing') {
    stateClass  = 'node-processing';
    statusText  = 'PROCESSING';
    statusColor = 'var(--orange)';
  }
  if (state === 'delayed') {
    stateClass  = 'node-delayed';
    statusText  = 'COMPUTING';
    statusColor = 'var(--gold)';
  }
  if (state === 'complete') {
    stateClass  = 'node-complete';
    statusText  = 'COMPLETE';
    statusColor = 'var(--green-bright)';
  }
  if (state === 'error' || state === 'escalate' || state === 'insufficient_data') {
    stateClass  = 'node-error';
    statusText  = 'ESCALATED';
    statusColor = '#E05A4A';
  }

  return (
    <div className={`custom-node agent-node ${stateClass}`}>
      <Handle type="target" position={Position.Top}    className="hidden-handle" />

      <div className="node-header">
        <span className="node-type-icon">{getIcon(id, label)}</span>
        <span className="node-label">{label}</span>
      </div>

      <div className="node-footer">
        {state === 'processing' && (
          <Loader2 size={9} className="node-spinner" style={{ animation: 'spin 1s linear infinite' }} />
        )}
        {state === 'complete' && <CheckCircle size={9} style={{ color: 'var(--green-bright)', flexShrink: 0 }} />}
        {(state === 'error' || state === 'escalate') && <XCircle size={9} style={{ color: '#E05A4A', flexShrink: 0 }} />}
        <span className="node-status-text" style={{ color: statusColor }}>{statusText}</span>
      </div>

      {state === 'processing' && <span className="node-pulse" />}

      {state === 'complete' && confidence && (
        <div className={`confidence-badge conf-${confidence.toLowerCase()}`}>{confidence}</div>
      )}

      <Handle type="source" position={Position.Bottom} className="hidden-handle" />
    </div>
  );
}

/* ── Coordinator Node ── */
export function CoordinatorNode({ data }) {
  const { label, state, isComplete } = data;

  let statusText  = 'STANDBY';
  let statusColor = 'var(--text-3)';

  if (state === 'processing') { statusText = 'ORCHESTRATING'; statusColor = 'var(--gold)'; }
  if (isComplete)             { statusText = 'CONCLUDED';     statusColor = 'var(--green-bright)'; }

  return (
    <div className={`custom-node coordinator-node ${isComplete ? 'coord-concluded' : (state === 'processing' ? 'coord-active' : '')}`}>
      <div className="coord-inner">
        <Cpu size={16} className="coord-icon" />
        <div className="coord-content">
          <span className="node-label">{label}</span>
          <span className="node-status-text" style={{ color: statusColor }}>{statusText}</span>
        </div>
      </div>
      {state === 'processing' && <span className="node-pulse" />}
      <Handle type="source" position={Position.Bottom} className="hidden-handle" />
    </div>
  );
}
