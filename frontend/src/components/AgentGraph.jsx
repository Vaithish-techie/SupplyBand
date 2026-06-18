import { useMemo } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AgentNode, CoordinatorNode } from './CustomNode';
import AnimatedEdge from './AnimatedEdge';

const nodeTypes = {
  agent: AgentNode,
  coordinator: CoordinatorNode,
};
const edgeTypes = {
  animated: AnimatedEdge,
};

export default function AgentGraph({ agentStates, isComplete }) {
  const nodes = useMemo(() => {
    return [
      {
        id: 'coordinator',
        type: 'coordinator',
        position: { x: 250, y: 20 },
        data: { label: 'Coordinator', state: agentStates['coordinator']?.state || 'pending', isComplete }
      },
      {
        id: 'event_intelligence',
        type: 'agent',
        position: { x: 250, y: 140 },
        data: { label: 'Event Intel', ...agentStates['event_intelligence'] }
      },
      {
        id: 'supplier_impact',
        type: 'agent',
        position: { x: 250, y: 260 },
        data: { label: 'Supplier Impact', ...agentStates['supplier_impact'] }
      },
      {
        id: 'financial_exposure',
        type: 'agent',
        position: { x: 80, y: 380 },
        data: { label: 'Financial Exposure', ...agentStates['financial_exposure'] }
      },
      {
        id: 'regulatory_trade',
        type: 'agent',
        position: { x: 420, y: 380 },
        data: { label: 'Regulatory & Trade', ...agentStates['regulatory_trade'] }
      },
      {
        id: 'alt_sourcing',
        type: 'agent',
        position: { x: 250, y: 500 },
        data: { label: 'Alt Sourcing', ...agentStates['alt_sourcing'] }
      }
    ];
  }, [agentStates, isComplete]);

  const edges = useMemo(() => {
    // Helper to determine edge label based on findings
    const getLabel = (agent) => {
      const state = agentStates[agent];
      if (state?.state === 'complete' && state.findings) {
        if (agent === 'event_intelligence') return state.findings.event_type || 'Event parsed';
        if (agent === 'supplier_impact') return `${state.findings.affected_tier1 || 0} Tier-1 Affected`;
        if (agent === 'financial_exposure') return `$${(state.findings.week6_risk_usd/1e6).toFixed(1)}M Risk`;
        if (agent === 'regulatory_trade') return state.findings.force_majeure_applicable ? 'Force Majeure' : 'Checked';
      }
      return null;
    };

    // Helper to determine if downstream is active/processing
    const isActive = (target) => ['processing', 'delayed', 'complete'].includes(agentStates[target]?.state);

    return [
      {
        id: 'e-coord-event',
        source: 'coordinator',
        target: 'event_intelligence',
        type: 'animated',
        animated: isActive('event_intelligence'),
        data: { id: 'e-coord-event', isAnimating: isActive('event_intelligence'), findingLabel: null }
      },
      {
        id: 'e-event-supplier',
        source: 'event_intelligence',
        target: 'supplier_impact',
        type: 'animated',
        animated: isActive('supplier_impact'),
        data: { id: 'e-event-supplier', isAnimating: isActive('supplier_impact'), findingLabel: getLabel('event_intelligence') }
      },
      {
        id: 'e-supplier-financial',
        source: 'supplier_impact',
        target: 'financial_exposure',
        type: 'animated',
        animated: isActive('financial_exposure'),
        data: { id: 'e-supplier-financial', isAnimating: isActive('financial_exposure'), findingLabel: getLabel('supplier_impact') }
      },
      {
        id: 'e-supplier-regulatory',
        source: 'supplier_impact',
        target: 'regulatory_trade',
        type: 'animated',
        animated: isActive('regulatory_trade'),
        data: { id: 'e-supplier-regulatory', isAnimating: isActive('regulatory_trade'), findingLabel: getLabel('supplier_impact') }
      },
      {
        id: 'e-financial-alt',
        source: 'financial_exposure',
        target: 'alt_sourcing',
        type: 'animated',
        animated: isActive('alt_sourcing'),
        data: { id: 'e-financial-alt', isAnimating: isActive('alt_sourcing'), findingLabel: getLabel('financial_exposure') }
      },
      {
        id: 'e-regulatory-alt',
        source: 'regulatory_trade',
        target: 'alt_sourcing',
        type: 'animated',
        animated: isActive('alt_sourcing'),
        data: { id: 'e-regulatory-alt', isAnimating: isActive('alt_sourcing'), findingLabel: getLabel('regulatory_trade') }
      }
    ];
  }, [agentStates]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnScroll={false}
        panOnDrag={false}
      >
        <Background color="#ffffff" gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
