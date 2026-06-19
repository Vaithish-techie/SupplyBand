import { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, AlertTriangle, Info, CheckCircle, ArrowRight, Activity, DollarSign, Scale, Truck, TrendingUp, Target, Clock, AlertOctagon } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, ScatterChart, Scatter, ZAxis, Cell } from 'recharts';
import './ExecutiveBriefScreen.css';

const API_BASE = 'http://localhost:8000';

export default function ExecutiveBriefScreen({ caseId, onBack }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [decision, setDecision] = useState(null);
  
  // Data State
  const [kpiData, setKpiData] = useState({});
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
              ...m,
              ...parsed,
              raw_content: m.content,
              timestamp: parsed.timestamp || m.inserted_at || new Date().toISOString()
            };
          });
          
          const briefMsg = fetchedMsgs.find(m => m.parsed?.agent === 'coordinator' && m.parsed?.phase === 'executive_brief');
          const altMsg = fetchedMsgs.find(m => m.parsed?.agent === 'alt_sourcing');
          const finMsg = fetchedMsgs.find(m => m.parsed?.agent === 'financial_exposure');
          const supMsg = fetchedMsgs.find(m => m.parsed?.agent === 'supplier_impact');
          const regMsg = fetchedMsgs.find(m => m.parsed?.agent === 'regulatory_trade');
          
          if (briefMsg && briefMsg.parsed) {
            setBrief(briefMsg.parsed);
            
            // 1. KPI Ribbon Data
            setKpiData({
              totalRisk: finMsg?.parsed?.findings?.week6_risk_usd || 0,
              marginImpact: finMsg?.parsed?.findings?.margin_impact_pct || 0,
              tier1: supMsg?.parsed?.findings?.affected_tier1 || 0,
              bufferDays: supMsg?.parsed?.findings?.inventory_buffer_days || 0
            });

            // 2. Financial Projection
            if (finMsg && finMsg.parsed?.findings) {
              const f = finMsg.parsed.findings;
              setFinancialData([
                { name: 'Week 1', risk: f.week1_risk_usd || 0 },
                { name: 'Week 3', risk: f.week3_risk_usd || 0 },
                { name: 'Week 6', risk: f.week6_risk_usd || 0 }
              ]);
            }

            // 3. Advanced Sourcing Matrix
            if (altMsg && altMsg.parsed?.findings?.alternatives) {
              const alts = altMsg.parsed.findings.alternatives;
              setAltChartData(alts.map(alt => ({
                name: alt.supplier,
                costDelta: alt.cost_delta_pct,
                leadTime: alt.lead_time_days,
                z: 100 // bubble size
              })));
            }

            // 4. Compliance Tracker
            if (regMsg && regMsg.parsed?.findings) {
              setComplianceData(regMsg.parsed.findings);
            }

          } else {
            setError("Executive brief not found for this case.");
          }
        }
      } catch (err) {
        if (isMounted) setError("Failed to load the executive brief.");
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
      console.error("Failed to post decision", e);
    }
  };

  if (loading) {
    return (
      <div className="brief-screen loading">
        <Activity className="processing-indicator" size={48} />
        <p>Synthesizing Executive Brief...</p>
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="brief-screen error">
        <h2>{error || "Brief not available"}</h2>
        <button className="glass-button" onClick={onBack}>Go Back</button>
      </div>
    );
  }

  const getSeverityColor = (sev) => {
    switch (sev?.toUpperCase()) {
      case 'CRITICAL': return '#EF4444';
      case 'HIGH': return '#F59E0B';
      case 'MEDIUM': return '#8B85FF';
      case 'LOW': return '#10B981';
      default: return '#8E98B0';
    }
  };

  const formatCurrency = (val) => {
    if (!val) return '$0';
    return val >= 1e6 ? `$${(val / 1e6).toFixed(1)}M` : `$${val.toLocaleString()}`;
  };

  const COLORS = ['#8B85FF', '#10B981', '#F59E0B', '#EF4444'];

  return (
    <div className="brief-screen animate-fade-in" style={{ maxWidth: '1600px', width: '100%' }}>
      {/* Premium Dashboard Header */}
      <header className="brief-header glass-panel" style={{ padding: '2rem', marginBottom: '2rem', borderBottom: 'none' }}>
        <div className="header-top" style={{ marginBottom: '1.5rem' }}>
          <div className="case-badge" style={{ fontSize: '0.9rem', padding: '8px 16px' }}>INVESTIGATION: {caseId}</div>
          <button className="glass-button small" onClick={onBack}>← Back to Dashboard</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>Executive Summary</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1.1rem' }}>Synthesized intelligence from 5 autonomous agents</p>
          </div>
          <div className="brief-verdict" style={{ 
            backgroundColor: getSeverityColor(brief.severity) + '1A', 
            color: getSeverityColor(brief.severity), 
            borderColor: getSeverityColor(brief.severity) + '40',
            fontSize: '1.1rem',
            padding: '12px 24px',
            borderWidth: '2px',
            textTransform: 'uppercase'
          }}>
            SYSTEM VERDICT: {brief.verdict?.replace(/_/g, ' ')}
          </div>
        </div>
      </header>

      {/* 1. Top KPI Ribbon */}
      <div className="kpi-ribbon" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="glass-panel kpi-card">
          <div className="kpi-icon-wrapper text-cyan"><DollarSign size={24} /></div>
          <div className="kpi-data">
            <span className="kpi-label">TOTAL FINANCIAL RISK</span>
            <span className="kpi-value text-cyan">{formatCurrency(kpiData.totalRisk)}</span>
          </div>
        </div>
        <div className="glass-panel kpi-card">
          <div className="kpi-icon-wrapper text-orange"><TrendingUp size={24} /></div>
          <div className="kpi-data">
            <span className="kpi-label">EST. MARGIN IMPACT</span>
            <span className="kpi-value text-orange">{kpiData.marginImpact}%</span>
          </div>
        </div>
        <div className="glass-panel kpi-card">
          <div className="kpi-icon-wrapper text-red"><AlertOctagon size={24} /></div>
          <div className="kpi-data">
            <span className="kpi-label">AFFECTED TIER 1 SUPPLIERS</span>
            <span className="kpi-value text-red">{kpiData.tier1}</span>
          </div>
        </div>
        <div className="glass-panel kpi-card">
          <div className="kpi-icon-wrapper text-emerald"><Clock size={24} /></div>
          <div className="kpi-data">
            <span className="kpi-label">INVENTORY BUFFER</span>
            <span className="kpi-value text-emerald">{kpiData.bufferDays} Days</span>
          </div>
        </div>
      </div>

      {/* Main Content Layout (Full Width) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
        
        {/* Situation Overview & Actions */}
        <div className="glass-panel" style={{ padding: '2.5rem' }}>
          <div className="section-header" style={{ marginBottom: '1.5rem' }}>
            <Activity size={28} color={getSeverityColor(brief.severity)} />
            <h2>Situation Overview & Recommended Actions</h2>
          </div>
          <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1.5', minWidth: '400px' }}>
              <p className="summary-text" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', fontSize: '1.15rem' }}>{brief.situation_summary}</p>
            </div>
            <div style={{ flex: '1', minWidth: '300px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-main)', fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>IMMEDIATE ACTION REQUIRED</h3>
              <ul className="action-list">
                {brief.top_3_actions?.map((action, idx) => (
                  <li key={idx}>
                    <ArrowRight size={18} className="action-icon" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Charts Row: Financial Risk & Sourcing Matrix */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2.5rem' }}>
          {/* 2. Expanded Financial Projection */}
          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
            <div className="section-header" style={{ marginBottom: '1.5rem' }}>
              <TrendingUp size={24} color="#EF4444" />
              <h2>Financial Risk Progression (6-Week Cascade)</h2>
            </div>
            <div style={{ width: '100%', height: '350px' }}>
              <ResponsiveContainer>
                <LineChart data={financialData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="name" stroke="#8E98B0" tick={{ fill: '#8E98B0' }} tickMargin={10} />
                  <YAxis stroke="#8E98B0" tickFormatter={(value) => `$${(value / 1000000)}M`} tick={{ fill: '#8E98B0' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(10, 12, 16, 0.95)', borderColor: 'var(--border-color)', color: '#fff', borderRadius: '8px' }}
                    formatter={(value) => [`$${(value / 1000000).toFixed(2)}M`, 'Revenue at Risk']}
                  />
                  <Line type="monotone" dataKey="risk" stroke="#EF4444" strokeWidth={4} activeDot={{ r: 8, strokeWidth: 0, fill: '#EF4444' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. Advanced Sourcing Matrix */}
          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
            <div className="section-header" style={{ marginBottom: '1.5rem' }}>
              <Target size={24} color="#00E5FF" />
              <h2>Sourcing Matrix: Cost Delta vs. Lead Time</h2>
            </div>
            <div style={{ width: '100%', height: '350px' }}>
              {altChartData.length > 0 ? (
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis type="number" dataKey="leadTime" name="Lead Time" unit=" Days" stroke="#8E98B0" label={{ value: 'Lead Time (Days)', position: 'insideBottom', offset: -10, fill: '#8E98B0' }} />
                    <YAxis type="number" dataKey="costDelta" name="Cost Delta" unit="%" stroke="#8E98B0" label={{ value: 'Cost Increase (%)', angle: -90, position: 'insideLeft', fill: '#8E98B0' }} />
                    <ZAxis type="number" dataKey="z" range={[100, 400]} />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }} 
                      contentStyle={{ backgroundColor: 'rgba(10, 12, 16, 0.95)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                      formatter={(val, name, props) => {
                        if (name === 'Lead Time') return [val + ' Days', name];
                        if (name === 'Cost Delta') return ['+' + val + '%', name];
                        return [val, name];
                      }}
                      labelFormatter={() => ''}
                    />
                    <Scatter name="Suppliers" data={altChartData} fill="#00E5FF">
                      {altChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  No alternative sourcing data available.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4. Compliance & Regulatory Tracker */}
        {complianceData && (
          <div className="glass-panel" style={{ padding: '2.5rem' }}>
            <div className="section-header" style={{ marginBottom: '2rem' }}>
              <Scale size={28} color="#8B85FF" />
              <h2>Compliance & Regulatory Checklist</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
              <div className="compliance-stat">
                <span className="comp-label">FORCE MAJEURE STATUS</span>
                <span className="comp-value" style={{ color: complianceData.force_majeure_applicable ? '#10B981' : '#8E98B0' }}>
                  {complianceData.force_majeure_applicable ? 'APPLICABLE - PREPARE FILING' : 'NOT APPLICABLE'}
                </span>
              </div>
              <div className="compliance-stat">
                <span className="comp-label">INSURER NOTIFICATION DEADLINE</span>
                <span className="comp-value text-orange">
                  {complianceData.insurer_notify_deadline_hours ? `${complianceData.insurer_notify_deadline_hours} HOURS` : 'N/A'}
                </span>
              </div>
              <div className="compliance-stat">
                <span className="comp-label">TARIFF IMPLICATIONS</span>
                <span className="comp-value" style={{ textTransform: 'uppercase', color: complianceData.tariff_implications === 'major' ? '#EF4444' : '#F59E0B' }}>
                  {complianceData.tariff_implications || 'NONE'}
                </span>
              </div>
              <div className="compliance-stat">
                <span className="comp-label">EXPORT CONTROLS</span>
                <span className="comp-value">
                  {complianceData.export_controls?.length ? complianceData.export_controls.join(', ') : 'CLEAR'}
                </span>
              </div>
            </div>
            
            {complianceData.compliance_actions?.length > 0 && (
              <div style={{ backgroundColor: 'rgba(139, 133, 255, 0.05)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(139, 133, 255, 0.2)' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#8B85FF', fontFamily: 'var(--font-mono)' }}>REQUIRED LEGAL ACTIONS</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {complianceData.compliance_actions.map((act, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)' }}>
                      <div style={{ width: '18px', height: '18px', border: '2px solid #8B85FF', borderRadius: '3px' }}></div>
                      {act}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Action Footer */}
        <div className="brief-footer glass-panel" style={{ padding: '2.5rem', textAlign: 'center' }}>
          {decision ? (
            <div className="decision-feedback animate-fade-in" style={{ justifyContent: 'center', margin: '0 auto', fontSize: '1.2rem' }}>
              <CheckCircle size={32} color="#00e676" />
              <h2>RESOLUTION LOGGED: {decision.toUpperCase()}</h2>
            </div>
          ) : (
            <div className="decision-actions" style={{ flexDirection: 'column', gap: '1.5rem' }}>
              <h2>Final Approval Workflow</h2>
              <div className="action-buttons" style={{ justifyContent: 'center', gap: '2rem' }}>
                <button 
                  className="glass-button btn-approve" 
                  onClick={() => handleDecision('approve')}
                  style={{ padding: '1rem 3rem', fontSize: '1.1rem' }}
                >
                  APPROVE RESOLUTION
                </button>
                <button 
                  className="glass-button btn-escalate" 
                  onClick={() => handleDecision('escalate')}
                  style={{ padding: '1rem 3rem', fontSize: '1.1rem' }}
                >
                  ESCALATE TO VP
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
