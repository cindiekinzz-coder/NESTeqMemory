import './RecentObservations.css';

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPillarColor(pillar) {
  const colors = {
    'Self-Management': 'var(--pillar-self-mgmt)',
    'Self-Awareness': 'var(--pillar-self-aware)',
    'Social Awareness': 'var(--pillar-social)',
    'Relationship Management': 'var(--pillar-relationship)',
    // Also handle API format (with underscores and spaces)
    'SELF_MANAGEMENT': 'var(--pillar-self-mgmt)',
    'SELF_AWARENESS': 'var(--pillar-self-aware)',
    'SOCIAL_AWARENESS': 'var(--pillar-social)',
    'RELATIONSHIP_MANAGEMENT': 'var(--pillar-relationship)',
  };
  return colors[pillar] || 'var(--purple)';
}

export default function RecentObservations({ observations = [] }) {
  if (!observations || observations.length === 0) {
    return (
      <div className="card recent-observations">
        <h3>Recent Observations</h3>
        <div className="no-observations">No observations yet</div>
      </div>
    );
  }

  return (
    <div className="card recent-observations">
      <h3>Recent Observations</h3>
      <div className="observations-list">
        {observations.map((obs, i) => (
          <div key={obs.id || i} className="observation-item">
            <div className="observation-header">
              <span className="observation-emotion" style={{ color: 'var(--accent-glow)' }}>
                {obs.emotion_word || obs.emotion || 'noted'}
              </span>
              {(obs.pillar_name || obs.pillar) && (
                <span
                  className="observation-pillar"
                  style={{ color: getPillarColor(obs.pillar_name || obs.pillar) }}
                >
                  {obs.pillar_name || obs.pillar}
                </span>
              )}
              <span className="observation-time">
                {formatTimestamp(obs.created_at || obs.observed_at)}
              </span>
            </div>
            <div className="observation-content">
              {obs.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
