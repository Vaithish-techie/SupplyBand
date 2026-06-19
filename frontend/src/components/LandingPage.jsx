import React, { useState } from 'react';
import { Activity, Globe, ShieldAlert, Cpu, ArrowRight } from 'lucide-react';
import axios from 'axios';
import './LandingPage.css';

const PRESETS = [
  {
    icon: <Globe size={20} />,
    title: 'Taiwan Earthquake',
    label: 'GEO / NATURAL DISASTER',
    text: 'Magnitude 7.4 earthquake strikes Hsinchu, Taiwan suspending TSMC production.'
  },
  {
    icon: <ShieldAlert size={20} />,
    title: 'Rotterdam Port Strike',
    label: 'LABOR / LOGISTICS',
    text: 'Dockworkers at Port of Rotterdam announce indefinite strike starting immediately, paralyzing European logistics.'
  },
  {
    icon: <Cpu size={20} />,
    title: 'US-China Tariff Escalation',
    label: 'TRADE / REGULATORY',
    text: 'New 40% tariff imposed on all semiconductor components imported from China, effective immediately.'
  }
];

export default function LandingPage({ onTrigger, isSubmitting, error }) {
  const [eventText, setEventText] = useState('');

  return (
    <div className="landing-container animate-fade-in">
      {/* NAV */}
      <nav className="landing-nav">
        <div className="nav-brand">
          <div className="nav-brand-dot" />
          Band of Agents&nbsp;&nbsp;·&nbsp;&nbsp;Disruption Risk Control
        </div>
        <div className="nav-status">
          <button
            className="glass-button danger small"
            onClick={async () => {
              try {
                await axios.post('https://vai7-supply-backend.hf.space/nuke');
                alert('State cleared.');
              } catch {
                alert('Failed to clear backend state.');
              }
            }}
          >
            Nuke State
          </button>
          Pipeline: <span>Ready</span>
        </div>
      </nav>

      {/* HERO & ABOUT */}
      <section className="landing-hero">
        <div className="hero-badge">AI-Powered Disruption Intelligence</div>

        <h1 className="hero-title" style={{ fontSize: 'clamp(3rem, 5vw, 4.5rem)', lineHeight: '1.1' }}>
          <span className="title-line">Supply Chain</span>
          <span className="title-accent">Intelligence Center</span>
        </h1>

        <p className="hero-subtitle" style={{ fontSize: '1.15rem', maxWidth: '700px' }}>
          An autonomous multi-agent system designed to assess supply chain disruptions, calculate financial exposure, and recommend alternative sourcing — in real time.
        </p>

        <div className="hero-meta" style={{ marginBottom: '2rem' }}>
          <span className="hero-meta-item">6 Specialist Agents</span>
          <span className="hero-meta-item">Band AI Framework</span>
          <span className="hero-meta-item">Live Resolution</span>
        </div>

        <div className="about-grid">
          <div className="about-card glass-panel">
            <h3 className="about-title">The Problem</h3>
            <p className="about-text">
              Global supply chain disruptions are chaotic. When a port strikes or an earthquake hits, it takes human teams days to manually cross-reference supplier data, calculate financial exposure, and check legal contracts. By the time a strategy is formed, millions of dollars are lost and alternatives are bought out by competitors.
            </p>
          </div>
          <div className="about-card glass-panel">
            <h3 className="about-title" style={{ color: 'var(--gold)' }}>The Solution</h3>
            <p className="about-text">
              We deploy a synchronized squad of 6 autonomous AI agents. Upon receiving raw disruption news, they instantly parallelize the work: identifying affected Tier-1/Tier-2 suppliers, calculating margin impact, checking Force Majeure clauses, and ranking alternative suppliers. You get an Executive Brief in under 30 seconds.
            </p>
          </div>
        </div>
      </section>

      {/* INPUT PANEL */}
      <div className="landing-input-section glass-panel">
        <div className="input-header">
          <Activity className="input-icon" size={20} />
          <h2>Analyze Live Disruption Event</h2>
        </div>

        <textarea
          className="glass-input landing-textarea"
          rows={4}
          placeholder="Describe the disruption event or paste raw news intel here..."
          value={eventText}
          onChange={(e) => setEventText(e.target.value)}
          disabled={isSubmitting}
        />

        {error && <div className="error-message">{error}</div>}

        <div className="submit-btn-wrapper">
          <button
            className={`glass-button primary hero-btn ${isSubmitting ? 'processing-indicator' : ''}`}
            onClick={() => onTrigger(eventText)}
            disabled={isSubmitting || !eventText.trim()}
          >
            {isSubmitting ? 'Initializing Agents...' : 'Deploy Investigation'}
            {!isSubmitting && <ArrowRight size={16} className="btn-icon" />}
          </button>
        </div>
      </div>

      {/* PRESETS */}
      <div className="presets-container">
        <h3 className="presets-title">Test Scenarios</h3>
        <p className="presets-description">
          Not sure what to type? Click one of the simulated disruption events below to watch the autonomous agent cluster analyze the impact in real-time.
        </p>
        <div className="presets-grid">
          {PRESETS.map((preset, idx) => (
            <div
              key={idx}
              className="premium-card"
              onClick={() => {
                setEventText(preset.text);
                onTrigger(preset.text);
              }}
            >
              <div className="preset-card-header">
                <div className="preset-icon-wrapper">{preset.icon}</div>
                <div>
                  <div style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    {preset.label}
                  </div>
                  <h3>{preset.title}</h3>
                </div>
              </div>
              <p>{preset.text}</p>
              <div className="preset-card-footer">
                Run Scenario <ArrowRight size={12} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section className="features-section">
        <div className="features-header">
          <div>
            <div className="section-label">03 · Why Band of Agents</div>
            <h2 className="section-title">Synchronized<br />Multi-Agent Pipeline</h2>
          </div>
          <p className="section-subtitle">
            A coordinated squad of six autonomous specialists — each trained on a distinct domain of supply chain risk.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card glass-panel">
            <div className="feature-num">01</div>
            <div className="feature-icon"><Cpu size={22} /></div>
            <h3>6 Autonomous Agents</h3>
            <p>Coordinator, Event Intel, Supplier Impact, Financial Exposure, Regulatory &amp; Trade, and Alt Sourcing running in parallel.</p>
          </div>
          <div className="feature-card glass-panel">
            <div className="feature-num">02</div>
            <div className="feature-icon"><Activity size={22} /></div>
            <h3>Real-Time Band AI Comms</h3>
            <p>Agents collaborate live in a shared workspace, passing structured findings dynamically using Band SDK integration.</p>
          </div>
          <div className="feature-card glass-panel">
            <div className="feature-num">03</div>
            <div className="feature-icon"><ShieldAlert size={22} /></div>
            <h3>Executive Brief Output</h3>
            <p>From raw news to synthesized financial risk, tier-1 exposure, and alternative sourcing — under 30 seconds.</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="nav-brand-dot" />
            Band of Agents · Disruption Risk Control
          </div>
          <div className="footer-links">
            <span>Hackathon 2026</span>
            <span>·</span>
            <span>Powered by Band AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
