import { HEX_COLOR, HEX_ICON_SIZES, ADMIN_ICON_SIZES, HEX_RESOLUTIONS } from './config.js';
import { buildForestIconImageExpr } from './icons.js';

const HEX_OUTLINE_WIDTH = ['interpolate', ['linear'], ['zoom'], 4, 0.5, 14, 0.5, 15, 0.8, 17, 1.2];
const ADMIN_OUTLINE_WIDTH = (baseWidth) => ['interpolate', ['linear'], ['zoom'], 4, baseWidth, 14, baseWidth, 15, baseWidth + 0.6, 17, baseWidth + 1.2];

// Minimum zoom at which centroid icons appear (step: hidden below, visible at/above)
const HEX_ICON_MIN_ZOOM  = { 6: 7, 7: 9, 8: 11, 9: 12 };
const ADMIN_ICON_MIN_ZOOM = { bezirke: 8, ortsteile: 9 };

// Density colour ramp — breakpoints expressed as fractions of a configurable max.
// Call updateDensityScale(map, p95) when the active resolution changes.
const DENSITY_STOPS_BASE = [0, '#c7e9c0', 0.10, '#74c476', 0.40, '#238b45', 1.0, '#005a32'];

export function densityColorExpr(p95) {
  const max = Math.max(p95, 1);
  return [
    'interpolate', ['linear'], ['coalesce', ['get', 'tree_density_km2'], 0],
    0,              '#c7e9c0',
    max * 0.10,     '#74c476',
    max * 0.40,     '#238b45',
    max,            '#005a32',
  ];
}

const INITIAL_P95 = 2818; // res7 default on load

export function updateDensityScale(map, p95) {
  const expr = densityColorExpr(p95);
  for (const resolution of HEX_RESOLUTIONS) {
    const sl = `hexes_res${resolution}`;
    try { map.setPaintProperty(`${sl}-fill`, 'fill-color', expr); } catch (_) {}
    try { map.setPaintProperty(`${sl}-label-genus`, 'text-color', expr); } catch (_) {}
  }
  for (const admin of ['bezirke', 'ortsteile']) {
    try { map.setPaintProperty(`admin_${admin}-fill`, 'fill-color', expr); } catch (_) {}
    try { map.setPaintProperty(`admin_${admin}-label`, 'text-color', expr); } catch (_) {}
  }
}

const HAS_TREES = ['!=', ['coalesce', ['get', 'dominant_genus'], ''], ''];

export function updateGenusLabelFilter(map, loadedGenera) {
  const filter = ['all', HAS_TREES, ['!', ['in', ['get', 'dominant_genus'], ['literal', loadedGenera]]]];
  for (const resolution of HEX_RESOLUTIONS) {
    try { map.setFilter(`hexes_res${resolution}-label-genus`, filter); } catch (_) {}
  }
  for (const admin of ['bezirke', 'ortsteile']) {
    try { map.setFilter(`admin_${admin}-label`, filter); } catch (_) {}
  }
}

function createLetterBg(size = 32) {
  const data = new Uint8Array(size * size * 4);
  const cx = (size - 1) / 2;
  const r  = size / 2 - 1.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (Math.hypot(x - cx, y - cx) <= r) {
        const i = (y * size + x) * 4;
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
      }
    }
  }
  return { width: size, height: size, data };
}

function createDotPattern(color = 'white', size = 10, dotRadius = 2, yOffset = 0) {
  const scratch = document.createElement('canvas').getContext('2d');
  scratch.fillStyle = color;
  scratch.fillRect(0, 0, 1, 1);
  const [r, g, b] = scratch.getImageData(0, 0, 1, 1).data;
  const data = new Uint8Array(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (((size - 1) / 2 + yOffset) % size + size) % size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // toroidal distance so the dot tiles seamlessly even when offset
      const ddx = Math.min(Math.abs(x - cx), size - Math.abs(x - cx));
      const ddy = Math.min(Math.abs(y - cy), size - Math.abs(y - cy));
      // antialiased edge: full alpha inside, smooth ~1px falloff at the rim
      const coverage = Math.min(Math.max(dotRadius + 0.5 - Math.hypot(ddx, ddy), 0), 1);
      if (coverage > 0) {
        const i = (y * size + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = Math.round(coverage * 255);
      }
    }
  }
  return { width: size, height: size, data };
}

function createHatchPattern(color = '#2a5e30', size = 16, lineWidth = 3) {
  const scratch = document.createElement('canvas').getContext('2d');
  scratch.fillStyle = color;
  scratch.fillRect(0, 0, 1, 1);
  const [r, g, b] = scratch.getImageData(0, 0, 1, 1).data;
  const data = new Uint8Array(size * size * 4);
  const halfWidth = Math.floor(lineWidth / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const diagonal = ((x + y) % size + size) % size;
      if (diagonal <= halfWidth || diagonal >= size - halfWidth) {
        const index = (y * size + x) * 4;
        data[index] = r; data[index + 1] = g; data[index + 2] = b; data[index + 3] = 255;
      }
    }
  }
  return { width: size, height: size, data };
}

