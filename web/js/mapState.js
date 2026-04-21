/**
 * mapState.js — Persist and restore map view state via localStorage.
 *
 * Stored schema:
 *   { zoom, center: [lng, lat], mode, forestEnabled, latched: { layerId, props, type } | null }
 */

const KEY = 'berlin_trees_map_state';

export function loadState() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; }
  catch { return {}; }
}

export function saveState(patch) {
  try {
    const current = loadState();
    localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
  } catch {}
}
