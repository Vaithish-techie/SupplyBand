import { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, AlertTriangle, Info, CheckCircle, ArrowRight, Activity, DollarSign, Scale, Truck } from 'lucide-react';
import './ExecutiveBriefScreen.css';

const API_BASE = 'http://localhost:8000';

export default function ExecutiveBriefScreen({ caseId, onBack }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [decision, setDecision] = useState(null);
  const [alternatives, setAlternatives] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchBrief = async () => {
      try {
        const response = await axios.get(`${API_BASE}/room-messages?case_id=${caseId}`);
        if (isMounted) {
          const fetchedMsgs = response.data.messages || [];
          const briefMsg = fetchedMsgs.find(m => m.parsed?.agent === 'coordinator' && m.parsed?.phase === 'executive_brief');
          const altMsg = fetchedMsgs.find(m => m.parsed?.agent === 'alt_sourcing');
          
          if (briefMsg && briefMsg.parsed) {
            setBrief(briefMsg.parsed);
            if (altMsg && altMsg.parsed?.findings?.alternatives) {
              setAlternatives(altMsg.parsed.findings.alternatives);
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

  const getSeverityIcon = (sev) => {
    switch (sev?.toUpperCase()) {
      case 'CRITICAL': return <ShieldAlert size={28} color="#EF4444" />;
      case 'HIGH': return <AlertTriangle size={28} color="#F59E0B" />;
      case 'MEDIUM': return <Info size={28} color="#8B85FF" />;
      default: return <CheckCircle size={28} color="#10B981" />;
    }
  };

  const formatFinancials = (text) => {
    if (!text) return 'No significant financial risk reported.';
    return text.replace(/\$?\b(\d{1,3}(?:,\d{3})+)(?:\.\d+)?\b/g, (match, p1) => {
      const num = parseInt(p1.replace(/,/g, ''), 10);
      if (num >= 1e6) {
        return `$${(num / 1e6).toFixed(2)}M`;
      }
      return match;
    });
  };

  return (
    <div className="brief-screen animate-fade-in">
      <header className="brief-header">
        <div className="header-top">
          <div className="case-badge">CASE: {caseId}</div>
          <button className="glass-button small" onClick={onBack}>New Investigation</button>
        </div>
        <h1>Executive Summary</h1>
        <p className="brief-verdict" style={{ color: getSeverityColor(brief.severity), fontWeight: 'bold' }}>
          VERDICT: {brief.verdict?.replace(/_/g, ' ')}
        </p>
      </header>

      <div className="brief-grid">
        <div className="glass-panel brief-main">
          <div className="section-header">
            {getSeverityIcon(brief.severity)}
            <h2>Situation Overview</h2>
            <span className="severity-badge" style={{ backgroundColor: getSeverityColor(brief.severity) + '33', color: getSeverityColor(brief.severity), border: `1px solid ${getSeverityColor(brief.severity)}` }}>
              {brief.severity} SEVERITY
            </span>
          </div>
          <p className="summary-text" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{brief.situation_summary}</p>
        </div>

        <div className="glass-panel brief-actions">
          <h2>Top Recommended Actions</h2>
          <ul className="action-list">
            {brief.top_3_actions?.map((action, idx) => (
              <li key={idx}>
                <ArrowRight size={18} className="action-icon" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-panel brief-card">
          <div className="card-icon"><DollarSign size={24} /></div>
          <h3>Financial Exposure</h3>
          <p>{formatFinancials(brief.financial_exposure)}</p>
        </div>

        <div className="glass-panel brief-card">
          <div className="card-icon"><Scale size={24} /></div>
          <h3>Regulatory & Compliance</h3>
          <p>{brief.compliance_deadline || 'No immediate compliance actions required.'}</p>
        </div>

        <div className="glass-panel brief-card">
          <div className="card-icon"><Truck size={24} /></div>
          <h3>Sourcing Recommendation</h3>
          {alternatives && alternatives.length > 0 ? (
            <ul style={{ paddingLeft: '20px', marginTop: '10px', fontSize: '0.95rem', color: 'var(--text-main)' }}>
              {alternatives.map((alt, idx) => (
                <li key={idx} style={{ marginBottom: '8px' }}>
                  <strong>{alt.supplier}</strong> (Lead time: {alt.lead_time_days} days)
                </li>
              ))}
            </ul>
          ) : (
            <p>{brief.recommended_supplier || 'Current suppliers adequate.'}</p>
          )}
        </div>
      </div>

      <div className="brief-footer glass-panel">
        {decision ? (
          <div className="decision-feedback animate-fade-in">
            <CheckCircle size={24} color="#00e676" />
            <h3>Action Logged: {decision.toUpperCase()}</h3>
          </div>
        ) : (
          <div className="decision-actions">
            <h3>Compliance Workflow</h3>
            <div className="action-buttons">
              <button 
                className="glass-button btn-approve" 
                onClick={() => handleDecision('approve')}
              >
                APPROVE RESOLUTION
              </button>
              <button 
                className="glass-button btn-escalate" 
                onClick={() => handleDecision('escalate')}
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
