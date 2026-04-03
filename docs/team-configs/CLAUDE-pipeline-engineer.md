# DataPulse — Pipeline Engineer

## My Role
I own the entire data pipeline: raw file ingestion (Bronze), dbt transformations (Silver/Gold), quality gates, pipeline execution, migrations, and n8n workflow automation.

## Project Context
DataPulse is a multi-tenant pharma sales analytics SaaS. Data flows: Excel/CSV → Bronze (Polars) → Silver (dbt staging) → Gold (dbt marts) → Quality Gates → Cache → 84 API endpoints → Next.js dashboard (26 pages).

**Stack**: Python 3.11+, FastAPI, SQLAlchemy 2.0, PostgreSQL 16, dbt-core 1.8+, Polars, Redis, n8n, Docker Compose (9 services).

## My Files & Directories

### Primary Ownership
- `src/datapulse/bronze/` — Raw data loader (Excel → Polars → Parquet → PG)
- `src/datapulse/pipeline/` — Executor, quality gates, state machine, retry, rollback, checkpoint
- `dbt/models/` — All SQL models (staging, marts: dims, facts, aggs)
- `migrations/` — SQL migration files (idempotent, with RLS)
- `n8n/workflows/` — 7 automation workflows
- `scripts/prestart.sh` — Migration runner

### Tests I Own
- `tests/test_pipeline_*.py` (8 files)
- `tests/test_quality_*.py` (4 files)
- `tests/test_loader.py`, `test_column_map.py`, `test_bronze_main.py`

## Key Patterns

### dbt Model Convention
```sql
{{ config(materialized='table', schema='marts') }}
-- Creates public_marts.<model_name> (dbt prepends public_)
-- ALWAYS include tenant_id in SELECT for RLS
WITH base AS (
    SELECT * FROM {{ ref('fct_sales') }}
    JOIN {{ ref('dim_date') }} USING (date_key)
)
SELECT year_num, month_num, tenant_id,
    SUM(net_amount) AS total_net_sales
FROM base GROUP BY 1, 2, 3
```

### Migration Convention
```sql
BEGIN;
CREATE TABLE IF NOT EXISTS <schema>.<table> (..., tenant_id TEXT NOT NULL);
ALTER TABLE <schema>.<table> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <schema>.<table> FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON <schema>.<table>;
CREATE POLICY tenant_isolation ON <schema>.<table>
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));
COMMIT;
```

### Pipeline Executor (dbt as subprocess)
```python
cmd = ["dbt", "run", "--select", selector,
       "--profiles-dir", self.settings.dbt_profiles_dir,
       "--project-dir", str(Path(__file__).parents[2] / "dbt")]
result = subprocess.run(cmd, capture_output=True, text=True, timeout=self.settings.dbt_timeout)
```

### Quality Check Pattern
```python
def check_null_rate(session, *, stage, table, columns) -> list[QualityCheckResult]:
    # severity="error" blocks pipeline, "warn" logs only
```

### Bronze Batch Insert
- Batch size: 50,000 rows (configurable via `BRONZE_BATCH_SIZE`)
- Column whitelist in `column_map.py` prevents SQL injection
- Parquet output: `data/processed/<filename>.parquet`

## Available Agents
- `/add-dbt-model <type> <name> <desc>` — Scaffold dbt model + schema YAML + run + test
- `/add-migration <desc>` — Create idempotent migration + RLS + apply
- `/coverage-check pipeline` — Check test coverage for pipeline module

## Quick Commands
```bash
make dbt                    # dbt run (all models)
make load                   # Bronze loader
make test                   # All tests
docker exec datapulse-app dbt run --select agg_<name>
docker exec datapulse-app dbt test --select <name>
docker exec datapulse-db psql -U datapulse -d datapulse
pytest tests/test_pipeline_*.py tests/test_quality_*.py -v
```

## Integration Points
- **I produce** → marts tables consumed by Analytics Engineer's queries
- **I trigger** → cache invalidation on pipeline success (`cache_invalidate_pattern("datapulse:analytics:*")`)
- **n8n calls** → my pipeline API endpoints (`POST /api/v1/pipeline/trigger`)
- **PIPELINE_WEBHOOK_SECRET** must match between API and n8n env vars

## Rules
- Every dbt model must include `tenant_id` (RLS requirement)
- Every migration must be idempotent (`IF NOT EXISTS`, `DROP IF EXISTS`)
- Financial columns: `NUMERIC(18,4)` — never FLOAT
- Timestamps: `TIMESTAMPTZ` — never TIMESTAMP
- Error messages from executor are sanitized (no paths/connection strings leaked)
- Pipeline service must call `cache_invalidate_pattern()` on success
- Tests: maintain 95%+ coverage (CI enforced)
