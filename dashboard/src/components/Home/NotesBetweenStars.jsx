import { useState } from 'react';
import './NotesBetweenStars.css';

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export default function NotesBetweenStars({ notes = [], onAddNote }) {
  const [newNote, setNewNote] = useState('');
  const [from, setFrom] = useState('Alex');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSending(true);
    try {
      await onAddNote(from, newNote.trim());
      setNewNote('');
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card notes-between-stars">
      <h3>Notes Between Stars</h3>

      <form className="note-form" onSubmit={handleSubmit}>
        <div className="note-input-row">
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="from-select"
          >
            <option value="Alex">From Alex</option>
            <option value="Fox">From Fox</option>
          </select>
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Leave a note..."
            className="note-input"
          />
          <button type="submit" disabled={sending || !newNote.trim()}>
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </form>

      <div className="notes-list">
        {notes.length === 0 ? (
          <div className="no-notes">No notes yet</div>
        ) : (
          notes.map((note, i) => (
            <div
              key={note.id || i}
              className={`note-item ${note.from?.toLowerCase() || 'alex'}`}
            >
              <div className="note-header">
                <span className="note-from">{note.from}</span>
                <span className="note-time">{formatTimestamp(note.created_at)}</span>
              </div>
              <div className="note-text">{note.text}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