// text-size mirrors icon-size × 32 (icon px → CSS px at 2× DPR)
const HEX_LABEL_SIZES = {
  6: ['interpolate', ['exponential', 2], ['zoom'],  6,   1.9, 14, 477],
  7: ['interpolate', ['exponential', 2], ['zoom'],  8,   2.9, 14, 182],
  8: ['interpolate', ['exponential', 2], ['zoom'], 10,   4.3, 14,  68],
  9: ['interpolate', ['exponential', 2], ['zoom'], 11,   3.2, 14,  26],
};
const ADMIN_LABEL_SIZES = {
  bezirke:  ['interpolate', ['exponential', 2], ['zoom'],  6,  3.2, 12, 102],
  ortsteile:['interpolate', ['exponential', 2], ['zoom'],  8,  2.9, 14, 182],
};
// Circle bg: 1.8× the tree-icon size (circle SDF is 32px, icon SDF is 64px,
// so circle icon-size = tree_icon-size × 1.8 × 2 = tree_icon-size × 3.6 / 2... simplified:
// text = icon × 32, circle display = text × 1.8, circle icon-size = text × 1.8 / 32 = icon × 1.8)
const HEX_LABEL_CIRCLE_SIZES = {
  6: ['interpolate', ['exponential', 2], ['zoom'],  6, 0.10, 14, 26.8],
  7: ['interpolate', ['exponential', 2], ['zoom'],  8, 0.16, 14, 10.3],
  8: ['interpolate', ['exponential', 2], ['zoom'], 10, 0.24, 14,  3.8],
  9: ['interpolate', ['exponential', 2], ['zoom'], 11, 0.18, 14,  1.5],
};
const ADMIN_LABEL_CIRCLE_SIZES = {
  bezirke:  ['interpolate', ['exponential', 2], ['zoom'],  6, 0.18, 12,  5.8],
  ortsteile:['interpolate', ['exponential', 2], ['zoom'],  8, 0.16, 14, 10.3],
};

// First letter of dominant_genus, '?' for Unbekannt/empty.
const GENUS_LABEL_FIELD = ['case',
  ['any',
    ['==', ['coalesce', ['get', 'dominant_genus'], ''], ''],
    ['==', ['downcase', ['coalesce', ['get', 'dominant_genus'], '']], 'unbekannt'],
  ],
  '?',
  ['slice', ['upcase', ['coalesce', ['get', 'dominant_genus'], '']], 0, 1],
];

