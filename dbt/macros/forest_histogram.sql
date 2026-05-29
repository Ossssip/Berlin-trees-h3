{% macro forest_histogram(id_col) %}
    forest_slots AS (
        SELECT {{ id_col }}, inter_area_m2, ba1 AS ba_code, m1 AS misch FROM forest_intersections WHERE ba1 IS NOT NULL AND m1 > 0
        UNION ALL
        SELECT {{ id_col }}, inter_area_m2, ba2, m2 FROM forest_intersections WHERE ba2 IS NOT NULL AND m2 > 0
        UNION ALL
        SELECT {{ id_col }}, inter_area_m2, ba3, m3 FROM forest_intersections WHERE ba3 IS NOT NULL AND m3 > 0
        UNION ALL
        SELECT {{ id_col }}, inter_area_m2, ba4, m4 FROM forest_intersections WHERE ba4 IS NOT NULL AND m4 > 0
        UNION ALL
        SELECT {{ id_col }}, inter_area_m2, ba5, m5 FROM forest_intersections WHERE ba5 IS NOT NULL AND m5 > 0
    ),
    forest_weights AS (
        SELECT
            fs.{{ id_col }},
            LOWER(lk.genus_latin)                  AS genus,
            fs.inter_area_m2 * (fs.misch / 100.0)  AS genus_weight
        FROM forest_slots fs
        JOIN {{ ref('forest_ba_codes') }} lk ON fs.ba_code = lk.ba_code
        WHERE lk.genus_latin != ''
    ),
    forest_genus_agg AS (
        SELECT {{ id_col }}, genus, SUM(genus_weight) AS total_weight
        FROM forest_weights
        GROUP BY {{ id_col }}, genus
    ),
    forest_total AS (
        SELECT {{ id_col }}, SUM(total_weight) AS grand_total
        FROM forest_genus_agg
        GROUP BY {{ id_col }}
    ),
    forest_ranked AS (
        SELECT
            g.{{ id_col }},
            g.genus,
            g.total_weight / t.grand_total                                    AS genus_share,
            ROW_NUMBER() OVER (PARTITION BY g.{{ id_col }} ORDER BY g.total_weight DESC) AS rn
        FROM forest_genus_agg g
        JOIN forest_total t ON g.{{ id_col }} = t.{{ id_col }}
    ),
    forest_histogram AS (
        SELECT
            {{ id_col }},
            MAX(CASE WHEN rn = 1 THEN genus END)                              AS forest_genus_1,
            ROUND(MAX(CASE WHEN rn = 1 THEN genus_share END) * 100, 1)        AS forest_genus_1_share,
            MAX(CASE WHEN rn = 2 THEN genus END)                              AS forest_genus_2,
            ROUND(MAX(CASE WHEN rn = 2 THEN genus_share END) * 100, 1)        AS forest_genus_2_share,
            MAX(CASE WHEN rn = 3 THEN genus END)                              AS forest_genus_3,
            ROUND(MAX(CASE WHEN rn = 3 THEN genus_share END) * 100, 1)        AS forest_genus_3_share,
            MAX(CASE WHEN rn = 4 THEN genus END)                              AS forest_genus_4,
            ROUND(MAX(CASE WHEN rn = 4 THEN genus_share END) * 100, 1)        AS forest_genus_4_share,
            MAX(CASE WHEN rn = 5 THEN genus END)                              AS forest_genus_5,
            ROUND(MAX(CASE WHEN rn = 5 THEN genus_share END) * 100, 1)        AS forest_genus_5_share,
            ROUND(
                (1.0 - SUM(CASE WHEN rn <= 5 THEN genus_share ELSE 0.0 END)) * 100,
                1
            )                                                                  AS forest_genus_other_share
        FROM forest_ranked
        GROUP BY {{ id_col }}
    )
{% endmacro %}
