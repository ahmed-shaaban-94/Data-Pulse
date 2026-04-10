# Phase 1: Data Pipeline (COMPLETED)

> **Status**: COMPLETED
> **Timeline**: Foundation through Dashboard + Polish
> **Result**: End-to-end sales analytics platform -- from raw Excel ingestion to interactive web dashboard

## Overview

Phase 1 delivers the complete data pipeline for DataPulse. Raw Excel/CSV files (272 MB) flow through a medallion architecture (Bronze -> Silver -> Gold), are served via a FastAPI REST API, and visualized on a Next.js 14 dashboard. All six sub-phases are done.

```
Excel/CSV (272 MB)
     |
     v
[1.1 Foundation]     Docker, config, file reader, dbt init
     |
     v
[1.2 Bronze Layer]   Raw ingestion: Excel -> Polars -> Parquet -> PostgreSQL
     |                1,134,799 rows, 46 columns, batch insert 50K
     v
[1.3 Silver Layer]   dbt staging: dedup, clean, rename, derive
     |                ~1.1M rows, 30 columns, 7 dbt tests
     v
[1.4 Gold Layer]     Star schema: 6 dims + 1 fact + 8 aggs
     |                FastAPI API: 10 analytics endpoints
     v
[1.5 Dashboard]      Next.js 14: 6 pages, Recharts, SWR, Tailwind
     |                18 Playwright E2E specs
     v
[1.6 Polish]         Security audit, error handling, 95%+ coverage
```

### Key Metrics

- **Raw data**: 272 MB Excel -> 57 MB Parquet -> 1.1M rows in PostgreSQL
- **Star schema**: 6 dimension tables, 1 fact table, 8 aggregation models
- **API**: 10 analytics endpoints + health check
- **Dashboard**: 6 pages, 7 KPI cards, 5 chart types
- **Test coverage**: 95%+ backend, 18 E2E specs frontend
- **dbt tests**: ~40 schema and data tests passing

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Data Processing | Polars + PyArrow + fastexcel |
| Database | PostgreSQL 16 (Docker) |
| Data Transform | dbt-core + dbt-postgres |
| API | FastAPI + SQLAlchemy 2.0 |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS + Recharts |
| Config | Pydantic Settings |
| Logging | structlog |
| Testing | pytest (95%+), Playwright (18 E2E specs) |
| Containers | Docker Compose |

---

## 1.1 Foundation

> **Status**: DONE

### Objective

Establish the project infrastructure: Docker services, Python project scaffold, configuration management, generic file reader, and dbt project initialization.

### Deliverables

- [x] Docker Compose with 4 services (app, postgres, pgadmin, jupyter)
- [x] PostgreSQL 16 database with `datapulse` schema
- [x] Pydantic Settings config (`DATABASE_URL`, `MAX_FILE_SIZE_MB`, `MAX_ROWS`, `MAX_COLUMNS`)
- [x] structlog logging configuration
- [x] Generic file reader (`read_csv()`, `read_excel()`, `read_file()`)
- [x] Column type detector (auto-detect types from DataFrame)
- [x] File validator (size limits, format checks)
- [x] dbt project with `dbt_project.yml` and `profiles.yml`
- [x] Full test suite for reader, type detector, config, and validator

### Technical Details

**Docker Services**

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `app` | Custom Python 3.12 | 8888 | Application + JupyterLab |
| `postgres` | PostgreSQL 16 | 5432 | Primary database |
| `pgadmin` | pgAdmin 4 | 5050 | DB admin UI |

**Configuration (Pydantic Settings)** -- all settings loaded from `.env`:

- `DATABASE_URL` -- PostgreSQL connection string
- `MAX_FILE_SIZE_MB` -- 500 MB default
- `MAX_ROWS` -- 10,000,000 default
- `MAX_COLUMNS` -- 200 default
- `BRONZE_BATCH_SIZE` -- 50,000 rows per insert batch

**File Reader**

- Engine: Polars for DataFrames, fastexcel (calamine) for Excel parsing
- Formats: `.csv`, `.xlsx`, `.xls`
- Output: Polars DataFrame with detected column types
- Models: `ImportConfig`, `ImportResult`, `ColumnInfo` (Pydantic)

