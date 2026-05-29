{% macro forest_intersections(geom_cte, id_col, geom_col='geometry') %}
    forest_intersections AS (
        SELECT
            {{ id_col }},
            ST_Area(clipped_geom) AS inter_area_m2,
            ba1, m1, ba2, m2, ba3, m3, ba4, m4, ba5, m5
        FROM (
            SELECT
                feat.{{ id_col }},
                ST_Intersection(feat.{{ geom_col }}, w.geometry) AS clipped_geom,
                TRIM(w.s1_1_ba) AS ba1, w.s1_1_misch AS m1,
                TRIM(w.s1_2_ba) AS ba2, w.s1_2_misch AS m2,
                TRIM(w.s1_3_ba) AS ba3, w.s1_3_misch AS m3,
                TRIM(w.s1_4_ba) AS ba4, w.s1_4_misch AS m4,
                TRIM(w.s1_5_ba) AS ba5, w.s1_5_misch AS m5
            FROM {{ geom_cte }} feat
            JOIN {{ ref('stg_waelder') }} w ON ST_Intersects(feat.{{ geom_col }}, w.geometry)
        )
        WHERE NOT ST_IsEmpty(clipped_geom)
    )
{% endmacro %}
