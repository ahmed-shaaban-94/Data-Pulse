{{
    config(
        materialized='table',
        schema='marts'
    )
}}

-- Customer dimension
-- SCD Type 1: latest attribute wins

WITH ranked AS (
    SELECT
        customer_id,
        customer_name,
        ROW_NUMBER() OVER (
            PARTITION BY customer_id
            ORDER BY invoice_date DESC
        ) AS rn
    FROM {{ ref('stg_sales') }}
    WHERE customer_id IS NOT NULL
)

SELECT
    ROW_NUMBER() OVER (ORDER BY customer_id)::INT            AS customer_key,
    customer_id,
    customer_name
FROM ranked
WHERE rn = 1
