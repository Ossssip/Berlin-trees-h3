{{ config(materialized='table') }}

WITH trees AS (
    SELECT
        1 AS dummy_id,
        COALESCE(
            NULLIF(NULLIF(LOWER(TRIM(genus_latin)), ''), 'unbekannt'),
            NULLIF(LOWER(SPLIT_PART(TRIM(species_latin), ' ', 1)), '')
        ) AS genus
    FROM {{ ref('int_trees_unified') }}
),
agg AS (
    SELECT
        COUNT(*) AS tree_count,
        COUNT(DISTINCT genus) AS genus_count
    FROM trees
),
{{ tree_genus_histogram('trees', 'dummy_id') }},
area_stats AS (
    SELECT
        ROUND(SUM(berlin_area_km2), 2) AS berlin_area_km2,
        ROUND(SUM(forest_area_km2), 2)  AS forest_area_km2,
        ROUND(SUM(non_forest_area_km2), 2) AS non_forest_area_km2
    FROM {{ ref('agg_bezirke') }}
),
res6_density AS (
    SELECT
        to_json(PERCENTILE_CONT([0.0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0]) WITHIN GROUP (ORDER BY tree_density_km2)) AS quantiles,
        CAST(PERCENTILE_DISC(0.5)  WITHIN GROUP (ORDER BY tree_density_km2) AS INT) AS p50,
        CAST(PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY tree_density_km2) AS INT) AS p95
    FROM {{ ref('agg_h3_res6') }} WHERE tree_density_km2 IS NOT NULL AND forest_cover_pct <= 85
),
res7_density AS (
    SELECT
        to_json(PERCENTILE_CONT([0.0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0]) WITHIN GROUP (ORDER BY tree_density_km2)) AS quantiles,
        CAST(PERCENTILE_DISC(0.5)  WITHIN GROUP (ORDER BY tree_density_km2) AS INT) AS p50,
        CAST(PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY tree_density_km2) AS INT) AS p95
    FROM {{ ref('agg_h3_res7') }} WHERE tree_density_km2 IS NOT NULL AND forest_cover_pct <= 85
),
res8_density AS (
    SELECT
        to_json(PERCENTILE_CONT([0.0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0]) WITHIN GROUP (ORDER BY tree_density_km2)) AS quantiles,
        CAST(PERCENTILE_DISC(0.5)  WITHIN GROUP (ORDER BY tree_density_km2) AS INT) AS p50,
        CAST(PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY tree_density_km2) AS INT) AS p95
    FROM {{ ref('agg_h3_res8') }} WHERE tree_density_km2 IS NOT NULL AND forest_cover_pct <= 85
),
res9_density AS (
    SELECT
        to_json(PERCENTILE_CONT([0.0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0]) WITHIN GROUP (ORDER BY tree_density_km2)) AS quantiles,
        CAST(PERCENTILE_DISC(0.5)  WITHIN GROUP (ORDER BY tree_density_km2) AS INT) AS p50,
        CAST(PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY tree_density_km2) AS INT) AS p95
    FROM {{ ref('agg_h3_res9') }} WHERE tree_density_km2 IS NOT NULL AND forest_cover_pct <= 85
),
bezirke_density AS (
    SELECT
        to_json(PERCENTILE_CONT([0.0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0]) WITHIN GROUP (ORDER BY tree_density_km2)) AS quantiles,
        CAST(PERCENTILE_DISC(0.5)  WITHIN GROUP (ORDER BY tree_density_km2) AS INT) AS p50,
        CAST(PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY tree_density_km2) AS INT) AS p95
    FROM {{ ref('agg_bezirke') }} WHERE tree_density_km2 IS NOT NULL AND forest_cover_pct <= 85
),
ortsteile_density AS (
    SELECT
        to_json(PERCENTILE_CONT([0.0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0]) WITHIN GROUP (ORDER BY tree_density_km2)) AS quantiles,
        CAST(PERCENTILE_DISC(0.5)  WITHIN GROUP (ORDER BY tree_density_km2) AS INT) AS p50,
        CAST(PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY tree_density_km2) AS INT) AS p95
    FROM {{ ref('agg_ortsteile') }} WHERE tree_density_km2 IS NOT NULL AND forest_cover_pct <= 85
),
berlin_geom_25833 AS (
    SELECT 1 AS dummy_id, ST_Union_Agg(geometry) AS geometry
    FROM {{ ref('stg_bezirke') }}
),
{{ forest_intersections('berlin_geom_25833', 'dummy_id') }},
forest_totals AS (
    SELECT dummy_id, SUM(inter_area_m2) AS forest_area_m2
    FROM forest_intersections
    GROUP BY dummy_id
),
{{ forest_histogram('dummy_id') }},
berlin_geom AS (
    SELECT ST_FlipCoordinates(ST_Transform(geometry, 'EPSG:25833', 'EPSG:4326')) AS geometry
    FROM berlin_geom_25833
)
SELECT
    agg.tree_count,
    agg.genus_count,
    area.berlin_area_km2,
    area.forest_area_km2,
    area.non_forest_area_km2,
    ROUND(area.forest_area_km2 / NULLIF(area.berlin_area_km2, 0) * 100.0, 1) AS forest_cover_pct,
    ROUND(CAST(agg.tree_count AS DOUBLE) / NULLIF(area.non_forest_area_km2, 0), 1) AS tree_density_km2,
    tg.tree_genus_1,       tg.tree_genus_1_count,  tg.tree_genus_1_share,
    tg.tree_genus_2,       tg.tree_genus_2_count,  tg.tree_genus_2_share,
    tg.tree_genus_3,       tg.tree_genus_3_count,  tg.tree_genus_3_share,
    tg.tree_genus_4,       tg.tree_genus_4_count,  tg.tree_genus_4_share,
    tg.tree_genus_5,       tg.tree_genus_5_count,  tg.tree_genus_5_share,
    tg.tree_genus_6,       tg.tree_genus_6_count,  tg.tree_genus_6_share,
    tg.tree_genus_7,       tg.tree_genus_7_count,  tg.tree_genus_7_share,
    tg.tree_genus_8,       tg.tree_genus_8_count,  tg.tree_genus_8_share,
    tg.tree_genus_9,       tg.tree_genus_9_count,  tg.tree_genus_9_share,
    tg.tree_genus_10,      tg.tree_genus_10_count, tg.tree_genus_10_share,
    tg.tree_genus_other_count,
    tg.tree_genus_other_share,
    fh.forest_genus_1,     fh.forest_genus_1_share,
    fh.forest_genus_2,     fh.forest_genus_2_share,
    fh.forest_genus_3,     fh.forest_genus_3_share,
    fh.forest_genus_4,     fh.forest_genus_4_share,
    fh.forest_genus_5,     fh.forest_genus_5_share,
    fh.forest_genus_other_share,
    r6.p50  AS density_res6_p50,      r6.p95  AS density_res6_p95,      r6.quantiles AS density_res6_quantiles,
    r7.p50  AS density_res7_p50,      r7.p95  AS density_res7_p95,      r7.quantiles AS density_res7_quantiles,
    r8.p50  AS density_res8_p50,      r8.p95  AS density_res8_p95,      r8.quantiles AS density_res8_quantiles,
    r9.p50  AS density_res9_p50,      r9.p95  AS density_res9_p95,      r9.quantiles AS density_res9_quantiles,
    bz.p50  AS density_bezirke_p50,   bz.p95  AS density_bezirke_p95,   bz.quantiles AS density_bezirke_quantiles,
    ot.p50  AS density_ortsteile_p50, ot.p95  AS density_ortsteile_p95, ot.quantiles AS density_ortsteile_quantiles,
    bg.geometry
FROM agg
CROSS JOIN area_stats area
CROSS JOIN tree_genus_histogram tg
CROSS JOIN forest_histogram fh
CROSS JOIN res6_density r6
CROSS JOIN res7_density r7
CROSS JOIN res8_density r8
CROSS JOIN res9_density r9
CROSS JOIN bezirke_density bz
CROSS JOIN ortsteile_density ot
CROSS JOIN berlin_geom bg
WHERE tg.dummy_id = 1 AND fh.dummy_id = 1
