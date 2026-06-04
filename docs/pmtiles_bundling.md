# PMTiles bundling

The goal of this project was to experiment with different grids, get familiar with PMTiles, and pack all the tiles into one file. While implementing it, I realised that when MapLibre fetches a tile, it gets every layer packed into that tile. The map offers a selection of different grids but renders only one at any moment — yet all of them are downloaded, wasting bandwidth. The simplest and probably most reasonable fix would have been to generate a separate PMTiles file per grid layer and have the map switch sources on the fly. But since I wanted to serve the data from a *single* file, the following approach was used instead:


## Bundle of PMTiles
Layers are packed into individual PMTiles files

| PMTiles   | source-layers it contains                                                                 |
|-----------|--------------------------------------------------------------------------------------------|
| `res6`    | `h3_res6`, `h3_res6_centroids`                                                        |
| `res7`    | `h3_res7`, `h3_res7_centroids`                                                        |
| `res8`    | `h3_res8`, `h3_res8_centroids`                                                        |
| `res9`    | `h3_res9`, `h3_res9_centroids`                                                        |
| `admin`   | `admin_bezirke`(+`_centroids`), `admin_ortsteile`(+`_centroids`), `berlin_border`, `agg_berlin` |
| `forests` | `forests`, `forests_union`                                                                  |
| `trees`   | `trees`                                                                                     |

…and then concatenated together behind a small header and a JSON
manifest into a single `pmtiles.bundle` file. The bundle is served *just like normal PMTiles* and read with HTTP range (206) requests. The web client registers one MapLibre source per packed PMTiles file, each reading
the bundle at its own byte offset, so the map only byte-range-fetches the tiles
of the detail level (and overlays) currently on screen — saving bandwidth at the cost of more requests.

## File format

```
"PMBUNDLE"            8 bytes,  ASCII magic
manifestLen           8 bytes,  uint64 big-endian = byte length of the manifest
manifest              manifestLen bytes, UTF-8 JSON (see below)
archive bytes         the PMTiles archives, concatenated in manifest order
```

Manifest:

```json
{
  "version": 1,
  "archives": [
    { "name": "res6", "offset": 0,        "length": 7808169  },
    { "name": "res7", "offset": 7808169,  "length": 14069364 },
    ...
  ]
}
```

`offset` is **relative to the start of the archive section** (i.e. a cumulative
sum of the preceding archives' lengths), so it does not depend on the manifest's
own variable length. The client computes an archive's absolute base as
`8 + 8 + manifestLen + offset`.

Each archive is a normal, self-contained PMTiles file: its header sits at its
base offset, and all of its internal directory offsets are relative to that
header — so adding a fixed base offset to every read makes it readable in place.


## Reading the bundle (client)

The source-layer → archive map lives in [`web/js/config.js`](../web/js/config.js)
as `SOURCE_FOR_LAYER` / `SOURCE_NAMES`.

[`web/js/main.js`](../web/js/main.js):

- `readBundleManifest(url)` — range-reads the 16-byte header, then the manifest.
- `OffsetSource` — a pmtiles `Source` that adds an archive's base offset to every
  `getBytes(offset, length)` call, so one physical file serves many archives.
- `resolveSources()` — registers one `pmtiles.PMTiles(new OffsetSource(...))` per
  manifest entry with the pmtiles `Protocol`, and returns
  `{ res6: 'pmtiles://res6', … }`.

[`web/js/layers.js`](../web/js/layers.js) `addMapLayers(map, sources)` then adds
one vector source per archive and points every layer at its archive.

Highlights and the city-wide summary read tiles via
`map.querySourceFeatures(SOURCE_FOR_LAYER[sourceLayer], { sourceLayer })`
(see [`web/js/info.js`](../web/js/info.js)).

