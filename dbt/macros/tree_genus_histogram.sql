{% macro tree_genus_histogram(source_cte, id_col) %}
    tree_genus_counts AS (
        SELECT {{ id_col }}, genus, COUNT(*) AS genus_count
        FROM {{ source_cte }}
        WHERE genus IS NOT NULL AND genus != ''
        GROUP BY {{ id_col }}, genus
    ),
    tree_genus_totals AS (
        SELECT {{ id_col }}, SUM(genus_count) AS total_count
        FROM tree_genus_counts
        GROUP BY {{ id_col }}
    ),
    tree_genus_ranked AS (
        SELECT
            c.{{ id_col }},
            c.genus,
            c.genus_count,
            c.genus_count * 1.0 / t.total_count AS genus_share,
            ROW_NUMBER() OVER (
                PARTITION BY c.{{ id_col }}
                ORDER BY c.genus_count DESC, c.genus ASC
            ) AS rn
        FROM tree_genus_counts c
        JOIN tree_genus_totals t ON c.{{ id_col }} = t.{{ id_col }}
    ),
    tree_genus_histogram AS (
        SELECT
            {{ id_col }},
            {% for i in range(1, 11) %}
            MAX(CASE WHEN rn = {{ i }} THEN genus END)                           AS tree_genus_{{ i }},
            MAX(CASE WHEN rn = {{ i }} THEN genus_count END)                     AS tree_genus_{{ i }}_count,
            ROUND(MAX(CASE WHEN rn = {{ i }} THEN genus_share END) * 100, 1)     AS tree_genus_{{ i }}_share,
            {% endfor %}
            COALESCE(SUM(CASE WHEN rn > 10 THEN genus_count ELSE 0 END), 0)     AS tree_genus_other_count,
            ROUND(
                COALESCE(SUM(CASE WHEN rn > 10 THEN genus_share ELSE 0.0 END), 0.0) * 100,
                1
            )                                                                    AS tree_genus_other_share
        FROM tree_genus_ranked
        GROUP BY {{ id_col }}
    )
{% endmacro %}
