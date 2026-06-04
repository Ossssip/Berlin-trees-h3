import { setupControls } from './controls.js';
import { registerMissingImagePlaceholder, loadPhylopicIcons, loadPhylopicIndex } from './icons.js';
import { addMapLayers, updateGenusLabelFilter } from './layers.js';
import { createModeController } from './mode.js';
import { setupInfoCard, updateColorbar, clearSelection, resetHighlight, setForestEnabled } from './info.js';
import { loadState, saveState } from './mapState.js';

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile.bind(protocol));

const REPO_URL = 'https://github.com/Ossssip/Berlin-trees-h3';
const DATA_SOURCES_URL = `${REPO_URL}/blob/main/docs/data_sources.md`;
const ATTRIBUTION = [
  `Street &amp; park trees, forests, admin boundaries: <a href="${DATA_SOURCES_URL}" target="_blank" rel="noopener">Senatsverwaltung Berlin</a>, <a href="https://www.govdata.de/dl-de/zero-2-0" target="_blank" rel="noopener">dl-de/zero-2-0</a>`,
  `Grün Berlin trees: <a href="${DATA_SOURCES_URL}" target="_blank" rel="noopener">Grün Berlin GmbH</a>, <a href="https://www.govdata.de/dl-de/by-2-0" target="_blank" rel="noopener">dl-de/by-2-0</a>`,
  `Tree silhouettes: <a href="https://www.phylopic.org" target="_blank" rel="noopener">PhyloPic</a>, <a href="${DATA_SOURCES_URL}#tree-silhouettes" target="_blank" rel="noopener">attributions</a>`,
];

// The tiles ship as one "bundle" file: several independent PMTiles archives
// (one per resolution / forests / admin / trees) concatenated behind a small
// header + JSON manifest that records each archive's [offset, length]. The map
// registers one pmtiles source per archive, each reading the bundle at its own
// byte offset, so only the visible resolution's tiles are ever fetched.
//
// Bundle layout:  "PMBUNDLE"(8) | manifestLen(uint64 BE, 8) | manifest JSON | archives…
const BUNDLE_MAGIC = 'PMBUNDLE';
const BUNDLE_HEADER = 16; // magic(8) + manifestLen(8)

// Served from GitHub Pages when it supports byte-range (HTTP 206) requests;
// otherwise the map falls back to the Cloudflare Worker mirror of the bundle.
const WORKER_BUNDLE_URL = 'https://berlin-trees-pmtiles.ossssip.workers.dev/';

// A pmtiles Source that maps an archive's internal offsets onto a byte range
// inside the shared bundle file by adding a fixed base offset to every read.
class OffsetSource {
  constructor(name, url, base) { this._name = name; this._url = url; this._base = base; }
  getKey() { return this._name; }
  async getBytes(offset, length, signal) {
    const start = this._base + offset;
    const end = start + length - 1;
    const res = await fetch(this._url, { signal, headers: { Range: `bytes=${start}-${end}` } });
    if (res.status !== 206 && res.status !== 200) throw new Error(`bundle range ${res.status}`);
    return { data: await res.arrayBuffer() };
  }
}

async function readBundleManifest(url) {
  const head = await fetch(url, { headers: { Range: 'bytes=0-' + (BUNDLE_HEADER - 1) } });
  if (head.status !== 206) throw new Error('no range support');
  const buf = new Uint8Array(await head.arrayBuffer());
  if (new TextDecoder().decode(buf.slice(0, 8)) !== BUNDLE_MAGIC) throw new Error('not a bundle');
  const dv = new DataView(buf.buffer);
  const manifestLen = dv.getUint32(8) * 2 ** 32 + dv.getUint32(12); // uint64 BE
  const manRes = await fetch(url, { headers: { Range: `bytes=${BUNDLE_HEADER}-${BUNDLE_HEADER + manifestLen - 1}` } });
  const manifest = JSON.parse(new TextDecoder().decode(await manRes.arrayBuffer()));
  return { manifest, sectionStart: BUNDLE_HEADER + manifestLen };
}

// Register one pmtiles archive per bundle entry; returns { sourceName: 'pmtiles://name' }.
async function resolveSources() {
  const pagesHttp = new URL('../public/berlin_trees.pmtiles', import.meta.url).href;
  let url = pagesHttp;
  let info;
  try {
    info = await readBundleManifest(pagesHttp);
  } catch (_) {
    url = WORKER_BUNDLE_URL;
    info = await readBundleManifest(url);
  }
  const sources = {};
  for (const a of info.manifest.archives) {
    const p = new pmtiles.PMTiles(new OffsetSource(a.name, url, info.sectionStart + a.offset));
    protocol.add(p);
    sources[a.name] = `pmtiles://${a.name}`;
  }
  return sources;
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
  const sources = await resolveSources();

  addMapLayers(map, sources);

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

  // onModeChange: the colorbar/scale is handled by the resolution-change callback
  // above (which knows the resolved resolution, e.g. auto → res7/8/9).
  function onModeChange(mode) {
    clearSelection();
    saveState({ mode });
  }

  setupControls(map, setActiveMode, getActiveMode, onModeChange, {
    mode: 'auto',
    // Forests are always enabled on load (the toggle no longer persists).
    onForestChange: (enabled) => { setForestEnabled(enabled); },
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

  // Pin a "github repo" link at the very end of the attribution. MapLibre sorts
  // its attribution entries by length and rebuilds the inner HTML on updates, so
  // a customAttribution can't be forced last — append to the DOM directly and
  // re-append whenever MapLibre regenerates it.
  const REPO_LINK = ` | <a class="repo-attrib" href="${REPO_URL}" target="_blank" rel="noopener">GitHub repo</a>`;
  function ensureRepoAttrib() {
    const inner = document.querySelector('.maplibregl-ctrl-attrib-inner');
    if (inner && !inner.querySelector('a.repo-attrib')) inner.insertAdjacentHTML('beforeend', REPO_LINK);
  }
  if (attrEl) new MutationObserver(ensureRepoAttrib).observe(attrEl, { childList: true, subtree: true });
  ensureRepoAttrib();
});
