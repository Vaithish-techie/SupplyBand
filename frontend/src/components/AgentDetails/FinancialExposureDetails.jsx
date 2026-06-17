import React from 'react';
import { DollarSign, Percent, AlertCircle } from 'lucide-react';

export default function FinancialExposureDetails({ findings }) {
  if (!findings) return null;

  const formatUSD = (val) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val}`;
  };

  const maxRisk = Math.max(
    findings.week1_risk_usd || 1, 
    findings.week3_risk_usd || 1, 
    findings.week6_risk_usd || 1
  );

  const riskBars = [
    { label: 'Week 1', val: findings.week1_risk_usd, pct: ((findings.week1_risk_usd || 0) / maxRisk) * 100, color: '#ffd000' },
    { label: 'Week 3', val: findings.week3_risk_usd, pct: ((findings.week3_risk_usd || 0) / maxRisk) * 100, color: '#ff6c00' },
    { label: 'Week 6', val: findings.week6_risk_usd, pct: ((findings.week6_risk_usd || 0) / maxRisk) * 100, color: '#ff007a' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Margin Impact Callout */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        background: 'linear-gradient(135deg, rgba(255, 0, 122, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)', 
        padding: '12px', 
        borderRadius: '10px',
        border: '1px solid rgba(255, 0, 122, 0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Percent size={18} style={{ color: '#ff007a' }} />
          <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>Margin Impact</span>
        </div>
        <span style={{ fontSize: '20px', fontWeight: 800, color: '#ff007a', fontFamily: 'var(--font-display)' }}>
          -{findings.margin_impact_pct}%
        </span>
      </div>

      {/* Escalating Risk Curve */}
      <div>
        <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '10px' }}>
          Cumulative Revenue at Risk (USD)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {riskBars.map((bar, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#9aa0b9', fontWeight: 500 }}>{bar.label}</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>{formatUSD(bar.val || 0)}</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${bar.pct}%`, 
                  height: '100%', 
                  backgroundColor: bar.color,
                  boxShadow: `0 0 8px ${bar.color}aa`,
                  transition: 'width 0.8s ease'
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue At Risk Products */}
      {findings.revenue_at_risk_products && findings.revenue_at_risk_products.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertCircle size={12} style={{ color: '#ffd000' }} /> Impacted Product Lines
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {findings.revenue_at_risk_products.map((prod, idx) => (
              <span key={idx} style={{
                fontSize: '12px',
                background: 'rgba(255, 208, 0, 0.05)',
                border: '1px solid rgba(255, 208, 0, 0.15)',
                padding: '3px 8px',
                borderRadius: '6px',
                color: '#ffe585'
              }}>
                {prod}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
