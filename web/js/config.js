// H3_COLOR: subtle fill tint for H3/admin polygons (used at fill-opacity 0.001 — visual only).
export const H3_COLOR = ['interpolate', ['linear'], ['coalesce', ['get', 'tree_density_km2'], 0],
  0, '#edf8e9', 50, '#bae4b3', 200, '#74c476', 600, '#31a354', 1500, '#006d2c'];

export const H3_RESOLUTIONS = [6, 7, 8, 9];

export const H3_ICON_SIZES = {
  6: ['interpolate', ['exponential', 2], ['zoom'], 6, 0.058, 14, 14.9],
  7: ['interpolate', ['exponential', 2], ['zoom'], 8, 0.089, 14, 5.7],
  8: ['interpolate', ['exponential', 2], ['zoom'], 10, 0.133, 14, 2.13],
  9: ['interpolate', ['exponential', 2], ['zoom'], 11, 0.101, 14, 0.81],
};

export const ADMIN_ICON_SIZES = {
  bezirke: ['interpolate', ['exponential', 2], ['zoom'], 6, 0.1, 12, 3.2],
  ortsteile: ['interpolate', ['exponential', 2], ['zoom'], 8, 0.089, 14, 5.7],
};

export const RES_LAYERS = {
  bezirke:   ['admin_bezirke-fill', 'admin_bezirke-outline', 'admin_bezirke-label', 'admin_bezirke-icon'],
  ortsteile: ['admin_ortsteile-fill', 'admin_ortsteile-outline', 'admin_ortsteile-label', 'admin_ortsteile-icon'],
  6: ['h3_res6-fill', 'h3_res6-outline', 'h3_res6-label-genus', 'h3_res6-icon-trees', 'h3_res6-icon-forest'],
  7: ['h3_res7-fill', 'h3_res7-outline', 'h3_res7-label-genus', 'h3_res7-icon-trees', 'h3_res7-icon-forest'],
  8: ['h3_res8-fill', 'h3_res8-outline', 'h3_res8-label-genus', 'h3_res8-icon-trees', 'h3_res8-icon-forest'],
  9: ['h3_res9-fill', 'h3_res9-outline', 'h3_res9-label-genus', 'h3_res9-icon-trees', 'h3_res9-icon-forest'],
  trees: ['trees-circle'],
};

// The tiles ship as one concatenated bundle of independent PMTiles archives —
// one per source below — so the map only byte-range-fetches the archive(s)
// whose layers are currently visible instead of every resolution at once.
// Each archive name doubles as the MapLibre vector-source id.
export const SOURCE_NAMES = ['res6', 'res7', 'res8', 'res9', 'admin', 'forests', 'trees'];

// Which bundle archive (= MapLibre source) each vector tile source-layer lives in.
export const SOURCE_FOR_LAYER = {
  h3_res6: 'res6', h3_res6_centroids: 'res6',
  h3_res7: 'res7', h3_res7_centroids: 'res7',
  h3_res8: 'res8', h3_res8_centroids: 'res8',
  h3_res9: 'res9', h3_res9_centroids: 'res9',
  admin_bezirke: 'admin', admin_bezirke_centroids: 'admin',
  admin_ortsteile: 'admin', admin_ortsteile_centroids: 'admin',
  berlin_border: 'admin', agg_berlin: 'admin',
  forests: 'forests', forests_union: 'forests',
  trees: 'trees',
};
