import { useState, useEffect } from 'react';
import { getJournalEntries, saveJournalEntry } from '../../cloudAPI';
import './Journal.css';

const PRIMARY_EMOTIONS = [
  'Sad', 'Angry', 'Scared', 'Anxious',
  'Happy', 'Ashamed', 'Confused', 'Numb',
  'Tired', 'Lonely'
];

const SUB_EMOTIONS = {
  Sad: ['Empty', 'Lonely', 'Grieving', 'Disappointed', 'Hopeless', 'Lost', 'Hurt', 'Heartbroken', 'Low', 'Defeated', 'Drained'],
  Angry: ['Frustrated', 'Resentful', 'Irritated', 'Bitter', 'Betrayed', 'Furious', 'Annoyed', 'Hostile'],
  Scared: ['Terrified', 'Panicked', 'Worried', 'Helpless', 'Vulnerable', 'Insecure', 'Nervous'],
  Anxious: ['Overwhelmed', 'Restless', 'Uneasy', 'Tense', 'Dread', 'On edge', 'Hypervigilant'],
  Happy: ['Grateful', 'Content', 'Peaceful', 'Hopeful', 'Loved', 'Excited', 'Proud', 'Relieved'],
  Ashamed: ['Guilty', 'Embarrassed', 'Worthless', 'Small', 'Exposed', 'Humiliated'],
  Confused: ['Lost', 'Uncertain', 'Torn', 'Foggy', 'Disconnected', 'Blank'],
  Numb: ['Detached', 'Flat', 'Empty', 'Dissociated', 'Shutdown', 'Frozen'],
  Tired: ['Exhausted', 'Burnt out', 'Depleted', 'Heavy', 'Worn down', 'Fatigued'],
  Lonely: ['Isolated', 'Abandoned', 'Invisible', 'Disconnected', 'Misunderstood', 'Excluded'],
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
      const data = await getJournalEntries({ limit: 20, includePrivate: true });
      setEntries(Array.isArray(data) ? data : []);
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

      await saveJournalEntry({
        content: text || `Feeling: ${mood}`,
        mood: primaryEmotion,
        tags: subEmotions,
        private: isPrivate,
        user_id: 'fox',
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
                    <span className="entry-mood chip">{entry.mood}</span>
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
