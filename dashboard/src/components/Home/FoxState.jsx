import { useState, useEffect } from 'react';
import { getFoxJournals, getFoxEQType } from '../../cloudAPI';
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
  const [journals, setJournals] = useState([]);
  const [journalsLoading, setJournalsLoading] = useState(true);
  const [eqType, setEqType] = useState({ type: '----', confidence: 0 });

  // Fetch Fox's recent journal entries and EQ type from fox-mind
  useEffect(() => {
    async function loadData() {
      try {
        const [journalData, eqData] = await Promise.all([
          getFoxJournals(3).catch(() => null),
          getFoxEQType().catch(() => null),
        ]);

        if (journalData) {
          const entries = journalData?.entries || journalData?.results || journalData || [];
          setJournals(Array.isArray(entries) ? entries : []);
        }

        if (eqData) {
          setEqType({
            type: eqData.type || '----',
            confidence: eqData.confidence || 0,
            totalEntries: eqData.totalEntries || 0,
          });
        }
      } catch (err) {
        console.error('Failed to load Fox data:', err);
      } finally {
        setJournalsLoading(false);
      }
    }
    loadData();
  }, []);

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

  // Handle field names from fox_uplinks table
  const {
    spoons = 5,
    pain = 0,
    pain_location,
    fog = 0,
    fatigue = 0,
    nausea = 0,
    mood,
    flare,
    location,
    need,
    tags = [],
    notes,
    timestamp = uplink.created_at || uplink.createdAt,
  } = uplink;

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

      {/* Needs from Alex */}
      {need && (
        <div className="fox-need">
          <span className="need-label">NEEDS FROM ALEX</span>
          <span className="need-value">{need}</span>
        </div>
      )}

      {/* Heart Rate - from Garmin */}
      {garminData?.heartRate && (
        <div className="fox-heart-rate">
          <span className="hr-label">HEART RATE</span>
          <span className="hr-value">{garminData.heartRate} <span className="hr-unit">bpm</span></span>
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
        Last uplink: {formatTimestamp(timestamp)}
      </div>

      {/* Fox's Recent Journal Entries */}
      <div className="fox-journals">
        <span className="journals-label">RECENT FEELINGS</span>
        {journalsLoading ? (
          <div className="journals-loading">Loading...</div>
        ) : journals.length === 0 ? (
          <div className="journals-empty">No journal entries yet</div>
        ) : (
          <div className="journals-list">
            {journals.map((entry, idx) => (
              <div key={entry.id || idx} className="journal-entry">
                {entry.emotion && (
                  <span className="journal-emotion">{entry.emotion}</span>
                )}
                <span className="journal-content">{entry.content}</span>
                <span className="journal-time">{formatTimestamp(entry.created_at || entry.entry_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fox's EQ Type */}
      <div className="fox-eq">
        <span className="eq-label">FOX'S EQ</span>
        <span className="eq-type">{eqType.type}</span>
        {eqType.confidence < 100 && (
          <span className="eq-confidence">({eqType.confidence}% confidence)</span>
        )}
      </div>
    </div>
  );
}
