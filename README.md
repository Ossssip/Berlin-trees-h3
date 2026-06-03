**[Open the map](https://ossssip.github.io/Berlin-trees-h3/)**

# Berlin Trees H3

Another take on visualizing Berlin's street and park trees. Trees are aggregated onto an H3 hex grid you can switch across detail levels, with Berlin's boroughs, neighbourhoods, and forests available as separate layers. Hover or tap any cell for its tree count, density, and genus breakdown. It's all packed into a single PMTile file serving required data via partial requests.

<a href="https://github.com/Ossssip/Berlin-trees-h3/blob/main/web/map.png">
  <img src="https://github.com/Ossssip/Berlin-trees-h3/blob/main/web/map_thumb.png?raw=true" width="600" alt="Berlin trees map preview">
</a>

---
## Data

Built from Berlin's public tree, forest, and administrative borders datasets; tree
silhouettes from [PhyloPic](https://www.phylopic.org) are used for visualization. See
[`docs/data_sources.md`](docs/data_sources.md) for the full list of sources,
licences, and attributions.


### Tools

Data from the WFS endpoints is saved to Parquet files, loaded into [DuckDB](https://duckdb.org/),
and cleaned, unified, and aggregated by [dbt](https://www.getdbt.com/) into [H3](https://h3geo.org/) hexes and admin boundaries. Geometry work (clipping, dissolves, reprojection) uses DuckDB's [spatial extension](https://duckdb.org/docs/extensions/spatial/overview). Tiles are built with
[tippecanoe](https://github.com/felt/tippecanoe) into a
[PMTiles](https://protomaps.com/docs/pmtiles) archive.


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
                       merged into one berlin_trees.pmtiles.
```



The pipeline runs weekly. `check_updates.py` queries WFS
record counts first and the full run proceeds only if a source has changed;
raw downloads are cached per record count, so unchanged sources are not
re-fetched.


## Running locally

Requires [tippecanoe](https://github.com/felt/tippecanoe) and the
[`pmtiles`](https://github.com/protomaps/go-pmtiles) CLI for the tile-build step.

```bash
# 1. Create the environment and install dependencies
conda create -n berlin_trees python=3.12
conda activate berlin_trees
pip install -r requirements-ci.txt

# 2. Fetch the raw WFS sources → one Parquet per source in data/raw/
for s in alkis_ortsteile baumbestand_anlagen baumbestand_strassen gruen_berlin forstbetriebskarte; do
  python pipeline/fetch_wfs.py --source "$s"
done

# 3. Load into DuckDB, then clean/unify/aggregate with dbt
python pipeline/init_db.py
dbt run --profiles-dir ./dbt --project-dir ./dbt

# 4. Build the PMTiles archive → web/public/berlin_trees.pmtiles
python pipeline/build_tiles.py

# 5. Serve web/ with a static server that supports HTTP range requests
#    (PMTiles is read via byte ranges), e.g.:
npx http-server web -p 8000
```

Then open <http://localhost:8000>.

> DuckDB allows only one connection at a time — close any open connection to
> `data/berlin_trees.duckdb` (e.g. a Jupyter kernel) before running steps 3–4.
> To rebuild from scratch, delete `data/berlin_trees.duckdb` first.
