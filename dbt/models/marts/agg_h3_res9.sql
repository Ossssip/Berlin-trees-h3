{{ config(materialized='table') }}

WITH berlin_boundary AS MATERIALIZED (
    SELECT ST_Union_Agg(geometry) AS geom FROM {{ ref('stg_bezirke') }}
),
trees_h3 AS (
    SELECT
        h3_latlng_to_cell(
            -- DuckDB EPSG:4326 authority axis order: ST_X = lat, ST_Y = lng
            ST_X(ST_Transform(geometry, 'EPSG:25833', 'EPSG:4326')),
            ST_Y(ST_Transform(geometry, 'EPSG:25833', 'EPSG:4326')),
            9
        ) AS h3_index,
        COALESCE(
            NULLIF(NULLIF(LOWER(TRIM(genus_latin)), ''), 'unbekannt'),
            NULLIF(LOWER(SPLIT_PART(TRIM(species_latin), ' ', 1)), '')
        ) AS genus,
        LOWER(TRIM(SPLIT_PART(COALESCE(TRIM(species_latin), ''), '''', 1))) AS species,
        source
    FROM {{ ref('int_trees_unified') }}
),
forest_h3 AS (
    SELECT DISTINCT UNNEST(h3_grid_disk(h3_index, 1)) AS h3_index
    FROM (
        SELECT DISTINCT
            UNNEST(h3_polygon_wkt_to_cells(
                ST_AsText(ST_FlipCoordinates(ST_Transform(part.geom, 'EPSG:25833', 'EPSG:4326'))),
                9
            )) AS h3_index
        FROM (
            SELECT UNNEST(ST_Dump(geometry)) AS part
            FROM {{ ref('stg_waelder') }}
            WHERE ST_GeometryType(geometry) IN ('POLYGON', 'MULTIPOLYGON', 'GEOMETRYCOLLECTION')
        )
        WHERE ST_GeometryType(part.geom) = 'POLYGON'
    )
),
h3_geoms AS MATERIALIZED (
    SELECT
        h3_index,
        ST_Transform(
            ST_FlipCoordinates(ST_GeomFromText(h3_cell_to_boundary_wkt(h3_index))),
            'EPSG:4326', 'EPSG:25833'
        ) AS geom_25833
    FROM (
        SELECT h3_index FROM trees_h3
        UNION
        SELECT h3_index FROM forest_h3
    )
),
h3_berlin AS MATERIALIZED (
    SELECT
        h.h3_index,
        ST_Intersection(h.geom_25833, b.geom) AS berlin_geom,
        ST_Area(ST_Intersection(h.geom_25833, b.geom)) AS berlin_area_m2
    FROM h3_geoms h
    CROSS JOIN berlin_boundary b
    WHERE ST_Intersects(h.geom_25833, b.geom)
),
{{ forest_intersections('h3_berlin', 'h3_index', 'berlin_geom') }},
tree_agg AS (
    SELECT
        h3_index,
        COUNT(*)                                                      AS tree_count,
        mode(genus)                                                   AS dominant_genus,
        COUNT(DISTINCT genus)                                         AS genus_count,
        mode(NULLIF(species, ''))                                     AS dominant_species,
        COUNT(DISTINCT NULLIF(species, ''))                           AS species_count,
        SUM(CASE WHEN source = 'strassenbaeume' THEN 1 ELSE 0 END)   AS source_strassenbaeume,
        SUM(CASE WHEN source = 'anlagenbaeume'  THEN 1 ELSE 0 END)   AS source_anlagenbaeume,
        SUM(CASE WHEN source = 'gruen_berlin'   THEN 1 ELSE 0 END)   AS source_gruen_berlin
    FROM trees_h3
    GROUP BY h3_index
),
species_counts AS (
    SELECT h3_index, NULLIF(species, '') AS species, COUNT(*) AS n
    FROM trees_h3
    WHERE species IS NOT NULL AND species != ''
    GROUP BY h3_index, species
),
dominant_n AS (
    SELECT h3_index, MAX(n) AS max_n
    FROM species_counts
    GROUP BY h3_index
),
forest_totals AS (
    SELECT h3_index, SUM(inter_area_m2) AS forest_area_m2
    FROM forest_intersections
    GROUP BY h3_index
),
{{ tree_genus_histogram('trees_h3', 'h3_index') }},
{{ forest_histogram('h3_index') }}
SELECT
    h3_h3_to_string(hb.h3_index)                                          AS h3_index,
    COALESCE(t.tree_count, 0)                                              AS tree_count,
    t.dominant_genus,
    COALESCE(t.genus_count, 0)                                             AS genus_count,
    t.dominant_species,
    COALESCE(t.species_count, 0)                                           AS species_count,
    CASE WHEN COALESCE(t.tree_count, 0) > 0
        THEN ROUND(100.0 * d.max_n / t.tree_count, 1) END                 AS dominant_species_pct,
    COALESCE(t.source_strassenbaeume, 0)                                   AS source_strassenbaeume,
    COALESCE(t.source_anlagenbaeume, 0)                                    AS source_anlagenbaeume,
    COALESCE(t.source_gruen_berlin, 0)                                     AS source_gruen_berlin,
    tg.tree_genus_1,
    tg.tree_genus_1_count,
    tg.tree_genus_1_share,
    tg.tree_genus_2,
    tg.tree_genus_2_count,
    tg.tree_genus_2_share,
    tg.tree_genus_3,
    tg.tree_genus_3_count,
    tg.tree_genus_3_share,
    tg.tree_genus_4,
    tg.tree_genus_4_count,
    tg.tree_genus_4_share,
    tg.tree_genus_5,
    tg.tree_genus_5_count,
    tg.tree_genus_5_share,
    tg.tree_genus_6,
    tg.tree_genus_6_count,
    tg.tree_genus_6_share,
    tg.tree_genus_7,
    tg.tree_genus_7_count,
    tg.tree_genus_7_share,
    tg.tree_genus_8,
    tg.tree_genus_8_count,
    tg.tree_genus_8_share,
    tg.tree_genus_9,
    tg.tree_genus_9_count,
    tg.tree_genus_9_share,
    tg.tree_genus_10,
    tg.tree_genus_10_count,
    tg.tree_genus_10_share,
    tg.tree_genus_other_count,
    tg.tree_genus_other_share,
    ROUND(hb.berlin_area_m2 / 1e6, 4)                                     AS berlin_area_km2,
    ROUND(COALESCE(ft.forest_area_m2, 0.0) / 1e6, 4)                      AS forest_area_km2,
    ROUND(
        GREATEST(hb.berlin_area_m2 - COALESCE(ft.forest_area_m2, 0.0), 0.0) / 1e6,
        4
    )                                                                      AS non_forest_area_km2,
    ROUND(
        CASE
            WHEN hb.berlin_area_m2 > 0
                THEN LEAST(COALESCE(ft.forest_area_m2, 0.0) / hb.berlin_area_m2 * 100.0, 100.0)
            ELSE 0.0
        END,
        1
    )                                                                      AS forest_cover_pct,
    fh.forest_genus_1,
    fh.forest_genus_1_share,
    fh.forest_genus_2,
    fh.forest_genus_2_share,
    fh.forest_genus_3,
    fh.forest_genus_3_share,
    fh.forest_genus_4,
    fh.forest_genus_4_share,
    fh.forest_genus_5,
    fh.forest_genus_5_share,
    fh.forest_genus_other_share,
    ROUND(
        COALESCE(t.tree_count, 0) /
        NULLIF(
            GREATEST(hb.berlin_area_m2 - COALESCE(ft.forest_area_m2, 0.0), 0.0) / 1e6,
            0
        ),
        1
    )                                                                      AS tree_density_km2,
    -- Geometry: standard (lng, lat) WKT from h3_cell_to_boundary_wkt, stored as GEOMETRY
    ST_GeomFromText(h3_cell_to_boundary_wkt(hb.h3_index))                 AS geometry
FROM h3_berlin hb
LEFT JOIN tree_agg t              ON hb.h3_index = t.h3_index
LEFT JOIN dominant_n d            ON hb.h3_index = d.h3_index
LEFT JOIN forest_totals ft        ON hb.h3_index = ft.h3_index
LEFT JOIN tree_genus_histogram tg ON hb.h3_index = tg.h3_index
LEFT JOIN forest_histogram fh     ON hb.h3_index = fh.h3_index
WHERE COALESCE(t.tree_count, 0) > 0 OR COALESCE(ft.forest_area_m2, 0) > 0
