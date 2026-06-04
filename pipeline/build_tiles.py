"""
pipeline/build_tiles.py
-----------------------
Convert dbt mart tables in berlin_trees.duckdb into a single PMTiles *bundle*.

Strategy: tippecanoe each band, then re-pack into one independent PMTiles
archive per source (res6–res9, admin, forests, trees) and concatenate the
archives behind a header + JSON manifest. The web client registers one MapLibre
source per archive and only byte-range-fetches the visible resolution's tiles.

    res6..res9     (agg_h3_res{6..9} + centroids)            z4–z17
    admin          (bezirke/ortsteile + border + summary)    z4–z17
    forests        (agg_forests + agg_forest_union)          z4–z17
    trees          (int_trees_unified)                       z6–z17

Bundle layout:  "PMBUNDLE"(8) | manifestLen(uint64 BE, 8) | manifest JSON | archives…

Run:
    conda run -n berlin_trees python pipeline/build_tiles.py
"""

import json
import logging
import shutil
import struct
import subprocess
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from pathlib import Path

import duckdb

DB_PATH = Path("data/berlin_trees.duckdb")
TILES_INPUT = Path("data/tiles_input")
WEB_PUBLIC = Path("web/public")
OUT_PMTILES = WEB_PUBLIC / "berlin_trees.pmtiles.bundle"
ATTRIBUTION = "Senatsverwaltung Berlin (dl-de/zero-2-0), Grün Berlin GmbH (dl-de/by-2-0)"

