{{
    config(
        materialized='table',
        schema='marts'
    )
}}

-- Product dimension from drug_code
-- SCD Type 1: latest attribute wins (by most recent invoice_date)
-- Includes buyer (business owner of the product relationship)

WITH ranked AS (
    SELECT
        drug_code,
        drug_name,
        drug_brand,
        drug_cluster,
        drug_status,
        is_temporary,
        drug_category,
        drug_subcategory,
        drug_division,
        drug_segment,
        buyer,
        ROW_NUMBER() OVER (
            PARTITION BY drug_code
            ORDER BY invoice_date DESC
        ) AS rn
    FROM {{ ref('stg_sales') }}
    WHERE drug_code IS NOT NULL
)

SELECT
    ROW_NUMBER() OVER (ORDER BY drug_code)::INT            AS product_key,
    drug_code,
    drug_name,
    drug_brand,
    drug_cluster,
    drug_status,
    is_temporary,
    drug_category,
    drug_subcategory,
    drug_division,
    drug_segment,
    buyer
FROM ranked
WHERE rn = 1
