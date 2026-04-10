---
name: product_origin_business_rules
description: Product origin categories and which ones count toward goals/budget calculations
type: project
---

Product origin is derived from drug_division via dbt seed (seed_division_origin.csv) and stored in dim_product.origin.

Three revenue-bearing origins (included in goals/budget):
- **Pharma** — RX, OTC, NUTRACEUTICAL, HOME HEALTH CARE
- **Non-pharma** — BABY AND MOM, BEAUTY SKIN CARE, COSMETICS, TOTAL HAIR CARE, EVERYDAY ESSENTIALS, PREMIUM SKIN CARE
- **HVI** — HIGH VALUE ITEMS

Excluded from goals/budget:
- **Services** — EL EZABY SERVICES, ARCHIVE, AUX
- **Other** — Uncategorized, Unknown

**Why:** Services origin is internal/operational, not revenue targets. Goals and budget calculations should filter: `WHERE origin IN ('Pharma', 'Non-pharma', 'HVI')`

**How to apply:** Any goals, targets, forecasting, or budget feature must exclude Services and Other origins from calculations.
