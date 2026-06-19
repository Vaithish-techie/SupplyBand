import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShieldAlert, CheckCircle, ArrowRight, Activity,
  DollarSign, Scale, Truck, TrendingUp, Target,
  Clock, AlertOctagon, Loader2
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, LineChart, Line, ScatterChart, Scatter,
  ZAxis, Cell, ReferenceLine, Area, AreaChart
} from 'recharts';
import './ExecutiveBriefScreen.css';

const API_BASE = 'http://localhost:8000';

/* ── custom recharts tooltip ── */
const DarkTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(10,11,16,0.97)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: '2px',
      padding: '10px 14px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.72rem',
    }}>
      {label && <div style={{ color: 'var(--text-3)', marginBottom: '6px', letterSpacing: '0.05em' }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--text)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
          {formatter ? formatter(p.value, p.name) : `${p.name}: ${p.value}`}
        </div>
      ))}
    </div>
  );
};

export default function ExecutiveBriefScreen({ caseId, onBack }) {
  const [brief, setBrief]               = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [decision, setDecision]         = useState(null);
  const [kpiData, setKpiData]           = useState({});
  const [financialData, setFinancialData] = useState([]);
  const [altChartData, setAltChartData] = useState([]);
  const [complianceData, setComplianceData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchBrief = async () => {
      try {
        const response = await axios.get(`${API_BASE}/room-messages?case_id=${caseId}`);
        if (isMounted) {
          const fetchedMsgs = (response.data.messages || []).map(m => {
            const parsed = m.parsed || {};
            return {
              ...m, ...parsed,
              raw_content: m.content,
              timestamp: parsed.timestamp || m.inserted_at || new Date().toISOString()
            };
          });

          const briefMsg = fetchedMsgs.find(m => m.parsed?.agent === 'coordinator' && m.parsed?.phase === 'executive_brief');
          const altMsg   = fetchedMsgs.find(m => m.parsed?.agent === 'alt_sourcing');
          const finMsg   = fetchedMsgs.find(m => m.parsed?.agent === 'financial_exposure');
          const supMsg   = fetchedMsgs.find(m => m.parsed?.agent === 'supplier_impact');
          const regMsg   = fetchedMsgs.find(m => m.parsed?.agent === 'regulatory_trade');

          if (briefMsg?.parsed) {
            setBrief(briefMsg.parsed);

            setKpiData({
              totalRisk:    finMsg?.parsed?.findings?.week6_risk_usd || 0,
              marginImpact: finMsg?.parsed?.findings?.margin_impact_pct || 0,
              tier1:        supMsg?.parsed?.findings?.affected_tier1 || 0,
              bufferDays:   supMsg?.parsed?.findings?.inventory_buffer_days || 0
            });

            if (finMsg?.parsed?.findings) {
              const f = finMsg.parsed.findings;
              setFinancialData([
                { name: 'Week 1', risk: f.week1_risk_usd || 0, label: 'W1' },
                { name: 'Week 3', risk: f.week3_risk_usd || 0, label: 'W3' },
                { name: 'Week 6', risk: f.week6_risk_usd || 0, label: 'W6' },
              ]);
            }

            if (altMsg?.parsed?.findings?.alternatives) {
              setAltChartData(altMsg.parsed.findings.alternatives.map(alt => ({
                name: alt.supplier,
                costDelta: alt.cost_delta_pct,
                leadTime: alt.lead_time_days,
                z: 100
              })));
            }

            if (regMsg?.parsed?.findings) setComplianceData(regMsg.parsed.findings);
          } else {
            setError('Executive brief not found for this case.');
          }
        }
      } catch {
        if (isMounted) setError('Failed to load the executive brief.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchBrief();
    return () => { isMounted = false; };
  }, [caseId]);

  const handleDecision = async (dec) => {
    try {
      await axios.post(`${API_BASE}/approve-action`, {
        case_id: caseId,
        decision: dec,
        notes: `User ${dec === 'approve' ? 'approved' : 'escalated'} from dashboard.`
      });
      setDecision(dec);
    } catch (e) {
      console.error('Failed to post decision', e);
    }
  };

  /* ── helpers ── */
  const getSeverityColor = (sev) => {
    switch (sev?.toUpperCase()) {
      case 'CRITICAL': return '#C0392B';
      case 'HIGH':     return '#D4541A';
      case 'MEDIUM':   return '#C8960A';
      case 'LOW':      return '#1A7A4A';
      default:         return '#6B6662';
    }
  };

  const formatCurrency = (val) => {
    if (!val) return '$0';
    return val >= 1e6 ? `$${(val / 1e6).toFixed(1)}M` : `$${val.toLocaleString()}`;
  };

  const SCATTER_COLORS = ['#C8960A', '#1A7A4A', '#D4541A', '#C0392B'];

  /* ── loading / error states ── */
  if (loading) {
    return (
      <div className="brief-screen loading">
        <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', color: 'var(--gold)' }} />
        <p>Synthesizing Executive Brief&nbsp;·&nbsp;{caseId}</p>
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="brief-screen error">
        <h2>{error || 'Brief not available'}</h2>
        <button className="glass-button" onClick={onBack}>← Go Back</button>
      </div>
    );
  }

  const severityColor = getSeverityColor(brief.severity);

  /* ── chart axis style ── */
  const axisStyle = { fill: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 10 };
  const gridStyle = { stroke: 'rgba(255,255,255,0.04)', strokeDasharray: '4 4' };

  return (
    <div className="brief-screen animate-fade-in">

      {/* ── HEADER ── */}
      <header className="brief-header glass-panel">
        <div className="header-top">
          <div className="case-badge">INVESTIGATION: {caseId}</div>
          <button className="glass-button small" onClick={onBack}>← Back to Dashboard</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 0.4rem 0', color: 'var(--text)' }}>
              Executive Summary
            </h1>
            <p style={{ color: 'var(--text-3)', margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Synthesized intelligence from 5 autonomous agents
            </p>
          </div>
          <div className="brief-verdict" style={{
            backgroundColor: severityColor + '18',
            color: severityColor,
            borderColor: severityColor + '45',
          }}>
            VERDICT: {brief.verdict?.replace(/_/g, ' ')}
          </div>
        </div>
      </header>

      {/* ── KPI RIBBON ── */}
      <div className="kpi-ribbon">
        {[
          { icon: <DollarSign size={20} />, label: 'Total Financial Risk',      value: formatCurrency(kpiData.totalRisk),    cls: 'text-cyan'    },
          { icon: <TrendingUp size={20} />, label: 'Est. Margin Impact',        value: `${kpiData.marginImpact}%`,           cls: 'text-orange'  },
          { icon: <AlertOctagon size={20}/>, label: 'Affected Tier 1 Suppliers', value: kpiData.tier1,                        cls: 'text-red'     },
          { icon: <Clock size={20} />,      label: 'Inventory Buffer',          value: `${kpiData.bufferDays} Days`,         cls: 'text-emerald' },
        ].map((kpi, i) => (
          <div key={i} className="kpi-card glass-panel">
            <div className={`kpi-icon-wrapper ${kpi.cls}`}>{kpi.icon}</div>
            <div className="kpi-data">
              <span className="kpi-label">{kpi.label}</span>
              <span className={`kpi-value ${kpi.cls}`}>{kpi.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── SITUATION + ACTIONS ── */}
      <div className="brief-section glass-panel">
        <div className="section-header">
          <Activity size={22} color={severityColor} />
          <h2>Situation Overview &amp; Recommended Actions</h2>
        </div>
        <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1.6', minWidth: '360px' }}>
            <p className="summary-text">{brief.situation_summary}</p>
          </div>
          <div style={{
            flex: '1', minWidth: '280px',
            background: 'rgba(255,255,255,0.015)',
            padding: '1.6rem',
            borderRadius: '2px',
            border: '1px solid var(--border)',
          }}>
            <h3 style={{
              margin: '0 0 1.2rem 0',
              color: 'var(--text-3)',
              fontSize: '0.65rem',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}>
              Immediate Actions Required
            </h3>
            <ul className="action-list">
              {brief.top_3_actions?.map((action, idx) => (
                <li key={idx}>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── CHARTS ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderTop: 'none' }}>

        {/* Financial Risk Cascade */}
        <div className="brief-section" style={{ borderRight: 'none', borderLeft: 'none', borderBottom: 'none' }}>
          <div className="section-header">
            <TrendingUp size={20} color="#C0392B" />
            <h2>Financial Risk Cascade (6-Week)</h2>
          </div>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer>
              <AreaChart data={financialData} margin={{ top: 16, right: 20, left: 10, bottom: 8 }}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#C0392B" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#C0392B" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridStyle} vertical={false} />
                <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} tickMargin={10} />
                <YAxis
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `$${(v / 1e6).toFixed(0)}M`}
                />
                <Tooltip
                  content={<DarkTooltip formatter={(v) => formatCurrency(v)} />}
                />
                <Area
                  type="monotone"
                  dataKey="risk"
                  stroke="#C0392B"
                  strokeWidth={2.5}
                  fill="url(#riskGrad)"
                  dot={{ r: 5, fill: '#C0392B', strokeWidth: 0 }}
                  activeDot={{ r: 8, fill: '#C0392B', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sourcing Matrix */}
        <div className="brief-section" style={{ borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}>
          <div className="section-header">
            <Target size={20} color="var(--gold)" />
            <h2>Sourcing Matrix: Cost vs. Lead Time</h2>
          </div>
          <div style={{ width: '100%', height: '300px' }}>
            {altChartData.length > 0 ? (
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 16, right: 20, bottom: 24, left: 10 }}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis
                    type="number" dataKey="leadTime" name="Lead Time" unit=" d"
                    tick={axisStyle} axisLine={false} tickLine={false}
                    label={{ value: 'Lead Time (days)', position: 'insideBottom', offset: -12, style: axisStyle }}
                  />
                  <YAxis
                    type="number" dataKey="costDelta" name="Cost Δ" unit="%"
                    tick={axisStyle} axisLine={false} tickLine={false}
                    label={{ value: 'Cost Increase (%)', angle: -90, position: 'insideLeft', style: axisStyle }}
                  />
                  <ZAxis type="number" dataKey="z" range={[120, 360]} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3', stroke: 'var(--border-mid)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div style={{
                          background: 'rgba(10,11,16,0.97)',
                          border: '1px solid rgba(255,255,255,0.10)',
                          borderRadius: '2px',
                          padding: '10px 14px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.72rem',
                          color: 'var(--text)',
                        }}>
                          <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--gold)' }}>{d.name}</div>
                          <div style={{ color: 'var(--text-2)' }}>Lead Time: {d.leadTime} days</div>
                          <div style={{ color: 'var(--text-2)' }}>Cost Delta: +{d.costDelta}%</div>
                        </div>
                      );
                    }}
                  />
                  <Scatter name="Suppliers" data={altChartData}>
                    {altChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={SCATTER_COLORS[index % SCATTER_COLORS.length]} fillOpacity={0.85} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                No alternative sourcing data available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── COMPLIANCE SECTION ── */}
      {complianceData && (
        <div className="brief-section glass-panel" style={{ borderTop: 'none' }}>
          <div className="section-header">
            <Scale size={22} color="#5B4FBD" />
            <h2>Compliance &amp; Regulatory Checklist</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.4rem' }}>
            <div className="compliance-stat">
              <span className="comp-label">Force Majeure Status</span>
              <span className="comp-value" style={{ color: complianceData.force_majeure_applicable ? 'var(--green-bright)' : 'var(--text-3)' }}>
                {complianceData.force_majeure_applicable ? 'APPLICABLE — PREPARE FILING' : 'NOT APPLICABLE'}
              </span>
            </div>
            <div className="compliance-stat">
              <span className="comp-label">Insurer Notification Deadline</span>
              <span className="comp-value" style={{ color: 'var(--orange)' }}>
                {complianceData.insurer_notify_deadline_hours ? `${complianceData.insurer_notify_deadline_hours} HOURS` : 'N/A'}
              </span>
            </div>
            <div className="compliance-stat">
              <span className="comp-label">Tariff Implications</span>
              <span className="comp-value" style={{ textTransform: 'uppercase', color: complianceData.tariff_implications === 'major' ? '#E05A4A' : 'var(--orange)' }}>
                {complianceData.tariff_implications || 'NONE'}
              </span>
            </div>
            <div className="compliance-stat">
              <span className="comp-label">Export Controls</span>
              <span className="comp-value">
                {complianceData.export_controls?.length ? complianceData.export_controls.join(', ') : 'CLEAR'}
              </span>
            </div>
          </div>

          {complianceData.compliance_actions?.length > 0 && (
            <div className="required-actions-box">
              <h4>Required Legal Actions</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                {complianceData.compliance_actions.map((act, i) => (
                  <div key={i} className="legal-action-item">
                    <div className="legal-action-checkbox" />
                    {act}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DECISION FOOTER ── */}
      <div className="brief-footer glass-panel" style={{ borderTop: 'none' }}>
        {decision ? (
          <div className="decision-feedback animate-fade-in" style={{ justifyContent: 'center', margin: '0 auto' }}>
            <CheckCircle size={28} color="var(--green-bright)" />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Resolution Logged: {decision.toUpperCase()}
            </h2>
          </div>
        ) : (
          <div className="decision-actions">
            <h2>Final Approval Workflow</h2>
            <div className="action-buttons">
              <button
                className="glass-button btn-approve"
                onClick={() => handleDecision('approve')}
                style={{ padding: '0.9rem 2.6rem', fontSize: '0.82rem', letterSpacing: '0.1em' }}
              >
                APPROVE RESOLUTION
              </button>
              <button
                className="glass-button btn-escalate"
                onClick={() => handleDecision('escalate')}
                style={{ padding: '0.9rem 2.6rem', fontSize: '0.82rem', letterSpacing: '0.1em' }}
              >
                ESCALATE TO VP
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
