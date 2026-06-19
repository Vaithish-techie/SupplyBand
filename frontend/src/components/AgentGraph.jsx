import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Gear,
  Globe,
  ShieldWarning,
  CurrencyDollar,
  Scales,
  Truck,
  CheckCircle,
  CircleNotch,
  WarningCircle
} from '@phosphor-icons/react';

// Coordinates for SVG lines (viewBox 0 0 600 600)
// Coordinator: (300, 50)
// Event Intel: (300, 150)
// Supplier Impact: (300, 250)
// Financial Exposure: (150, 370)
// Regulatory & Trade: (450, 370)
// Alt Sourcing: (300, 490)

const NODE_DEFS = [
  {
    id: 'coordinator',
    label: 'Coordinator',
    role: 'Orchestration Hub',
    icon: <Gear weight="duotone" size={20} />,
    pos: { left: '50%', top: '10%' },
    coords: { x: 300, y: 60 }
  },
  {
    id: 'event_intelligence',
    label: 'Event Intel',
    role: 'Disruption Classifier',
    icon: <Globe weight="duotone" size={20} />,
    pos: { left: '50%', top: '26%' },
    coords: { x: 300, y: 160 }
  },
  {
    id: 'supplier_impact',
    label: 'Supplier Impact',
    role: 'Exposure Analyzer',
    icon: <ShieldWarning weight="duotone" size={20} />,
    pos: { left: '50%', top: '43%' },
    coords: { x: 300, y: 260 }
  },
  {
    id: 'financial_exposure',
    label: 'Financial Exposure',
    role: 'Margin Risk Calc',
    icon: <CurrencyDollar weight="duotone" size={20} />,
    pos: { left: '22%', top: '63%' },
    coords: { x: 130, y: 380 }
  },
  {
    id: 'regulatory_trade',
    label: 'Regulatory & Trade',
    role: 'Compliance Assessor',
    icon: <Scales weight="duotone" size={20} />,
    pos: { left: '78%', top: '63%' },
    coords: { x: 470, y: 380 }
  },
  {
    id: 'alt_sourcing',
    label: 'Alt Sourcing',
    role: 'Supply Rerouter',
    icon: <Truck weight="duotone" size={20} />,
    pos: { left: '50%', top: '82%' },
    coords: { x: 300, y: 490 }
  }
];