export function addMapLayers(map, tilesUrl) {
  const forestIconImage = buildForestIconImageExpr();
  const initialDensityColor = densityColorExpr(INITIAL_P95);

  map.addImage('letter-bg', createLetterBg(), { sdf: true });
  map.addSource('berlin-trees', { type: 'vector', url: tilesUrl });

  // Pass 1: hex fills only — forest layers inserted after, so they render above fills
  for (const resolution of HEX_RESOLUTIONS) {
    const sourceLayer = `hexes_res${resolution}`;
    map.addLayer({
      id: `${sourceLayer}-fill`,
      type: 'fill',
      source: 'berlin-trees',
      'source-layer': sourceLayer,
      layout: { visibility: resolution === 7 ? 'visible' : 'none' },
      paint: { 'fill-color': initialDensityColor, 'fill-opacity': 0.65 },
    });
  }

  // 2× supersampled (pixelRatio 2) → 5 CSS-px spacing, 2.5-px radius, smooth round dots
  map.addImage('forest-dots', createDotPattern('#13321a', 10, 5, 10), { pixelRatio: 2 });
  const dotPattern = 'forest-dots';

  // Pass 2: hex outlines + centroids
  for (const resolution of HEX_RESOLUTIONS) {
    const sourceLayer = `hexes_res${resolution}`;
    const fcp = ['coalesce', ['get', 'forest_cover_pct'], 0];
    const dualForestBand = ['all', ['>=', fcp, 33], ['<=', fcp, 67]];
    const minZoom = HEX_ICON_MIN_ZOOM[resolution];

    map.addLayer({
      id: `${sourceLayer}-outline`,
      type: 'line',
      ...(resolution >= 8 ? { minzoom: minZoom } : {}),
      source: 'berlin-trees',
      'source-layer': sourceLayer,
      layout: { visibility: resolution === 7 ? 'visible' : 'none' },
      paint: { 'line-color': '#e8e8e8', 'line-width': HEX_OUTLINE_WIDTH, 'line-opacity': 0.5 },
    });

    map.addLayer({
      id: `${sourceLayer}-label-genus`,
      type: 'symbol',
      minzoom: minZoom,
      source: 'berlin-trees',
      'source-layer': `${sourceLayer}_centroids`,
      filter: HAS_TREES,
      layout: {
        visibility: resolution === 7 ? 'visible' : 'none',
        'icon-image': 'letter-bg',
        'icon-size': HEX_LABEL_CIRCLE_SIZES[resolution],
        'icon-allow-overlap': true,
        'icon-anchor': 'center',
        'text-field': GENUS_LABEL_FIELD,
        'text-size': HEX_LABEL_SIZES[resolution],
        'text-allow-overlap': true,
        'text-anchor': 'center',
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'symbol-avoid-edges': false,
      },
      paint: {
        'icon-color': 'white',
        'icon-opacity': ['case', ['>', fcp, 67], 0, 0.12],
        'text-color': initialDensityColor,
        'text-opacity': ['case', ['>', fcp, 67], 0, 0.85],
      },
    });

    map.addLayer({
      id: `${sourceLayer}-icon-trees`,
      type: 'symbol',
      minzoom: minZoom,
      source: 'berlin-trees',
      'source-layer': `${sourceLayer}_centroids`,
      layout: {
        visibility: resolution === 7 ? 'visible' : 'none',
        'icon-image': ['get', 'dominant_genus'],
        'icon-size': HEX_ICON_SIZES[resolution],
        'icon-allow-overlap': true,
        'icon-offset': ['case', dualForestBand, ['literal', [-32, 0]], ['literal', [0, 0]]],
      },
      paint: {
        'icon-color': 'white',
        'icon-opacity': ['case', ['>', fcp, 67], 0, 0.85],
      },
    });

    map.addLayer({
      id: `${sourceLayer}-icon-forest`,
      type: 'symbol',
      minzoom: minZoom,
      source: 'berlin-trees',
      'source-layer': `${sourceLayer}_centroids`,
      layout: {
        visibility: resolution === 7 ? 'visible' : 'none',
        'icon-image': forestIconImage,
        'icon-size': HEX_ICON_SIZES[resolution],
        'icon-allow-overlap': true,
        'icon-offset': ['case', dualForestBand, ['literal', [32, 0]], ['literal', [0, 0]]],
      },
      paint: {
        'icon-color': 'white',
        'icon-opacity': ['case', ['<', fcp, 33], 0, 0.85],
      },
    });
  }

  for (const admin of ['bezirke', 'ortsteile']) {
    const sourceLayer = `admin_${admin}`;
    const adminMinZoom = ADMIN_ICON_MIN_ZOOM[admin];

    map.addLayer({
      id: `${sourceLayer}-fill`,
      type: 'fill',
      source: 'berlin-trees',
      'source-layer': sourceLayer,
      layout: { visibility: 'none' },
      paint: { 'fill-color': initialDensityColor, 'fill-opacity': 0.65 },
    });

    map.addLayer({
      id: `${sourceLayer}-outline`,
      type: 'line',
      source: 'berlin-trees',
      'source-layer': sourceLayer,
      layout: { visibility: 'none' },
      paint: {
        'line-color': '#e8e8e8',
        'line-width': ADMIN_OUTLINE_WIDTH(admin === 'bezirke' ? 2 : 1.2),
        'line-opacity': 0.5,
      },
    });

    map.addLayer({
      id: `${sourceLayer}-label`,
      type: 'symbol',
      minzoom: adminMinZoom,
      source: 'berlin-trees',
      'source-layer': `${sourceLayer}_centroids`,
      filter: HAS_TREES,
      layout: {
        visibility: 'none',
        'icon-image': 'letter-bg',
        'icon-size': ADMIN_LABEL_CIRCLE_SIZES[admin],
        'icon-allow-overlap': true,
        'icon-anchor': 'center',
        'text-field': GENUS_LABEL_FIELD,
        'text-size': ADMIN_LABEL_SIZES[admin],
        'text-allow-overlap': true,
        'text-anchor': 'center',
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'symbol-avoid-edges': false,
      },
      paint: {
        'icon-color': 'white',
        'icon-opacity': 0.12,
        'text-color': initialDensityColor,
        'text-opacity': 0.85,
      },
    });

    map.addLayer({
      id: `${sourceLayer}-icon`,
      type: 'symbol',
      minzoom: adminMinZoom,
      source: 'berlin-trees',
      'source-layer': `${sourceLayer}_centroids`,
      layout: {
        visibility: 'none',
        'icon-image': ['get', 'dominant_genus'],
        'icon-size': ADMIN_ICON_SIZES[admin],
        'icon-allow-overlap': true,
      },
      paint: { 'icon-color': 'white', 'icon-opacity': 0.85 },
    });
  }

  // Forest layers — on top of all hex/admin fills, outlines and icons
  map.addLayer({
    id: 'forests-union-fill',
    type: 'fill',
    source: 'berlin-trees',
    'source-layer': 'forests_union',
    layout: { visibility: 'visible' },
    paint: {
      'fill-pattern': dotPattern,
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.7, 15, 0],
    },
  });

  map.addLayer({
    id: 'forests-union-outline',
    type: 'line',
    source: 'berlin-trees',
    'source-layer': 'forests_union',
    layout: { visibility: 'visible' },
    paint: { 'line-color': '#2a5e30', 'line-width': 1, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.8, 15, 0] },
  });

  map.addLayer({
    id: 'forests-fill',
    type: 'fill',
    source: 'berlin-trees',
    'source-layer': 'forests',
    layout: { visibility: 'none' },
    paint: {
      'fill-pattern': dotPattern,
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 0.7],
    },
  });

  map.addLayer({
    id: 'forests-outline',
    type: 'line',
    source: 'berlin-trees',
    'source-layer': 'forests',
    layout: { visibility: 'none' },
    paint: { 'line-color': '#2a5e30', 'line-width': 0.8, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 0.6] },
  });

  map.addLayer({
    id: 'berlin-border',
    type: 'line',
    source: 'berlin-trees',
    'source-layer': 'berlin_border',
    paint: { 'line-color': '#fff', 'line-width': 1.8, 'line-opacity': 0.5 },
  });

  // Hidden layer — loads the agg_berlin source layer into the tile cache
  // so querySourceFeatures can read the city-wide summary stats.
  map.addLayer({
    id: 'berlin-summary',
    type: 'fill',
    source: 'berlin-trees',
    'source-layer': 'agg_berlin',
    layout: { visibility: 'none' },
    paint: { 'fill-opacity': 0 },
  });

  map.addLayer({
    id: 'trees-circle',
    type: 'circle',
    source: 'berlin-trees',
    'source-layer': 'trees',
    paint: {
      'circle-color': '#2d6a4f',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 2, 17, 5],
      'circle-opacity': 0.8,
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 0.5,
    },
  });

  // Selection highlight layers — solid thick outline on click-to-pin.
  const SELECTED_PAINT = { 'line-color': '#fff', 'line-width': 3, 'line-opacity': 0.9 };
  const HOVER_PAINT    = { 'line-color': '#fff', 'line-width': 3, 'line-opacity': 0.9 };

  for (const resolution of HEX_RESOLUTIONS) {
    map.addLayer({
      id: `hexes_res${resolution}-selected`,
      type: 'line',
      source: 'berlin-trees',
      'source-layer': `hexes_res${resolution}`,
      filter: ['==', ['get', 'h3_index'], ''],
      paint: SELECTED_PAINT,
    });
    map.addLayer({
      id: `hexes_res${resolution}-hover`,
      type: 'line',
      source: 'berlin-trees',
      'source-layer': `hexes_res${resolution}`,
      filter: ['==', ['get', 'h3_index'], ''],
      paint: HOVER_PAINT,
    });
  }

  for (const admin of ['bezirke', 'ortsteile']) {
    map.addLayer({
      id: `admin_${admin}-selected`,
      type: 'line',
      source: 'berlin-trees',
      'source-layer': `admin_${admin}`,
      filter: ['==', ['get', 'area_id'], -1],
      paint: SELECTED_PAINT,
    });
    map.addLayer({
      id: `admin_${admin}-hover`,
      type: 'line',
      source: 'berlin-trees',
      'source-layer': `admin_${admin}`,
      filter: ['==', ['get', 'area_id'], -1],
      paint: HOVER_PAINT,
    });
  }

  // For individual tree points (not tile-clipped) keep a GeoJSON highlight circle.
  map.addSource('selected-tree', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: 'selected-tree-circle',
    type: 'circle',
    source: 'selected-tree',
    paint: {
      'circle-radius': 14,
      'circle-color': 'rgba(0,0,0,0)',
      'circle-opacity': 0,
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  });

  // Tree/forest genus silhouettes always render above all other layers
  // (incl. the forest dot pattern, which otherwise sits on top of the fills).
  const silhouetteLayers = [];
  for (const r of HEX_RESOLUTIONS) silhouetteLayers.push(`hexes_res${r}-icon-trees`, `hexes_res${r}-icon-forest`);
  for (const a of ['bezirke', 'ortsteile']) silhouetteLayers.push(`admin_${a}-icon`);
  for (const id of silhouetteLayers) {
    try { map.moveLayer(id); } catch (_) {}
  }
}
