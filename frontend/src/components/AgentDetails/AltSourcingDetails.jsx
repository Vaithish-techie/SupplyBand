import React from 'react';
import { Sparkles, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function AltSourcingDetails({ findings }) {
  if (!findings) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Recommended Supplier Highlight */}
      <div style={{ 
        background: 'linear-gradient(135deg, rgba(5, 243, 173, 0.08) 0%, rgba(0, 210, 255, 0.08) 100%)', 
        padding: '12px', 
        borderRadius: '10px',
        border: '1px solid rgba(5, 243, 173, 0.25)',
        boxShadow: '0 0 15px rgba(5, 243, 173, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <Sparkles size={14} style={{ color: '#05f3ad' }} />
          <span style={{ fontSize: '11px', color: '#05f3ad', fontWeight: 600, textTransform: 'uppercase' }}>Recommended Supplier</span>
        </div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>
          {findings.recommended}
        </div>
        <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4 }}>
          {findings.recommendation_reason}
        </div>
      </div>

      {/* Alternatives List */}
      <div>
        <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
          Alternative Options Comparison
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {findings.alternatives && findings.alternatives.map((alt, idx) => {
            const isRec = alt.supplier === findings.recommended;
            const riskColor = alt.risk_level === 'LOW' ? '#05f3ad' : alt.risk_level === 'MEDIUM' ? '#ffd000' : '#ff007a';
            
            return (
              <div key={idx} style={{
                background: isRec ? 'rgba(5, 243, 173, 0.03)' : 'rgba(255, 255, 255, 0.01)',
                border: `1px solid ${isRec ? 'rgba(5, 243, 173, 0.2)' : 'rgba(255, 255, 255, 0.05)'}`,
                padding: '12px',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: isRec ? '#05f3ad' : '#fff' }}>
                    {alt.supplier} {isRec && '★'}
                  </span>
                  <span style={{ fontSize: '11px', color: riskColor, fontWeight: 600, background: `${riskColor}15`, padding: '2px 6px', borderRadius: '4px' }}>
                    {alt.risk_level} RISK
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: '#9aa0b9' }}>
                  <div>
                    Cost Premium: <span style={{ color: '#fff', fontWeight: 500 }}>+{alt.cost_delta_pct}%</span>
                  </div>
                  <div>
                    Lead Time: <span style={{ color: '#fff', fontWeight: 500 }}>{alt.lead_time_days} days</span>
                  </div>
                </div>

                {alt.components_covered && alt.components_covered.length > 0 && (
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Covers: {alt.components_covered.join(', ')}
                  </div>
                )}

                {alt.regulatory_flags && alt.regulatory_flags.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#ff6c00' }}>
                    <AlertTriangle size={12} /> Flags: {alt.regulatory_flags.join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
