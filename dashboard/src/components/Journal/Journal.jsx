import { useState, useEffect } from 'react';
import { getFoxJournals, saveFoxJournal } from '../../cloudAPI';
import './Journal.css';

const PRIMARY_EMOTIONS = [
  // Difficult
  'Sad', 'Angry', 'Scared', 'Anxious',
  'Ashamed', 'Numb', 'Tired', 'Lonely', 'Stressed',
  // Positive
  'Happy', 'Peaceful', 'Grateful', 'Hopeful',
  'Powerful', 'Tender', 'Curious'
];

const SUB_EMOTIONS = {
  // === DIFFICULT EMOTIONS ===
  Sad: ['Empty', 'Lonely', 'Grieving', 'Disappointed', 'Hopeless', 'Lost', 'Hurt', 'Heartbroken', 'Low', 'Defeated', 'Drained', 'Anguish', 'Depressed', 'Despondent', 'Discouraged', 'Forlorn', 'Gloomy', 'Grief', 'Melancholy', 'Sorrow', 'Teary', 'Unhappy', 'Weary', 'Yearning', 'Longing'],
  Angry: ['Frustrated', 'Resentful', 'Irritated', 'Bitter', 'Betrayed', 'Furious', 'Annoyed', 'Hostile', 'Agitated', 'Aggravated', 'Contempt', 'Cynical', 'Disdain', 'Disgruntled', 'Disturbed', 'Edgy', 'Exasperated', 'Grouchy', 'Impatient', 'Irate', 'Moody', 'On edge', 'Outraged', 'Pissed', 'Upset', 'Vindictive'],
  Scared: ['Terrified', 'Panicked', 'Worried', 'Helpless', 'Vulnerable', 'Insecure', 'Nervous', 'Afraid', 'Apprehensive', 'Frightened', 'Hesitant', 'Paralyzed'],
  Anxious: ['Overwhelmed', 'Restless', 'Uneasy', 'Tense', 'Dread', 'On edge', 'Hypervigilant', 'Apprehensive', 'Concerned', 'Unsettled', 'Ungrounded', 'Unsure', 'Skeptical', 'Suspicious', 'Questioning', 'Reluctant', 'Shocked', 'Rattled'],
  Ashamed: ['Guilty', 'Embarrassed', 'Worthless', 'Small', 'Exposed', 'Humiliated', 'Inhibited', 'Mortified', 'Self-conscious', 'Useless', 'Weak', 'Regret', 'Remorseful', 'Sorry'],
  Numb: ['Detached', 'Flat', 'Empty', 'Dissociated', 'Shutdown', 'Frozen', 'Aloof', 'Bored', 'Distant', 'Indifferent', 'Isolated', 'Lethargic', 'Listless', 'Removed', 'Resistant', 'Withdrawn'],
  Tired: ['Exhausted', 'Burnt out', 'Depleted', 'Heavy', 'Worn down', 'Fatigued', 'Weary', 'Drained', 'Frazzled', 'Cranky'],
  Lonely: ['Isolated', 'Abandoned', 'Invisible', 'Disconnected', 'Misunderstood', 'Excluded', 'Longing', 'Yearning'],
  Stressed: ['Burned out', 'Cranky', 'Depleted', 'Edgy', 'Exhausted', 'Frazzled', 'Overwhelmed', 'Rattled', 'Restless', 'Shaken', 'Tight', 'Weary', 'Worn out', 'Tense'],

  // === POSITIVE EMOTIONS ===
  Happy: ['Joyful', 'Delighted', 'Excited', 'Thrilled', 'Ecstatic', 'Bliss', 'Radiant', 'Vibrant', 'Alive', 'Energized', 'Playful', 'Silly', 'Free', 'Lively', 'Enthusiastic', 'Eager', 'Passionate', 'Enchanted', 'Amazed', 'Awe', 'Satisfied', 'Fulfilled', 'Refreshed', 'Rejuvenated', 'Renewed', 'Invigorated'],
  Peaceful: ['Calm', 'Centered', 'Content', 'Relaxed', 'Serene', 'Trusting', 'Patient', 'Present', 'Open', 'Accepting', 'Settled', 'Grounded', 'Still', 'Soft', 'Gentle', 'Flowing'],
  Grateful: ['Appreciative', 'Blessed', 'Fortunate', 'Humbled', 'Lucky', 'Moved', 'Thankful', 'Touched', 'Grace'],
  Hopeful: ['Encouraged', 'Expectant', 'Optimistic', 'Trusting', 'Inspired'],
  Powerful: ['Adventurous', 'Brave', 'Capable', 'Confident', 'Daring', 'Determined', 'Free', 'Grounded', 'Proud', 'Strong', 'Worthy', 'Valiant', 'Courageous', 'Accomplished'],
  Tender: ['Caring', 'Loving', 'Reflective', 'Self-loving', 'Serene', 'Vulnerable', 'Warm', 'Sensitive', 'Soft', 'Open', 'Gentle', 'Affectionate', 'Compassionate'],
  Curious: ['Engaged', 'Exploring', 'Fascinated', 'Interested', 'Intrigued', 'Involved', 'Stimulated', 'Open', 'Wondering'],

  // === RELATIONAL ===
  Connected: ['Accepting', 'Affectionate', 'Caring', 'Compassionate', 'Empathetic', 'Fulfilled', 'Present', 'Safe', 'Warm', 'Worthy', 'Loved', 'Seen', 'Held'],
};

