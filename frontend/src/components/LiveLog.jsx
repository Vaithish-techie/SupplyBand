import { useEffect, useRef } from 'react';

export default function LiveLog({ messages }) {
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sortedMsgs = [...messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

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
                <span className="log-agent">{msg.agent}</span>
                <span className="log-time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="log-body">
                {msg.phase === 'kickoff' ? (
                  <p><strong>Kickoff:</strong> {msg.event_text}</p>
                ) : msg.phase === 'executive_brief' ? (
                  <p><strong>Executive Brief:</strong> {msg.situation_summary}</p>
                ) : (
                  <>
                    {msg.flags && msg.flags.length > 0 && (
                      <div className="log-flags">
                        <strong>Flags:</strong> {msg.flags.join(', ')}
                      </div>
                    )}
                    {msg.status === 'error' || msg.status === 'insufficient_data' || msg.status === 'escalate' ? (
                      <div className="log-error-state">Status: {msg.status.toUpperCase()}</div>
                    ) : (
                      <pre className="log-findings">
                        {JSON.stringify(msg.findings, null, 2)}
                      </pre>
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
