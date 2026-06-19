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
      const severityClass = sev === 'CRITICAL' ? 'severity-critical' : sev === 'HIGH' ? 'severity-high' : sev === 'MEDIUM' ? 'severity-medium' : 'severity-low';
      return (
        <div className="custom-findings">
          {f.severity && <span className={`severity-badge ${severityClass}`}>{sev}</span>}
          <div className="telemetry-grid">
            <div className="telemetry-item">
              <span className="tel-label">EVENT TYPE</span>
              <span className="tel-value">{f.event_type || 'Unknown'}</span>
            </div>
            <div className="telemetry-item">
              <span className="tel-label">LOCATION</span>
              <span className="tel-value">{f.location || 'Unknown'}</span>
            </div>
            <div className="telemetry-item">
              <span className="tel-label">EST. DURATION</span>
              <span className="tel-value">{f.estimated_duration_weeks || 0} Weeks</span>
            </div>
          </div>
          {f.summary && (
            <p className="tel-summary">
              {f.summary}
            </p>
          )}
        </div>
      );
    }

    if (msg.agent === 'supplier_impact') {
      const f = msg.findings;
      const sev = f.severity ? f.severity.toUpperCase() : 'UNKNOWN';
      const severityClass = sev === 'CRITICAL' ? 'severity-critical' : sev === 'HIGH' ? 'severity-high' : sev === 'MEDIUM' ? 'severity-medium' : 'severity-low';
      return (
        <div className="custom-findings">
          {f.severity && <span className={`severity-badge ${severityClass}`}>{sev}</span>}
          
          <div className="telemetry-grid">
            <div className="telemetry-itemHighlight">
              <span className="tel-value">{f.affected_tier1 || 0}</span>
              <span className="tel-label">TIER 1 AFFECTED</span>
            </div>
            <div className="telemetry-itemHighlight">
              <span className="tel-value">{f.affected_tier2 || 0}</span>
              <span className="tel-label">TIER 2 AFFECTED</span>
            </div>
          </div>

          {f.affected_components && f.affected_components.length > 0 && (
            <div className="impact-components">
              <strong>Exposed Components</strong>
              <div className="component-tag-list">
                {f.affected_components.map((c, i) => (
                  <span key={i} className="component-tag">{c}</span>
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
          <div className="telemetry-grid">
            <div className="telemetry-itemHighlight text-cyan">
              <span className="tel-value">{formatCurrency(f.week6_risk_usd)}</span>
              <span className="tel-label">WEEK 6 MAX RISK</span>
            </div>
            <div className="telemetry-itemHighlight text-orange">
              <span className="tel-value">{f.margin_impact_pct || 0}%</span>
              <span className="tel-label">MARGIN IMPACT</span>
            </div>
          </div>
        </div>
      );
    }

    if (msg.agent === 'regulatory_trade') {
      const f = msg.findings;
      return (
        <div className="custom-findings">
          <div className="telemetry-grid">
            <div className="telemetry-item">
              <span className="tel-label">FORCE MAJEURE</span>
              <span className="tel-value">{f.force_majeure_applicable ? "Applicable" : "Not Applicable"}</span>
            </div>
            <div className="telemetry-item">
              <span className="tel-label">INSURER DEADLINE</span>
              <span className="tel-value">{f.insurer_notify_deadline_hours || 'N/A'} Hrs</span>
            </div>
            <div className="telemetry-item">
              <span className="tel-label">TARIFF IMPACT</span>
              <span className="tel-value" style={{ textTransform: 'capitalize' }}>{f.tariff_implications || 'None'}</span>
            </div>
          </div>
          
          {f.compliance_actions && f.compliance_actions.length > 0 && (
            <div className="impact-components">
              <strong>Compliance Workflow Actions</strong>
              <ul className="compliance-action-list">
                {f.compliance_actions.map((act, i) => (
                  <li key={i}>{act}</li>
                ))}
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
          <div className="sourcing-recommendation-card">
            <span className="rec-badge">STRATEGIC RECOMMENDATION</span>
            <h4>{f.recommended || 'None found'}</h4>
            {f.recommendation_reason && <p className="rec-reason">{f.recommendation_reason}</p>}
          </div>

          {f.alternatives && f.alternatives.length > 0 && (
            <div className="impact-components" style={{ marginTop: '16px' }}>
              <strong>Ranked Substitutes</strong>
              <div className="alternatives-table">
                {f.alternatives.map((alt, i) => (
                  <div key={i} className="alt-row">
                    <span className="alt-name">{alt.supplier}</span>
                    <span className="alt-cost">+{alt.cost_delta_pct}% cost</span>
                    <span className="alt-lead">{alt.lead_time_days}d Lead</span>
                  </div>
                ))}
              </div>
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
                    <p style={{ color: 'var(--accent-cyan)', marginBottom: '8px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>INCOMING DISRUPTION INTEL</p>
                    <p style={{ color: 'var(--text-main)', lineHeight: '1.5', fontSize: '0.9rem' }}>
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
                        <strong>FLAGS:</strong> {msg.flags.join(', ')}
                      </div>
                    )}
                    {msg.status === 'error' || msg.status === 'insufficient_data' || msg.status === 'escalate' ? (
                      <div className="log-error-state">STATUS: {msg.status.toUpperCase()}</div>
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