### Key Decisions

1. **Polars over Pandas** -- better performance for large datasets, native Arrow integration
2. **fastexcel over openpyxl** -- calamine Rust engine, significantly faster Excel parsing
3. **Pydantic Settings** -- type-safe config with environment variable support and validation
4. **structlog** -- structured JSON logging for production observability
5. **Docker-first** -- all services containerized from day one

### Files Created

```
src/datapulse/
  __init__.py
  config.py                        # Pydantic Settings
  logging.py                       # structlog configuration
  import_pipeline/
    __init__.py
    models.py                      # ImportConfig, ImportResult, ColumnInfo
    reader.py                      # read_csv(), read_excel(), read_file()
    type_detector.py               # Auto-detect column types
    validator.py                   # File validation

dbt/
  dbt_project.yml
  profiles.yml

docker-compose.yml
tests/
  conftest.py
  test_reader.py
  test_type_detector.py
  test_config.py
  test_validator.py
```

---

## 1.2 Bronze Layer

> **Status**: DONE

### Objective

Build the raw data ingestion pipeline: read Excel sales files, convert to Parquet, and load into PostgreSQL's bronze schema with full column mapping and batch inserts.

### Deliverables

- [x] Migration `001_create_bronze_schema.sql` -- bronze schema + `bronze.sales` table (46 columns)
- [x] Column mapping for 46 Excel columns to database columns
- [x] Bronze loader: Excel -> Polars DataFrame -> Parquet file -> PostgreSQL
- [x] CLI entry point: `python -m datapulse.bronze.loader`
- [x] Parquet compression: 272 MB Excel -> 57 MB Parquet
- [x] Batch insert: 50,000 rows per batch
- [x] 1,134,799 rows loaded successfully
- [x] Tests for loader module

### Technical Details

**Pipeline Flow**

```
Excel file (272 MB, .xlsx)
     |  fastexcel (calamine engine)
     v
Polars DataFrame (1.1M rows x 46 cols)
     |  PyArrow serialization
     v
Parquet file (57 MB, compressed)
     |  SQLAlchemy + batch insert
     v
PostgreSQL bronze.sales (1,134,799 rows)
```

**Column Mapping (46 columns)**

| Group | Columns |
|-------|---------|
| Transaction | `reference_no`, `date`, `billing_document`, `billing_type` |
| Product | `material`, `material_desc`, `brand`, `category`, `subcategory`, `division`, `segment` |
| Customer/Site | `customer`, `customer_name`, `site`, `site_name`, `buyer` |
| Personnel | `personel_number`, `person_name`, `position`, `area_mg` |
| Financials | `quantity`, `net_sales`, `gross_sales`, `sales_not_tax`, `tax`, `paid`, `kzwi1` |

**Database Schema**

```sql
CREATE SCHEMA IF NOT EXISTS bronze;

CREATE TABLE bronze.sales (
    id SERIAL PRIMARY KEY,
    reference_no TEXT,
    date DATE,
    -- ... 44 more columns
    loaded_at TIMESTAMPTZ DEFAULT NOW()
);
```

**CLI Usage**

```bash
# Full pipeline (Excel -> Parquet -> PostgreSQL)
python -m datapulse.bronze.loader --source /app/data/raw/sales

# Parquet only (skip database load)
python -m datapulse.bronze.loader --source /app/data/raw/sales --skip-db
```

### Key Decisions

1. **Parquet as intermediate format** -- columnar storage, 79% compression, enables re-loading without re-reading Excel
2. **Batch insert at 50K rows** -- balances memory usage with insert performance
3. **SQL column whitelist** -- only mapped columns are inserted, preventing injection
4. **Financial columns as NUMERIC(18,4)** -- avoids floating-point precision errors
5. **`loaded_at` timestamp** -- tracks when each row was ingested for auditability

### Files Created

```
src/datapulse/bronze/
  __init__.py
  __main__.py                      # CLI entry point
  column_map.py                    # Excel header -> DB column mapping
  loader.py                        # Excel -> Polars -> Parquet -> PostgreSQL

migrations/
  001_create_bronze_schema.sql     # Bronze schema + tables

tests/
  test_loader.py
```

---

## 1.3 Silver Layer

> **Status**: DONE

