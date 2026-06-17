import React from 'react';
import { Send, Search, ShieldCheck, DollarSign, Scale, Share2, FileText } from 'lucide-react';

export default function PipelineVisualizer({ agentsPosted = [], agentsPending = [] }) {
  // Determine status of each agent step based on posted keys
  const getStatus = (key, dependencies = []) => {
    const isPosted = agentsPosted.includes(key);
    if (isPosted) return 'completed';

    // If any dependency isn't met, it's waiting
    const depsMet = dependencies.every(dep => agentsPosted.includes(dep));
    if (depsMet && (agentsPending.includes(key) || agentsPending.length > 0)) {
      return 'processing';
    }
    return 'waiting';
  };

  // Setup statuses
  const s1 = agentsPosted.length > 0 ? 'completed' : 'waiting'; // Kickoff
  const s2 = getStatus('event_intelligence', ['coordinator_kickoff']);
  const s3 = getStatus('supplier_impact', ['event_intelligence']);
  const s4a = getStatus('financial_exposure', ['supplier_impact']);
  const s4b = getStatus('regulatory_trade', ['supplier_impact']);
  const s5 = getStatus('alt_sourcing', ['financial_exposure', 'regulatory_trade']);
  const s6 = getStatus('coordinator_brief', ['alt_sourcing']);

  // Node details
  const nodes = [
    { id: 'n1', label: '1. Kickoff', sub: 'Coordinator', status: s1, x: 100, y: 120, icon: Send, color: 'var(--neon-blue)' },
    { id: 'n2', label: '2. Event Intel', sub: 'EI Agent', status: s2, x: 260, y: 120, icon: Search, color: 'var(--neon-purple)' },
    { id: 'n3', label: '3. Supplier Impact', sub: 'SI Agent', status: s3, x: 420, y: 120, icon: ShieldCheck, color: 'var(--neon-pink)' },
    { id: 'n4a', label: '4a. Financials', sub: 'FE Agent', status: s4a, x: 580, y: 60, icon: DollarSign, color: 'var(--neon-orange)' },
    { id: 'n4b', label: '4b. Regulatory', sub: 'RT Agent', status: s4b, x: 580, y: 180, icon: Scale, color: 'var(--neon-cyan)' },
    { id: 'n5', label: '5. Alt Sourcing', sub: 'AS Agent', status: s5, x: 740, y: 120, icon: Share2, color: 'var(--neon-green)' },
    { id: 'n6', label: '6. Exec Brief', sub: 'Coordinator', status: s6, x: 900, y: 120, icon: FileText, color: 'var(--neon-yellow)' }
  ];

  // Helper for path status style
  const getPathStyle = (fromStatus, toStatus, color) => {
    if (fromStatus === 'completed' && toStatus === 'completed') {
      return { stroke: color, opacity: 0.9, strokeWidth: 3 };
    }
    if (fromStatus === 'completed' && toStatus === 'processing') {
      return { stroke: color, opacity: 0.8, strokeWidth: 3, className: 'flow-active' };
    }
    return { stroke: '#475569', opacity: 0.3, strokeWidth: 2 };
  };

  return (
    <div className="glass-panel" style={{
      padding: '24px',
      borderRadius: '16px',
      marginBottom: '24px',
      overflow: 'hidden'
    }}>
      <h3 style={{ fontSize: '15px', color: '#9aa0b9', textTransform: 'uppercase', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--neon-blue)', boxShadow: '0 0 10px var(--neon-blue)' }} />
        Live Multi-Agent Pipeline Visualizer
      </h3>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox="0 0 1000 240" width="100%" height="100%" style={{ minWidth: '850px' }}>
          <defs>
            {/* Glowing Gradients */}
            {nodes.map(n => (
              <filter key={n.id} id={`glow-${n.id}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            ))}
          </defs>

          {/* Connection Lines (Paths) */}
          {/* N1 -> N2 */}
          <line x1={100} y1={120} x2={260} y2={120} style={getPathStyle(s1, s2, 'var(--neon-purple)')} />
          {/* N2 -> N3 */}
          <line x1={260} y1={120} x2={420} y2={120} style={getPathStyle(s2, s3, 'var(--neon-pink)')} />
          {/* N3 -> N4a */}
          <path d="M 420 120 L 580 60" fill="none" style={getPathStyle(s3, s4a, 'var(--neon-orange)')} />
          {/* N3 -> N4b */}
          <path d="M 420 120 L 580 180" fill="none" style={getPathStyle(s3, s4b, 'var(--neon-cyan)')} />
          {/* N4a -> N5 */}
          <path d="M 580 60 L 740 120" fill="none" style={getPathStyle(s4a, s5, 'var(--neon-green)')} />
          {/* N4b -> N5 */}
          <path d="M 580 180 L 740 120" fill="none" style={getPathStyle(s4b, s5, 'var(--neon-green)')} />
          {/* N5 -> N6 */}
          <line x1={740} y1={120} x2={900} y2={120} style={getPathStyle(s5, s6, 'var(--neon-yellow)')} />

          {/* Node Circles and Labels */}
          {nodes.map(n => {
            const Icon = n.icon;
            const isCompleted = n.status === 'completed';
            const isProcessing = n.status === 'processing';
            
            // Outer glow color determination
            const fillBg = isCompleted ? n.color : isProcessing ? 'rgba(255, 208, 0, 0.1)' : 'rgba(15, 23, 42, 0.6)';
            const strokeBg = isCompleted ? n.color : isProcessing ? 'var(--neon-yellow)' : '#475569';
            const iconColor = isCompleted ? '#050512' : isProcessing ? 'var(--neon-yellow)' : '#9aa0b9';

            return (
              <g key={n.id} style={{ cursor: 'pointer' }}>
                {/* Glow ring if processing or completed */}
                {(isCompleted || isProcessing) && (
                  <circle 
                    cx={n.x} 
                    cy={n.y} 
                    r={26} 
                    fill="none" 
                    stroke={isCompleted ? n.color : 'var(--neon-yellow)'} 
                    strokeWidth={1.5}
                    style={{ 
                      opacity: 0.6,
                      filter: `url(#glow-${n.id})`,
                      animation: isProcessing ? 'dash 2s linear infinite' : 'none',
                      strokeDasharray: isProcessing ? '5 3' : 'none'
                    }}
                  />
                )}

                {/* Main Node Circle */}
                <circle 
                  cx={n.x} 
                  cy={n.y} 
                  r={20} 
                  fill={fillBg} 
                  stroke={strokeBg} 
                  strokeWidth={2}
                  style={{ transition: 'all 0.5s ease' }}
                />

                {/* Inside Icon */}
                <g transform={`translate(${n.x - 10}, ${n.y - 10})`}>
                  <Icon size={20} style={{ color: iconColor, transition: 'all 0.5s ease' }} />
                </g>

                {/* Labels */}
                <text 
                  x={n.x} 
                  y={n.y + 36} 
                  textAnchor="middle" 
                  style={{ 
                    fill: isCompleted ? '#fff' : isProcessing ? 'var(--neon-yellow)' : '#64748b', 
                    fontSize: '11px', 
                    fontWeight: 600,
                    fontFamily: 'var(--font-display)'
                  }}
                >
                  {n.label}
                </text>
                <text 
                  x={n.x} 
                  y={n.y + 48} 
                  textAnchor="middle" 
                  style={{ 
                    fill: '#64748b', 
                    fontSize: '9px',
                    fontWeight: 500
                  }}
                >
                  {n.sub}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
