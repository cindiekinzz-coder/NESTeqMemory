// Cloud API for NESTeq Dashboard
// Replace with your deployed worker URL
const API_BASE = import.meta.env.VITE_API_URL || 'https://your-worker.workers.dev';

// Helper for fetch with error handling
async function apiFetch(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
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
    console.error(`API Error (${endpoint}):`, err);
    throw err;
  }
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

// === UPLINK ===
export async function getLatestUplink() {
  // Try the direct uplink endpoint
  const result = await apiFetch('/uplink?limit=1');
  console.log('Uplink API response:', result);
  return result;
}

export async function getUplinks(limit = 10) {
  return apiFetch(`/uplink?limit=${limit}`);
}

export async function sendUplink(data) {
  return apiFetch('/uplink', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// === JOURNAL ===
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
  return apiFetch('/feelings/surface');
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

// Export base URL for debugging
export { API_BASE };
