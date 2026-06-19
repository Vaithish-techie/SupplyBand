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
        position: { x: 400, y: 40 },
        data: { label: 'Coordinator', state: agentStates['coordinator']?.state || 'pending', isComplete }
      },
      {
        id: 'event_intelligence',
        type: 'agent',
        position: { x: 400, y: 200 },
        data: { label: 'Event Intel', ...agentStates['event_intelligence'] }
      },
      {
        id: 'supplier_impact',
        type: 'agent',
        position: { x: 400, y: 360 },
        data: { label: 'Supplier Impact', ...agentStates['supplier_impact'] }
      },
      {
        id: 'financial_exposure',
        type: 'agent',
        position: { x: 50, y: 540 },
        data: { label: 'Financial Exposure', ...agentStates['financial_exposure'] }
      },
      {
        id: 'alt_sourcing',
        type: 'agent',
        position: { x: 400, y: 540 },
        data: { label: 'Alt Sourcing', ...agentStates['alt_sourcing'] }
      },
      {
        id: 'regulatory_trade',
        type: 'agent',
        position: { x: 750, y: 540 },
        data: { label: 'Regulatory & Trade', ...agentStates['regulatory_trade'] }
      }
    ];
  }, [agentStates, isComplete]);

  const edges = useMemo(() => {
    const getLabel = (agent) => {
      const state = agentStates[agent];
      if (state?.state === 'complete' && state.findings) {
        if (agent === 'event_intelligence') return state.findings.event_type || 'Event parsed';
        if (agent === 'supplier_impact') return `${state.findings.affected_tier1 || 0} Tier-1 Affected`;
        if (agent === 'financial_exposure') return `$${(state.findings.week6_risk_usd/1e6).toFixed(1)}M Risk`;
        if (agent === 'regulatory_trade') return state.findings.force_majeure_applicable ? 'Force Majeure' : 'Checked';
        if (agent === 'alt_sourcing') return state.findings.recommended || 'Alternatives Ranked';
      }
      return null;
    };

    const isActive = (target) => ['processing', 'delayed', 'complete'].includes(agentStates[target]?.state);

    return [
      { id: 'e-coord-event', source: 'coordinator', target: 'event_intelligence', type: 'animated', animated: isActive('event_intelligence'), data: { id: 'e-coord-event', isAnimating: isActive('event_intelligence'), findingLabel: null } },
      { id: 'e-event-supplier', source: 'event_intelligence', target: 'supplier_impact', type: 'animated', animated: isActive('supplier_impact'), data: { id: 'e-event-supplier', isAnimating: isActive('supplier_impact'), findingLabel: getLabel('event_intelligence') } },
      { id: 'e-supplier-financial', source: 'supplier_impact', target: 'financial_exposure', type: 'animated', animated: isActive('financial_exposure'), data: { id: 'e-supplier-financial', isAnimating: isActive('financial_exposure'), findingLabel: getLabel('supplier_impact') } },
      { id: 'e-supplier-regulatory', source: 'supplier_impact', target: 'regulatory_trade', type: 'animated', animated: isActive('regulatory_trade'), data: { id: 'e-supplier-regulatory', isAnimating: isActive('regulatory_trade'), findingLabel: getLabel('supplier_impact') } },
      { id: 'e-supplier-alt', source: 'supplier_impact', target: 'alt_sourcing', type: 'animated', animated: isActive('alt_sourcing'), data: { id: 'e-supplier-alt', isAnimating: isActive('alt_sourcing'), findingLabel: getLabel('supplier_impact') } },
      { id: 'e-financial-coord', source: 'financial_exposure', target: 'coordinator', type: 'animated', animated: isComplete, data: { id: 'e-financial-coord', isAnimating: isComplete, findingLabel: getLabel('financial_exposure') } },
      { id: 'e-regulatory-coord', source: 'regulatory_trade', target: 'coordinator', type: 'animated', animated: isComplete, data: { id: 'e-regulatory-coord', isAnimating: isComplete, findingLabel: getLabel('regulatory_trade') } },
      { id: 'e-alt-coord', source: 'alt_sourcing', target: 'coordinator', type: 'animated', animated: isComplete, data: { id: 'e-alt-coord', isAnimating: isComplete, findingLabel: getLabel('alt_sourcing') } }
    ];
  }, [agentStates, isComplete]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={true}
        nodesConnectable={false}
        zoomOnScroll={true}
        panOnDrag={true}
      >
        <Background color="#ffffff" gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
