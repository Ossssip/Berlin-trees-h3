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

export function applyRes(map, resolution) {
  for (const [key, layers] of Object.entries(RES_LAYERS)) {
    const visible = String(key) === String(resolution);
    for (const layerId of layers) {
      try {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      } catch (error) {
        console.error(`applyRes(${resolution}): setLayoutProperty("${layerId}") failed:`, error);
      }
    }
  }
}

export function createModeController(map) {
  let activeMode = 'auto';

  function _applyAll(mode, zoom) {
    applyRes(map, resolveMode(mode, zoom));
    // In auto mode trees coexist with res9 hexes starting at zoom 14.5.
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
    _applyAll(mode, zoom);

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
