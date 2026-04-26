{{ config(tags=['quality_gate', 'marts']) }}

-- M11 (audit 2026-04-26): margin invariants on agg_basket_margin.
--
-- Two contracts that the gold model must hold:
--   (1) gross_margin = revenue - cost
--       Both ``cost`` and ``gross_margin`` use COALESCE-per-item in the
--       model, so they are always non-NULL and the invariant is exact.
--   (2) margin_pct in a sanity band
--       margin_pct = (revenue - cost) / revenue when revenue > 0.
--       Above 1.0 is mathematically impossible (cost is COALESCE-clamped
--       to ≥ 0). Below -10 indicates either a data error or a clearance
--       sale below cost by more than 10× revenue — flag it.
--
-- The test fails if any row violates either contract.

WITH violations AS (
    SELECT
        tenant_id,
        transaction_id,
        revenue,
        cost,
        gross_margin,
        margin_pct,
        CASE
            WHEN gross_margin IS DISTINCT FROM (revenue - cost)
                THEN 'gross_margin != revenue - cost'
            WHEN margin_pct IS NOT NULL AND (margin_pct > 1 OR margin_pct < -10)
                THEN 'margin_pct out of sanity band [-10, 1]'
        END AS violation
    FROM {{ ref('agg_basket_margin') }}
)

SELECT *
FROM violations
WHERE violation IS NOT NULL
