import { useEffect, useRef } from 'react';

export default function LiveLog({ messages }) {
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sortedMsgs = [...messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const renderFindings = (msg) => {
    if (!msg.findings) return null;

    if (msg.agent === 'event_intelligence') {
      const f = msg.findings;
      const sev = f.severity ? f.severity.toUpperCase() : 'UNKNOWN';
      const severityClass = sev === 'HIGH' || sev === 'CRITICAL' ? 'severity-high' : sev === 'MEDIUM' ? 'severity-medium' : 'severity-low';
      return (
        <div className="custom-findings">
          {f.severity && <span className={`severity-badge ${severityClass}`}>{sev}</span>}
          <div className="impact-components">
            <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
              <li style={{ marginBottom: '4px' }}><strong>Type:</strong> {f.event_type || 'Unknown'}</li>
              <li style={{ marginBottom: '4px' }}><strong>Location:</strong> {f.location || 'Unknown'}</li>
              <li style={{ marginBottom: '4px' }}><strong>Duration:</strong> {f.estimated_duration_weeks || 0} weeks</li>
            </ul>
          </div>
          {f.summary && (
            <p style={{ marginTop: '12px', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
              {f.summary}
            </p>
          )}
        </div>
      );
    }

    if (msg.agent === 'supplier_impact') {
      const f = msg.findings;
      const sev = f.severity ? f.severity.toUpperCase() : 'UNKNOWN';
      const severityClass = sev === 'HIGH' || sev === 'CRITICAL' ? 'severity-high' : sev === 'MEDIUM' ? 'severity-medium' : 'severity-low';
      return (
        <div className="custom-findings">
          {f.severity && <span className={`severity-badge ${severityClass}`}>{sev}</span>}
          <div className="impact-stats">
            <div>Tier 1 Affected: <strong>{f.affected_tier1 || 0}</strong></div>
            <div>Tier 2 Affected: <strong>{f.affected_tier2 || 0}</strong></div>
          </div>
          {f.affected_components && f.affected_components.length > 0 && (
            <div className="impact-components">
              <strong>Components:</strong>
              <ul>
                {f.affected_components.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
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
            <strong>Week 6 Risk:</strong> {formatCurrency(f.week6_risk_usd)}
          </div>
          <div className="finance-stat">
            <strong>Margin Impact:</strong> {f.margin_impact_pct || 0}%
          </div>
        </div>
      );
    }

    if (msg.agent === 'regulatory_trade') {
      const f = msg.findings;
      return (
        <div className="custom-findings">
          <div className="impact-components">
            <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
              <li style={{ marginBottom: '4px' }}><strong>Force Majeure:</strong> {f.force_majeure_applicable ? "Applicable" : "Not Applicable"}</li>
              <li style={{ marginBottom: '4px' }}><strong>Insurer Deadline:</strong> {f.insurer_notify_deadline_hours || 'N/A'} hrs</li>
              <li style={{ marginBottom: '4px' }}><strong>Tariffs:</strong> {f.tariff_implications || 'None'}</li>
            </ul>
          </div>
          {f.compliance_actions && f.compliance_actions.length > 0 && (
            <div className="impact-components" style={{ marginTop: '8px' }}>
              <strong>Required Actions:</strong>
              <ul style={{ paddingLeft: '20px', marginTop: '4px', fontSize: '0.9rem' }}>
                {f.compliance_actions.map((act, i) => <li key={i}>{act}</li>)}
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
            <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>Recommended: </span>
            {f.recommended || 'None found'}
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
            {f.recommendation_reason || ''}
          </p>
          {f.alternatives && f.alternatives.length > 0 && (
            <div className="impact-components">
              <strong>Top Alternatives:</strong>
              <ul style={{ paddingLeft: '20px', marginTop: '4px', fontSize: '0.9rem' }}>
                {f.alternatives.map((alt, i) => (
                  <li key={i}>
                    {alt.supplier} (+{alt.cost_delta_pct}% cost, {alt.lead_time_days} days)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="log-findings">
        <em>Complex data processed successfully.</em>
      </div>
    );
  };

  return (
    <div className="live-log-container">
      <h3>Live Intelligence Feed</h3>
      <div className="log-scroll">
        {sortedMsgs.length === 0 ? (
          <div className="log-empty">Waiting for agent activity...</div>
        ) : (
          sortedMsgs.map((msg, idx) => (
            <div key={idx} className={`log-entry status-${msg.status || 'unknown'}`}>
              <div className="log-header">
                <span className="log-agent">{msg.agent || 'Unknown Agent'}</span>
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
                    <p style={{ color: 'var(--accent-cyan)', marginBottom: '8px', fontWeight: 'bold' }}>Incoming Alert</p>
                    <p style={{ color: 'var(--text-main)', lineHeight: '1.5' }}>
                      {(msg.raw_content || '').replace(/@\[\[.*?\]\]/g, '').replace(/[{}[\]"]/g, '').trim()}
                    </p>
                  </div>
                ) : msg.phase === 'kickoff' ? (
                  <p><strong>Kickoff:</strong> {msg.event_text}</p>
                ) : msg.phase === 'executive_brief' ? (
                  <p><strong>Executive Brief:</strong> {msg.situation_summary}</p>
                ) : (
                  <>
                    {msg.flags && msg.flags.length > 0 && (
                      <div className="log-flags">
                        <strong>Flags:</strong> {msg.flags.join(', ')}
                      </div>
                    )}
                    {msg.status === 'error' || msg.status === 'insufficient_data' || msg.status === 'escalate' ? (
                      <div className="log-error-state">Status: {msg.status.toUpperCase()}</div>
                    ) : msg.findings ? (
                      renderFindings(msg)
                    ) : (
                      <div className="log-raw-content">
                        {msg.raw_content || 'No findings reported.'}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
