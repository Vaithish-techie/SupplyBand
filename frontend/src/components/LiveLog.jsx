import { useEffect, useRef } from 'react';

export default function LiveLog({ messages }) {
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sortedMsgs = [...messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const formatAgentName = (name) => {
    if (!name) return 'Unknown';
    return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const renderFindings = (msg) => {
    if (!msg.findings) return null;

    if (msg.agent === 'event_intelligence') {
      const f = msg.findings;
      const sev = f.severity ? f.severity.toUpperCase() : 'UNKNOWN';
      const sevClass = sev === 'HIGH' || sev === 'CRITICAL' ? 'danger' : sev === 'MEDIUM' ? 'warning' : 'success';
      return (
        <div className="custom-findings">
          {f.severity && <span className={`tag ${sevClass}`}>{sev}</span>}
          <div className="impact-components" style={{ marginTop: '10px' }}>
            <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
              <li style={{ marginBottom: '4px' }}><span className="text-tertiary">Type:</span> {f.event_type || 'Unknown'}</li>
              <li style={{ marginBottom: '4px' }}><span className="text-tertiary">Location:</span> {f.location || 'Unknown'}</li>
              <li style={{ marginBottom: '4px' }}><span className="text-tertiary">Duration:</span> {f.estimated_duration_weeks || 0} weeks</li>
            </ul>
          </div>
          {f.summary && (
            <p style={{ marginTop: '10px', fontSize: 'var(--size-small)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              {f.summary}
            </p>
          )}
        </div>
      );
    }

    if (msg.agent === 'supplier_impact') {
      const f = msg.findings;
      const sev = f.severity ? f.severity.toUpperCase() : 'UNKNOWN';
      const sevClass = sev === 'HIGH' || sev === 'CRITICAL' ? 'danger' : sev === 'MEDIUM' ? 'warning' : 'success';
      return (
        <div className="custom-findings">
          {f.severity && <span className={`tag ${sevClass}`}>{sev}</span>}
          <div className="impact-stats" style={{ marginTop: '10px' }}>
            <div>Tier 1: <strong className="text-accent">{f.affected_tier1 || 0}</strong></div>
            <div>Tier 2: <strong className="text-accent">{f.affected_tier2 || 0}</strong></div>
          </div>
          {f.affected_components && f.affected_components.length > 0 && (
            <div className="impact-components">
              <span className="text-tertiary">Components:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                {f.affected_components.map((c, i) => (
                  <span key={i} className="tag">{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (msg.agent === 'financial_exposure') {
      const f = msg.findings;
      const formatCurrency = (val) => {
        if (!val) return '$0';
        return val >= 1e6 ? `$${(val / 1e6).toFixed(2)}M` : `$${val.toLocaleString()}`;
      };
      return (
        <div className="custom-findings">
          <div className="finance-stat">
            <span className="text-tertiary">Week 6 Risk:</span> <strong>{formatCurrency(f.week6_risk_usd)}</strong>
          </div>
          <div className="finance-stat">
            <span className="text-tertiary">Margin Impact:</span> <strong>{f.margin_impact_pct || 0}%</strong>
          </div>
        </div>
      );
    }

    if (msg.agent === 'regulatory_trade') {
      const f = msg.findings;
      return (
        <div className="custom-findings">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div><span className="text-tertiary">Force Majeure:</span> {f.force_majeure_applicable ? <span className="tag accent">Applicable</span> : <span className="tag">Not applicable</span>}</div>
            <div><span className="text-tertiary">Insurer deadline:</span> {f.insurer_notify_deadline_hours || 'N/A'} hrs</div>
            <div><span className="text-tertiary">Tariffs:</span> {f.tariff_implications || 'None'}</div>
          </div>
          {f.compliance_actions && f.compliance_actions.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <span className="text-tertiary" style={{ display: 'block', marginBottom: '6px' }}>Required actions:</span>
              <ul style={{ paddingLeft: '16px', fontSize: 'var(--size-small)', color: 'var(--color-text-secondary)' }}>
                {f.compliance_actions.map((act, i) => <li key={i} style={{ marginBottom: '4px' }}>{act}</li>)}
              </ul>
            </div>
          )}
        </div>
      );
    }

    if (msg.agent === 'alt_sourcing') {
      const f = msg.findings;
      return (
        <div className="custom-findings">
          <div style={{ marginBottom: '8px' }}>
            <span className="text-accent" style={{ fontWeight: '600' }}>Recommended: </span>
            {f.recommended || 'None found'}
          </div>
          {f.recommendation_reason && (
            <p style={{ fontSize: 'var(--size-small)', color: 'var(--color-text-secondary)', marginBottom: '8px', lineHeight: 1.5 }}>
              {f.recommendation_reason}
            </p>
          )}
          {f.alternatives && f.alternatives.length > 0 && (
            <div>
              <span className="text-tertiary" style={{ display: 'block', marginBottom: '6px', fontSize: 'var(--size-micro)' }}>Alternatives:</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {f.alternatives.map((alt, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-sm)' }}>
                    <strong style={{ fontSize: 'var(--size-small)' }}>{alt.supplier}</strong>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span className="tag">+{alt.cost_delta_pct}%</span>
                      <span className="tag">{alt.lead_time_days}d</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="custom-findings">
        <em className="text-tertiary">Analysis data processed.</em>
      </div>
    );
  };

  return (
    <div className="live-log-container double-bezel-outer" style={{ padding: '6px' }}>
      <div className="double-bezel-inner" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 'var(--space-md)', background: '#020203' }}>
        
        {/* Terminal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-md)', borderBottom: '1px solid var(--color-rule)', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f56', display: 'block' }}></span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e', display: 'block' }}></span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27c93f', display: 'block' }}></span>
          </div>
          <span className="font-mono text-tertiary" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginLeft: '8px' }}>
            TELEMETRY ACTIVE FEED
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-accent)', display: 'inline-block', boxShadow: '0 0 8px var(--color-accent)' }}></span>
            <span className="font-mono text-tertiary" style={{ fontSize: '9px' }}>STREAMING</span>
          </div>
        </div>

        <div className="log-scroll">
          {sortedMsgs.length === 0 ? (
            <div className="log-empty">Awaiting data stream...</div>
          ) : (
            sortedMsgs.map((msg, idx) => (
              <div key={idx} className={`log-entry status-${msg.status || 'unknown'}`}>
                <div className="log-header">
                  <span className="log-agent">{formatAgentName(msg.agent)}</span>
                  <span className="log-time">
                    {(() => {
                      const d = new Date(msg.timestamp);
                      return isNaN(d.getTime()) ? msg.timestamp : d.toLocaleTimeString();
                    })()}
                  </span>
                </div>
                <div className="log-body">
                  {msg.agent === 'human_operator' ? (
                    <div className="custom-findings" style={{ marginTop: 0 }}>
                      <p style={{ color: 'var(--color-accent)', marginBottom: '6px', fontFamily: 'var(--font-mono)', fontSize: 'var(--size-micro)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caption)' }}>Incoming alert</p>
                      <p style={{ color: 'var(--color-text-primary)', lineHeight: '1.5', fontSize: 'var(--size-small)' }}>
                        {(msg.raw_content || '').replace(/@\[\[.*?\]\]/g, '').replace(/[{}[\]"]/g, '').trim()}
                      </p>
                    </div>
                  ) : msg.phase === 'kickoff' ? (
                    <p style={{ fontSize: 'var(--size-small)' }}><strong>Kickoff:</strong> {msg.event_text}</p>
                  ) : msg.phase === 'executive_brief' ? (
                    <p style={{ fontSize: 'var(--size-small)' }}><strong>Executive brief:</strong> {msg.situation_summary}</p>
                  ) : (
                    <>
                      {msg.flags && msg.flags.length > 0 && (
                        <div className="log-flags">
                          <span className="text-warning" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--size-micro)', letterSpacing: 'var(--tracking-caption)' }}>Flags: </span>
                          {msg.flags.join(', ')}
                        </div>
                      )}
                      {msg.status === 'error' || msg.status === 'insufficient_data' || msg.status === 'escalate' ? (
                        <div className="log-error-state">Status: {msg.status.toUpperCase()}</div>
                      ) : msg.findings ? (
                        renderFindings(msg)
                      ) : (
                        <div style={{ fontSize: 'var(--size-small)', color: 'var(--color-text-tertiary)' }}>
                          {msg.raw_content || 'No findings reported.'}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
          {sortedMsgs.length > 0 && (
            <div className="font-mono" style={{ fontSize: 'var(--size-small)', color: 'var(--color-accent)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: 'var(--space-md)' }}>
              <span>$</span>
              <span className="terminal-cursor" style={{ width: '6px', height: '12px', background: 'var(--color-accent)', display: 'inline-block' }}></span>
            </div>
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
