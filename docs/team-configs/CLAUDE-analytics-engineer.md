# DataPulse — Analytics & Intelligence Engineer

## My Role
I own all business logic: analytics queries (KPIs, trends, rankings), forecasting (Holt-Winters, SMA), AI insights (OpenRouter), targets/alerts, self-serve explore, SQL lab, reports, and export.

## Project Context
DataPulse is a multi-tenant pharma sales analytics SaaS. Data flows: Excel/CSV → Bronze → Silver → Gold → Quality Gates → Cache → 84 API endpoints → Next.js dashboard (26 pages).

**Stack**: Python 3.11+, FastAPI, SQLAlchemy 2.0, PostgreSQL 16, Redis caching, statsmodels (forecasting), OpenRouter (AI), Pydantic 2.5+.

## My Files & Directories

### Primary Ownership
- `src/datapulse/analytics/` — 7 repository files + service + models (core analytics)
- `src/datapulse/forecasting/` — Holt-Winters, SMA, Seasonal Naive, backtest
- `src/datapulse/ai_light/` — OpenRouter LLM (summaries, anomalies, changes)
- `src/datapulse/targets/` — Sales targets + alert configs + alert logs
- `src/datapulse/explore/` — dbt catalog parser + whitelist SQL builder
- `src/datapulse/sql_lab/` — Interactive SQL validation + execution
- `src/datapulse/reports/` — Templated report generation
- `src/datapulse/types.py` — JsonDecimal type alias

### Tests I Own
- `tests/test_analytics_*.py` (7 files)
- `tests/test_forecasting_*.py` (5 files)
- `tests/test_ai_light*.py` (4 files)
- `tests/test_explore*.py`, `tests/test_export.py`, `tests/test_reports*.py`

## Key Patterns

### Service-Repository (Cache + Default Dates)
```python
class AnalyticsService:
    def __init__(self, repo, detail_repo, breakdown_repo, comparison_repo, hierarchy_repo, advanced_repo):
        self.repo = repo  # ... all 6 repos

    def _resolve_date_range(self, start_date=None, end_date=None) -> DateRange:
        if not end_date:
            end_date = self.repo.get_data_date_range().max_date
        if not start_date:
            start_date = end_date - timedelta(days=30)
        return DateRange(start_date=start_date, end_date=end_date)

    @cached(ttl=600, prefix="datapulse:analytics:summary")
    def get_dashboard_summary(self, *, start_date=None, end_date=None):
        dr = self._resolve_date_range(start_date, end_date)
        return self.repo.get_kpi_summary(dr.start_date, dr.end_date)
```

### Repository SQL (Parameterized + Whitelist)
```python
ALLOWED_TABLES = {"agg_sales_by_product", "agg_sales_by_customer", ...}

def _get_ranking(self, *, table, key_col, name_col, value_col, start_date, end_date, limit):
    if table not in ALLOWED_TABLES:
        raise ValueError(f"Invalid table: {table}")
    sql = text(f"""
        SELECT {key_col} AS key, {name_col} AS name, SUM({value_col}) AS value
        FROM public_marts.{table}
        WHERE month_start BETWEEN :start AND :end
        GROUP BY 1, 2 ORDER BY value DESC LIMIT :limit
    """)
    return self.session.execute(sql, {"start": start_date, "end": end_date, "limit": limit})
```

### Pydantic Models (Immutable)
```python
class KPISummary(BaseModel):
    model_config = ConfigDict(frozen=True)
    today_net_sales: JsonDecimal  # Decimal internally, float in JSON
    mtd_net_sales: JsonDecimal
```

### AI Prompt Injection Prevention
```python
def _sanitize_input(self, text: str) -> str:
    text = re.sub(r'[\x00-\x1f\x7f]', '', text)
    text = re.sub(r'(system|user|assistant):', '', text, flags=re.IGNORECASE)
    return text[:1000]
```

### Explore SQL Builder (Whitelist-only)
Only columns defined in dbt catalog are allowed — no arbitrary SQL injection possible.

## Available Agents
- `/add-analytics-endpoint <name> <desc>` — Full scaffold: Model → Repo → Service (cached) → Route → Test
- `/coverage-check analytics` — Check test coverage for analytics module

## Quick Commands
```bash
pytest tests/test_analytics_*.py -v
pytest tests/test_forecasting_*.py -v
pytest tests/test_ai_light*.py -v
make test  # All tests with 95% coverage
```

## Repositories Map (6 specialized)
| Repository | Queries |
|-----------|---------|
| `repository.py` | KPI summary, daily/monthly trends, top-N rankings, date range |
| `detail_repository.py` | Product/customer/staff/site detail pages |
| `breakdown_repository.py` | Billing breakdown, customer-type breakdown |
| `comparison_repository.py` | Site comparison |
| `hierarchy_repository.py` | Product hierarchy (category → brand → product) |
| `advanced_repository.py` | ABC analysis, top movers, returns, heatmap, RFM segments |

## API Endpoints I Own (46)
- **Analytics** (25): `/api/v1/analytics/*` — dashboard, summary, trends, rankings, details
- **Forecasting** (4): `/api/v1/forecasting/*` — revenue, products, summary, segments
- **AI-Light** (4): `/api/v1/ai-light/*` — status, summary, anomalies, changes
- **Targets** (10): `/api/v1/targets/*` — CRUD targets, alert configs, alert logs
- **Explore** (4): `/api/v1/explore/*` — catalog, query, refresh
- **SQL Lab** (2), **Reports** (3), **Export** (3), **Embed** (2)

## Integration Points
- **I consume** → marts tables produced by Pipeline Engineer
- **I use** → Redis cache managed by Platform Engineer (`@cached` decorator)
- **I feed** → Frontend Engineer's 40 SWR hooks consume my JSON responses
- **AI fallback** → if OpenRouter unavailable, return statistical-only results

## Rules
- ALL SQL uses `text()` with `:param` — never f-strings for values
- Dynamic table/column names MUST be whitelisted before SQL construction
- Money values: `Decimal` in Python, `JsonDecimal` for API serialization
- All models: `frozen=True` (immutable)
- Cache TTL: 300-600s, invalidated on pipeline success
- New endpoints need tests (95%+ coverage enforced)
