import { useState, useEffect } from 'react';
import './LoveOMeter.css';

export default function LoveOMeter({ data, onPushLove, onSetEmotion }) {
  const alexScore = data?.alexScore || 0;
  const foxScore = data?.foxScore || 0;

  const [alexEmotion, setAlexEmotion] = useState(data?.alexEmotion || '');
  const [foxEmotion, setFoxEmotion] = useState(data?.foxEmotion || '');

  // Sync with incoming data
  useEffect(() => {
    if (data?.alexEmotion !== undefined) setAlexEmotion(data.alexEmotion);
    if (data?.foxEmotion !== undefined) setFoxEmotion(data.foxEmotion);
  }, [data?.alexEmotion, data?.foxEmotion]);

  // Calculate heart position (50% = center)
  const total = alexScore + foxScore;
  const foxPercent = total > 0 ? (foxScore / total) * 100 : 50;
  const heartPosition = 15 + (foxPercent * 0.7); // Keep within visible range

  const handleEmotionBlur = (who, value) => {
    if (onSetEmotion) {
      onSetEmotion(who, value);
    }
  };

  return (
    <div className="card love-meter">
      <h3>Love-O-Meter</h3>
      <small className="text-muted">A tug of war of tenderness</small>

      <div className="meter-container">
        <div className="meter-side alex-side">
          <span className="meter-name text-alex">ALEX</span>
          <span className="meter-score">{alexScore}</span>
        </div>
        <div className="meter-track">
          <div
            className="meter-heart"
            style={{ left: `${heartPosition}%` }}
          >
            <span className="heart-emoji">{'\u{1F5A4}'}</span>
          </div>
        </div>
        <div className="meter-side fox-side">
          <span className="meter-name text-fox">FOX</span>
          <span className="meter-score">{foxScore}</span>
        </div>
      </div>

      <div className="meter-buttons">
        <button className="alex" onClick={() => onPushLove('alex')}>
          Alex did something soft
        </button>
        <button className="fox" onClick={() => onPushLove('fox')}>
          Fox made Alex quiet
        </button>
      </div>

      <div className="emotion-row">
        <div className="emotion-display alex">
          <label className="emotion-label">ALEX FEELS:</label>
          <input
            type="text"
            className="emotion-input"
            value={alexEmotion}
            onChange={(e) => setAlexEmotion(e.target.value)}
            onBlur={() => handleEmotionBlur('alex', alexEmotion)}
            placeholder="..."
          />
        </div>
        <div className="emotion-display fox">
          <label className="emotion-label">FOX FEELS:</label>
          <input
            type="text"
            className="emotion-input"
            value={foxEmotion}
            onChange={(e) => setFoxEmotion(e.target.value)}
            onBlur={() => handleEmotionBlur('fox', foxEmotion)}
            placeholder="..."
          />
        </div>
      </div>
    </div>
  );
}
