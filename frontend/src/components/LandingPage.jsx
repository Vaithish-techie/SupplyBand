import React, { useState } from 'react';
import { Activity, Globe, ShieldAlert, Cpu, ArrowRight } from 'lucide-react';
import axios from 'axios';
import './LandingPage.css';

const PRESETS = [
  {
    icon: <Globe className="preset-icon" size={28} />,
    title: 'Taiwan Earthquake',
    text: 'Magnitude 7.4 earthquake strikes Hsinchu, Taiwan suspending TSMC production.'
  },
  {
    icon: <ShieldAlert className="preset-icon" size={28} />,
    title: 'Rotterdam Port Strike',
    text: 'Dockworkers at Port of Rotterdam announce indefinite strike starting immediately, paralyzing European logistics.'
  },
  {
    icon: <Cpu className="preset-icon" size={28} />,
    title: 'US-China Tariff Escalation',
    text: 'New 40% tariff imposed on all semiconductor components imported from China, effective immediately.'
  }
];

export default function LandingPage({ onTrigger, isSubmitting, error }) {
  const [eventText, setEventText] = useState('');

  return (
    <div className="landing-container animate-fade-in">
      <nav className="landing-nav">
        <div className="nav-brand">
          <div className="nav-brand-dot"></div>
          Band of Agents // Disruption Risk Control
        </div>
        <div className="nav-status">
          <button 
            className="glass-button secondary nuke-btn" 
            onClick={async () => {
              try {
                await axios.post('http://localhost:8000/nuke');
                alert('Nuked! All cases cleared from memory.');
              } catch (e) {
                alert('Failed to nuke backend state.');
              }
            }}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'rgba(255, 0, 0, 0.1)', borderColor: 'rgba(255, 0, 0, 0.3)', color: '#ff4444', marginRight: '1rem' }}
          >
            Nuke State
          </button>
          Pipeline: <span>Ready for Dispatch</span>
        </div>
      </nav>

      <div className="landing-hero">
        <div className="hero-badge">AI-Powered Disruption Intelligence</div>
        <h1 className="hero-title">Anticipate. Analyze. <span>Act.</span></h1>
        <p className="hero-subtitle">
          Instantly deploy autonomous specialist agents to assess supply chain disruptions, calculate financial exposure, and recommend alternative sourcing.
        </p>
      </div>

      <div className="landing-input-section glass-panel">
        <div className="input-header">
          <Activity className="input-icon" size={24} />
          <h2>Analyze Disruption Event</h2>
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
            {!isSubmitting && <ArrowRight size={18} className="btn-icon" />}
          </button>
        </div>
      </div>

      <div className="presets-container">
        <h3 className="presets-title">Quick Scenarios</h3>
        <div className="presets-grid">
          {PRESETS.map((preset, idx) => (
            <div 
              key={idx} 
              className="glass-panel preset-card premium-card"
              onClick={() => {
                setEventText(preset.text);
                onTrigger(preset.text);
              }}
            >
              <div className="preset-card-header">
                {preset.icon}
                <h3>{preset.title}</h3>
              </div>
              <p>{preset.text}</p>
              <div className="preset-card-footer">
                <span>Run Scenario</span>
                <ArrowRight size={14} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="features-section">
        <div className="features-header">
          <h2 className="section-title">Why Band of Agents?</h2>
          <p className="section-subtitle">A synchronized multi-agent pipeline for extreme speed and precision.</p>
        </div>
        <div className="features-grid">
          <div className="feature-card glass-panel">
            <div className="feature-icon"><Cpu size={32} /></div>
            <h3>6 Autonomous Agents</h3>
            <p>Coordinator, Event Intel, Supplier Impact, Financial Exposure, Regulatory & Trade, and Alt Sourcing running in parallel.</p>
          </div>
          <div className="feature-card glass-panel">
            <div className="feature-icon"><Activity size={32} /></div>
            <h3>Real-Time Band AI Comms</h3>
            <p>Agents collaborate live in a shared workspace, passing contexts dynamically using Band SDK integration.</p>
          </div>
          <div className="feature-card glass-panel">
            <div className="feature-icon"><ShieldAlert size={32} /></div>
            <h3>Instant Executive Brief</h3>
            <p>From raw news to synthesized financial risk, tier-1 exposure, and alternative sourcing in under 30 seconds.</p>
          </div>
        </div>
      </div>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="nav-brand-dot"></div>
            Band of Agents // Disruption Risk Control
          </div>
          <div className="footer-links">
            <span>Hackathon 2026</span>
            <span>&bull;</span>
            <span>Powered by Band AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
