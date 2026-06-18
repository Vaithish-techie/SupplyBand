import React from 'react';
import { motion } from 'framer-motion';
import { Compass, Factory, ChartLineDown, Scales, Handshake, WarningOctagon, Warning, MapPin, Calendar, Clock, ShieldCheck } from '@phosphor-icons/react';

const getAgentIcon = (agent) => {
  switch (agent) {
    case 'event_intelligence': return <Compass size={16} weight="duotone" />;
    case 'supplier_impact': return <Factory size={16} weight="duotone" />;
    case 'financial_exposure': return <ChartLineDown size={16} weight="duotone" />;
    case 'regulatory_trade': return <Scales size={16} weight="duotone" />;
    case 'alt_sourcing': return <Handshake size={16} weight="duotone" />;
    default: return <WarningOctagon size={16} weight="duotone" />;
  }
};

const getAgentName = (agent) => {
  return agent.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const formatCurrency = (val) => {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
};

// Event Intelligence Custom Visualizer
const EventIntelRenderer = ({ data }) => {
  const duration = data.estimated_duration_weeks || 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--color-text-primary)' }}>{data.summary}</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
          <span className="block text-secondary font-mono" style={{ fontSize: '9px', marginBottom: '2px' }}>LOCATION</span>
          <span className="flex items-center gap-1 font-mono" style={{ fontSize: '12px', fontWeight: 500 }}>
            <MapPin size={12} className="text-accent" /> {data.location || 'Unknown'}
          </span>
        </div>
        
        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
          <span className="block text-secondary font-mono" style={{ fontSize: '9px', marginBottom: '2px' }}>EVENT TYPE</span>
          <span className="font-mono text-accent" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
            {data.event_type || 'N/A'}
          </span>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-secondary font-mono" style={{ fontSize: '9px' }}>ESTIMATED DURATION</span>
          <span className="font-mono text-accent" style={{ fontSize: '11px', fontWeight: 600 }}>{duration} WEEKS</span>
        </div>
        <div style={{ height: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min((duration / 12) * 100, 100)}%`, height: '100%', background: 'var(--color-accent)', borderRadius: '99px' }} />
        </div>
      </div>

      {data.affected_industries && data.affected_industries.length > 0 && (
        <div>
          <span className="block text-secondary font-mono mb-1.5" style={{ fontSize: '9px' }}>AFFECTED INDUSTRIES</span>
          <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
            {data.affected_industries.map((ind, i) => (
              <span key={i} className="tag" style={{ fontSize: '10px' }}>{ind}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Supplier Impact Custom Visualizer
const SupplierImpactRenderer = ({ data }) => {
  const buffer = data.inventory_buffer_days || 0;
  const bufferPercent = Math.min((buffer / 30) * 100, 100);
  const isBufferLow = buffer < 7;
  const isBufferMid = buffer >= 7 && buffer < 21;
  const bufferColor = isBufferLow ? '#FF3B30' : isBufferMid ? '#FF9500' : 'var(--color-accent)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* Buffer Safety Gauge */}
      <div style={{ background: 'rgba(0,0,0,0.15)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.02)' }}>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-secondary font-mono" style={{ fontSize: '9px' }}>INVENTORY BUFFER LEVEL</span>
          <span className="font-mono" style={{ fontSize: '13px', fontWeight: 600, color: bufferColor }}>
            {buffer} DAYS RUNWAY
          </span>
        </div>
        <div style={{ height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '99px', overflow: 'hidden', position: 'relative' }}>
          <div style={{ 
            width: `${bufferPercent}%`, 
            height: '100%', 
            background: bufferColor, 
            borderRadius: '99px',
            boxShadow: `0 0 8px ${bufferColor}`,
            transition: 'width 1s ease-out'
          }} />
          {/* Warning markers */}
          <div style={{ position: 'absolute', left: '23%', top: 0, width: '1px', height: '100%', background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ position: 'absolute', left: '70%', top: 0, width: '1px', height: '100%', background: 'rgba(255,255,255,0.2)' }} />
        </div>
        <div className="flex justify-between font-mono mt-1 text-secondary" style={{ fontSize: '8px' }}>
          <span>CRITICAL (&lt;7d)</span>
          <span>WARNING (&lt;21d)</span>
          <span>STABLE</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
          <span className="block text-secondary font-mono" style={{ fontSize: '9px', marginBottom: '2px' }}>TIER 1 AFFECTED</span>
          <span className="font-mono" style={{ fontSize: '18px', fontWeight: 600, color: data.affected_tier1 > 0 ? '#FF9500' : 'var(--color-text-primary)' }}>
            {data.affected_tier1 || 0}
          </span>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
          <span className="block text-secondary font-mono" style={{ fontSize: '9px', marginBottom: '2px' }}>TIER 2 AFFECTED</span>
          <span className="font-mono" style={{ fontSize: '18px', fontWeight: 600 }}>
            {data.affected_tier2 || 0}
          </span>
        </div>
      </div>

      {data.critical_path_suppliers && data.critical_path_suppliers.length > 0 && (
        <div>
          <span className="block text-secondary font-mono mb-1.5" style={{ fontSize: '9px' }}>CRITICAL PATH SUPPLIERS</span>
          <div className="flex gap-1.5" style={{ flexWrap: 'wrap' }}>
            {data.critical_path_suppliers.map((sup, i) => (
              <span key={i} className="tag accent" style={{ fontSize: '10px' }}>{sup}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Financial Exposure Custom Visualizer
const FinancialExposureRenderer = ({ data }) => {
  const w1 = data.week1_risk_usd || 0;
  const w3 = data.week3_risk_usd || 0;
  const w6 = data.week6_risk_usd || 0;
  const maxVal = Math.max(w1, w3, w6, 1);
  
  // Custom SVG step graph heights
  const h1 = (w1 / maxVal) * 50 + 10;
  const h2 = (w3 / maxVal) * 50 + 10;
  const h3 = (w6 / maxVal) * 50 + 10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* Margin impact ticker banner */}
      <div style={{ 
        background: 'rgba(255, 59, 48, 0.03)', 
        border: '1px solid rgba(255, 59, 48, 0.15)',
        padding: '12px 16px', 
        borderRadius: '10px',
        display: 'flex',
        justifyContent: 'between',
        alignItems: 'center'
      }}>
        <div>
          <span className="block text-secondary font-mono" style={{ fontSize: '8px' }}>MARGIN IMPACT</span>
          <span className="font-mono" style={{ fontSize: '16px', fontWeight: 700, color: '#FF3B30' }}>
            ▼ {data.margin_impact_pct || 0}%
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="block text-secondary font-mono" style={{ fontSize: '8px' }}>PEAK RISK RATE</span>
          <span className="font-mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {formatCurrency(w6)}
          </span>
        </div>
      </div>

      {/* SVG Risk Projection Timeline */}
      <div style={{ background: 'rgba(0,0,0,0.15)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.02)' }}>
        <span className="block text-secondary font-mono mb-2" style={{ fontSize: '9px' }}>RISK PROJECTION OVER TIME</span>
        
        <div style={{ position: 'relative', height: '80px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 10px' }}>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            {/* Dotted helper lines */}
            <line x1="0" y1="10" x2="100%" y2="10" stroke="rgba(255,255,255,0.02)" strokeDasharray="3" />
            <line x1="0" y1="40" x2="100%" y2="40" stroke="rgba(255,255,255,0.02)" strokeDasharray="3" />
            <line x1="0" y1="70" x2="100%" y2="70" stroke="rgba(255,255,255,0.02)" strokeDasharray="3" />
            
            {/* Draw spline curve */}
            <path 
              d={`M 30 ${80 - h1} Q 110 ${80 - h2} 220 ${80 - h3}`} 
              fill="none" 
              stroke="#FF3B30" 
              strokeWidth="2"
              style={{ filter: 'drop-shadow(0 0 4px rgba(255,59,48,0.2))' }}
            />
          </svg>

          {/* Timeline Nodes */}
          <div className="flex flex-col items-center" style={{ zIndex: 1, width: '60px' }}>
            <span className="font-mono text-secondary" style={{ fontSize: '8px' }}>WEEK 1</span>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF3B30', margin: '4px 0' }} />
            <span className="font-mono" style={{ fontSize: '11px', fontWeight: 600 }}>{formatCurrency(w1)}</span>
          </div>

          <div className="flex flex-col items-center" style={{ zIndex: 1, width: '60px' }}>
            <span className="font-mono text-secondary" style={{ fontSize: '8px' }}>WEEK 3</span>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF3B30', margin: '4px 0' }} />
            <span className="font-mono" style={{ fontSize: '11px', fontWeight: 600 }}>{formatCurrency(w3)}</span>
          </div>

          <div className="flex flex-col items-center" style={{ zIndex: 1, width: '60px' }}>
            <span className="font-mono text-secondary" style={{ fontSize: '8px' }}>WEEK 6</span>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF3B30', margin: '4px 0' }} />
            <span className="font-mono" style={{ fontSize: '11px', fontWeight: 600 }}>{formatCurrency(w6)}</span>
          </div>
        </div>
      </div>
      
      {data.revenue_at_risk_products && data.revenue_at_risk_products.length > 0 && (
        <div>
          <span className="block text-secondary font-mono mb-1.5" style={{ fontSize: '9px' }}>EXPOSED PRODUCT LINES</span>
          <div className="flex gap-1.5" style={{ flexWrap: 'wrap' }}>
            {data.revenue_at_risk_products.map((prod, i) => (
              <span key={i} className="tag" style={{ fontSize: '10px' }}>{prod}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Regulatory & Trade Custom Visualizer
const RegulatoryTradeRenderer = ({ data }) => {
  const isFm = data.force_majeure_applicable;
  const deadline = data.insurer_notify_deadline_hours;
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
        <div style={{ 
          background: isFm ? 'rgba(255, 149, 0, 0.03)' : 'rgba(0,0,0,0.15)', 
          border: `1px solid ${isFm ? 'rgba(255, 149, 0, 0.15)' : 'rgba(255,255,255,0.02)'}`,
          padding: '12px', 
          borderRadius: '8px', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center' 
        }}>
          <span className="block text-secondary font-mono" style={{ fontSize: '8px', marginBottom: '2px' }}>FORCE MAJEURE</span>
          <span className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: isFm ? '#FF9500' : 'var(--color-text-secondary)' }}>
            {isFm ? '✔ APPLICABLE CLAUSES' : '✖ NOT DETECTED'}
          </span>
        </div>

        <div style={{ 
          background: deadline <= 72 ? 'rgba(255, 59, 48, 0.03)' : 'rgba(0,0,0,0.15)', 
          border: `1px solid ${deadline <= 72 ? 'rgba(255, 59, 48, 0.15)' : 'rgba(255,255,255,0.02)'}`,
          padding: '12px', 
          borderRadius: '8px', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center' 
        }}>
          <span className="block text-secondary font-mono" style={{ fontSize: '8px', marginBottom: '2px' }}>NOTIFY DEADLINE</span>
          <span className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: deadline <= 72 ? '#FF3B30' : 'var(--color-text-primary)' }}>
            {deadline ? `${deadline} HOURS` : 'N/A'}
          </span>
        </div>
      </div>

      {data.export_controls && data.export_controls.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
          <span className="text-secondary font-mono" style={{ fontSize: '9px' }}>EXPORT CONTROLS</span>
          <div className="flex gap-1">
            {data.export_controls.map((ctrl, i) => (
              <code key={i} className="font-mono" style={{ fontSize: '11px', color: 'var(--color-accent)', background: 'rgba(212,255,0,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                {ctrl}
              </code>
            ))}
          </div>
        </div>
      )}

      {data.compliance_actions && data.compliance_actions.length > 0 && (
        <div>
          <span className="block text-secondary font-mono mb-1.5" style={{ fontSize: '9px' }}>COMPLIANCE CHECKLIST</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.compliance_actions.map((act, i) => (
              <div 
                key={i} 
                style={{ 
                  padding: '10px 12px', 
                  background: 'rgba(0,0,0,0.15)', 
                  borderRadius: '8px', 
                  border: '1px solid rgba(255,255,255,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <Warning size={14} className="text-accent" style={{ flexShrink: 0 }} />
                <span className="font-mono" style={{ fontSize: '11.5px', color: 'var(--color-text-primary)' }}>{act}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Alternative Sourcing Custom Visualizer
const AltSourcingRenderer = ({ data }) => {
  const alts = data.alternatives || [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* Recommended highlights */}
      <div style={{ 
        background: 'rgba(212, 255, 0, 0.02)', 
        border: '1px solid rgba(212, 255, 0, 0.15)',
        padding: '14px', 
        borderRadius: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-accent" />
          <span className="font-mono text-accent" style={{ fontSize: '9px', fontWeight: 600 }}>RECOMMENDED OPTION</span>
        </div>
        <span className="font-mono" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {data.recommended || 'None'}
        </span>
        <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: 1.4, marginTop: '4px' }}>
          {data.recommendation_reason}
        </p>
      </div>

      {alts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span className="block text-secondary font-mono" style={{ fontSize: '9px' }}>CANDIDATE ALTERNATIVES</span>
          {alts.map((alt, idx) => (
            <div 
              key={idx} 
              style={{ 
                padding: '12px', 
                background: 'rgba(0,0,0,0.15)', 
                borderRadius: '8px', 
                border: '1px solid rgba(255,255,255,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div className="flex justify-between items-center">
                <span className="font-mono" style={{ fontSize: '13px', fontWeight: 600 }}>{alt.supplier}</span>
                <span className="tag" style={{ fontSize: '8px', background: alt.risk_level === 'LOW' ? 'rgba(212,255,0,0.05)' : 'rgba(255,90,0,0.05)', color: alt.risk_level === 'LOW' ? 'var(--color-accent)' : '#FF9500', borderColor: 'transparent' }}>
                  {alt.risk_level} RISK
                </span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: '4px', textAlign: 'center' }}>
                  <span className="block text-secondary font-mono" style={{ fontSize: '8px' }}>LEAD TIME</span>
                  <span className="font-mono text-accent" style={{ fontSize: '11px', fontWeight: 600 }}>{alt.lead_time_days} DAYS</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: '4px', textAlign: 'center' }}>
                  <span className="block text-secondary font-mono" style={{ fontSize: '8px' }}>COST DELTA</span>
                  <span className="font-mono" style={{ fontSize: '11px', fontWeight: 600, color: alt.cost_delta_pct > 15 ? '#FF9500' : 'var(--color-text-primary)' }}>
                    +{alt.cost_delta_pct}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const FindingsRenderer = ({ agent, findings }) => {
  if (!findings || Object.keys(findings).length === 0) return null;

  switch (agent) {
    case 'event_intelligence':
      return <EventIntelRenderer data={findings} />;
    case 'supplier_impact':
      return <SupplierImpactRenderer data={findings} />;
    case 'financial_exposure':
      return <FinancialExposureRenderer data={findings} />;
    case 'regulatory_trade':
      return <RegulatoryTradeRenderer data={findings} />;
    case 'alt_sourcing':
      return <AltSourcingRenderer data={findings} />;
    default:
      // Fallback
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginTop: '8px' }}>
          {Object.entries(findings).map(([key, value]) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="font-mono text-secondary" style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {key.replace(/_/g, ' ')}
              </span>
              <span style={{ fontSize: '14px' }}>{String(value)}</span>
            </div>
          ))}
        </div>
      );
  }
};

const AgentCard = ({ message, index, handleMouseMove }) => {
  const data = message.parsed || {};
  const agent = data.agent;
  const status = data.status;
  const confidence = data.confidence;
  const findings = data.findings || {};
  const flags = data.flags || [];

  const isEscalate = status === 'escalate' || status === 'insufficient_data';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: index * 0.08, ease: [0.32, 0.72, 0, 1] }}
      onMouseMove={handleMouseMove}
      className={`spotlight-card shell-bezel ${isEscalate ? 'accent' : ''}`}
    >
      <div className="core-bezel">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-accent flex items-center">{getAgentIcon(agent)}</span>
            <span className="font-mono text-secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
              {getAgentName(agent)}
            </span>
          </div>
          <div className="flex gap-1.5">
            {confidence && <span className="tag">{confidence} CONFIDENCE</span>}
            {status && (
              <span className={`tag ${isEscalate ? 'accent' : ''}`}>
                {status}
              </span>
            )}
          </div>
        </div>
        
        <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '14px' }}>
          <FindingsRenderer agent={agent} findings={findings} />
        </div>

        {flags && flags.length > 0 && (
          <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '12px' }}>
            <div className="font-mono text-accent mb-2 flex items-center gap-1" style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 600 }}>
              <Warning size={12} weight="bold" />
              <span>FLAGS DETECTED</span>
            </div>
            <ul style={{ listStyle: 'none', paddingLeft: '2px' }}>
              {flags.map((flag, idx) => (
                <li key={idx} className="flex items-start gap-1.5" style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px', lineHeight: 1.4 }}>
                  <span style={{ color: 'var(--color-accent)', marginTop: '2px' }}>▸</span> 
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AgentCard;