# Columns to retain in the individual-tree layer (keeps tile size down).
TREE_COLS = [
    "tree_uuid",
    "species_latin",
    "species_german",
    "genus_latin",
    "planting_year",
    "tree_age",
    "source",
]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _run(cmd: list[str]) -> None:
    log.info("$ %s", " ".join(str(c) for c in cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stdout:
        for line in result.stdout.strip().splitlines():
            log.info("  %s", line)
    if result.stderr:
        for line in result.stderr.strip().splitlines():
            log.info("  %s", line)
    result.check_returncode()


@contextmanager
def _timed(label: str):
    start = time.perf_counter()
    try:
        yield
    finally:
        log.info("%s finished in %.1fs", label, time.perf_counter() - start)


def _quote(path) -> str:
    return str(path).replace("'", "''")


def _is_fresh(output_path: Path, input_paths: list[Path]) -> bool:
    if not output_path.exists():
        return False
    out_mtime = output_path.stat().st_mtime
    for input_path in input_paths:
        if not input_path.exists():
            return False
        if input_path.stat().st_mtime > out_mtime:
            return False
    return True


def _copy_query_to_flatgeobuf(
    con: duckdb.DuckDBPyConnection,
    out_path: Path,
    input_paths: list[Path],
    select_sql: str,
    label: str,
) -> None:
    if _is_fresh(out_path, input_paths):
        log.info("Skipping %s → %s (cached)", label, out_path.name)
        return

    log.info("Exporting %s → %s (FlatGeobuf)", label, out_path.name)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with _timed(f"Export {out_path.name}"):
        con.execute(
            f"""
            COPY ({select_sql})
            TO '{_quote(out_path)}'
            WITH (FORMAT GDAL, DRIVER 'FlatGeobuf')
            """
        )
    mb = out_path.stat().st_size / 1024 / 1024
    log.info("  %.1f MB", mb)


def _col_projection(col_defs: list[tuple], exclude: set[str], geom_expr: str) -> str:
    """Build a SELECT projection, casting HUGEINT → BIGINT (FlatGeobuf supports ≤64-bit ints)."""
    parts = []
    for name, dtype in col_defs:
        if name in exclude:
            continue
        if dtype == "HUGEINT":
            parts.append(f"CAST({name} AS BIGINT) AS {name}")
        else:
            parts.append(name)
    parts.append(geom_expr)
    return ", ".join(parts)


def table_to_flatgeobuf(
    con: duckdb.DuckDBPyConnection,
    table: str,
    out_path: Path,
    cols: list[str] | None = None,
) -> None:
    col_defs = con.execute(f"DESCRIBE {table}").fetchall()
    if cols:
        col_set = set(cols)
        col_defs = [(n, t) for n, t, *_ in col_defs if n in col_set and n != "geometry"]
    else:
        col_defs = [(n, t) for n, t, *_ in col_defs if n != "geometry"]
    projection = _col_projection(col_defs, set(), "geometry")
    select_sql = f"SELECT {projection} FROM {table}"
    _copy_query_to_flatgeobuf(con, out_path, [DB_PATH], select_sql, table)


def table_centroids_to_flatgeobuf(
    con: duckdb.DuckDBPyConnection,
    table: str,
    out_path: Path,
) -> None:
    col_defs = [
        (n, t) for n, t, *_ in con.execute(f"DESCRIBE {table}").fetchall() if n != "geometry"
    ]
    projection = _col_projection(col_defs, set(), "ST_Centroid(geometry) AS geometry")
    select_sql = f"SELECT {projection} FROM {table}"
    _copy_query_to_flatgeobuf(con, out_path, [DB_PATH], select_sql, f"{table} centroids")


def tippecanoe(
    output: Path,
    min_zoom: int,
    max_zoom: int,
    layers: list[tuple[str, Path]],
    extra: list[str] | None = None,
    read_parallel: bool = False,
) -> None:
    cmd = [
        "tippecanoe",
        "--output",
        str(output),
        "--force",
        f"--minimum-zoom={min_zoom}",
        f"--maximum-zoom={max_zoom}",
        "--no-feature-limit",
    ]
    if read_parallel:
        cmd.append("--read-parallel")
    if extra:
        cmd.extend(extra)
    for name, path in layers:
        cmd.append(f"--named-layer={name}:{path}")
    with _timed(f"tippecanoe {output.name}"):
        _run(cmd)


def tile_join(output: Path, inputs: list[Path], only_layers: list[str] | None = None) -> None:
    """Merge/extract source-layers into one PMTiles archive with tile-join."""
    cmd = [
        "tile-join",
        "--output",
        str(output),
        "--force",
        "--no-tile-size-limit",
        "--attribution",
        ATTRIBUTION,
    ]
    for layer in only_layers or []:
        cmd.extend(["-l", layer])
    cmd.extend(str(p) for p in inputs)
    with _timed(f"tile-join {output.name}"):
        _run(cmd)


# The web client expects the tiles as a single "bundle" file: each entry below is
# tiled into its own PMTiles archive and the archives are concatenated behind a
# header + JSON manifest. MapLibre then registers one source per archive (the
# `name` doubles as the source id) and only byte-range-fetches the visible ones.
BUNDLE_MAGIC = b"PMBUNDLE"  # 8 bytes; followed by uint64-BE manifest length


def write_bundle(out_path: Path, archives: list[tuple[str, Path]]) -> None:
    """Concatenate archive files behind  MAGIC | manifestLen(u64 BE) | manifest | data.

    Manifest offsets are relative to the start of the data section, so they don't
    depend on the manifest's own (variable) length.
    """
    entries = []
    offset = 0
    for name, path in archives:
        size = path.stat().st_size
        entries.append({"name": name, "offset": offset, "length": size})
        offset += size
    manifest = json.dumps({"version": 1, "archives": entries}, separators=(",", ":")).encode()

    with open(out_path, "wb") as out:
        out.write(BUNDLE_MAGIC)
        out.write(struct.pack(">Q", len(manifest)))
        out.write(manifest)
        for _name, path in archives:
            with open(path, "rb") as src:
                shutil.copyfileobj(src, out)
    log.info("Bundle manifest: %s", manifest.decode())


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    TILES_INPUT.mkdir(parents=True, exist_ok=True)
    WEB_PUBLIC.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect(str(DB_PATH), read_only=True)
    con.execute("LOAD spatial; LOAD h3;")

    # --- 1. DuckDB mart tables → FlatGeobuf -----------------------------------

    for res in [6, 7, 8, 9]:
        table_to_flatgeobuf(con, f"agg_h3_res{res}", TILES_INPUT / f"h3_res{res}.fgb")

    table_to_flatgeobuf(con, "agg_bezirke", TILES_INPUT / "admin_bezirke.fgb")
    table_to_flatgeobuf(con, "agg_ortsteile", TILES_INPUT / "admin_ortsteile.fgb")
    table_to_flatgeobuf(con, "agg_berlin", TILES_INPUT / "berlin_summary.fgb")

    for admin in ["bezirke", "ortsteile"]:
        table_centroids_to_flatgeobuf(
            con, f"agg_{admin}", TILES_INPUT / f"admin_{admin}_centroids.fgb"
        )

    # Individual tree points from int_trees_unified (column subset to keep tiles small)
    tree_cols_sql = ", ".join(
        TREE_COLS
        + ["ST_FlipCoordinates(ST_Transform(geometry, 'EPSG:25833', 'EPSG:4326')) AS geometry"]
    )
    _copy_query_to_flatgeobuf(
        con,
        TILES_INPUT / "trees.fgb",
        [DB_PATH],
        f"SELECT {tree_cols_sql} FROM int_trees_unified",
        "int_trees_unified",
    )

    # City border: dissolve all Bezirke geometries into one polygon
    _copy_query_to_flatgeobuf(
        con,
        TILES_INPUT / "berlin_border.fgb",
        [DB_PATH],
        "SELECT ST_Union_Agg(geometry) AS geometry FROM agg_bezirke",
        "Berlin city border",
    )

    # H3 centroid point layers
    for res in [6, 7, 8, 9]:
        table_centroids_to_flatgeobuf(
            con, f"agg_h3_res{res}", TILES_INPUT / f"h3_res{res}_centroids.fgb"
        )

    # --- 2. Forest layers (DuckDB mart tables) ----------------------------------

    table_to_flatgeobuf(con, "agg_forests", TILES_INPUT / "forests.fgb")
    table_to_flatgeobuf(con, "agg_forest_union", TILES_INPUT / "forests_union.fgb")

    # --- 3. tippecanoe: all bands in parallel ---------------------------------
    tmp_dir = Path(tempfile.mkdtemp(prefix="bt_tiles_", dir="/dev/shm"))
    try:
        h3_pmtiles = tmp_dir / "h3.pmtiles"
        h3_centroids_pmtiles = tmp_dir / "h3_centroids.pmtiles"
        admin_pmtiles = tmp_dir / "admin.pmtiles"
        admin_centroids_pmtiles = tmp_dir / "admin_centroids.pmtiles"
        forests_pmtiles = tmp_dir / "forests.pmtiles"
        trees_pmtiles = tmp_dir / "trees.pmtiles"

        tippecanoe_jobs = {
            "h3": lambda: tippecanoe(
                h3_pmtiles,
                min_zoom=4,
                max_zoom=17,
                layers=[(f"h3_res{res}", TILES_INPUT / f"h3_res{res}.fgb") for res in [6, 7, 8, 9]],
                extra=["--no-tile-size-limit", "--no-tile-stats"],
                read_parallel=True,
            ),
            "h3_centroids": lambda: tippecanoe(
                h3_centroids_pmtiles,
                min_zoom=4,
                max_zoom=17,
                layers=[
                    (f"h3_res{res}_centroids", TILES_INPUT / f"h3_res{res}_centroids.fgb")
                    for res in [6, 7, 8, 9]
                ],
                extra=[
                    "--no-feature-limit",
                    "--no-tile-size-limit",
                    "--drop-rate=0",
                    "--no-tile-stats",
                ],
                read_parallel=True,
            ),
            "admin": lambda: tippecanoe(
                admin_pmtiles,
                min_zoom=4,
                max_zoom=17,
                layers=[
                    ("admin_bezirke", TILES_INPUT / "admin_bezirke.fgb"),
                    ("admin_ortsteile", TILES_INPUT / "admin_ortsteile.fgb"),
                    ("berlin_border", TILES_INPUT / "berlin_border.fgb"),
                    ("agg_berlin", TILES_INPUT / "berlin_summary.fgb"),
                ],
                extra=[
                    "--no-tile-size-limit",
                    "--no-simplification-of-shared-nodes",
                    "--no-tile-stats",
                ],
                read_parallel=True,
            ),
            "admin_centroids": lambda: tippecanoe(
                admin_centroids_pmtiles,
                min_zoom=4,
                max_zoom=17,
                layers=[
                    ("admin_bezirke_centroids", TILES_INPUT / "admin_bezirke_centroids.fgb"),
                    ("admin_ortsteile_centroids", TILES_INPUT / "admin_ortsteile_centroids.fgb"),
                ],
                extra=[
                    "--no-feature-limit",
                    "--no-tile-size-limit",
                    "--drop-rate=0",
                    "--no-tile-stats",
                ],
                read_parallel=True,
            ),
            "forests": lambda: tippecanoe(
                forests_pmtiles,
                min_zoom=4,
                max_zoom=17,
                layers=[
                    ("forests", TILES_INPUT / "forests.fgb"),
                    ("forests_union", TILES_INPUT / "forests_union.fgb"),
                ],
                extra=[
                    "--no-tile-size-limit",
                    "--no-simplification-of-shared-nodes",
                    "--no-tile-stats",
                ],
                read_parallel=True,
            ),
            "trees": lambda: tippecanoe(
                trees_pmtiles,
                min_zoom=6,
                max_zoom=17,
                layers=[("trees", TILES_INPUT / "trees.fgb")],
                extra=["--no-tile-size-limit", "--drop-densest-as-needed", "--no-tile-stats"],
                read_parallel=True,
            ),
        }

        log.info("Running %d tippecanoe jobs in parallel ...", len(tippecanoe_jobs))
        with (
            _timed("tippecanoe (all jobs)"),
            ThreadPoolExecutor(max_workers=len(tippecanoe_jobs)) as executor,
        ):
            futures = {executor.submit(fn): name for name, fn in tippecanoe_jobs.items()}
            for future in as_completed(futures):
                name = futures[future]
                try:
                    future.result()
                except Exception as exc:
                    raise RuntimeError(f"tippecanoe job '{name}' failed") from exc

        # --- 4. tile-join: one PMTiles archive per source -------------------
        # Each archive becomes an independent MapLibre source so the map only
        # fetches the tiles of the resolution/layer currently displayed.
        archive_dir = tmp_dir / "archives"
        archive_dir.mkdir()
        archive_jobs = {}
        for res in [6, 7, 8, 9]:
            archive_jobs[f"res{res}"] = lambda res=res: tile_join(
                archive_dir / f"res{res}.pmtiles",
                [h3_pmtiles, h3_centroids_pmtiles],
                only_layers=[f"h3_res{res}", f"h3_res{res}_centroids"],
            )
        archive_jobs["admin"] = lambda: tile_join(
            archive_dir / "admin.pmtiles", [admin_pmtiles, admin_centroids_pmtiles]
        )
        archive_jobs["forests"] = lambda: tile_join(
            archive_dir / "forests.pmtiles", [forests_pmtiles]
        )
        archive_jobs["trees"] = lambda: tile_join(archive_dir / "trees.pmtiles", [trees_pmtiles])

        log.info("Building %d per-source PMTiles archives ...", len(archive_jobs))
        with (
            _timed("tile-join (all archives)"),
            ThreadPoolExecutor(max_workers=len(archive_jobs)) as executor,
        ):
            futures = {executor.submit(fn): name for name, fn in archive_jobs.items()}
            for future in as_completed(futures):
                name = futures[future]
                try:
                    future.result()
                except Exception as exc:
                    raise RuntimeError(f"tile-join archive '{name}' failed") from exc

        # --- 5. Concatenate archives into the single bundle file -------------
        # Order = registration order in the client; res6..9 first, then overlays.
        bundle_order = ["res6", "res7", "res8", "res9", "admin", "forests", "trees"]
        archives = [(name, archive_dir / f"{name}.pmtiles") for name in bundle_order]
        assembled = tmp_dir / OUT_PMTILES.name
        with _timed("write bundle"):
            write_bundle(assembled, archives)

        final_copy_tmp = OUT_PMTILES.with_name(f"{OUT_PMTILES.name}.tmp")
        with _timed(f"Copy final bundle to {OUT_PMTILES}"):
            WEB_PUBLIC.mkdir(parents=True, exist_ok=True)
            shutil.copy2(assembled, final_copy_tmp)
            final_copy_tmp.replace(OUT_PMTILES)
            OUT_PMTILES.with_name(f"{OUT_PMTILES.name}-journal").unlink(missing_ok=True)

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        con.close()

    # --- 5. Validate ----------------------------------------------------------
    mb = OUT_PMTILES.stat().st_size / 1024 / 1024
    log.info("Output: %s  (%.1f MB)", OUT_PMTILES, mb)
    if mb > 200:
        log.warning(
            "File is %.1f MB — consider reducing attribute payload or capping zoom to z16",
            mb,
        )

    try:
        result = subprocess.run(
            ["pmtiles", "show", str(OUT_PMTILES)],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            log.info("pmtiles show:\n%s", result.stdout)
    except FileNotFoundError:
        log.info("(pmtiles CLI not found — skipping inspection)")

    log.info("Done.")


if __name__ == "__main__":
    main()