export default function AgentGraph({ agentStates = {}, isComplete }) {
  
  // Helper to determine status class
  const getNodeState = (id) => {
    const s = agentStates[id];
    if (!s) return 'pending';
    return s.state || 'pending';
  };

  // Helper to check if a connection is active (downstream has started/completed)
  const isConnectionActive = (downstreamId) => {
    const state = getNodeState(downstreamId);
    return ['processing', 'complete', 'delayed', 'error', 'escalate'].includes(state);
  };

  // Helper to check if connection is currently streaming data (downstream is processing)
  const isConnectionStreaming = (downstreamId) => {
    const state = getNodeState(downstreamId);
    return ['processing', 'delayed'].includes(state);
  };

  // Memoized SVG paths
  const paths = useMemo(() => {
    return [
      {
        id: 'coord-event',
        d: 'M 300 60 L 300 160',
        active: isConnectionActive('event_intelligence'),
        streaming: isConnectionStreaming('event_intelligence')
      },
      {
        id: 'event-supplier',
        d: 'M 300 160 L 300 260',
        active: isConnectionActive('supplier_impact'),
        streaming: isConnectionStreaming('supplier_impact')
      },
      {
        id: 'supplier-financial',
        d: 'M 300 260 C 300 320, 130 320, 130 380',
        active: isConnectionActive('financial_exposure'),
        streaming: isConnectionStreaming('financial_exposure')
      },
      {
        id: 'supplier-regulatory',
        d: 'M 300 260 C 300 320, 470 320, 470 380',
        active: isConnectionActive('regulatory_trade'),
        streaming: isConnectionStreaming('regulatory_trade')
      },
      {
        id: 'financial-alt',
        d: 'M 130 380 C 130 440, 300 440, 300 490',
        active: isConnectionActive('alt_sourcing'),
        streaming: isConnectionStreaming('alt_sourcing')
      },
      {
        id: 'regulatory-alt',
        d: 'M 470 380 C 470 440, 300 440, 300 490',
        active: isConnectionActive('alt_sourcing'),
        streaming: isConnectionStreaming('alt_sourcing')
      },
      // Loopback to Coordinator showing briefing synthesis completion
      {
        id: 'alt-coord',
        d: 'M 300 490 C 560 490, 560 60, 300 60',
        active: isComplete,
        streaming: isComplete && agentStates.coordinator?.state === 'processing'
      }
    ];
  }, [agentStates, isComplete]);

  // Summaries to render inside the node cards
  const renderNodeSummary = (id) => {
    const nodeState = agentStates[id];
    if (!nodeState || nodeState.state !== 'complete' || !nodeState.findings) return null;
    
    const f = nodeState.findings;
    switch (id) {
      case 'coordinator':
        return (
          <div className="graph-node-details">
            <span className="text-accent" style={{ fontWeight: 600 }}>Verdict: </span>
            <span>{agentStates.coordinator?.phase === 'executive_brief' ? 'BRIEF GENERATED' : 'KICKED OFF'}</span>
          </div>
        );
      case 'event_intelligence':
        return (
          <div className="graph-node-details">
            <div>Type: <strong>{f.event_type || 'Unknown'}</strong></div>
            <div>Loc: <strong>{f.location || 'Unknown'}</strong></div>
          </div>
        );
      case 'supplier_impact':
        return (
          <div className="graph-node-details">
            <div>Tier 1/2: <strong>{f.affected_tier1 || 0} / {f.affected_tier2 || 0}</strong></div>
            <div>Buffer: <strong className="text-warning">{f.inventory_buffer_days || 0}d</strong></div>
          </div>
        );
      case 'financial_exposure':
        return (
          <div className="graph-node-details">
            <div>Risk: <strong>${((f.week6_risk_usd || 0)/1e6).toFixed(1)}M</strong></div>
            <div>Margin: <strong>-{f.margin_impact_pct || 0}%</strong></div>
          </div>
        );
      case 'regulatory_trade':
        return (
          <div className="graph-node-details">
            <div>FM: <strong>{f.force_majeure_applicable ? 'Yes' : 'No'}</strong></div>
            <div>Notify: <strong>{f.insurer_notify_deadline_hours || 0}h</strong></div>
          </div>
        );
      case 'alt_sourcing':
        return (
          <div className="graph-node-details">
            <span className="text-accent" style={{ fontWeight: 600 }}>Rec: </span>
            <strong>{f.recommended || 'None'}</strong>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="graph-canvas">
      {/* SVG Connections Canvas */}
      <svg viewBox="0 0 600 600" className="graph-svg-overlay">
        <defs>
          <linearGradient id="gradient-inactive" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </linearGradient>
          <linearGradient id="gradient-active" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Draw connection paths */}
        {paths.map((path) => (
          <g key={path.id}>
            <path
              id={`path-${path.id}`}
              d={path.d}
              className={`graph-connection-line ${path.active ? 'active' : ''} ${path.streaming ? 'processing' : ''}`}
            />
            {/* Draw animated particles when data is transferring */}
            {path.streaming && (
              <circle r="4" className="graph-particle">
                <animateMotion dur="1.8s" repeatCount="indefinite">
                  <mpath href={`#path-${path.id}`} />
                </animateMotion>
              </circle>
            )}
          </g>
        ))}
      </svg>

      {/* HTML Node Cards */}
      {NODE_DEFS.map((node) => {
        const state = getNodeState(node.id);
        const icon = node.icon;
        
        return (
          <div
            key={node.id}
            className="graph-node-wrapper"
            style={{ left: node.pos.left, top: node.pos.top }}
          >
            <motion.div
              className={`graph-node ${state}`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 100, damping: 15 }}
            >
              <div className="graph-node-header">
                <span className="text-secondary">{icon}</span>
                <div className="flex-col" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h4 className="graph-node-title">{node.label}</h4>
                  <span className="graph-node-desc">{node.role}</span>
                </div>

                {/* Status indicator badges */}
                <div className="graph-node-badge">
                  {state === 'complete' && (
                    <CheckCircle weight="fill" className="text-success" size={16} />
                  )}
                  {state === 'processing' && (
                    <CircleNotch weight="bold" className="text-warning animate-spin" size={16} />
                  )}
                  {(state === 'error' || state === 'escalate') && (
                    <WarningCircle weight="fill" className="text-danger" size={16} />
                  )}
                </div>
              </div>

              {/* In-situ summary of agent results */}
              {renderNodeSummary(node.id)}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