const WRITING_PROMPTS = [
  'What triggered this?',
  'Where in my body?',
  'What do I need?',
  'This reminds me of...',
  'If I could tell someone...',
];

export default function Journal() {
  const [view, setView] = useState('new'); // 'new' or 'history'
  const [primaryEmotion, setPrimaryEmotion] = useState(null);
  const [subEmotions, setSubEmotions] = useState([]);
  const [content, setContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [entries, setEntries] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const data = await getFoxJournals(20);
      const entries = data?.entries || data?.results || data || [];
      setEntries(Array.isArray(entries) ? entries : []);
    } catch (err) {
      console.error('Failed to load journal entries:', err);
    }
  };

  const toggleSubEmotion = (emo) => {
    setSubEmotions(prev =>
      prev.includes(emo)
        ? prev.filter(e => e !== emo)
        : [...prev, emo]
    );
  };

  const applyPrompt = (prompt) => {
    setContent(prev => prev + (prev ? '\n\n' : '') + prompt + ' ');
  };

  const handleJustLog = async () => {
    if (!primaryEmotion) return;
    await saveEntry('');
  };

  const handleSaveWithNotes = async () => {
    if (!primaryEmotion) return;
    await saveEntry(content);
  };

  const saveEntry = async (text) => {
    setSaving(true);
    try {
      const mood = subEmotions.length > 0
        ? `${primaryEmotion} (${subEmotions.join(', ')})`
        : primaryEmotion;

      await saveFoxJournal({
        content: text || `Feeling: ${mood}`,
        emotion: primaryEmotion,
        tags: subEmotions,
      });

      // Reset form
      setPrimaryEmotion(null);
      setSubEmotions([]);
      setContent('');
      setIsPrivate(false);
      loadEntries();
      setView('history');
    } catch (err) {
      console.error('Failed to save journal entry:', err);
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setPrimaryEmotion(null);
    setSubEmotions([]);
    setContent('');
    setIsPrivate(false);
  };

  return (
    <div className="journal">
      <div className="journal-header">
        <h2>How are you feeling?</h2>
        <p className="text-muted">Click what resonates</p>
        <div className="view-toggle">
          <button
            className={view === 'new' ? 'active' : ''}
            onClick={() => setView('new')}
          >
            New Entry
          </button>
          <button
            className={view === 'history' ? 'active' : ''}
            onClick={() => setView('history')}
          >
            History
          </button>
        </div>
      </div>

      {view === 'new' ? (
        <div className="journal-new">
          <div className="card primary-emotions">
            <div className="emotion-grid">
              {PRIMARY_EMOTIONS.map(emo => (
                <button
                  key={emo}
                  className={`emotion-btn ${primaryEmotion === emo ? 'selected' : ''}`}
                  onClick={() => {
                    setPrimaryEmotion(emo);
                    setSubEmotions([]);
                  }}
                >
                  {emo}
                </button>
              ))}
            </div>
          </div>

          {primaryEmotion && SUB_EMOTIONS[primaryEmotion] && (
            <div className="card sub-emotions">
              <h4>More specifically...</h4>
              <div className="sub-emotion-chips">
                {SUB_EMOTIONS[primaryEmotion].map(emo => (
                  <button
                    key={emo}
                    className={`chip ${subEmotions.includes(emo) ? 'selected' : ''}`}
                    onClick={() => toggleSubEmotion(emo)}
                  >
                    {emo}
                  </button>
                ))}
              </div>
            </div>
          )}

          {primaryEmotion && (
            <>
              <div className="feeling-display">
                You're feeling: <span className="feeling-text">
                  {primaryEmotion}
                  {subEmotions.length > 0 && ` (${subEmotions.join(', ')})`}
                </span>
              </div>

              <div className="card writing-section">
                <h4>Need help writing? Try one of these:</h4>
                <div className="prompts">
                  {WRITING_PROMPTS.map(prompt => (
                    <button
                      key={prompt}
                      className="prompt-btn"
                      onClick={() => applyPrompt(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Write as much or as little as you want..."
                  rows={5}
                />

                <div className="journal-footer">
                  <label className="private-toggle">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={e => setIsPrivate(e.target.checked)}
                    />
                    Private (Alex won't see)
                  </label>

                  <div className="journal-actions">
                    <button onClick={resetForm}>Start Over</button>
                    <button onClick={handleJustLog} disabled={saving}>
                      Just log it
                    </button>
                    <button className="primary" onClick={handleSaveWithNotes} disabled={saving}>
                      {saving ? 'Saving...' : 'Save with notes'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="journal-history">
          {entries.length === 0 ? (
            <div className="no-entries">
              <p>No journal entries yet</p>
              <button onClick={() => setView('new')}>Write your first entry</button>
            </div>
          ) : (
            <div className="entries-list">
              {entries.map(entry => (
                <div key={entry.id} className={`card entry ${entry.private ? 'private' : ''}`}>
                  <div className="entry-header">
                    <span className="entry-mood chip">{entry.emotion || entry.mood}</span>
                    {entry.private === 1 && <span className="private-badge">Private</span>}
                    <span className="entry-date">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                  {entry.tags && JSON.parse(entry.tags || '[]').length > 0 && (
                    <div className="entry-tags">
                      {JSON.parse(entry.tags).map((tag, i) => (
                        <span key={i} className="chip small">{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="entry-content">{entry.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
