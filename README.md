**[Open the map](https://ossssip.github.io/Berlin-trees-hex/)**

# Berlin Trees

Another take on visualizing Berlin's trees. Tree data is aggregated onto an H3 hex grid and packed into a single PMTiles archive served to the browser.

<img src="https://github.com/Ossssip/Berlin-trees-hex/blob/main/web/map.png?raw=true" width="900">

---
## Data

Built from Berlin's public tree, forest, and administrative borders datasets; tree
silhouettes from [PhyloPic](https://www.phylopic.org) are used for visualization. See
[`docs/data_sources.md`](docs/data_sources.md) for the full list of sources,
licences, and attributions.


### Tools

WFS sources are fetched as Parquet, loaded into [DuckDB](https://duckdb.org/),
and cleaned, unified, and aggregated by [dbt](https://www.getdbt.com/) into [H3](https://h3geo.org/) hexes and admin borders. Spatial work uses the
 library. Tiles are built with
[tippecanoe](https://github.com/felt/tippecanoe) into a
[PMTiles](https://protomaps.com/docs/pmtiles) archive, served via Cloudflare
Workers. 


## Pipeline

Raw data is collected from the WFS endpoints, loaded into DuckDB, and aggregated with dbt. The tiles are then built using tippecanoe.

```
WFS sources
    │
    ▼
check_updates.py     ← compare WFS record counts; skip the run if nothing changed
    │
    ▼
fetch_wfs.py         ← paginated WFS download → one Parquet file per source
    │
    ▼
init_db.py + dbt     ← load into DuckDB, then clean, unify, and aggregate:
    │                   trees onto H3 hexes (res 6–9) and admin polygons,
    │                   with genus histograms, density, and forest cover per cell
    ▼
build_tiles.py       ← tippecanoe → three scoped layers (hexes, forests, trees)
                       merged into one berlin_trees.pmtiles, served via Cloudflare Workers
```



The pipeline runs weekly. `check_updates.py` queries WFS
record counts first and the full run proceeds only if a source has changed;
raw downloads are cached per record count, so unchanged sources are not
re-fetched.
