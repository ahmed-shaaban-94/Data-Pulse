{{
    config(
        materialized='table',
        schema='marts'
    )
}}

-- Staff/personnel dimension
-- SCD Type 1: latest attribute wins

WITH ranked AS (
    SELECT
        staff_id,
        staff_name,
        staff_position,
        ROW_NUMBER() OVER (
            PARTITION BY staff_id
            ORDER BY invoice_date DESC
        ) AS rn
    FROM {{ ref('stg_sales') }}
    WHERE staff_id IS NOT NULL
)

SELECT
    ROW_NUMBER() OVER (ORDER BY staff_id)::INT            AS staff_key,
    staff_id,
    staff_name,
    staff_position
FROM ranked
WHERE rn = 1