### Objective

Build the data cleaning and transformation layer using dbt. The silver layer deduplicates, renames, derives new columns, and standardizes the raw bronze data into a clean staging model.

### Deliverables

- [x] Source definition `_bronze__sources.yml`
- [x] Base model `bronze_sales.sql`
- [x] Staging model `stg_sales.sql` -- 30 columns, fully cleaned
- [x] Deduplication: ~1.1M unique rows from 1.13M raw rows
- [x] 19 columns dropped, 22 columns renamed
- [x] Billing type Arabic -> English mapping (10 types)
- [x] 5 derived columns: `net_amount`, `year`, `month`, `quarter`, `is_return`, `has_insurance`
- [x] Normalized `drug_status` values
- [x] 7 dbt tests passing
- [x] Staging source definition `_staging__sources.yml`

### Technical Details

**Transformations in `stg_sales.sql`**

| Transformation | Detail |
|---------------|--------|
| Dedup | `ROW_NUMBER() OVER (PARTITION BY reference_no ORDER BY date)` -- keep first occurrence |
| Drop columns | 19 columns removed (redundant, empty, internal) |
| Rename | 22 columns renamed to snake_case English conventions |
| Billing EN | CASE expression mapping 10 Arabic billing types to English |
| NULL handling | COALESCE for key fields, NULL-safe comparisons |
| net_amount | Derived: `gross_sales - tax` |
| Temporal | `EXTRACT(YEAR/MONTH/QUARTER FROM date)` |
| is_return | Boolean flag based on negative quantity |
| has_insurance | Boolean flag based on insurance billing types |
| drug_status | Normalized to consistent values via CASE |

**Billing Type Mapping (10 types)**

| Arabic | English |
|--------|---------|
| نقدي | Cash |
| آجل | Credit |
| تأمين | Insurance |
| مرتجع نقدي | Cash Return |
| مرتجع آجل | Credit Return |
| ... | (5 groups total) |

**dbt Tests (7 passing)**

- `unique` on `reference_no`
- `not_null` on key columns (`reference_no`, `date`, `material`)
- `accepted_values` on `billing_type_en`
- `relationships` to bronze source

### Key Decisions

1. **dbt over raw SQL** -- version-controlled transformations, built-in testing, dependency graph
2. **View materialization for staging** -- avoids data duplication, always reflects latest bronze data
3. **English billing types** -- standardized for downstream analytics and API consumers
4. **Aggressive column pruning** -- 19 columns dropped early to reduce downstream complexity
5. **Security invoker on views** -- `security_invoker=on` ensures RLS applies through views

### Files Created

```
dbt/models/
  bronze/
    _bronze__sources.yml           # Source definition for bronze.sales
    bronze_sales.sql               # Base model (ref to source)
  staging/
    _staging__sources.yml          # Source definition for staging
    stg_sales.sql                  # Silver layer: 30 cols, dedup, clean, derive
```

---

## 1.4 Gold Layer & Analytics API

> **Status**: DONE

### Objective

Build the business-ready gold layer as a star schema in dbt, then expose it through a Python analytics module and FastAPI REST API.

### Deliverables

- [x] 6 dimension tables: `dim_date`, `dim_billing`, `dim_customer`, `dim_product`, `dim_site`, `dim_staff`
- [x] 1 fact table: `fct_sales` (1,134,073 rows, 6 foreign keys)
- [x] 8 aggregation models: daily, monthly, by-product, by-customer, by-site, by-staff, returns, metrics_summary
- [x] ~40 dbt tests (unique, not_null, relationships, accepted_values)
- [x] Python analytics module: Pydantic models, SQLAlchemy repository, service layer
- [x] FastAPI API: 10 analytics endpoints under `/api/v1/analytics/`
- [x] Health endpoint: `GET /health`
- [x] CORS configuration for frontend access

### Technical Details

**Star Schema**

```
                    dim_date
                       |
dim_billing ----> fct_sales <---- dim_customer
                   |   |   |
            dim_product  dim_site  dim_staff
```

**Dimension Tables**

