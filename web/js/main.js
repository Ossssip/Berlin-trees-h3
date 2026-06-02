import { setupControls } from './controls.js';
import { registerMissingImagePlaceholder, loadPhylopicIcons, loadPhylopicIndex } from './icons.js';
import { addMapLayers, updateGenusLabelFilter } from './layers.js';
import { createModeController } from './mode.js';
import { setupInfoCard, updateColorbar, clearSelection, resetHighlight, setForestEnabled } from './info.js';
import { loadState, saveState } from './mapState.js';

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile.bind(protocol));

const DATA_SOURCES_URL = 'https://github.com/Ossssip/Berlin-trees-hex/blob/main/docs/data_sources.md';
const ATTRIBUTION = [
  `Street &amp; park trees, forests, admin boundaries: <a href="${DATA_SOURCES_URL}" target="_blank" rel="noopener">Senatsverwaltung Berlin</a>, <a href="https://www.govdata.de/dl-de/zero-2-0" target="_blank" rel="noopener">dl-de/zero-2-0</a>`,
  `Grün Berlin trees: <a href="${DATA_SOURCES_URL}" target="_blank" rel="noopener">Grün Berlin GmbH</a>, <a href="https://www.govdata.de/dl-de/by-2-0" target="_blank" rel="noopener">dl-de/by-2-0</a>`,
  `Tree silhouettes: <a href="https://www.phylopic.org" target="_blank" rel="noopener">PhyloPic</a>, <a href="${DATA_SOURCES_URL}#tree-silhouettes" target="_blank" rel="noopener">attributions</a>`,
];

// Tiles are served from GitHub Pages when it supports byte-range (HTTP 206)
// requests; otherwise the map falls back to the Cloudflare Worker mirror.
const WORKER_TILES_URL = 'pmtiles://https://berlin-trees-pmtiles.ossssip.workers.dev/';

async function resolveTilesUrl() {
  const pagesHttp = new URL('../public/berlin_trees.pmtiles', import.meta.url).href;
  try {
    const res = await fetch(pagesHttp, { headers: { Range: 'bytes=0-6' } });
    if (res.status === 206) {
      const magic = new TextDecoder().decode(new Uint8Array(await res.arrayBuffer()));
      if (magic.startsWith('PMTiles')) return `pmtiles://${pagesHttp}`;
    }
  } catch (_) { /* network error — fall back to the worker */ }
  return WORKER_TILES_URL;
}

const _saved = loadState();

// Berlin extent — fit the whole city to the screen on load (desktop + mobile).
const BERLIN_BOUNDS = [[13.088, 52.338], [13.761, 52.675]];

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json',
  bounds: BERLIN_BOUNDS,
  fitBoundsOptions: { padding: 16 },
  attributionControl: false,
});

map.addControl(new maplibregl.AttributionControl({ customAttribution: ATTRIBUTION, compact: true }), 'bottom-right');
map.addControl(new maplibregl.NavigationControl(), 'top-left');
registerMissingImagePlaceholder(map);

let phylopicIndex = {};
const getPhylopicIndex = () => phylopicIndex;

map.on('load', async () => {
  const tilesUrl = await resolveTilesUrl();

  addMapLayers(map, tilesUrl);

  loadPhylopicIndex()
    .then((index) => {
      phylopicIndex = index;
      return loadPhylopicIcons(map, index).then(() => {
        const withIcon = Object.keys(index).filter(g => index[g] !== null);
        updateGenusLabelFilter(map, withIcon);
      });
    })
    .catch(() => {});

  // When the displayed resolution changes (mode switch OR auto-mode zoom across
  // a threshold) update the colorbar/density scale for that resolution and clear
  // any stale highlight.
  const { getActiveMode, setActiveMode, syncToZoom } = createModeController(map, (res) => {
    resetHighlight();
    updateColorbar(res);
  });

  setupInfoCard(map, getPhylopicIndex, {
    onLatchChange: (latchState) => saveState({ latched: latchState }),
  });
  if (_saved.forestEnabled === false) setForestEnabled(false);

  // onModeChange: the colorbar/scale is handled by the resolution-change callback
  // above (which knows the resolved resolution, e.g. auto → res7/8/9).
  function onModeChange(mode) {
    clearSelection();
    saveState({ mode });
  }

  setupControls(map, setActiveMode, getActiveMode, onModeChange, {
    mode: 'auto',
    forestEnabled: _saved.forestEnabled,
    onForestChange: (enabled) => { saveState({ forestEnabled: enabled }); setForestEnabled(enabled); },
  });

  // Save position on every pan/zoom end
  map.on('moveend', () => {
    const c = map.getCenter();
    saveState({ zoom: map.getZoom(), center: [c.lng, c.lat] });
  });

  map.on('zoom', syncToZoom);

  // Show attribution expanded on load, auto-collapse after 10s
  const attrEl = document.querySelector('.maplibregl-ctrl-attrib');
  if (attrEl) {
    attrEl.classList.add('maplibregl-compact-show');
    setTimeout(() => attrEl.classList.remove('maplibregl-compact-show'), 10000);
  }
});
