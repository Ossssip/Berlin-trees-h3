import { RES_LAYERS } from './config.js';

export function autoResForZoom(zoom) {
  if (zoom >= 14) return 9;
  if (zoom >= 12) return 8;
  if (zoom >= 10) return 7;
  return 6;
}

export function resolveMode(mode, zoom) {
  return mode === 'auto' ? autoResForZoom(zoom) : mode;
}

// Constant fill-opacity of the H3/admin fills (see layers.js); keep in sync if
// the fill opacity there changes.
const FILL_OPACITY = 0.65;

function _setVisible(map, layerId, visible) {
  try {
    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
  } catch (error) {
    console.error(`applyRes: setLayoutProperty("${layerId}") failed:`, error);
  }
}

// Set a fill's opacity instantly (no transition), so revealing/zeroing the fill
// never animates.
function _setFillOpacity(map, fillLayerId, value) {
  try {
    map.setPaintProperty(fillLayerId, 'fill-opacity-transition', { duration: 0, delay: 0 });
    map.setPaintProperty(fillLayerId, 'fill-opacity', value);
  } catch (_) { /* layer absent */ }
}

// Pending deferred-swap state (so a rapid second switch supersedes the first).
let _hideToken = 0;
let _hideTimer = null;   // readiness fallback timeout
let _hideRender = null;

function _clearPendingHide(map) {
  if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
  if (_hideRender) { map.off('render', _hideRender); _hideRender = null; }
}

// Switch the visible resolution without ever drawing anything half-loaded: the
// new fill is revealed at opacity 0 (invisible, but enough to fetch its tiles)
// while its outline/labels/icons stay hidden, and the old resolution stays fully
// on screen. Only once the new source is *fully* loaded for the viewport do we
// show the new layers and hide the old ones — an instant swap of fully-rendered
// tiles, no crossfade.
export function applyRes(map, resolution) {
  const key = String(resolution);
  _clearPendingHide(map);
  const token = ++_hideToken;

  const targetLayers = RES_LAYERS[key] || [];
  const newFill = targetLayers.find((id) => id.endsWith('-fill'));

  // Old layers to hide once the new resolution is ready; trees-circle off now
  // (it is re-shown explicitly for auto mode and never causes the resolution-swap flicker).
  const toHide = [];
  for (const [k, layers] of Object.entries(RES_LAYERS)) {
    if (k === key) continue;
    for (const layerId of layers) {
      if (layerId === 'trees-circle') { _setVisible(map, layerId, false); continue; }
      toHide.push(layerId);
    }
  }

  // Start loading the new source. With a fill, keep it invisible (opacity 0) and
  // its overlays hidden until ready; without one (trees mode) just reveal it.
  if (newFill) {
    _setFillOpacity(map, newFill, 0);
    _setVisible(map, newFill, true);
  } else {
    for (const layerId of targetLayers) _setVisible(map, layerId, true);
  }

  const newSource = newFill ? map.getLayer(newFill)?.source : null;
  const ready = () => {
    if (!newSource) return true;
    try {
      return map.isSourceLoaded(newSource) &&
        map.queryRenderedFeatures({ layers: [newFill] }).length > 0;
    } catch (_) { return true; }
  };

  const commit = () => {
    if (token !== _hideToken) return;   // superseded by a newer switch
    _clearPendingHide(map);
    if (newFill) {
      _setFillOpacity(map, newFill, FILL_OPACITY);
      for (const layerId of targetLayers) _setVisible(map, layerId, true);
    }
    for (const layerId of toHide) _setVisible(map, layerId, false);
  };

  if (ready()) { commit(); return; }
  _hideRender = () => { if (ready()) commit(); };
  map.on('render', _hideRender);
  _hideTimer = setTimeout(commit, 1500);   // fallback: never keep both forever
}

export function createModeController(map, onResolutionChange) {
  let activeMode = 'auto';
  let lastRes = null;

  // force=true re-applies layer visibility even if the resolution is unchanged
  // (needed on an explicit mode switch); zoom events skip the work unless the
  // resolved resolution actually changes, avoiding ~30 setLayoutProperty/frame.
  function _applyAll(mode, zoom, force = false) {
    const res = resolveMode(mode, zoom);
    const changed = res !== lastRes;
    // Clear any latched/hover highlight the moment the resolution changes —
    // BEFORE applyRes starts loading the new layer — so the stale outline (whose
    // polygon no longer corresponds to a visible feature) vanishes immediately
    // instead of lingering through the swap.
    if (changed) {
      lastRes = res;
      onResolutionChange?.(res);
    }
    if (force || changed) {
      applyRes(map, res);
    }
    // In auto mode trees coexist with res9 cells starting at zoom 14.5.
    // Explicit 'trees' mode is handled by applyRes already.
    if (mode === 'auto') {
      try {
        map.setLayoutProperty('trees-circle', 'visibility', zoom >= 14.5 ? 'visible' : 'none');
      } catch (_) {}
    }
  }

  function _updateAutoGhost(mode, zoom) {
    const track = document.getElementById('seg-track');
    if (!track) return;
    track.querySelectorAll('.seg-btn').forEach((btn) => btn.classList.remove('auto-active'));
    if (mode === 'auto') {
      const res = autoResForZoom(zoom);
      track.querySelector(`[data-mode="${res}"]`)?.classList.add('auto-active');
    }
  }

  function setActiveMode(mode) {
    activeMode = mode;
    const zoom = map.getZoom();
    _applyAll(mode, zoom, true);

    const track = document.getElementById('seg-track');
    const thumb = document.getElementById('seg-thumb');
    const autoButton = document.getElementById('btn-auto');
    const trackButton = track.querySelector(`[data-mode="${mode}"]`);

    if (trackButton) {
      thumb.style.opacity = '1';
      thumb.style.left = `${trackButton.offsetLeft}px`;
      thumb.style.width = `${trackButton.offsetWidth}px`;
    } else {
      thumb.style.opacity = '0';
    }

    track.querySelectorAll('.seg-btn').forEach((candidate) => {
      candidate.classList.toggle('active', candidate.dataset.mode === mode);
    });

    if (autoButton) {
      autoButton.classList.toggle('active', mode === 'auto');
      autoButton.setAttribute('aria-pressed', mode === 'auto' ? 'true' : 'false');
    }

    _updateAutoGhost(mode, zoom);
  }

  function syncToZoom() {
    const zoom = map.getZoom();
    _applyAll(activeMode, zoom);
    _updateAutoGhost(activeMode, zoom);
  }

  function getActiveMode() {
    return activeMode;
  }

  return { getActiveMode, setActiveMode, syncToZoom };
}
