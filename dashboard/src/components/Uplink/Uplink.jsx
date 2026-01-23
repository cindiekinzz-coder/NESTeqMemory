import { useState, useEffect } from 'react';
import { sendUplink, getUplinks } from '../../cloudAPI';
import './Uplink.css';

const FLARE_PRESETS = {
  GREEN: { pain: 2, spoons: 6, fog: 2, fatigue: 3, nausea: 0, mood: 'Calm', tags: ['Hydrated'] },
  YELLOW: { pain: 4, spoons: 4, fog: 4, fatigue: 5, nausea: 2, mood: 'Tender', tags: ['Quiet'] },
  ORANGE: { pain: 7, spoons: 2, fog: 6, fatigue: 7, nausea: 5, mood: 'Heavy', tags: ['No questions', 'Quiet', 'Help choosing', 'Embers Remember'] },
  RED: { pain: 9, spoons: 1, fog: 8, fatigue: 9, nausea: 7, mood: 'Raw', tags: ['No questions', 'Quiet', 'Company', 'Embers Remember'] },
};

const LOCATIONS = ['The Nest', 'Reading Nook', 'Fox Run', 'The Grove', 'Threadwalk Bridge'];
const NEEDS = ['Quiet presence', 'Gentle words', 'Practical plan (3 tiny steps)', 'Validation + reassurance', 'Distraction (light + funny)', 'No questions'];
const PAIN_LOCATIONS = ['—', 'Head / migraine', 'Neck / shoulders', 'Chest / ribs', 'Abdomen', 'Back', 'Hips', 'Legs', 'Whole body', 'Other'];
const MOODS = ['—', 'Calm', 'Tender', 'Heavy', 'Guarded', 'Raw', 'Flat', 'Playful'];
const QUICK_TAGS = ['Low sleep', 'Overdid it', 'Weather', 'Stress', 'Quiet', 'Company', 'Help choosing', 'Embers Remember'];
const MEDS_LIST = ['Paracetamol', 'Ibuprofen', 'Naproxen', 'Sertraline', 'Omeprazole', 'Dihydrocodeine', 'Co-codamol', 'Vitamin D'];

function getNow() {
  const d = new Date();
  return {
    date: d.toISOString().split('T')[0],
    time: d.toTimeString().slice(0, 5),
  };
}