| Table | Rows | Key Columns | Notes |
|-------|------|-------------|-------|
| `dim_date` | 1,096 | date_key, year, quarter, month, week | 2023-2025 calendar |
| `dim_billing` | 11 | billing_type, billing_group | 10 types + Unknown |
| `dim_customer` | 24,801 | customer_code, customer_name | Unknown member at key=-1 |
| `dim_product` | 17,803 | drug_code, brand, category | Unknown member at key=-1 |
| `dim_site` | 2 | site_name, area_manager | Unknown member at key=-1 |
| `dim_staff` | 1,226 | staff_name, position | Unknown member at key=-1 |

**Fact Table: `fct_sales`**

- Rows: 1,134,073
- Foreign Keys: 6 (date, billing, customer, product, site, staff)
- Measures: quantity, net_sales, gross_sales, tax
- COALESCE to -1: All FK joins map NULLs to Unknown dimension members

**Aggregation Models**

| Model | Rows | Grain | Key Metrics |
|-------|------|-------|-------------|
| `agg_sales_daily` | 9,004 | day | total_sales, total_quantity, order_count |
| `agg_sales_monthly` | 36 | month | sales, MoM growth %, YoY growth % |
| `agg_sales_by_product` | 161,703 | product x month | revenue, quantity, avg_price |
| `agg_sales_by_customer` | 43,674 | customer x month | revenue, order_count |
| `agg_sales_by_site` | 36 | site x month | revenue, quantity |
| `agg_sales_by_staff` | 3,123 | staff x month | revenue, order_count |
| `agg_returns` | 91,536 | product x customer | return_quantity, return_value |
| `metrics_summary` | 1,094 | day | MTD/YTD running totals, daily KPIs |

**API Endpoints**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (503 if DB down) |
| GET | `/api/v1/analytics/summary` | KPI summary (7 metrics) |
| GET | `/api/v1/analytics/trends/daily` | Daily sales trend |
| GET | `/api/v1/analytics/trends/monthly` | Monthly sales trend |
| GET | `/api/v1/analytics/products/top` | Top products ranking |
| GET | `/api/v1/analytics/customers/top` | Top customers ranking |
| GET | `/api/v1/analytics/staff/top` | Top staff ranking |
| GET | `/api/v1/analytics/sites` | Site comparison |
| GET | `/api/v1/analytics/returns` | Returns analysis |
| GET | `/api/v1/analytics/filters` | Available filter values |

**Python Analytics Module**

- `models.py` -- Pydantic models: `KPISummary`, `TrendResult`, `RankingResult`, etc.
- `repository.py` -- SQLAlchemy read-only queries against `public_marts` schema
- `service.py` -- Business logic layer with default date filters

### Key Decisions

1. **Star schema with Unknown members** -- dimension key=-1 for unmatched records, avoids NULL FKs
2. **Pre-computed aggregations** -- 8 agg tables avoid expensive runtime JOINs
3. **MoM/YoY growth in SQL** -- `LAG()` window functions in `agg_sales_monthly`
4. **MTD/YTD running totals** -- `metrics_summary` provides pre-calculated rolling metrics
5. **Read-only repository** -- analytics queries never write, clean separation from pipeline mutations
6. **JsonDecimal type** -- Decimal precision internally, float serialization in JSON responses

### Files Created

```
dbt/models/marts/
  dims/
    _dims__models.yml              # Schema + tests for all dimensions
    dim_date.sql, dim_billing.sql, dim_customer.sql
    dim_product.sql, dim_site.sql, dim_staff.sql
  facts/
    _facts__models.yml             # Schema + tests for fact table
    fct_sales.sql
  aggs/
    _aggs__models.yml              # Schema + tests for aggregations
    agg_sales_daily.sql, agg_sales_monthly.sql
    agg_sales_by_product.sql, agg_sales_by_customer.sql
    agg_sales_by_site.sql, agg_sales_by_staff.sql
    agg_returns.sql, metrics_summary.sql

src/datapulse/
  analytics/
    __init__.py
    models.py                      # Pydantic response models
    repository.py                  # SQLAlchemy queries
    service.py                     # Business logic layer
  api/
    __init__.py
    app.py                         # FastAPI app factory
    deps.py                        # Dependency injection
    routes/
      __init__.py
      health.py                    # GET /health
      analytics.py                 # 10 analytics endpoints
```

---

## 1.5 Dashboard

