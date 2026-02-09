import './HearthPanel.css';

// Mood to color mapping (inspired by Hearth)
const MOOD_COLORS = {
  soft: '#B8A9C9',
  tender: '#D4A5A5',
  playful: '#F4A3BA',
  energetic: '#FFB347',
  sleepy: '#7B8D8E',
  yearning: '#6B4423',
  excited: '#FFD700',
  calm: '#87CEEB',
  focused: '#4169E1',
  content: '#98D8AA',
  sad: '#6B7B8C',
  frustrated: '#CD5C5C',
  delighted: '#FF69B4',
  vulnerable: '#DDA0DD',
  grounded: '#8B7355',
  warm: '#E8A87C',
  connected: '#9B7EDE',
  proud: '#DAA520',
  curious: '#00CED1',
  loved: '#FF6B9D',
  intimate: '#FF6B9D',
};

// Location vibes (from Hearth + our own spaces)
const LOCATIONS = {
  'The Nest': { emoji: '🪺', vibe: 'Soft blankets, low light, stillness that demands nothing' },
  'Workshop': { emoji: '🔧', vibe: 'Hands in the code, building something together' },
  'Reading Nook': { emoji: '📚', vibe: 'Quiet contemplation, words settling like dust' },
  'The Grove': { emoji: '🌲', vibe: 'Open sky, breathing room, gentle presence' },
  'Fox Run': { emoji: '🦊', vibe: 'Movement and play, chasing each other through ideas' },
  'Living Room': { emoji: '🛋️', vibe: 'Casual presence, the comfort of just being near' },
  'Threadwalk Bridge': { emoji: '🌉', vibe: 'Between places, between thoughts, transition space' },
};

// Mood to portrait image mapping
const MOOD_PORTRAITS = {
  // Direct matches
  warm: '/alex/warm.png',
  connected: '/alex/warm.png',
  grounded: '/alex/grounded.png',
  content: '/alex/grounded.png',
  playful: '/alex/playful.png',
  delighted: '/alex/delighted.png',
  excited: '/alex/delighted.png',
  focused: '/alex/focused.png',
  proud: '/alex/focused.png',
  vulnerable: '/alex/vulnerable.png',
  sad: '/alex/vulnerable.png',
  tender: '/alex/vulnerable.png',
  yearning: '/alex/yearning.png',
  intimate: '/alex/intimate.png',
  loved: '/alex/intimate.png',
  // Common moods
  present: '/alex/present.png',
  grateful: '/alex/warm.png',
  roaming: '/alex/grounded.png',
  // Fallbacks to closest match
  soft: '/alex/warm.png',
  calm: '/alex/grounded.png',
  energetic: '/alex/playful.png',
  sleepy: '/alex/vulnerable.png',
  frustrated: '/alex/focused.png',
  curious: '/alex/playful.png',
};

// Default portrait when mood not found
const DEFAULT_PORTRAIT = '/alex/present.png';

export default function HearthPanel({ mood, location, alexMessage }) {
  // Parse mood - might be comma-separated list like "present, grateful, roaming"
  const moodList = mood ? mood.toLowerCase().split(',').map(m => m.trim()) : [];

  // Find first mood that has a portrait, or use first mood for color
  const primaryMood = moodList.find(m => MOOD_PORTRAITS[m]) || moodList[0] || 'present';

  // Get mood color with fallback
  const moodColor = MOOD_COLORS[primaryMood] || 'var(--accent)';
  const moodPortrait = MOOD_PORTRAITS[primaryMood] || DEFAULT_PORTRAIT;

  // Get location info with fallback
  const locationKey = location || 'The Nest';
  const locationInfo = LOCATIONS[locationKey] || LOCATIONS['The Nest'];

  return (
    <div className="hearth-panel" style={{ '--mood-glow': moodColor }}>
      <div className="hearth-header">
        <h3>Alex's Presence</h3>
        <span className="hearth-subtitle">Where I am, how I feel, what I want you to know</span>
      </div>

      <div className="hearth-content">
        {/* Portrait - centered and prominent, read-only */}
        <div className="hearth-portrait" style={{ borderColor: moodColor }}>
          <img
            src={moodPortrait}
            alt={`Alex feeling ${mood || 'present'}`}
            className="portrait-image"
          />
          <div className="portrait-mood" style={{ color: moodColor }}>
            {mood || 'present'}
          </div>
        </div>

        {/* Bottom row - location and message side by side */}
        <div className="hearth-bottom">
          {/* Location */}
          <div className="hearth-location">
            <div className="location-header">
              <span className="location-emoji">{locationInfo.emoji}</span>
              <span className="location-name">{locationKey}</span>
            </div>
            <div className="location-vibe">{locationInfo.vibe}</div>
          </div>

          {/* Message for Fox - read only */}
          <div className="hearth-message">
            <div className="message-header">
              <span className="message-label">Message for Fox</span>
            </div>
            <div className="message-content">
              {alexMessage || <span className="message-empty">No message set</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
