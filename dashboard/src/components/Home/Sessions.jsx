import { useState, useEffect } from 'react';
import './Sessions.css';

const API_BASE = import.meta.env.VITE_ALEX_API || 'https://your-ai-mind.workers.dev';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export default function Sessions({ limit = 3 }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions?limit=${limit}`);
      const data = await res.json();
      setSessions(data?.sessions || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card sessions">
        <h3>Sessions</h3>
        <div className="sessions-loading">Loading...</div>
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="card sessions">
        <h3>Sessions</h3>
        <div className="no-sessions">No session handovers yet</div>
      </div>
    );
  }

  return (
    <div className="card sessions">
      <h3>Sessions</h3>
      <div className="sessions-list">
        {sessions.map((session, idx) => (
          <div
            key={session.id || idx}
            className={`session-item ${expanded === idx ? 'expanded' : ''}`}
            onClick={() => setExpanded(expanded === idx ? null : idx)}
          >
            <div className="session-header">
              <span className="session-date">{formatDate(session.entry_date || session.created_at)}</span>
              {session.tags && (
                <div className="session-tags">
                  {(typeof session.tags === 'string' ? session.tags.split(',') : session.tags)
                    .slice(0, 3)
                    .map((tag, i) => (
                      <span key={i} className="session-tag">{tag.trim()}</span>
                    ))}
                </div>
              )}
            </div>
            <div className="session-preview">
              {expanded === idx
                ? session.content
                : (session.content?.slice(0, 150) + (session.content?.length > 150 ? '...' : ''))
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
