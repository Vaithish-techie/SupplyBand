import React, { useState } from 'react';
import { ShieldCheck, Loader2, ChevronDown, ChevronUp, Code, Database, AlertCircle } from 'lucide-react';
import EventIntelDetails from './AgentDetails/EventIntelDetails';
import SupplierImpactDetails from './AgentDetails/SupplierImpactDetails';
import FinancialExposureDetails from './AgentDetails/FinancialExposureDetails';
import RegulatoryDetails from './AgentDetails/RegulatoryDetails';
import AltSourcingDetails from './AgentDetails/AltSourcingDetails';

const AGENT_META = {
  event_intelligence: {
    title: 'Event Intelligence',
    model: 'Claude 3.5 Sonnet',
    color: 'var(--neon-purple)',
    detailsComponent: EventIntelDetails
  },
  supplier_impact: {
    title: 'Supplier Impact Analysis',
    model: 'Llama 3.1 70B (Featherless)',
    color: 'var(--neon-pink)',
    detailsComponent: SupplierImpactDetails
  },
  financial_exposure: {
    title: 'Financial Exposure & Margins',
    model: 'Llama 3.1 70B (Featherless)',
    color: 'var(--neon-orange)',
    detailsComponent: FinancialExposureDetails
  },
  regulatory_trade: {
    title: 'Regulatory & Trade Compliance',
    model: 'Claude 3.5 Sonnet',
    color: 'var(--neon-cyan)',
    detailsComponent: RegulatoryDetails
  },
  alt_sourcing: {
    title: 'Alternative Sourcing & Routing',
    model: 'Llama 3.1 70B (Featherless)',
    color: 'var(--neon-green)',
    detailsComponent: AltSourcingDetails
  }
};

export default function AgentCard({ agentKey, rawMessage, isPending, isPosted }) {
  const [expanded, setExpanded] = useState(true);
  const [showRawJson, setShowRawJson] = useState(false);
  
  const meta = AGENT_META[agentKey];
  if (!meta) return null;

  const status = isPosted ? 'completed' : isPending ? 'processing' : 'waiting';
  const parsed = rawMessage?.parsed;
  const confidence = parsed?.confidence || 'UNKNOWN';
  const flags = parsed?.flags || [];

  const confidenceColors = {
    HIGH: 'var(--neon-green)',
    MEDIUM: 'var(--neon-yellow)',
    LOW: 'var(--neon-pink)',
    UNKNOWN: '#64748b'
  };

  const statusBadge = () => {
    switch (status) {
      case 'completed':
        return (
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--neon-green)',
            backgroundColor: 'rgba(5, 243, 173, 0.08)',
            padding: '3px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(5, 243, 173, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--neon-green)' }} />
            COMPLETED
          </span>
        );
      case 'processing':
        return (
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--neon-yellow)',
            backgroundColor: 'rgba(255, 208, 0, 0.08)',
            padding: '3px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(255, 208, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Loader2 size={10} className="animate-spin" style={{ color: 'var(--neon-yellow)' }} />
            PROCESSING
          </span>
        );
      default:
        return (
          <span style={{
            fontSize: '10px',
            fontWeight: 600,
            color: '#64748b',
            backgroundColor: 'rgba(255,255,255,0.02)',
            padding: '3px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#64748b' }} />
            WAITING
          </span>
        );
    }
  };

  const DetailsComp = meta.detailsComponent;

  return (
    <div 
      className="glass-panel" 
      style={{
        opacity: status === 'waiting' ? 0.45 : 1,
        borderLeft: `4px solid ${status === 'completed' ? meta.color : status === 'processing' ? 'var(--neon-yellow)' : '#1e293b'}`,
        padding: '16px',
        borderRadius: '12px',
        transition: 'all 0.4s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-display)', color: status !== 'waiting' ? '#fff' : '#9aa0b9' }}>
            {meta.title}
          </h4>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Node LLM: <strong style={{ color: '#94a3b8' }}>{meta.model}</strong>
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {statusBadge()}
          <button 
            onClick={() => setExpanded(!expanded)} 
            disabled={status === 'waiting'}
            style={{
              background: 'none',
              border: 'none',
              color: '#9aa0b9',
              cursor: status === 'waiting' ? 'not-allowed' : 'pointer',
              padding: '2px'
            }}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && status !== 'waiting' && parsed && (
        <div style={{ 
          borderTop: '1px solid rgba(255,255,255,0.05)', 
          paddingTop: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* Metadata Badges: Confidence & Flags */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', fontSize: '11px' }}>
            <span style={{ color: '#64748b' }}>Confidence:</span>
            <span style={{ fontWeight: 700, color: confidenceColors[confidence] }}>
              {confidence}
            </span>
            
            {flags.length > 0 && (
              <span style={{ 
                color: 'var(--neon-pink)', 
                marginLeft: 'auto',
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                background: 'rgba(255, 0, 122, 0.05)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 500
              }}>
                <AlertCircle size={10} />
                {flags.length} Flags
              </span>
            )}
          </div>

          {/* Toggle Parsed vs Raw JSON */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={() => setShowRawJson(!showRawJson)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '11px',
                color: showRawJson ? 'var(--neon-blue)' : '#9aa0b9',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s'
              }}
            >
              {showRawJson ? <Database size={11} /> : <Code size={11} />}
              {showRawJson ? 'Show Details Panel' : 'View Raw JSON'}
            </button>
          </div>

          {/* Body Render */}
          {showRawJson ? (
            <pre style={{
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#34d399',
              fontFamily: 'monospace',
              overflowX: 'auto',
              maxHeight: '200px'
            }}>
              {JSON.stringify(parsed, null, 2)}
            </pre>
          ) : (
            <DetailsComp findings={parsed.findings} />
          )}

          {/* Flags Alert Container */}
          {flags.length > 0 && (
            <div style={{
              background: 'rgba(255, 0, 122, 0.03)',
              border: '1px solid rgba(255, 0, 122, 0.1)',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '12px',
              color: '#ffa6c9',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <strong style={{ color: 'var(--neon-pink)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Anomaly Flags Detected:
              </strong>
              <ul style={{ paddingLeft: '16px', margin: 0 }}>
                {flags.map((flag, idx) => <li key={idx}>{flag}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
