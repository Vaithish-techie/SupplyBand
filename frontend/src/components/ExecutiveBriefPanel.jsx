import React, { useState } from 'react';
import { FileText, Check, AlertTriangle, MessageSquare, Clock, ShieldAlert } from 'lucide-react';
import { approveAction } from '../services/api';

export default function ExecutiveBriefPanel({ caseId, briefData, isComplete }) {
  const [decision, setDecision] = useState(null); // 'approve' | 'escalate'
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loggedDecision, setLoggedDecision] = useState(null);

  if (!isComplete) {
    return (
      <div className="glass-panel" style={{
        padding: '24px',
        borderRadius: '16px',
        borderLeft: '4px solid var(--neon-gray)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '250px',
        gap: '12px'
      }}>
        <Clock size={32} style={{ color: 'var(--neon-yellow)', animation: 'pulse-glow-yellow 2s infinite', borderRadius: '50%' }} />
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-display)', color: '#fff' }}>
          Executive Control Deck
        </h3>
        <p style={{ fontSize: '13px', color: '#9aa0b9', maxWidth: '280px', margin: 0 }}>
          Investigation in progress. Specialist agents are reporting analysis. Coordinator brief will compile automatically.
        </p>
      </div>
    );
  }

  const brief = briefData?.parsed || {};
  const severityColors = {
    CRITICAL: '#ff007a',
    HIGH: '#ff6c00',
    MEDIUM: '#ffd000',
    LOW: '#05f3ad',
  };

  const sevColor = severityColors[brief.severity] || 'var(--neon-blue)';

  const handleDecision = async (dec) => {
    setDecision(dec);
    setSubmitted(false);
    setSubmitError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await approveAction(caseId, decision, notes);
      if (res.logged) {
        setSubmitted(true);
        setLoggedDecision({
          decision,
          notes,
          decidedAt: res.decided_at
        });
        setDecision(null);
        setNotes('');
      }
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit decision');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-panel" style={{
      padding: '24px',
      borderRadius: '16px',
      borderLeft: `4px solid ${sevColor}`,
      boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.4), 0 0 20px ${sevColor}15`,
      display: 'flex',
      flexDirection: 'column',
      gap: '18px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} style={{ color: 'var(--neon-yellow)' }} />
          Executive Decision Deck
        </h3>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          color: sevColor,
          background: `${sevColor}10`,
          border: `1px solid ${sevColor}33`,
          padding: '3px 8px',
          borderRadius: '4px'
        }}>
          {brief.severity} SEVERITY
        </span>
      </div>

      {/* Situation Summary */}
      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
          Situation Summary
        </div>
        <p style={{ margin: 0, fontSize: '13.5px', color: '#e2e8f0', lineHeight: 1.5 }}>
          {brief.situation_summary}
        </p>
      </div>

      {/* Quick Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
          <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Financial Impact</div>
          <div style={{ color: '#ff6c00', fontWeight: 600, marginTop: '2px' }}>{brief.financial_exposure}</div>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
          <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Sourcing Recom.</div>
          <div style={{ color: '#05f3ad', fontWeight: 600, marginTop: '2px' }}>{brief.recommended_supplier}</div>
        </div>
      </div>

      {/* Top Actions Checklist */}
      <div>
        <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
          Top Priority Action Playbook
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {brief.top_3_actions && brief.top_3_actions.map((act, idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: '10px', 
              fontSize: '13px', 
              color: '#e2e8f0',
              background: 'rgba(255,255,255,0.01)',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.03)'
            }}>
              <span style={{ 
                width: '18px', 
                height: '18px', 
                borderRadius: '50%', 
                backgroundColor: 'rgba(255, 208, 0, 0.1)', 
                color: 'var(--neon-yellow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                flexShrink: 0
              }}>
                {idx + 1}
              </span>
              <span>{act}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance / Legal Callout */}
      {brief.compliance_deadline && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#8be5ff', background: 'rgba(0, 240, 255, 0.04)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(0, 240, 255, 0.15)' }}>
          <Clock size={14} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
          <span>Compliance Deadline: <strong>{brief.compliance_deadline}</strong></span>
        </div>
      )}

      {/* Decision Summary Verdict */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: brief.verdict === 'AUTO_RESOLVE' ? '#05f3ad' : '#ff007a', background: brief.verdict === 'AUTO_RESOLVE' ? 'rgba(5, 243, 173, 0.05)' : 'rgba(255, 0, 122, 0.05)', padding: '12px', borderRadius: '8px', border: `1px solid ${brief.verdict === 'AUTO_RESOLVE' ? 'rgba(5, 243, 173, 0.15)' : 'rgba(255, 0, 122, 0.15)'}` }}>
        <ShieldAlert size={16} style={{ flexShrink: 0 }} />
        <span>Coordinator Verdict: <strong>{brief.verdict?.replace('_', ' ')}</strong></span>
      </div>

      {/* Human Actions & Logs */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* If decision already taken and saved */}
        {submitted && loggedDecision && (
          <div style={{
            background: loggedDecision.decision === 'approve' ? 'rgba(5, 243, 173, 0.05)' : 'rgba(255, 0, 122, 0.05)',
            border: `1px solid ${loggedDecision.decision === 'approve' ? 'var(--neon-green)33' : 'var(--neon-pink)33'}`,
            borderRadius: '10px',
            padding: '12px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ 
              fontWeight: 700, 
              color: loggedDecision.decision === 'approve' ? 'var(--neon-green)' : 'var(--neon-pink)',
              fontSize: '14px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              ✓ Decision Logged: {loggedDecision.decision}d
            </div>
            {loggedDecision.notes && (
              <div style={{ fontSize: '12px', color: '#9aa0b9', fontStyle: 'italic' }}>
                "{loggedDecision.notes}"
              </div>
            )}
            <div style={{ fontSize: '10px', color: '#64748b' }}>
              Timestamp: {new Date(loggedDecision.decidedAt).toLocaleString()}
            </div>
          </div>
        )}

        {/* Input Controls */}
        {!submitted && (
          <>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
              Human Operator Audit Control
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button 
                onClick={() => handleDecision('approve')}
                style={{
                  background: decision === 'approve' ? 'var(--neon-green)' : 'rgba(5, 243, 173, 0.1)',
                  border: '1px solid var(--neon-green)',
                  color: decision === 'approve' ? '#050512' : 'var(--neon-green)',
                  padding: '10px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <Check size={14} /> Approve Action
              </button>

              <button 
                onClick={() => handleDecision('escalate')}
                style={{
                  background: decision === 'escalate' ? 'var(--neon-pink)' : 'rgba(255, 0, 122, 0.1)',
                  border: '1px solid var(--neon-pink)',
                  color: decision === 'escalate' ? '#050512' : 'var(--neon-pink)',
                  padding: '10px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <AlertTriangle size={14} /> Escalate to Board
              </button>
            </div>

            {decision && (
              <form onSubmit={handleSubmit} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                background: 'rgba(255,255,255,0.02)',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.04)'
              }}>
                <div style={{ fontSize: '11px', color: '#9aa0b9', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MessageSquare size={12} />
                  Add Audit Log / Decision Notes:
                </div>
                <textarea 
                  rows={2}
                  placeholder="Provide brief justification notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    background: 'rgba(16, 18, 35, 0.8)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '8px',
                    fontSize: '12px',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'inherit'
                  }}
                />
                <button 
                  type="submit" 
                  className="btn-neon" 
                  disabled={submitting}
                  style={{ alignSelf: 'flex-end', padding: '6px 16px', fontSize: '12px' }}
                >
                  Submit Decision Log
                </button>
                {submitError && (
                  <span style={{ fontSize: '11px', color: 'var(--neon-pink)' }}>{submitError}</span>
                )}
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
