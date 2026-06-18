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

  useEffect(() => {
    let isMounted = true;
    const fetchBrief = async () => {
      try {
        const response = await axios.get(`${API_BASE}/room-messages?case_id=${caseId}`);
        if (isMounted) {
          const fetchedMsgs = response.data.messages || [];
          const briefMsg = fetchedMsgs.find(m => m.parsed?.agent === 'coordinator' && m.parsed?.phase === 'executive_brief');
          
          if (briefMsg && briefMsg.parsed) {
            setBrief(briefMsg.parsed);
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
      case 'CRITICAL': return '#ff5252';
      case 'HIGH': return '#ff9100';
      case 'MEDIUM': return '#ffea00';
      case 'LOW': return '#00e676';
      default: return '#b0bec5';
    }
  };

  const getSeverityIcon = (sev) => {
    switch (sev?.toUpperCase()) {
      case 'CRITICAL': return <ShieldAlert size={28} color="#ff5252" />;
      case 'HIGH': return <AlertTriangle size={28} color="#ff9100" />;
      case 'MEDIUM': return <Info size={28} color="#ffea00" />;
      default: return <CheckCircle size={28} color="#00e676" />;
    }
  };

  return (
    <div className="brief-screen animate-fade-in">
      <header className="brief-header">
        <div className="header-top">
          <div className="case-badge">CASE: {caseId}</div>
          <button className="glass-button small" onClick={onBack}>New Investigation</button>
        </div>
        <h1>Executive Summary</h1>
        <p className="brief-verdict" style={{ color: getSeverityColor(brief.severity) }}>
          Verdict: {brief.verdict?.replace(/_/g, ' ')}
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
          <p className="summary-text">{brief.situation_summary}</p>
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
          <p>{brief.financial_exposure || 'No significant financial risk reported.'}</p>
        </div>

        <div className="glass-panel brief-card">
          <div className="card-icon"><Scale size={24} /></div>
          <h3>Regulatory & Compliance</h3>
          <p>{brief.compliance_deadline || 'No immediate compliance actions required.'}</p>
        </div>

        <div className="glass-panel brief-card">
          <div className="card-icon"><Truck size={24} /></div>
          <h3>Sourcing Recommendation</h3>
          <p>{brief.recommended_supplier || 'Current suppliers adequate.'}</p>
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
            <h3>Human Investigator Required</h3>
            <div className="action-buttons">
              <button className="glass-button primary approve" onClick={() => handleDecision('approve')}>
                Approve Auto-Resolution
              </button>
              <button className="glass-button escalate" onClick={() => handleDecision('escalate')}>
                Escalate & Intervene
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
