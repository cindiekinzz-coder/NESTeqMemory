import './FoxState.css';

function getFlareColor(level) {
  const colors = {
    green: 'var(--flare-green)',
    yellow: 'var(--flare-yellow)',
    orange: 'var(--flare-orange)',
    red: 'var(--flare-red)',
  };
  return colors[level?.toLowerCase()] || colors.green;
}

function getFlareLabel(level) {
  const labels = {
    green: 'Green',
    yellow: 'Yellow',
    orange: 'Orange',
    red: 'Raw',
  };
  return labels[level?.toLowerCase()] || level || 'Unknown';
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

export default function FoxState({ uplink, garminData }) {
  if (!uplink) {
    return (
      <div className="card fox fox-state">
        <h3>Fox</h3>
        <div className="no-data">
          <span>No uplink data</span>
          <small>Go to Uplink tab to send one</small>
        </div>
      </div>
    );
  }

  // Handle various field names from API
  const {
    spoons = 5,
    pain = 0,
    painLocation = uplink.pain_location,
    fog = 0,
    fatigue = 0,
    nausea = 0,
    mood,
    flare,
    location = uplink.dhLocation || uplink.dh_location,
    need = uplink.needFromAlex || uplink.need_from_alex,
    tags = [],
    notes = uplink.note,
    timestamp = uplink.created_at || uplink.createdAt,
    heartRate = uplink.heart_rate,
  } = uplink;

  // Use the extracted values
  const needFromAlex = need;
  const created_at = timestamp;

  // Parse tags if it's a string
  const parsedTags = typeof tags === 'string' ? JSON.parse(tags || '[]') : tags;

  return (
    <div className="card fox fox-state">
      <h3>Fox</h3>

      {/* Spoons display - the core metric */}
      <div className="fox-spoons">
        <span className="spoons-label">SPOONS</span>
        <div className="spoons-visual">
          {[...Array(5)].map((_, i) => (
            <span key={i} className={`spoon ${i < spoons ? 'filled' : 'empty'}`}>🥄</span>
          ))}
        </div>
        <span className="spoons-count">{spoons}/5</span>
      </div>

      {/* Quick stats row */}
      <div className="fox-stats-row">
        {pain > 0 && (
          <div className="stat-chip pain">
            <span className="stat-label">Pain</span>
            <span className="stat-value">{pain}/10</span>
          </div>
        )}
        {fog > 0 && (
          <div className="stat-chip fog">
            <span className="stat-label">Fog</span>
            <span className="stat-value">{fog}/10</span>
          </div>
        )}
        {fatigue > 0 && (
          <div className="stat-chip fatigue">
            <span className="stat-label">Fatigue</span>
            <span className="stat-value">{fatigue}/10</span>
          </div>
        )}
      </div>

      {/* Mood */}
      {mood && (
        <div className="fox-mood">
          <span className="mood-label">MOOD</span>
          <span className="mood-value">{mood}</span>
        </div>
      )}

      {/* Need from Alex */}
      {needFromAlex && (
        <div className="fox-need">
          <span className="need-label">NEEDS</span>
          <span className="need-value">{needFromAlex}</span>
        </div>
      )}

      {/* Heart Rate - from Garmin or uplink */}
      {(heartRate || garminData?.heartRate) && (
        <div className="fox-heart-rate">
          <span className="hr-label">HEART RATE</span>
          <span className="hr-value">{heartRate || garminData?.heartRate} <span className="hr-unit">bpm</span></span>
        </div>
      )}

      {/* Status / Flare Level */}
      {flare && (
        <div className="fox-status" style={{ borderLeftColor: getFlareColor(flare) }}>
          <span className="status-label">STATUS</span>
          <span className="status-value" style={{ color: getFlareColor(flare) }}>
            {getFlareLabel(flare)}
          </span>
        </div>
      )}

      {/* Tags as chips */}
      {parsedTags && parsedTags.length > 0 && (
        <div className="fox-tags">
          {parsedTags.map((tag, i) => (
            <span key={i} className="tag-chip">{tag}</span>
          ))}
        </div>
      )}

      {/* Today's Note */}
      {notes && (
        <div className="fox-note">
          <span className="note-label">TODAY'S NOTE</span>
          <span className="note-text">"{notes}"</span>
        </div>
      )}

      {/* Timestamp */}
      <div className="fox-timestamp">
        Last uplink: {formatTimestamp(created_at)}
      </div>
    </div>
  );
}
