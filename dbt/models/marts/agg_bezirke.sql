{{ config(materialized='table') }}

WITH trees_coords AS (
    SELECT
        geometry,
        COALESCE(
            NULLIF(NULLIF(LOWER(TRIM(genus_latin)), ''), 'unbekannt'),
            NULLIF(LOWER(SPLIT_PART(TRIM(species_latin), ' ', 1)), '')
        ) AS genus,
        LOWER(TRIM(SPLIT_PART(COALESCE(TRIM(species_latin), ''), '''', 1))) AS species,
        source
    FROM {{ ref('int_trees_unified') }}
),
tree_admin AS (
    SELECT
        a.bezirk_code AS area_id,
        t.genus,
        t.species,
        t.source
    FROM trees_coords t
    JOIN {{ ref('stg_bezirke') }} a ON ST_Within(t.geometry, a.geometry)
),
agg AS (
    SELECT
        area_id,
        COUNT(*)                                                    AS tree_count,
        mode(genus)                                                 AS dominant_genus,
        COUNT(DISTINCT genus)                                       AS genus_count,
        mode(NULLIF(species, ''))                                   AS dominant_species,
        COUNT(DISTINCT NULLIF(species, ''))                         AS species_count,
        SUM(CASE WHEN source = 'strassenbaeume' THEN 1 ELSE 0 END) AS source_strassenbaeume,
        SUM(CASE WHEN source = 'anlagenbaeume'  THEN 1 ELSE 0 END) AS source_anlagenbaeume,
        SUM(CASE WHEN source = 'gruen_berlin'   THEN 1 ELSE 0 END) AS source_gruen_berlin
    FROM tree_admin
    GROUP BY area_id
),
species_counts AS (
    SELECT area_id, NULLIF(species, '') AS species, COUNT(*) AS n
    FROM tree_admin
    WHERE species IS NOT NULL AND species != ''
    GROUP BY area_id, species
),
dominant_n AS (
    SELECT area_id, MAX(n) AS max_n
    FROM species_counts
    GROUP BY area_id
),
{{ tree_genus_histogram('tree_admin', 'area_id') }},
admin_geoms AS (
    SELECT bezirk_code AS area_id, geometry FROM {{ ref('stg_bezirke') }}
),
{{ forest_intersections('admin_geoms', 'area_id') }},
forest_totals AS (
    SELECT area_id, SUM(inter_area_m2) AS forest_area_m2
    FROM forest_intersections
    GROUP BY area_id
),
{{ forest_histogram('area_id') }}
SELECT
    a.bezirk_code                                                       AS area_id,
    a.bezirk_name                                                       AS area_name,
    b.tree_count,
    b.dominant_genus,
    b.genus_count,
    b.dominant_species,
    b.species_count,
    ROUND(100.0 * d.max_n / b.tree_count, 1)                          AS dominant_species_pct,
    b.source_strassenbaeume,
    b.source_anlagenbaeume,
    b.source_gruen_berlin,
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
    ROUND(ST_Area(a.geometry) / 1e6, 4)                               AS berlin_area_km2,
    ROUND(COALESCE(ft.forest_area_m2, 0.0) / 1e6, 4)                 AS forest_area_km2,
    ROUND(GREATEST(ST_Area(a.geometry) - COALESCE(ft.forest_area_m2, 0.0), 0.0) / 1e6, 4)
                                                                       AS non_forest_area_km2,
    ROUND(
        CASE
            WHEN ST_Area(a.geometry) > 0
                THEN LEAST(COALESCE(ft.forest_area_m2, 0.0) / ST_Area(a.geometry) * 100.0, 100.0)
            ELSE 0.0
        END,
        1
    )                                                                  AS forest_cover_pct,
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
        b.tree_count /
        NULLIF(GREATEST(ST_Area(a.geometry) - COALESCE(ft.forest_area_m2, 0.0), 0.0) / 1e6, 0),
        1
    )                                                                  AS tree_density_km2,
    -- Geometry: EPSG:25833 → EPSG:4326, flip to standard (lng, lat)
    ST_FlipCoordinates(ST_Transform(a.geometry, 'EPSG:25833', 'EPSG:4326'))
                                                                       AS geometry
FROM {{ ref('stg_bezirke') }} a
JOIN agg b              ON a.bezirk_code = b.area_id
LEFT JOIN dominant_n d  ON a.bezirk_code = d.area_id
LEFT JOIN tree_genus_histogram tg ON a.bezirk_code = tg.area_id
LEFT JOIN forest_histogram fh     ON a.bezirk_code = fh.area_id
LEFT JOIN forest_totals ft        ON a.bezirk_code = ft.area_id
