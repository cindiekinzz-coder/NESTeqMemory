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
  // Get type from landscape (eq-landscape returns mbti directly) or mbtiType
  const type = landscape?.mbti || mbtiType?.type || 'INFP';

  // Calculate confidence from signal count (more signals = more confident)
  const signals = landscape?.signals || 0;
  const confidence = signals > 100 ? 1.0 : signals > 50 ? 0.9 : signals > 20 ? 0.7 : 0.5;
  const confidenceDisplay = signals > 0
    ? `${Math.round(confidence * 100)}%`
    : '...';

  // Normalize axes: API returns raw values (e.g., 2195), we need -1 to 1
  // Positive values = I, N, F, P (right side)
  const rawAxes = landscape?.axes || {};
  const maxVal = Math.max(
    Math.abs(rawAxes.e_i || 0),
    Math.abs(rawAxes.s_n || 0),
    Math.abs(rawAxes.t_f || 0),
    Math.abs(rawAxes.j_p || 0),
    1 // Prevent division by zero
  );

  const axes = {
    e_i: (rawAxes.e_i || 0) / maxVal,
    s_n: (rawAxes.s_n || 0) / maxVal,
    t_f: (rawAxes.t_f || 0) / maxVal,
    j_p: (rawAxes.j_p || 0) / maxVal,
  };

  const pillars = landscape?.pillars || {};
  const topEmotions = landscape?.topEmotions || [];
  const recentSignals = landscape?.signals || 0;

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
          {(() => {
            const pillarEntries = Object.entries(pillars);
            const maxCount = Math.max(...pillarEntries.map(([, c]) => c), 1);
            return pillarEntries.map(([name, count]) => (
              <div key={name} className="pillar-row">
                <span className="pillar-name">{name}</span>
                <div className="pillar-bar">
                  <div
                    className="pillar-fill"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                    data-pillar={name.toLowerCase().replace(/\s+/g, '-')}
                  ></div>
                </div>
                <span className="pillar-count">{count}</span>
              </div>
            ));
          })()}
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
