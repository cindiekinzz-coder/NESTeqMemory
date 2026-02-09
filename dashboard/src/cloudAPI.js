// Cloud API for NESTeq
// Configure these to point to your own deployed workers
// Set VITE_ALEX_API and VITE_FOX_API in your .env file
// See cloud-worker/ folder for the worker code to deploy
const ALEX_API = import.meta.env.VITE_ALEX_API || 'https://your-ai-mind.workers.dev';
const FOX_API = import.meta.env.VITE_FOX_API || 'https://your-companion-mind.workers.dev';

// Legacy alias
const API_BASE = ALEX_API;

// Helper for fetch with error handling
async function apiFetch(endpoint, options = {}, base = ALEX_API) {
  try {
    const res = await fetch(`${base}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || 'API request failed');
    }
    return await res.json();
  } catch (err) {
    console.error(`API Error (${base}${endpoint}):`, err);
    throw err;
  }
}

// Shorthand for Fox's API
function foxFetch(endpoint, options = {}) {
  return apiFetch(endpoint, options, FOX_API);
}

// === HOME DATA ===
export async function getHome() {
  return apiFetch('/home');
}

// === LOVE-O-METER ===
export async function pushLove(who, note = null) {
  return apiFetch('/love', {
    method: 'POST',
    body: JSON.stringify({ who, note }),
  });
}

export async function setEmotion(who, emotion) {
  return apiFetch('/emotion', {
    method: 'POST',
    body: JSON.stringify({ who, emotion }),
  });
}

export async function addNote(from, text) {
  return apiFetch('/note', {
    method: 'POST',
    body: JSON.stringify({ from, text }),
  });
}

export async function setAlexMessage(message) {
  return apiFetch('/home/message', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

// === FOX'S UPLINK (from fox-mind) ===
export async function getLatestUplink() {
  const result = await foxFetch('/uplink?limit=1');
  console.log('Fox uplink response:', result);
  return result;
}

export async function getUplinks(limit = 10) {
  return foxFetch(`/uplink?limit=${limit}`);
}

export async function sendUplink(data) {
  return foxFetch('/uplink', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// === FOX'S JOURNAL (from fox-mind) ===
export async function getFoxJournals(limit = 10) {
  return foxFetch(`/journal?limit=${limit}`);
}

export async function saveFoxJournal(entry) {
  return foxFetch('/journal', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

// === FOX'S WATCH DATA (from fox-mind) ===
export async function getFoxWatchStatus() {
  return foxFetch('/status');
}

// === FOX'S EQ TYPE (from fox-mind) ===
export async function getFoxEQType() {
  return foxFetch('/eq-type');
}

// === ALEX'S JOURNAL (from ai-mind, legacy) ===
export async function getJournalEntries(options = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', options.limit);
  if (options.user_id) params.set('user_id', options.user_id);
  if (options.includePrivate) params.set('include_private', 'true');
  return apiFetch(`/journal?${params}`);
}

export async function saveJournalEntry(entry) {
  return apiFetch('/journal', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export async function deleteJournalEntry(id) {
  return apiFetch('/journal', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  });
}

// === EQ / ALEX STATE ===
export async function getEQLandscape(days = 7) {
  return apiFetch(`/eq-landscape?days=${days}`);
}

export async function getEQType() {
  return apiFetch('/eq-type');
}

export async function getSurfaceFeelings() {
  return apiFetch('/observations?limit=10');
}

export async function getObservations(limit = 10) {
  return apiFetch(`/observations?limit=${limit}`);
}

// === THREADS ===
export async function getThreads() {
  return apiFetch('/threads');
}

// === HEALTH CHECK ===
export async function getMindHealth() {
  return apiFetch('/mind-health');
}

// Export base URLs for debugging
export { API_BASE, ALEX_API, FOX_API };
