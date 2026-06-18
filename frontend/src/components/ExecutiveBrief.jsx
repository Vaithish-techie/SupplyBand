import React from 'react';
import { motion } from 'framer-motion';
import { Warning, Calendar, CurrencyDollar, Handshake, CheckCircle } from '@phosphor-icons/react';

function RiskFlowMap({ messages }) {
  if (!messages) return null;

  // Extract findings
  const eventMsg = messages.find(m => m.parsed?.agent === 'event_intelligence');
  const eventTitle = eventMsg?.parsed?.findings?.event_type 
    ? eventMsg.parsed.findings.event_type.replace(/_/g, ' ') 
    : 'Disruption';
  const eventLoc = eventMsg?.parsed?.findings?.location || 'Origin Point';

  const supplierMsg = messages.find(m => m.parsed?.agent === 'supplier_impact');
  const suppliers = supplierMsg?.parsed?.findings?.critical_path_suppliers || [];
  const primarySupplier = suppliers[0] || 'Supplier Offline';

  const financialMsg = messages.find(m => m.parsed?.agent === 'financial_exposure');
  const products = financialMsg?.parsed?.findings?.revenue_at_risk_products || [];
  const primaryProduct = products[0] || 'Exposed Product';

  const altMsg = messages.find(m => m.parsed?.agent === 'alt_sourcing');
  const recommendedSupplier = altMsg?.parsed?.findings?.recommended || 'Alt Option';

  return (
    <div style={{
      background: 'rgba(0,0,0,0.15)',
      padding: '16px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.02)',
      marginTop: '16px',
      marginBottom: '20px'
    }}>
      <div className="flex justify-between items-center mb-3">
        <span className="font-mono text-secondary" style={{ fontSize: '9px', letterSpacing: '0.12em', fontWeight: 600 }}>
          SUPPLY NETWORK RISK MAP
        </span>
        <span className="tag" style={{ border: 'none', background: 'rgba(212,255,0,0.05)', color: 'var(--color-accent)', padding: '2px 8px', fontSize: '8px' }}>
          LIVE MODEL
        </span>
      </div>

      <div style={{ position: 'relative', width: '100%' }}>
        <svg viewBox="0 0 360 110" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          {/* Paths */}
          {/* Disruption to Supplier (Red warning) */}
          <path 
            d="M 40 55 C 100 25, 110 25, 170 25" 
            fill="none" 
            stroke="#FF3B30" 
            strokeWidth="1.5" 
            className="animate-flow-dash"
            style={{ opacity: 0.8 }}
          />
          {/* Supplier to Product (Orange warning) */}
          <path 
            d="M 170 25 C 230 25, 240 55, 300 55" 
            fill="none" 
            stroke="#FF9500" 
            strokeWidth="1.5" 
            className="animate-flow-dash"
            style={{ opacity: 0.8 }}
          />
          {/* Disruption to Alt Option (Muted Lime) */}
          <path 
            d="M 40 55 C 100 85, 110 85, 170 85" 
            fill="none" 
            stroke="rgba(212, 255, 0, 0.15)" 
            strokeWidth="1.5" 
            strokeDasharray="4,4"
          />
          {/* Alt Option to Product (Active Lime) */}
          <path 
            d="M 170 85 C 230 85, 240 55, 300 55" 
            fill="none" 
            stroke="var(--color-accent)" 
            strokeWidth="1.5" 
            className="animate-flow-dash"
            style={{ opacity: 0.9 }}
          />

          {/* Node 1: Disruption */}
          <g>
            <circle cx="40" cy="55" r="8" fill="#FF3B30" style={{ filter: 'drop-shadow(0 0 6px #FF3B30)', opacity: 0.9 }} />
            <circle cx="40" cy="55" r="4" fill="#FFFFFF" />
            <text x="40" y="75" textAnchor="middle" fill="var(--color-text-primary)" fontSize="8" fontFamily="var(--font-mono)" fontWeight="600" style={{ textTransform: 'uppercase' }}>
              {eventTitle.length > 12 ? eventTitle.substring(0, 10) + '..' : eventTitle}
            </text>
            <text x="40" y="85" textAnchor="middle" fill="var(--color-text-secondary)" fontSize="7" fontFamily="var(--font-mono)">
              {eventLoc}
            </text>
          </g>

          {/* Node 2: Supplier */}
          <g>
            <circle cx="170" cy="25" r="8" fill="#FF9500" style={{ filter: 'drop-shadow(0 0 6px #FF9500)', opacity: 0.9 }} />
            <circle cx="170" cy="25" r="4" fill="#FFFFFF" />
            <text x="170" y="10" textAnchor="middle" fill="var(--color-text-primary)" fontSize="8" fontFamily="var(--font-mono)" fontWeight="600">
              {primarySupplier.length > 15 ? primarySupplier.substring(0, 13) + '..' : primarySupplier}
            </text>
          </g>

          {/* Node 3: Product */}
          <g>
            <circle cx="300" cy="55" r="8" fill="#18181B" stroke="var(--color-text-secondary)" strokeWidth="1.5" />
            <circle cx="300" cy="55" r="4" fill="var(--color-text-secondary)" />
            <text x="300" y="75" textAnchor="middle" fill="var(--color-text-primary)" fontSize="8" fontFamily="var(--font-mono)" fontWeight="600">
              {primaryProduct.length > 12 ? primaryProduct.substring(0, 10) + '..' : primaryProduct}
            </text>
            <text x="300" y="85" textAnchor="middle" fill="#FF3B30" fontSize="7" fontFamily="var(--font-mono)" fontWeight="600">
              EXPOSED
            </text>
          </g>

          {/* Node 4: Alt Option */}
          <g>
            <circle cx="170" cy="85" r="8" fill="var(--color-accent)" style={{ filter: 'drop-shadow(0 0 6px var(--color-accent))', opacity: 0.9 }} />
            <circle cx="170" cy="85" r="4" fill="var(--color-surface)" />
            <text x="170" y="102" textAnchor="middle" fill="var(--color-accent)" fontSize="8" fontFamily="var(--font-mono)" fontWeight="600">
              {recommendedSupplier.length > 15 ? recommendedSupplier.substring(0, 13) + '..' : recommendedSupplier}
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}

const ExecutiveBrief = ({ brief, messages, handleMouseMove }) => {
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

        {/* Dynamic SVG Risk Flow Diagram */}
        <RiskFlowMap messages={messages} />

        {/* Bento Grid layout */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1.2fr', 
          gap: '20px', 
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
