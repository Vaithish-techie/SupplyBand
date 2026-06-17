import React from 'react';
import { Gavel, Clock, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function RegulatoryDetails({ findings }) {
  if (!findings) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Force Majeure & Tariff Indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ 
          background: 'rgba(255,255,255,0.02)', 
          padding: '10px', 
          borderRadius: '8px', 
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px'
        }}>
          <ShieldCheck size={18} style={{ color: findings.force_majeure_applicable ? '#05f3ad' : '#64748b' }} />
          <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Force Majeure</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: findings.force_majeure_applicable ? '#05f3ad' : '#9aa0b9' }}>
            {findings.force_majeure_applicable ? 'APPLICABLE' : 'NOT APPLICABLE'}
          </span>
        </div>

        <div style={{ 
          background: 'rgba(255,255,255,0.02)', 
          padding: '10px', 
          borderRadius: '8px', 
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px'
        }}>
          <Gavel size={18} style={{ color: '#00d2ff' }} />
          <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Tariff Impact</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#00d2ff', textTransform: 'uppercase' }}>
            {findings.tariff_implications || 'UNKNOWN'}
          </span>
        </div>
      </div>

      {/* Insurer Notification Deadline */}
      {findings.insurer_notify_deadline_hours && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          background: 'rgba(255, 108, 0, 0.05)',
          border: '1px solid rgba(255, 108, 0, 0.15)',
          padding: '10px 12px',
          borderRadius: '8px'
        }}>
          <Clock size={18} style={{ color: '#ff6c00' }} />
          <div>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Insurance Notice window</div>
            <div style={{ fontSize: '13px', color: '#fff', fontWeight: 500 }}>
              Must file claim within <span style={{ color: '#ff6c00', fontWeight: 600 }}>{findings.insurer_notify_deadline_hours} hours</span>
            </div>
          </div>
        </div>
      )}

      {/* Export Controls */}
      {findings.export_controls && findings.export_controls.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
            Relevant Export Controls
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {findings.export_controls.map((control, idx) => (
              <span key={idx} style={{
                fontSize: '12px',
                background: 'rgba(0, 210, 255, 0.05)',
                border: '1px solid rgba(0, 210, 255, 0.15)',
                padding: '3px 8px',
                borderRadius: '6px',
                color: '#8be5ff'
              }}>
                {control}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Compliance Action Checklists */}
      {findings.compliance_actions && findings.compliance_actions.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
            Required Compliance Actions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {findings.compliance_actions.map((act, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#e2e8f0' }}>
                <CheckCircle2 size={14} style={{ color: '#05f3ad', marginTop: '3px', flexShrink: 0 }} />
                <span>{act}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