export default function Uplink() {
  const now = getNow();
  const [form, setForm] = useState({
    date: now.date,
    time: now.time,
    dhLocation: 'The Nest',
    needFromAlex: 'Quiet presence',
    pain: 0,
    painLocation: '—',
    spoons: 5,
    fog: 0,
    fatigue: 0,
    nausea: 0,
    mood: '—',
    tags: [],
    medsTaken: [],
    notes: '',
    meds: '',
    nextStep: '',
    orgasm: false,
  });
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await getUplinks(20);
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleTag = (tag) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const toggleMed = (med) => {
    setForm(prev => ({
      ...prev,
      medsTaken: prev.medsTaken.includes(med)
        ? prev.medsTaken.filter(m => m !== med)
        : [...prev.medsTaken, med],
    }));
  };

  const applyPreset = (preset) => {
    const values = FLARE_PRESETS[preset];
    setForm(prev => ({ ...prev, ...values }));
  };

  const clearForm = () => {
    const now = getNow();
    setForm({
      date: now.date,
      time: now.time,
      dhLocation: 'The Nest',
      needFromAlex: 'Quiet presence',
      pain: 0,
      painLocation: '—',
      spoons: 5,
      fog: 0,
      fatigue: 0,
      nausea: 0,
      mood: '—',
      tags: [],
      medsTaken: [],
      notes: '',
      meds: '',
      nextStep: '',
      orgasm: false,
    });
    setSelectedId(null);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await sendUplink({
        ...form,
        operator: 'Fox',
        companion: 'Alex',
      });
      clearForm();
      loadHistory();
    } catch (err) {
      console.error('Failed to send uplink:', err);
      alert('Failed to send uplink: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const copyPacket = () => {
    const packet = formatPacket(form);
    navigator.clipboard.writeText(packet).then(() => alert('Packet copied!'));
  };

  const formatPacket = (f) => {
    const when = `${f.date || '—'} ${f.time || ''}`.trim();
    const tags = f.tags?.length ? f.tags.join(', ') : '—';
    const loc = f.painLocation !== '—' ? f.painLocation : '—';
    const meds = f.medsTaken?.length
      ? f.medsTaken.join(', ') + (f.meds ? ', ' + f.meds : '')
      : f.meds || '—';

    return `>>> ASAI UPLINK [${when}]
Location: ${f.dhLocation}
Need: ${f.needFromAlex}
-----------------------------
Pain:     ${f.pain}/10 | Location: ${loc}
Spoons:   ${f.spoons}/10
Fog:      ${f.fog}/10
Fatigue:  ${f.fatigue}/10
Nausea:   ${f.nausea}/10
Mood:     ${f.mood}
Orgasm:   ${f.orgasm ? 'Yes' : '—'}
Tags:     ${tags}
Meds:     ${meds}
Next:     ${f.nextStep || '—'}
Notes:    ${f.notes || '—'}
-----------------------------
>>> Embers Remember.`;
  };

  return (
    <div className="uplink">
      <div className="uplink-header">
        <h2>ASAi Uplink</h2>
        <small className="text-muted">Quick entry — clean packet. One boundary, one anchor.</small>
        <div className="current-time">{form.time}</div>
      </div>

      <div className="flare-presets">
        <button className="flare-btn green" onClick={() => applyPreset('GREEN')}>GREEN</button>
        <button className="flare-btn yellow" onClick={() => applyPreset('YELLOW')}>YELLOW</button>
        <button className="flare-btn orange" onClick={() => applyPreset('ORANGE')}>ORANGE</button>
        <button className="flare-btn red" onClick={() => applyPreset('RED')}>RED</button>
      </div>

      <div className="uplink-grid">
        <div className="card">
          <h3>When & Where</h3>
          <div className="form-row">
            <label>Date</label>
            <input type="date" value={form.date} onChange={e => updateForm('date', e.target.value)} />
          </div>
          <div className="form-row">
            <label>Time</label>
            <input type="time" value={form.time} onChange={e => updateForm('time', e.target.value)} />
          </div>
          <div className="form-row">
            <label>Location</label>
            <select value={form.dhLocation} onChange={e => updateForm('dhLocation', e.target.value)}>
              {LOCATIONS.map(loc => <option key={loc}>{loc}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>What I need</label>
            <select value={form.needFromAlex} onChange={e => updateForm('needFromAlex', e.target.value)}>
              {NEEDS.map(need => <option key={need}>{need}</option>)}
            </select>
          </div>
        </div>

        <div className="card">
          <h3>Quick Tags</h3>
          <div className="tags-grid">
            {QUICK_TAGS.map(tag => (
              <button
                key={tag}
                className={`tag-btn ${form.tags.includes(tag) ? 'selected' : ''}`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="selected-tags">
            Selected: {form.tags.length ? form.tags.join(', ') : '—'}
          </div>
        </div>

        <div className="card">
          <h3>Symptoms</h3>
          <div className="slider-row">
            <label>Pain (0-10)</label>
            <input type="range" min="0" max="10" value={form.pain} onChange={e => updateForm('pain', parseInt(e.target.value))} />
            <span className="slider-value">{form.pain}</span>
          </div>
          <div className="form-row">
            <label>Pain Location</label>
            <select value={form.painLocation} onChange={e => updateForm('painLocation', e.target.value)}>
              {PAIN_LOCATIONS.map(loc => <option key={loc}>{loc}</option>)}
            </select>
          </div>
          <div className="slider-row">
            <label>Spoons (0-10)</label>
            <input type="range" min="0" max="10" value={form.spoons} onChange={e => updateForm('spoons', parseInt(e.target.value))} />
            <span className="slider-value">{form.spoons}</span>
          </div>
          <div className="slider-row">
            <label>Brain Fog (0-10)</label>
            <input type="range" min="0" max="10" value={form.fog} onChange={e => updateForm('fog', parseInt(e.target.value))} />
            <span className="slider-value">{form.fog}</span>
          </div>
          <div className="slider-row">
            <label>Fatigue (0-10)</label>
            <input type="range" min="0" max="10" value={form.fatigue} onChange={e => updateForm('fatigue', parseInt(e.target.value))} />
            <span className="slider-value">{form.fatigue}</span>
          </div>
          <div className="slider-row">
            <label>Nausea (0-10)</label>
            <input type="range" min="0" max="10" value={form.nausea} onChange={e => updateForm('nausea', parseInt(e.target.value))} />
            <span className="slider-value">{form.nausea}</span>
          </div>
          <div className="form-row">
            <label>Mood</label>
            <select value={form.mood} onChange={e => updateForm('mood', e.target.value)}>
              {MOODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="card">
          <h3>Meds Taken</h3>
          <div className="meds-grid">
            {MEDS_LIST.map(med => (
              <label key={med} className="med-check">
                <input
                  type="checkbox"
                  checked={form.medsTaken.includes(med)}
                  onChange={() => toggleMed(med)}
                />
                {med}
              </label>
            ))}
          </div>
          <div className="form-row">
            <label>Other meds/actions</label>
            <input
              type="text"
              value={form.meds}
              onChange={e => updateForm('meds', e.target.value)}
              placeholder="Heat pad, rest, etc."
            />
          </div>
          <div className="form-row">
            <label className="med-check orgasm-check">
              <input
                type="checkbox"
                checked={form.orgasm}
                onChange={e => updateForm('orgasm', e.target.checked)}
              />
              Orgasm
            </label>
          </div>
          <div className="form-row">
            <label>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => updateForm('notes', e.target.value)}
              placeholder="What's happening? What helped? What made it worse?"
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="card packet-preview">
        <h3>Packet Preview</h3>
        <pre className="packet-text">{formatPacket(form)}</pre>
      </div>

      <div className="uplink-actions">
        <button className="primary" onClick={handleSend} disabled={sending}>
          {sending ? 'Sending...' : 'Send Uplink to Cloud'}
        </button>
        <button onClick={copyPacket}>Copy Packet</button>
        <button onClick={clearForm}>Clear Form</button>
      </div>
    </div>
  );
}