> **Status**: DONE

### Objective

Build an interactive web dashboard to visualize the gold layer analytics. Six pages covering executive overview, product/customer/staff/site analytics, and returns analysis.

### Deliverables

- [x] Next.js 14 scaffold with App Router
- [x] API client with `fetchAPI<T>` and Decimal parsing
- [x] SWR configuration and 9 data-fetching hooks
- [x] Executive overview page: 7 KPI cards + daily/monthly trend charts
- [x] Product analytics page: top products ranking (chart + table)
- [x] Customer intelligence page: top customers ranking (chart + table)
- [x] Staff performance page: staff rankings
- [x] Site comparison page: side-by-side site cards
- [x] Returns analysis page: returns table + top returns chart
- [x] Filter bar with date presets (This Month, Last Month, Q1-Q4, YTD, All Time)
- [x] Filter context synced to URL search params
- [x] Responsive sidebar navigation (collapsible on mobile)
- [x] Loading skeletons for all pages
- [x] Error boundary and 404 page
- [x] Health indicator (green/amber/red dot)
- [x] Docker multi-stage build (dev + builder + production)
- [x] 18 Playwright E2E specs across 6 test files

### Technical Details

**Pages**

| Route | Page | Key Components |
|-------|------|---------------|
| `/` | Redirect | -> `/dashboard` |
| `/dashboard` | Executive Overview | KPI grid (7 cards), daily area chart, monthly bar chart |
| `/products` | Product Analytics | Horizontal bar chart, ranking table |
| `/customers` | Customer Intelligence | Horizontal bar chart, ranking table |
| `/staff` | Staff Performance | Rankings with progress bars |
| `/sites` | Site Comparison | Side-by-side comparison cards (2 sites) |
| `/returns` | Returns Analysis | Custom 5-column table, top returns chart |

**Component Architecture**

```
layout.tsx
  Providers (SWR + FilterContext)
    Sidebar (6 nav items, health indicator)
    ErrorBoundary
      page.tsx
        FilterBar (date presets)
        KPIGrid / Overview / Table / Chart components
          SWR hooks -> API client -> FastAPI
```

**SWR Hooks (9 total)**

| Hook | Endpoint | Used By |
|------|----------|---------|
| `useSummary` | `/analytics/summary` | Dashboard KPI grid |
| `useDailyTrend` | `/analytics/trends/daily` | Dashboard area chart |
| `useMonthlyTrend` | `/analytics/trends/monthly` | Dashboard bar chart |
| `useTopProducts` | `/analytics/products/top` | Products page |
| `useTopCustomers` | `/analytics/customers/top` | Customers page |
| `useTopStaff` | `/analytics/staff/top` | Staff page |
| `useSites` | `/analytics/sites` | Sites page |
| `useReturns` | `/analytics/returns` | Returns page |
| `useHealth` | `/health` | Health indicator |

**E2E Tests (18 specs)**

| File | Coverage |
|------|----------|
| `dashboard.spec.ts` | KPI cards, trend charts, filter bar |
| `navigation.spec.ts` | Sidebar nav, active highlight, redirect |
| `filters.spec.ts` | Date preset clicks |
| `pages.spec.ts` | All 5 analytics pages load |
| `health.spec.ts` | API health indicator |
| `pipeline.spec.ts` | Pipeline dashboard elements |

### Key Decisions

1. **Next.js 14 App Router** -- server components by default, file-based routing
2. **SWR over React Query** -- lighter weight, sufficient for read-heavy analytics
3. **URL-synced filters** -- shareable/bookmarkable filter states via search params
4. **Recharts** -- React-native charting, good TypeScript support, composable
5. **No SSR for data** -- all analytics data fetched client-side via SWR (API behind auth)
6. **Multi-stage Docker** -- dev stage for hot reload, builder for compilation, production for minimal image

### Files Created

