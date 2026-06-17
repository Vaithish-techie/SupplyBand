import React from 'react';
import { AlertTriangle, MapPin, Calendar, Layers, Activity } from 'lucide-react';

export default function EventIntelDetails({ findings }) {
  if (!findings) return null;

  const severityColors = {
    CRITICAL: '#ff007a',
    HIGH: '#ff6c00',
    MEDIUM: '#ffd000',
    LOW: '#05f3ad',
  };

  const severityGlow = {
    CRITICAL: 'rgba(255, 0, 122, 0.2)',
    HIGH: 'rgba(255, 108, 0, 0.2)',
    MEDIUM: 'rgba(255, 208, 0, 0.2)',
    LOW: 'rgba(5, 243, 173, 0.2)',
  };

  const sevColor = severityColors[findings.severity] || '#fff';
  const glowColor = severityGlow[findings.severity] || 'rgba(255,255,255,0.1)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ 
          fontSize: '12px', 
          fontWeight: 600, 
          letterSpacing: '1px', 
          textTransform: 'uppercase', 
          color: sevColor,
          backgroundColor: glowColor,
          padding: '4px 10px',
          borderRadius: '4px',
          border: `1px solid ${sevColor}33`,
          boxShadow: `0 0 10px ${sevColor}22`
        }}>
          {findings.severity} Severity
        </span>
        <span style={{ fontSize: '13px', color: '#9aa0b9', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Activity size={14} style={{ color: '#bd00ff' }} />
          {findings.event_type?.replace('_', ' ')}
        </span>
      </div>

      <div style={{ borderLeft: `3px solid ${sevColor}`, paddingLeft: '12px', margin: '4px 0' }}>
        <p style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: 500, lineHeight: 1.4 }}>
          {findings.summary}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px' }}>
          <MapPin size={16} style={{ color: '#00d2ff', marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Location</div>
            <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>{findings.location || 'N/A'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px' }}>
          <Calendar size={16} style={{ color: '#ff6c00', marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Est. Duration</div>
            <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>
              {findings.estimated_duration_weeks ? `${findings.estimated_duration_weeks} Weeks` : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {findings.affected_industries && findings.affected_industries.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Layers size={12} /> Impacted Sectors
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {findings.affected_industries.map((ind, idx) => (
              <span key={idx} style={{
                fontSize: '12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '3px 8px',
                borderRadius: '6px',
                color: '#cbd5e1'
              }}>
                {ind}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
