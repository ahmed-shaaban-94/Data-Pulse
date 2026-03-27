{{
    config(
        materialized='table',
        schema='marts'
    )
}}

-- Calendar dimension (2023-2025)
-- Egypt weekend: Friday & Saturday

WITH date_spine AS (
    SELECT
        generate_series(
            '2023-01-01'::date,
            '2025-12-31'::date,
            '1 day'::interval
        )::date AS full_date
)

SELECT
    TO_CHAR(full_date, 'YYYYMMDD')::INT          AS date_key,
    full_date,
    EXTRACT(YEAR FROM full_date)::INT             AS year,
    EXTRACT(QUARTER FROM full_date)::INT          AS quarter,
    EXTRACT(MONTH FROM full_date)::INT            AS month,
    TRIM(TO_CHAR(full_date, 'Month'))             AS month_name,
    EXTRACT(ISODOW FROM full_date)::INT           AS day_of_week,
    TRIM(TO_CHAR(full_date, 'Day'))               AS day_name,
    EXTRACT(ISODOW FROM full_date) IN (5, 6)      AS is_weekend

FROM date_spine
ORDER BY full_date