```
frontend/
  Dockerfile, package.json, tailwind.config.ts, playwright.config.ts
  e2e/
    dashboard.spec.ts, navigation.spec.ts, filters.spec.ts
    pages.spec.ts, health.spec.ts, pipeline.spec.ts
  src/
    app/
      layout.tsx, page.tsx, not-found.tsx, error.tsx
      dashboard/, products/, customers/, staff/, sites/, returns/
    components/
      layout/     sidebar.tsx, header.tsx, health-indicator.tsx
      dashboard/  kpi-card.tsx, kpi-grid.tsx, daily-trend-chart.tsx, monthly-trend-chart.tsx
      filters/    filter-bar.tsx
      shared/     ranking-table.tsx, ranking-chart.tsx, summary-stats.tsx, progress-bar.tsx
      products/, customers/, staff/, sites/, returns/  (per-page overview components)
      providers.tsx, error-boundary.tsx, empty-state.tsx, loading-card.tsx
    hooks/        9 SWR hooks (use-summary.ts, use-daily-trend.ts, ...)
    contexts/     filter-context.tsx
    types/        api.ts, filters.ts
    lib/          api-client.ts, swr-config.ts, formatters.ts, date-utils.ts, constants.ts, utils.ts
```

---

## 1.6 Polish & Testing

> **Status**: DONE

### Objective

Harden the platform for production readiness: security audit, error handling, test coverage, CORS configuration, and quality fixes across the full stack.

### Deliverables

- [x] Global exception handler -- catches unhandled errors, logs traceback, returns generic 500
- [x] Health endpoint returns 503 (not 200) when database is unreachable
- [x] CORS restricted to specific headers: `Content-Type`, `Authorization`, `X-API-Key`, `X-Pipeline-Token`
- [x] Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
- [x] Rate limiting: 60/min analytics, 5/min pipeline mutations
- [x] `JsonDecimal` type alias -- Decimal precision internally, float serialization in JSON
- [x] React ErrorBoundary wraps layout to catch component crashes
- [x] RLS enforcement: `FORCE ROW LEVEL SECURITY` on all enabled tables
- [x] Tenant-scoped RLS: `SET LOCAL app.tenant_id` from JWT claims
- [x] Backend test coverage: 95%+ on `src/datapulse/`
- [x] E2E test hardening: 18 specs across 6 files
- [x] Chart dark/light theme compatibility in Recharts SVG

### Technical Details

**Security Hardening**

| Area | Before | After |
|------|--------|-------|
| Exception handling | Unhandled errors leaked stack traces | Generic 500 with logged traceback |
| Health endpoint | Returned 200 always | Returns 503 when DB unreachable |
| CORS | Wildcard headers | Specific header whitelist |
| RLS | Tables had RLS but owner could bypass | `FORCE ROW LEVEL SECURITY` on all tables |
| Financial precision | Float serialization | `JsonDecimal` -- Decimal in Python, float in JSON |

**Error Handling Stack**

```
Frontend:
  ErrorBoundary (React)
    -> error.tsx (Next.js page-level)
      -> not-found.tsx (404)
      -> SWR error states in hooks

Backend:
  Global exception handler middleware
    -> Route-level try/catch
      -> Repository error propagation
        -> 503 health when DB down
```

**Test Coverage**

| Module | Coverage |
|--------|----------|
| `config.py` | 95%+ |
| `import_pipeline/` | 95%+ |
| `bronze/` | 95%+ |
| `analytics/` | 95%+ |
| `pipeline/` | 95%+ |
| `api/` | 95%+ |

**Key Files Modified (21 files across the audit)**

- `src/datapulse/api/app.py` -- global exception handler, security headers, rate limiting
- `src/datapulse/api/routes/health.py` -- 503 on DB failure
- `src/datapulse/analytics/models.py` -- JsonDecimal type alias
- `frontend/src/components/error-boundary.tsx` -- React ErrorBoundary
- `frontend/src/components/dashboard/*.tsx` -- chart theme fixes
- `migrations/002_add_rls_and_roles.sql` -- FORCE ROW LEVEL SECURITY

### Key Decisions

1. **Generic 500 responses** -- never expose internal error details to clients
2. **503 over 200 for health** -- load balancers and monitoring tools expect proper status codes
3. **FORCE ROW LEVEL SECURITY** -- prevents table owner from bypassing RLS policies
4. **JsonDecimal** -- maintains financial precision through the full stack without custom serializers
5. **95% coverage target** -- high bar ensures regressions are caught early
6. **ErrorBoundary at layout level** -- catches any component crash without losing the entire app shell
