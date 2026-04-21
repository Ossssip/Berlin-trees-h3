import { HEX_COLOR, HEX_ICON_SIZES, ADMIN_ICON_SIZES, HEX_RESOLUTIONS } from './config.js';
import { buildForestIconImageExpr } from './icons.js';

const HEX_OUTLINE_WIDTH = ['interpolate', ['linear'], ['zoom'], 4, 1.2, 14, 1.2, 15, 1.8, 17, 2.4];
const ADMIN_OUTLINE_WIDTH = (baseWidth) => ['interpolate', ['linear'], ['zoom'], 4, baseWidth, 14, baseWidth, 15, baseWidth + 0.6, 17, baseWidth + 1.2];

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
    try { map.setPaintProperty(`${sl}-icon-trees`, 'icon-color', expr); } catch (_) {}
  }
  for (const admin of ['bezirke', 'ortsteile']) {
    try { map.setPaintProperty(`admin_${admin}-icon`, 'icon-color', expr); } catch (_) {}
  }
}

function createHatchPattern(color = '#2255aa', size = 16, lineWidth = 3) {
  const scratch = document.createElement('canvas').getContext('2d');
  scratch.fillStyle = color;
  scratch.fillRect(0, 0, 1, 1);
  const [r, g, b] = scratch.getImageData(0, 0, 1, 1).data;
  const data = new Uint8Array(size * size * 4);
  const halfWidth = Math.floor(lineWidth / 2);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const diagonal = ((x + y) % size + size) % size;
      if (diagonal <= halfWidth || diagonal >= size - halfWidth) {
        const index = (y * size + x) * 4;
        data[index] = r; data[index + 1] = g; data[index + 2] = b; data[index + 3] = 255;
      }
    }
  }
  return { width: size, height: size, data };
}

export function addMapLayers(map, tilesUrl) {
  const forestIconImage = buildForestIconImageExpr();
  const initialDensityColor = densityColorExpr(INITIAL_P95);

  map.addSource('berlin-trees', { type: 'vector', url: tilesUrl });

  for (const resolution of HEX_RESOLUTIONS) {
    const sourceLayer = `hexes_res${resolution}`;
    const fcp = ['coalesce', ['get', 'forest_cover_pct'], 0];
    const dualForestBand = ['all', ['>=', fcp, 33], ['<=', fcp, 67]];

    map.addLayer({
      id: `${sourceLayer}-fill`,
      type: 'fill',
      source: 'berlin-trees',
      'source-layer': sourceLayer,
      layout: { visibility: resolution === 7 ? 'visible' : 'none' },
      // 0.001: effectively invisible but keeps the layer hittable for click/hover
      paint: { 'fill-color': HEX_COLOR, 'fill-opacity': 0.001 },
    });

    map.addLayer({
      id: `${sourceLayer}-outline`,
      type: 'line',
      source: 'berlin-trees',
      'source-layer': sourceLayer,
      layout: { visibility: resolution === 7 ? 'visible' : 'none' },
      paint: { 'line-color': '#ccc', 'line-width': HEX_OUTLINE_WIDTH, 'line-opacity': 0.7 },
    });

    map.addLayer({
      id: `${sourceLayer}-icon-trees`,
      type: 'symbol',
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
        'icon-color': initialDensityColor,
        'icon-opacity': ['case', ['>', fcp, 67], 0, 0.85],
      },
    });

    map.addLayer({
      id: `${sourceLayer}-icon-forest`,
      type: 'symbol',
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
        'icon-color': '#2255aa',
        'icon-opacity': ['case', ['<', fcp, 33], 0, 0.85],
      },
    });
  }

  map.addImage('forest-hatch', createHatchPattern());

  map.addLayer({
    id: 'forests-fill',
    type: 'fill',
    source: 'berlin-trees',
    'source-layer': 'forests',
    layout: { visibility: 'none' },
    paint: {
      'fill-pattern': 'forest-hatch',
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 0.7],
    },
  }, 'hexes_res6-fill');

  map.addLayer({
    id: 'forests-outline',
    type: 'line',
    source: 'berlin-trees',
    'source-layer': 'forests',
    layout: { visibility: 'none' },
    paint: { 'line-color': '#2255aa', 'line-width': 0.8, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 0.6] },
  }, 'hexes_res6-fill');

  map.addLayer({
    id: 'forests-union-fill',
    type: 'fill',
    source: 'berlin-trees',
    'source-layer': 'forests_union',
    layout: { visibility: 'visible' },
    paint: {
      'fill-pattern': 'forest-hatch',
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.7, 15, 0],
    },
  }, 'hexes_res6-fill');

  map.addLayer({
    id: 'forests-union-outline',
    type: 'line',
    source: 'berlin-trees',
    'source-layer': 'forests_union',
    layout: { visibility: 'visible' },
    paint: { 'line-color': '#2255aa', 'line-width': 1, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.8, 15, 0] },
  }, 'hexes_res6-fill');

  for (const admin of ['bezirke', 'ortsteile']) {
    const sourceLayer = `admin_${admin}`;

    map.addLayer({
      id: `${sourceLayer}-fill`,
      type: 'fill',
      source: 'berlin-trees',
      'source-layer': sourceLayer,
      layout: { visibility: 'none' },
      paint: { 'fill-color': HEX_COLOR, 'fill-opacity': 0.001 },
    });

    map.addLayer({
      id: `${sourceLayer}-outline`,
      type: 'line',
      source: 'berlin-trees',
      'source-layer': sourceLayer,
      layout: { visibility: 'none' },
      paint: {
        'line-color': '#ccc',
        'line-width': ADMIN_OUTLINE_WIDTH(admin === 'bezirke' ? 2 : 1.2),
        'line-opacity': 0.7,
      },
    });

    map.addLayer({
      id: `${sourceLayer}-icon`,
      type: 'symbol',
      source: 'berlin-trees',
      'source-layer': `${sourceLayer}_centroids`,
      layout: {
        visibility: 'none',
        'icon-image': ['get', 'dominant_genus'],
        'icon-size': ADMIN_ICON_SIZES[admin],
        'icon-allow-overlap': true,
      },
      paint: { 'icon-color': initialDensityColor, 'icon-opacity': 0.85 },
    });
  }

  map.addLayer({
    id: 'berlin-border',
    type: 'line',
    source: 'berlin-trees',
    'source-layer': 'berlin_border',
    paint: { 'line-color': '#fff', 'line-width': 1.8, 'line-opacity': 0.5 },
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

  // Selection highlight layers — one per polygon source layer so the outline
  // is drawn from the actual tile geometry (not a tile-clipped GeoJSON copy).
  // Filters are set to a no-match value initially and updated by info.js on click.
  const SELECTED_PAINT = { 'line-color': '#fff', 'line-width': 2.5, 'line-opacity': 0.9, 'line-dasharray': [3, 2] };

  for (const resolution of HEX_RESOLUTIONS) {
    map.addLayer({
      id: `hexes_res${resolution}-selected`,
      type: 'line',
      source: 'berlin-trees',
      'source-layer': `hexes_res${resolution}`,
      filter: ['==', ['get', 'h3_index_str'], ''],
      paint: SELECTED_PAINT,
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
}
