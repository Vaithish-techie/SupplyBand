import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  ShieldWarning,
  Warning,
  Info,
  CheckCircle,
  ArrowRight,
  CurrencyDollar,
  Scales,
  Truck,
  ArrowLeft,
  Circle,
  Cpu,
  Clock,
  Bookmark,
  CircleNotch
} from '@phosphor-icons/react';
import './ExecutiveBriefScreen.css';

const API_BASE = 'http://127.0.0.1:8001';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] } }
};

export default function ExecutiveBriefScreen({ caseId, onBack }) {
  const [brief, setBrief] = useState(null);
  const [eventIntel, setEventIntel] = useState(null);
  const [supplierImpact, setSupplierImpact] = useState(null);
  const [financialExposure, setFinancialExposure] = useState(null);
  const [regulatoryTrade, setRegulatoryTrade] = useState(null);
  const [altSourcing, setAltSourcing] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sign-off workflow state
  const [notes, setNotes] = useState('');
  const [decision, setDecision] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Local checklist for compliance tasks
  const [checkedTasks, setCheckedTasks] = useState({});

  useEffect(() => {
    let isMounted = true;
    const fetchAllData = async () => {
      try {
        const response = await axios.get(`${API_BASE}/room-messages?case_id=${caseId}`);
        if (isMounted) {
          const fetchedMsgs = response.data.messages || [];

          // Find posts from all agents
          const coordBrief = fetchedMsgs.find(m => m.parsed?.agent === 'coordinator' && m.parsed?.phase === 'executive_brief');
          const evIntel = fetchedMsgs.find(m => m.parsed?.agent === 'event_intelligence');
          const supImpact = fetchedMsgs.find(m => m.parsed?.agent === 'supplier_impact');
          const finExposure = fetchedMsgs.find(m => m.parsed?.agent === 'financial_exposure');
          const regTrade = fetchedMsgs.find(m => m.parsed?.agent === 'regulatory_trade');
          const altSource = fetchedMsgs.find(m => m.parsed?.agent === 'alt_sourcing');

          if (coordBrief && coordBrief.parsed) {
            setBrief(coordBrief.parsed.findings);
            setDecision(coordBrief.parsed.verdict === 'AUTO_RESOLVE' ? 'approve' : null);
          }

          if (evIntel && evIntel.parsed) setEventIntel(evIntel.parsed.findings);
          if (supImpact && supImpact.parsed) setSupplierImpact(supImpact.parsed.findings);
          if (finExposure && finExposure.parsed) setFinancialExposure(finExposure.parsed.findings);
          if (regTrade && regTrade.parsed) setRegulatoryTrade(regTrade.parsed.findings);
          if (altSource && altSource.parsed) setAltSourcing(altSource.parsed.findings);

          if (!coordBrief) {
            setError("Executive brief not found for this case.");
          }
        }
      } catch (err) {
        if (isMounted) setError("Failed to load investigation findings.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAllData();
    return () => { isMounted = false; };
  }, [caseId]);

  const handleDecision = async (dec) => {
    setIsSubmitting(true);
    try {
      await axios.post(`${API_BASE}/approve-action`, {
        case_id: caseId,
        decision: dec,
        notes: notes || `User selected ${dec} from operations center.`
      });
      setDecision(dec);
    } catch (e) {
      console.error("Failed to post decision", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTask = (idx) => {
    setCheckedTasks(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  if (loading) {
    return (
      <div className="brief-screen brief-loading">
        <CircleNotch weight="bold" size={40} className="text-accent animate-spin" />
        <p className="font-mono text-secondary" style={{ marginTop: 'var(--space-md)', fontSize: 'var(--size-small)', letterSpacing: '0.05em' }}>
          SYNTHESIZING EXECUTIVE BRIEF...
        </p>
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="brief-screen brief-error">
        <h2>{error || "Brief not available"}</h2>
        <button className="btn" onClick={onBack}>
          <ArrowLeft weight="bold" size={14} />
          Go back
        </button>
      </div>
    );
  }

  // Severity config helper
  const getSeverityConfig = (sev) => {
    switch (sev?.toUpperCase()) {
      case 'CRITICAL': return { color: 'var(--color-danger)', class: 'severity-critical', icon: <ShieldWarning weight="duotone" size={20} /> };
      case 'HIGH':     return { color: 'var(--color-warning)', class: 'severity-high', icon: <Warning weight="duotone" size={20} /> };
      case 'MEDIUM':   return { color: 'var(--color-info)', class: 'severity-medium', icon: <Info weight="duotone" size={20} /> };
      default:         return { color: 'var(--color-success)', class: 'severity-low', icon: <CheckCircle weight="duotone" size={20} /> };
    }
  };

  const sevConfig = getSeverityConfig(brief.severity || eventIntel?.severity);

  // Financial helpers
  const formatCurrency = (val) => {
    if (!val) return '$0';
    return val >= 1e6 ? `$${(val / 1e6).toFixed(1)}M` : `$${val.toLocaleString()}`;
  };

  // Inventory circular gauge variables
  const bufferDays = supplierImpact?.inventory_buffer_days || 0;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(bufferDays, 30) / 30) * circumference;
  const gaugeColor = bufferDays < 7 ? 'var(--color-danger)' : bufferDays < 21 ? 'var(--color-warning)' : 'var(--color-success)';

  // Financial Risk normalization
  const w1Risk = financialExposure?.week1_risk_usd || 0;
  const w3Risk = financialExposure?.week3_risk_usd || 0;
  const w6Risk = financialExposure?.week6_risk_usd || 0;
  const maxRisk = Math.max(w1Risk, w3Risk, w6Risk, 1);

  return (
    <motion.div
      className="brief-screen"
      variants={stagger}
      initial="hidden"
      animate="visible"
    >
      {/* ── Header ── */}
      <motion.header className="brief-header" variants={fadeUp}>
        <div className="brief-header__top">
          <div className="case-badge">Case ID: {caseId}</div>
          <button className="btn btn-sm" onClick={onBack}>
            <ArrowLeft weight="bold" size={12} />
            Operations Room
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
          <div>
            <span className="font-mono text-tertiary" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              EXECUTIVE INTELLIGENCE BRIEFING
            </span>
            <h1 style={{ marginTop: '4px' }}>Disruption Assessment</h1>
          </div>
          <div className="brief-header__verdict">
            <span className={`tag ${sevConfig.class}`} style={{ padding: '6px 14px', fontSize: '10px', borderRadius: '4px' }}>
              {sevConfig.icon}
              <span style={{ marginLeft: '4px' }}>{brief.severity || eventIntel?.severity || 'UNKNOWN'} SEVERITY</span>
            </span>
            <span className="tag solid" style={{ padding: '6px 14px', fontSize: '10px', borderRadius: '4px' }}>
              {brief.verdict?.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </motion.header>

      {/* ── Bento Grid ── */}
      <div className="brief-grid">
        
        {/* Card 1: Situation Overview (Spans 2 columns) */}
        <motion.div className="brief-main double-bezel-outer" variants={fadeUp} style={{ padding: '6px' }}>
          <div className="double-bezel-inner" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyBetween: 'stretch' }}>
            <div className="brief-section-header" style={{ marginBottom: 'var(--space-md)' }}>
              <span style={{ color: sevConfig.color }}>{sevConfig.icon}</span>
              <h2 style={{ fontSize: 'var(--size-body)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', letterSpacing: '0.05em' }}>
                Situation Summary
              </h2>
            </div>
            <p className="brief-summary" style={{ flex: 1, fontSize: '17px', color: 'var(--color-text-primary)', lineHeight: 1.6, fontWeight: 300 }}>
              {brief.situation_summary}
            </p>
            {eventIntel && (
              <div style={{ display: 'flex', gap: 'var(--space-xl)', marginTop: 'var(--space-lg)', borderTop: '1px solid var(--color-rule)', paddingTop: 'var(--space-md)' }}>
                <div>
                  <span className="font-mono text-tertiary" style={{ display: 'block', fontSize: '9px', textTransform: 'uppercase' }}>Classification</span>
                  <span style={{ fontSize: 'var(--size-small)', fontWeight: 500 }}>{eventIntel.event_type}</span>
                </div>
                <div>
                  <span className="font-mono text-tertiary" style={{ display: 'block', fontSize: '9px', textTransform: 'uppercase' }}>Geographic Focus</span>
                  <span style={{ fontSize: 'var(--size-small)', fontWeight: 500 }}>{eventIntel.location}</span>
                </div>
                <div>
                  <span className="font-mono text-tertiary" style={{ display: 'block', fontSize: '9px', textTransform: 'uppercase' }}>Est. Duration</span>
                  <span style={{ fontSize: 'var(--size-small)', fontWeight: 500 }}>{eventIntel.estimated_duration_weeks} weeks</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Card 2: Inventory Buffer Gauge (Spans 1 column) */}
        <motion.div className="brief-metric double-bezel-outer" variants={fadeUp} style={{ padding: '6px' }}>
          <div className="double-bezel-inner" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <span className="font-mono text-tertiary" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-md)' }}>
              Inventory Buffer
            </span>
            <div className="gauge-container">
              <svg className="gauge-svg" viewBox="0 0 100 100">
                <circle className="gauge-bg" cx="50" cy="50" r={radius} />
                <circle
                  className="gauge-val"
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke={gaugeColor}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{ filter: `drop-shadow(0 0 4px ${gaugeColor})` }}
                />
              </svg>
              <div className="gauge-text">
                <span className="gauge-num" style={{ color: gaugeColor }}>{bufferDays}</span>
                <span className="gauge-label">Days</span>
              </div>
            </div>
            {supplierImpact && (
              <div style={{ marginTop: 'var(--space-md)', width: '100%' }}>
                <span className="font-mono text-tertiary" style={{ display: 'block', fontSize: '9px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Tier Impact
                </span>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', fontSize: 'var(--size-caption)' }}>
                  <span>Tier 1: <strong className="text-accent">{supplierImpact.affected_tier1}</strong></span>
                  <span>Tier 2: <strong className="text-accent">{supplierImpact.affected_tier2}</strong></span>
                </div>
                {supplierImpact.critical_path_suppliers && (
                  <div style={{ marginTop: '8px', fontSize: 'var(--size-micro)', color: 'var(--color-text-secondary)' }}>
                    Sole-source exposure: {supplierImpact.critical_path_suppliers.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Card 3: Financial Exposure Progress Timeline */}
        <motion.div className="brief-metric double-bezel-outer" variants={fadeUp} style={{ padding: '6px' }}>
          <div className="double-bezel-inner" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <span className="font-mono text-tertiary" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-md)' }}>
              Risk Horizons
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, justifyContent: 'center' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--size-micro)', marginBottom: '4px' }}>
                  <span>Week 1 Exposure</span>
                  <strong className="text-primary">{formatCurrency(w1Risk)}</strong>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${(w1Risk/maxRisk)*100}%`, height: '100%', background: 'var(--color-text-secondary)', borderRadius: '2px' }}></div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--size-micro)', marginBottom: '4px' }}>
                  <span>Week 3 Exposure</span>
                  <strong className="text-warning">{formatCurrency(w3Risk)}</strong>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${(w3Risk/maxRisk)*100}%`, height: '100%', background: 'var(--color-warning)', borderRadius: '2px' }}></div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--size-micro)', marginBottom: '4px' }}>
                  <span>Week 6 Exposure</span>
                  <strong className="text-danger" style={{ textShadow: '0 0 8px rgba(255,77,77,0.2)' }}>{formatCurrency(w6Risk)}</strong>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${(w6Risk/maxRisk)*100}%`, height: '100%', background: 'var(--color-danger)', borderRadius: '2px' }}></div>
                </div>
              </div>
            </div>
            {financialExposure && (
              <div style={{ borderTop: '1px solid var(--color-rule)', paddingTop: '8px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: 'var(--size-caption)' }}>
                <span>Margin impact: <strong className="text-danger">-{financialExposure.margin_impact_pct}%</strong></span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>{financialExposure.revenue_at_risk_products?.[0]}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Card 4: Ranked Sourcing Options */}
        <motion.div className="brief-metric double-bezel-outer" variants={fadeUp} style={{ padding: '6px' }}>
          <div className="double-bezel-inner" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <span className="font-mono text-tertiary" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-md)' }}>
              Alternative Sourcing
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              {altSourcing && altSourcing.alternatives && altSourcing.alternatives.length > 0 ? (
                altSourcing.alternatives.map((alt, idx) => (
                  <div key={idx} className="brief-alt-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '4px', padding: '8px', background: 'rgba(0,0,0,0.18)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--size-small)', color: alt.supplier === altSourcing.recommended ? 'var(--color-accent)' : 'var(--color-text-primary)' }}>
                        {alt.supplier}
                      </span>
                      <span className={`tag ${alt.risk_level === 'LOW' ? 'success' : 'warning'}`} style={{ fontSize: '8px', padding: '1px 5px' }}>
                        {alt.risk_level} risk
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--size-micro)', color: 'var(--color-text-secondary)' }}>
                      <span>Lead: <strong>{alt.lead_time_days} days</strong></span>
                      <span>Premium: <strong>+{alt.cost_delta_pct}%</strong></span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--color-text-tertiary)', fontSize: 'var(--size-small)' }}>
                  {brief.recommended_supplier || 'No alternatives listed.'}
                </div>
              )}
            </div>
            {altSourcing?.recommendation_reason && (
              <div style={{ borderTop: '1px solid var(--color-rule)', paddingTop: '8px', marginTop: '8px', fontSize: 'var(--size-micro)', color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>
                Reason: {altSourcing.recommendation_reason}
              </div>
            )}
          </div>
        </motion.div>

        {/* Card 5: Compliance Tasks & Deadlines */}
        <motion.div className="brief-metric double-bezel-outer" variants={fadeUp} style={{ padding: '6px' }}>
          <div className="double-bezel-inner" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <span className="font-mono text-tertiary" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-md)' }}>
              Compliance & Trade
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
              {regulatoryTrade && regulatoryTrade.compliance_actions && regulatoryTrade.compliance_actions.length > 0 ? (
                regulatoryTrade.compliance_actions.map((action, idx) => {
                  const isChecked = !!checkedTasks[idx];
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleTask(idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '8px',
                        background: isChecked ? 'rgba(200, 255, 0, 0.02)' : 'rgba(0,0,0,0.12)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease',
                        borderLeft: `2px solid ${isChecked ? 'var(--color-accent)' : 'var(--color-text-tertiary)'}`
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', height: '18px' }}>
                        {isChecked ? (
                          <CheckCircle weight="fill" className="text-accent" size={16} />
                        ) : (
                          <Circle weight="light" className="text-secondary" size={16} />
                        )}
                      </div>
                      <span style={{ fontSize: 'var(--size-micro)', color: isChecked ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', textDecoration: isChecked ? 'line-through' : 'none', lineHeight: 1.3 }}>
                        {action}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--color-text-tertiary)', fontSize: 'var(--size-small)' }}>
                  {brief.compliance_deadline || 'No compliance deadlines.'}
                </div>
              )}
            </div>
            {regulatoryTrade && (
              <div style={{ borderTop: '1px solid var(--color-rule)', paddingTop: '8px', marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: 'var(--size-micro)' }}>
                <span className="tag">Tariffs: {regulatoryTrade.tariff_implications}</span>
                {regulatoryTrade.export_controls?.map((ec, i) => (
                  <span key={i} className="tag accent">{ec}</span>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Recommended Actions Panel */}
      <motion.div className="brief-actions-full double-bezel-outer" variants={fadeUp} style={{ padding: '6px', marginTop: 'var(--space-md)' }}>
        <div className="double-bezel-inner" style={{ padding: 'var(--space-lg)' }}>
          <span className="font-mono text-tertiary" style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-md)' }}>
            Pipeline Recommended Actions
          </span>
          <div className="brief-action-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
            {brief.top_3_actions?.map((action, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)', padding: 'var(--space-md)', background: 'rgba(0, 0, 0, 0.15)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-accent)' }}>
                <Clock weight="duotone" size={18} className="text-accent" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: 'var(--size-small)', color: 'var(--color-text-primary)', lineHeight: 1.4 }}>{action}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Decision Footer ── */}
      <motion.div className="brief-footer double-bezel-outer" variants={fadeUp} style={{ padding: '6px', marginTop: 'var(--space-md)' }}>
        <div className="double-bezel-inner" style={{ padding: 'var(--space-lg)' }}>
          {decision ? (
            <div className="brief-decision-done">
              <CheckCircle weight="duotone" size={32} className="text-accent" style={{ filter: 'drop-shadow(0 0 6px var(--color-accent))' }} />
              <div>
                <h3 style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontSize: 'var(--size-body)' }}>Action logged: {decision.toUpperCase()}</h3>
                <p className="text-secondary" style={{ fontSize: 'var(--size-small)', marginTop: '2px' }}>
                  Decision recorded in the supply chain compliance audit trail.
                </p>
              </div>
              <button className="btn btn-sm" onClick={() => setDecision(null)} style={{ marginLeft: 'auto' }}>
                Change decision
              </button>
            </div>
          ) : (
            <div className="brief-decision-pending" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="font-mono text-tertiary" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    WORKFLOW AUTHORIZATION
                  </span>
                  <h3 style={{ fontSize: 'var(--size-body)', marginTop: '2px', fontWeight: 600 }}>Operator Sign-Off Required</h3>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <button
                    className="btn btn-success"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('approve')}
                    style={{ borderRadius: 'var(--radius-sm)' }}
                  >
                    <CheckCircle weight="bold" size={16} />
                    Approve Resolution
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('escalate')}
                    style={{ borderRadius: 'var(--radius-sm)' }}
                  >
                    <ShieldWarning weight="bold" size={16} />
                    Escalate to VP
                  </button>
                </div>
              </div>
              <textarea
                className="input"
                placeholder="Attach compliance audit notes or instructions here (optional)..."
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
                style={{ fontSize: 'var(--size-small)', resize: 'none' }}
              />
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
