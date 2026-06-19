import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Pulse,
  Globe,
  ShieldWarning,
  Cpu,
  ArrowRight,
  Lightning,
  Graph,
  Eye
} from '@phosphor-icons/react';
import './LandingPage.css';

const PRESETS = [
  {
    icon: <Globe weight="light" size={24} />,
    title: 'Taiwan earthquake',
    subtitle: 'TSMC fab damage',
    text: 'Magnitude 7.4 earthquake strikes Hsinchu, Taiwan suspending TSMC production.',
    severity: 'critical'
  },
  {
    icon: <ShieldWarning weight="light" size={24} />,
    title: 'Rotterdam port strike',
    subtitle: 'European logistics halt',
    text: 'Dockworkers at Port of Rotterdam announce indefinite strike starting immediately, paralyzing European logistics.',
    severity: 'high'
  },
  {
    icon: <Cpu weight="light" size={24} />,
    title: 'US-China tariff escalation',
    subtitle: 'Semiconductor ban',
    text: 'New 40% tariff imposed on all semiconductor components imported from China, effective immediately.',
    severity: 'high'
  }
];

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 }
  }
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
  }
};

export default function LandingPage({ onTrigger, isSubmitting, error }) {
  const [eventText, setEventText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (eventText.trim()) {
      onTrigger(eventText);
    }
  };

  return (
    <div className="landing">
      <div className="landing__grid">

        {/* ─── Left column: sticky hero + input ─── */}
        <motion.div
          className="landing__left"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="landing__eyebrow" variants={fadeUp}>
            <Pulse weight="bold" size={14} />
            <span>SupplyBand Intelligence</span>
          </motion.div>

          <motion.h1 className="landing__title" variants={fadeUp}>
            Disruption{' '}
            <span className="landing__title-outline">Monitor</span>
          </motion.h1>

          <motion.p className="landing__subtitle" variants={fadeUp}>
            Autonomous multi-agent synthesis of supply chain risks,
            component exposure, and regulatory compliance.
          </motion.p>

          <motion.div
            className="double-bezel-outer"
            variants={fadeUp}
            style={{ marginBottom: 'var(--space-xl)', width: '100%' }}
          >
            <form
              className="double-bezel-inner landing__form"
              onSubmit={handleSubmit}
              style={{ border: 'none', padding: 'var(--space-md)', background: 'transparent', boxShadow: 'none', margin: 0 }}
            >
              <div className="landing__form-header">
                <span className="font-mono text-secondary" style={{ fontSize: 'var(--size-micro)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>
                  New investigation
                </span>
              </div>

              <textarea
                className="input landing__textarea"
                rows={5}
                placeholder="Paste raw news text, analyst report, or disruption alert here..."
                value={eventText}
                onChange={(e) => setEventText(e.target.value)}
                disabled={isSubmitting}
              />

              {error && (
                <div className="landing__error">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className={`btn ${eventText.trim() ? 'btn-primary' : ''} w-full`}
                disabled={isSubmitting || !eventText.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Pulse weight="bold" size={16} className="animate-pulse" />
                    Initializing agents...
                  </>
                ) : (
                  <>
                    Analyze event
                    <ArrowRight weight="bold" size={16} />
                  </>
                )}
              </button>
            </form>
          </motion.div>

          <motion.div className="landing__stats" variants={fadeUp}>
            <div className="landing__stat">
              <Lightning weight="fill" size={14} className="text-accent" />
              <span>6 specialist agents</span>
            </div>
            <div className="landing__stat">
              <Graph weight="fill" size={14} className="text-accent" />
              <span>Real-time synthesis</span>
            </div>
            <div className="landing__stat">
              <Eye weight="fill" size={14} className="text-accent" />
              <span>Executive verdicts</span>
            </div>
          </motion.div>
        </motion.div>

        {/* ─── Right column: scenario cards ─── */}
        <motion.div
          className="landing__right"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="landing__scenarios-label" variants={fadeUp}>
            <span className="font-mono text-secondary" style={{ fontSize: 'var(--size-micro)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>
              Quick scenarios
            </span>
          </motion.div>

          {PRESETS.map((preset, idx) => (
            <motion.div
              key={idx}
              className="landing__card card-premium"
              variants={fadeUp}
              onClick={() => {
                setEventText(preset.text);
                onTrigger(preset.text);
              }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.985 }}
            >
              <div className="landing__card-top">
                <div className="landing__card-icon">
                  {preset.icon}
                </div>
                <span className={`tag ${preset.severity === 'critical' ? 'danger' : 'warning'}`}>
                  {preset.severity}
                </span>
              </div>

              <div className="landing__card-body">
                <h3 className="landing__card-title">{preset.title}</h3>
                <p className="landing__card-sub">{preset.subtitle}</p>
              </div>

              <p className="landing__card-text">{preset.text}</p>

              <div className="landing__card-footer">
                <span>Run scenario</span>
                <ArrowRight weight="bold" size={14} />
              </div>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </div>
  );
}
