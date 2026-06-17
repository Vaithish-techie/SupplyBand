import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle } from 'lucide-react';

const ExecutiveBrief = ({ brief }) => {
  if (!brief) return null;

  const data = brief.parsed || {};
  const { situation_summary, severity, verdict, top_3_actions, financial_exposure, recommended_supplier, compliance_deadline } = data;

  const isCritical = severity === 'CRITICAL' || severity === 'HIGH';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: 'var(--color-surface-hi)',
        border: `1px solid ${isCritical ? 'var(--color-accent)' : 'var(--color-rule)'}`,
        borderRadius: '8px',
        padding: '32px',
        marginTop: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: isCritical ? 'var(--color-accent)' : 'var(--color-text-secondary)' }} />
      
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-display" style={{ fontSize: 'var(--size-heading)', color: 'var(--color-text-primary)', margin: 0 }}>
          Executive Brief
        </h2>
        <div className="flex gap-2">
          {severity && (
            <span className={`tag ${isCritical ? 'accent' : ''}`} style={{ padding: '6px 12px', fontSize: '14px' }}>
              SEVERITY: {severity}
            </span>
          )}
          {verdict && (
            <span className="tag" style={{ padding: '6px 12px', fontSize: '14px', background: 'var(--color-text-primary)', color: 'var(--color-surface)' }}>
              {verdict.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </div>

      <div className="mb-4">
        <p style={{ fontSize: '18px', lineHeight: 1.6, color: 'var(--color-text-primary)' }}>
          {situation_summary}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '32px' }}>
        <div>
          <h3 className="font-mono text-secondary mb-2" style={{ fontSize: '12px', letterSpacing: '0.1em' }}>KEY METRICS</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            <li className="mb-2" style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
              <span className="block text-secondary font-mono" style={{ fontSize: '11px', marginBottom: '4px' }}>FINANCIAL EXPOSURE</span>
              <span style={{ fontSize: '16px' }}>{financial_exposure || 'Pending analysis'}</span>
            </li>
            <li className="mb-2" style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
              <span className="block text-secondary font-mono" style={{ fontSize: '11px', marginBottom: '4px' }}>ALT SOURCING</span>
              <span style={{ fontSize: '16px' }}>{recommended_supplier || 'N/A'}</span>
            </li>
            <li style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
              <span className="block text-secondary font-mono" style={{ fontSize: '11px', marginBottom: '4px' }}>COMPLIANCE DEADLINE</span>
              <span style={{ fontSize: '16px', color: compliance_deadline ? 'var(--color-accent)' : 'inherit' }}>{compliance_deadline || 'None detected'}</span>
            </li>
          </ul>
        </div>
        
        <div>
          <h3 className="font-mono text-secondary mb-2" style={{ fontSize: '12px', letterSpacing: '0.1em' }}>RECOMMENDED ACTIONS</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {top_3_actions && top_3_actions.length > 0 ? (
              top_3_actions.map((action, idx) => (
                <li key={idx} className="flex gap-2 mb-2" style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '15px', lineHeight: 1.4 }}>{action}</span>
                </li>
              ))
            ) : (
              <li style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>No actions prescribed.</li>
            )}
          </ul>
        </div>
      </div>
    </motion.div>
  );
};

export default ExecutiveBrief;
