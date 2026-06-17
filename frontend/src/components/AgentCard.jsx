import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Map, Building2, TrendingDown, Scale, CheckCircle2 } from 'lucide-react';

const getAgentIcon = (agent) => {
  switch (agent) {
    case 'event_intelligence': return <Map size={16} />;
    case 'supplier_impact': return <Building2 size={16} />;
    case 'financial_exposure': return <TrendingDown size={16} />;
    case 'regulatory_trade': return <Scale size={16} />;
    case 'alt_sourcing': return <CheckCircle2 size={16} />;
    default: return <ShieldAlert size={16} />;
  }
};

const getAgentName = (agent) => {
  return agent.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const formatKey = (key) => key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const FindingsRenderer = ({ findings }) => {
  if (!findings || Object.keys(findings).length === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginTop: '8px' }}>
      {Object.entries(findings).map(([key, value]) => {
        if (value === null || value === undefined) return null;
        
        let displayValue;
        if (typeof value === 'boolean') {
          displayValue = <span className={`tag ${value ? 'accent' : ''}`}>{value ? 'YES' : 'NO'}</span>;
        } else if (Array.isArray(value)) {
          if (value.length === 0) {
            displayValue = <span className="text-secondary" style={{ fontSize: '14px' }}>None</span>;
          } else if (typeof value[0] === 'object') {
            displayValue = (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                {value.map((item, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '4px', border: '1px solid var(--color-rule)' }}>
                    {Object.entries(item).map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center" style={{ fontSize: '13px', marginBottom: '6px' }}>
                        <span className="text-secondary">{formatKey(k)}:</span>
                        <span style={{ color: 'var(--color-text-primary)' }}>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          } else {
            displayValue = (
              <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                {value.map((item, idx) => (
                  <span key={idx} className="tag">{String(item)}</span>
                ))}
              </div>
            );
          }
        } else {
          displayValue = <span style={{ fontSize: '15px', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>{String(value)}</span>;
        }

        return (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span className="font-mono text-secondary" style={{ fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {formatKey(key)}
            </span>
            {displayValue}
          </div>
        );
      })}
    </div>
  );
};

const AgentCard = ({ message, index }) => {
  const data = message.parsed || {};
  const agent = data.agent;
  const status = data.status;
  const confidence = data.confidence;
  const findings = data.findings || {};
  const flags = data.flags || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="card-premium mb-3"
    >
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-1">
          <span className="text-accent">{getAgentIcon(agent)}</span>
          <span className="font-mono text-secondary" style={{ fontSize: 'var(--size-caption)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {getAgentName(agent)}
          </span>
        </div>
        <div className="flex gap-1">
          {confidence && <span className="tag">{confidence} CONFIDENCE</span>}
          {status && <span className={`tag ${status === 'escalate' ? 'accent' : ''}`}>{status}</span>}
        </div>
      </div>
      
      <div className="mt-3">
        <FindingsRenderer findings={findings} />
      </div>

      {flags && flags.length > 0 && (
        <div className="mt-3">
          <div className="font-mono text-accent mb-1" style={{ fontSize: 'var(--size-caption)', letterSpacing: '0.1em' }}>FLAGS</div>
          <ul style={{ listStyle: 'none' }}>
            {flags.map((flag, idx) => (
              <li key={idx} className="flex items-center gap-1" style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                <span style={{ color: 'var(--color-accent)' }}>▸</span> {flag}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
};

export default AgentCard;
