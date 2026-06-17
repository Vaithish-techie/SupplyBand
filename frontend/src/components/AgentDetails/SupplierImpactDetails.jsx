import React from 'react';
import { ShieldAlert, Package, Layers, Activity } from 'lucide-react';

export default function SupplierImpactDetails({ findings }) {
  if (!findings) return null;

  const bufferPct = Math.min(100, Math.max(0, (findings.inventory_buffer_days / 30) * 100));
  const bufferColor = findings.inventory_buffer_days < 10 
    ? '#ff007a' 
    : findings.inventory_buffer_days < 20 
      ? '#ffd000' 
      : '#05f3ad';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#ff007a', fontFamily: 'var(--font-display)' }}>
            {findings.affected_tier1}
          </div>
          <div style={{ fontSize: '11px', color: '#9aa0b9', textTransform: 'uppercase', fontWeight: 600, marginTop: '4px' }}>
            Tier-1 Suppliers Affected
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#ff6c00', fontFamily: 'var(--font-display)' }}>
            {findings.affected_tier2}
          </div>
          <div style={{ fontSize: '11px', color: '#9aa0b9', textTransform: 'uppercase', fontWeight: 600, marginTop: '4px' }}>
            Tier-2 Suppliers Affected
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
            Inventory Buffer Status
          </span>
          <span style={{ fontSize: '12px', color: bufferColor, fontWeight: 600 }}>
            {findings.inventory_buffer_days} Days Remaining
          </span>
        </div>
        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ 
            width: `${bufferPct}%`, 
            height: '100%', 
            backgroundColor: bufferColor,
            boxShadow: `0 0 10px ${bufferColor}88`,
            transition: 'width 0.8s ease'
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
          <span>Critical (&lt;10d)</span>
          <span>Moderate (10-20d)</span>
          <span>Healthy (30d+)</span>
        </div>
      </div>

      {findings.critical_path_suppliers && findings.critical_path_suppliers.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldAlert size={12} style={{ color: '#ff007a' }} /> Critical Path Suppliers
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {findings.critical_path_suppliers.map((supplier, idx) => (
              <span key={idx} style={{
                fontSize: '12px',
                background: 'rgba(255, 0, 122, 0.05)',
                border: '1px solid rgba(255, 0, 122, 0.15)',
                padding: '3px 8px',
                borderRadius: '6px',
                color: '#ff85b3'
              }}>
                {supplier}
              </span>
            ))}
          </div>
        </div>
      )}

      {findings.affected_components && findings.affected_components.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Package size={12} style={{ color: '#00d2ff' }} /> Affected Parts / Components
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {findings.affected_components.map((comp, idx) => (
              <span key={idx} style={{
                fontSize: '12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '3px 8px',
                borderRadius: '6px',
                color: '#cbd5e1'
              }}>
                {comp}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
