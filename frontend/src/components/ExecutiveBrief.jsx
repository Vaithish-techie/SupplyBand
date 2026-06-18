import React from 'react';
import { motion } from 'framer-motion';
import { Warning, Calendar, CurrencyDollar, Handshake, CheckCircle } from '@phosphor-icons/react';

const ExecutiveBrief = ({ brief, handleMouseMove }) => {
  if (!brief) return null;

  const data = brief.parsed || {};
  const { situation_summary, severity, verdict, top_3_actions, financial_exposure, recommended_supplier, compliance_deadline } = data;

  const isCritical = severity === 'CRITICAL' || severity === 'HIGH';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
      onMouseMove={handleMouseMove}
      className={`spotlight-card shell-bezel ${isCritical ? 'accent' : ''}`}
      style={{ marginTop: '28px', display: 'block' }}
    >
      <div className="core-bezel" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
        {/* Severity indicator line */}
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '4px', 
          height: '100%', 
          background: isCritical ? '#FF3B30' : 'var(--color-accent)',
          opacity: 0.8
        }} />
        
        <div className="flex justify-between items-center mb-4" style={{ paddingLeft: '8px' }}>
          <div className="flex items-center gap-2">
            <Warning size={18} className={isCritical ? 'text-accent' : 'text-secondary'} style={{ color: isCritical ? '#FF3B30' : 'var(--color-accent)' }} />
            <h2 className="font-display" style={{ fontSize: 'var(--size-heading)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-text-primary)', margin: 0 }}>
              Executive Brief
            </h2>
          </div>
          <div className="flex gap-2">
            {severity && (
              <span className="tag accent" style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 600, borderColor: isCritical ? 'rgba(255,59,48,0.3)' : '', color: isCritical ? '#FF3B30' : 'var(--color-accent)', background: isCritical ? 'rgba(255,59,48,0.03)' : '' }}>
                SEVERITY: {severity}
              </span>
            )}
            {verdict && (
              <span className="tag" style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 600, background: 'var(--color-text-primary)', color: 'var(--color-surface)', border: 'none' }}>
                {verdict.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>

        <div className="mb-6" style={{ paddingLeft: '8px' }}>
          <p style={{ fontSize: '15.5px', lineHeight: 1.6, color: 'var(--color-text-primary)', fontWeight: 400 }}>
            {situation_summary}
          </p>
        </div>

        {/* Bento Grid layout */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1.2fr', 
          gap: '20px', 
          marginTop: '28px',
          paddingLeft: '8px'
        }}>
          {/* Key Metrics Bento Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="font-mono text-secondary" style={{ fontSize: '10px', letterSpacing: '0.12em', fontWeight: 600 }}>
              KEY TELEMETRY
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Financial Exposure card */}
              <div style={{ 
                padding: '14px', 
                background: 'rgba(0,0,0,0.15)', 
                borderRadius: '10px', 
                border: '1px solid rgba(255,255,255,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '8px', 
                  background: 'rgba(255,255,255,0.02)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  border: '1px solid rgba(255,255,255,0.04)',
                  color: 'var(--color-text-secondary)'
                }}>
                  <CurrencyDollar size={18} weight="duotone" />
                </div>
                <div>
                  <span className="block text-secondary font-mono" style={{ fontSize: '9px', letterSpacing: '0.05em' }}>FINANCIAL EXPOSURE</span>
                  <span className="font-mono" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {financial_exposure || 'Pending analysis'}
                  </span>
                </div>
              </div>

              {/* Alt Sourcing card */}
              <div style={{ 
                padding: '14px', 
                background: 'rgba(0,0,0,0.15)', 
                borderRadius: '10px', 
                border: '1px solid rgba(255,255,255,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '8px', 
                  background: 'rgba(255,255,255,0.02)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  border: '1px solid rgba(255,255,255,0.04)',
                  color: 'var(--color-text-secondary)'
                }}>
                  <Handshake size={18} weight="duotone" />
                </div>
                <div>
                  <span className="block text-secondary font-mono" style={{ fontSize: '9px', letterSpacing: '0.05em' }}>ALT SOURCING RECS</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {recommended_supplier || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Compliance Deadline card */}
              <div style={{ 
                padding: '14px', 
                background: 'rgba(0,0,0,0.15)', 
                borderRadius: '10px', 
                border: '1px solid rgba(255,255,255,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '8px', 
                  background: 'rgba(255,255,255,0.02)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  border: '1px solid rgba(255,255,255,0.04)',
                  color: compliance_deadline ? 'var(--color-accent)' : 'var(--color-text-secondary)'
                }}>
                  <Calendar size={18} weight="duotone" />
                </div>
                <div>
                  <span className="block text-secondary font-mono" style={{ fontSize: '9px', letterSpacing: '0.05em' }}>COMPLIANCE DEADLINE</span>
                  <span className={compliance_deadline ? 'font-mono' : ''} style={{ fontSize: '14px', fontWeight: 600, color: compliance_deadline ? 'var(--color-accent)' : 'var(--color-text-primary)' }}>
                    {compliance_deadline || 'None detected'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Actions Bento Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="font-mono text-secondary" style={{ fontSize: '10px', letterSpacing: '0.12em', fontWeight: 600 }}>
              RECOMMENDED ACTIONS
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {top_3_actions && top_3_actions.length > 0 ? (
                top_3_actions.map((action, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      padding: '14px', 
                      background: 'rgba(0,0,0,0.15)', 
                      borderRadius: '10px', 
                      border: '1px solid rgba(255,255,255,0.02)',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start'
                    }}
                  >
                    <CheckCircle size={16} weight="fill" className="text-accent" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', lineHeight: 1.4, color: 'var(--color-text-primary)' }}>{action}</span>
                  </div>
                ))
              ) : (
                <div style={{ padding: '14px', color: 'var(--color-text-secondary)', fontSize: '13px', fontStyle: 'italic' }}>
                  No actions prescribed.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ExecutiveBrief;
