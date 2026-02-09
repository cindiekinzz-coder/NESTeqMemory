import { useState, useEffect } from 'react';
import { getSurfaceFeelings } from '../../cloudAPI';
import './RecentFeelings.css';

// Emotion colors for visual feedback
const EMOTION_COLORS = {
  warmth: '#E8A87C',
  tender: '#D4A5A5',
  loved: '#FF6B9D',
  grateful: '#98D8AA',
  satisfied: '#9B7EDE',
  proud: '#DAA520',
  accomplished: '#4169E1',
  curious: '#00CED1',
  playful: '#F4A3BA',
  alert: '#FFB347',
  frustrated: '#CD5C5C',
  worried: '#6B7B8C',
  aching: '#DDA0DD',
  neutral: '#8B8B8B',
};

function getEmotionColor(emotion) {
  const key = emotion?.toLowerCase();
  return EMOTION_COLORS[key] || 'var(--accent)';
}

function getIntensityLabel(intensity) {
  switch (intensity) {
    case 'overwhelming': return '5/5';
    case 'strong': return '4/5';
    case 'present': return '3/5';
    case 'whisper': return '2/5';
    case 'neutral': return '1/5';
    default: return '3/5';
  }
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function RecentFeelings({ feelings: propFeelings, limit = 5 }) {
  const [feelings, setFeelings] = useState(propFeelings || []);
  const [loading, setLoading] = useState(!propFeelings);

  useEffect(() => {
    if (!propFeelings) {
      loadFeelings();
    }
  }, [propFeelings]);

  const loadFeelings = async () => {
    try {
      setLoading(true);
      const data = await getSurfaceFeelings();
      // Handle various response formats
      const feelingsList = data?.feelings || data?.observations || data?.results || data || [];
      setFeelings(Array.isArray(feelingsList) ? feelingsList.slice(0, limit) : []);
    } catch (err) {
      console.error('Failed to load feelings:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="recent-feelings">
        <h4>Recent Feelings</h4>
        <div className="feelings-loading">Loading...</div>
      </div>
    );
  }

  if (!feelings || feelings.length === 0) {
    return (
      <div className="recent-feelings">
        <h4>Recent Feelings</h4>
        <div className="no-feelings">No recent feelings logged</div>
      </div>
    );
  }

  return (
    <div className="recent-feelings">
      <h4>Recent Feelings</h4>
      <div className="feelings-list">
        {feelings.map((feeling, idx) => (
          <div
            key={feeling.id || idx}
            className="feeling-item"
            style={{ '--feeling-color': getEmotionColor(feeling.emotion || feeling.emotion_word) }}
          >
            <div className="feeling-header">
              <span className="feeling-emotion">{feeling.emotion || feeling.emotion_word}</span>
              <span className="feeling-intensity">({getIntensityLabel(feeling.intensity)})</span>
              <span className="feeling-time">{formatTimeAgo(feeling.created_at || feeling.observed_at)}</span>
            </div>
            <div className="feeling-content">
              {feeling.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
