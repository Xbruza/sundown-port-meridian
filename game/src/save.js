// Save and load: one versioned record in localStorage. A malformed save
// falls back to a fresh game instead of crashing, and reset is explicit.
import { SAVE_KEY, SAVE_VERSION } from './config.js';

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    missionIndex: 0,
    cash: 250,
    garage: [],
    station: 0,
    completed: [],
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (data.version !== SAVE_VERSION) return null;
    if (typeof data.cash !== 'number' || !Number.isFinite(data.cash)) return null;
    if (!Number.isInteger(data.missionIndex) || data.missionIndex < 0 || data.missionIndex > 7) return null;
    if (!Array.isArray(data.garage) || !Array.isArray(data.completed)) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: SAVE_VERSION }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage off */ }
}
