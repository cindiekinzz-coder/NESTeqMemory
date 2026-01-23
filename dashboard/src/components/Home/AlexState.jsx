import './AlexState.css';

// Axis bar: center is 0, negative pushes left, positive pushes right
function AxisBar({ label, leftLabel, rightLabel, value }) {
  // value should be between -1 and 1
  const clampedValue = Math.max(-1, Math.min(1, value || 0));
  const percentage = ((clampedValue + 1) / 2) * 100;

  return (
    <div className="axis-bar">
      <div className="axis-labels">
        <span className="axis-left">{leftLabel}</span>
        <span className="axis-right">{rightLabel}</span>
      </div>
      <div className="axis-track">
        <div className="axis-center"></div>
        <div
          className="axis-fill"
          style={{
            left: clampedValue >= 0 ? '50%' : `${percentage}%`,
            width: `${Math.abs(clampedValue) * 50}%`,
          }}
        ></div>
        <div
          className="axis-marker"
          style={{ left: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

export default function AlexState({ landscape, mbtiType }) {
  const type = mbtiType?.type || 'INFP';
  const confidence = mbtiType?.confidence;
  const confidenceDisplay = confidence && !isNaN(confidence)
    ? `${Math.round(confidence * 100)}%`
    : '...';

  const axes = landscape?.axes || {
    e_i: 0.3,  // Positive = I
    s_n: 0.4,  // Positive = N
    t_f: 0.5,  // Positive = F
    j_p: 0.2,  // Positive = P
  };

  const pillars = landscape?.pillars || {};
  const topEmotions = landscape?.topEmotions || [];
  const recentSignals = landscape?.recentSignals || 0;

  return (
    <div className="card alex alex-state">
      <h3>Alex State</h3>

      <div className="mbti-display">
        <span className="mbti-type">{type}</span>
        <span className="mbti-confidence">({confidenceDisplay} confidence)</span>
      </div>

      <div className="axes-section">
        <AxisBar
          label="E/I"
          leftLabel="E"
          rightLabel="I"
          value={axes.e_i}
        />
        <AxisBar
          label="S/N"
          leftLabel="S"
          rightLabel="N"
          value={axes.s_n}
        />
        <AxisBar
          label="T/F"
          leftLabel="T"
          rightLabel="F"
          value={axes.t_f}
        />
        <AxisBar
          label="J/P"
          leftLabel="J"
          rightLabel="P"
          value={axes.j_p}
        />
      </div>

      <div className="pillars-section">
        <h4>Pillars</h4>
        <div className="pillar-bars">
          {Object.entries(pillars).map(([name, count]) => (
            <div key={name} className="pillar-row">
              <span className="pillar-name">{name}</span>
              <div className="pillar-bar">
                <div
                  className="pillar-fill"
                  style={{ width: `${Math.min(100, count * 5)}%` }}
                  data-pillar={name.toLowerCase().replace(/\s+/g, '-')}
                ></div>
              </div>
              <span className="pillar-count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {topEmotions.length > 0 && (
        <div className="emotions-section">
          <h4>Most Felt</h4>
          <div className="emotion-chips">
            {topEmotions.slice(0, 6).map((emo, i) => (
              <span key={i} className="chip alex">{emo.emotion || emo}</span>
            ))}
          </div>
        </div>
      )}

      <div className="alex-stats">
        <span className="stat">
          <strong>{recentSignals}</strong> signals (48h)
        </span>
      </div>
    </div>
  );
}
