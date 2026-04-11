# Enhancement 4: Analytics Intelligence — Implementation Plan

## Executive Summary

This plan delivers five Tier-1 analytics intelligence features across four independently-deployable phases. Each phase adds new capabilities without breaking existing functionality. The architecture follows the established DataPulse repository/service/route layering, immutable Pydantic models, parameterized SQL, and RLS-aware tenant isolation.

---

## Phase 1: Why Engine + Statistical Confidence (Features 1 & 2)

**Goal:** Diagnostic analytics — explain *why* KPIs changed, and quantify *whether* changes are statistically significant.

**Rationale for grouping:** Both features enhance existing trend/KPI endpoints with deeper analytical context. Feature 2 (confidence) is a helper utility consumed by Feature 1 (why engine) and all existing trend endpoints.

### Phase 1A: Statistical Confidence on Growth Metrics (Feature 2)

**Files to create:**
- None (extends existing modules)

**Files to modify:**

#### 1. `src/datapulse/analytics/queries.py`
Add two new pure functions at module level:

```python
def compute_z_score(current: Decimal, historical_values: list[Decimal]) -> Decimal | None:
```
- Takes a current value and a list of historical values (e.g., last 12 same-metric readings)
- Computes mean + stdev using `statistics.mean()` and `statistics.stdev()` from stdlib
- Returns z-score = (current - mean) / stdev, or None if stdev is zero or fewer than 3 data points

```python
def significance_level(z_score: Decimal | None) -> str:
```
- Returns `"significant"` if abs(z) >= 1.96 (95% CI)
- Returns `"inconclusive"` if 1.28 <= abs(z) < 1.96
- Returns `"noise"` otherwise or if z_score is None

```python
def coefficient_of_variation(values: list[Decimal]) -> Decimal | None:
```
- Returns stdev/mean * 100 as a percentage, or None if mean is zero

#### 2. `src/datapulse/analytics/models.py`
Add new model after `TrendResult`:

```python
class StatisticalAnnotation(BaseModel):
    model_config = ConfigDict(frozen=True)
    z_score: JsonDecimal | None = None
    significance: str = "noise"        # "significant", "inconclusive", "noise"
    cv_pct: JsonDecimal | None = None  # coefficient of variation
    confidence_level: str = "80%"
```

Extend `TrendResult` with one new optional field:
```python
    stats: StatisticalAnnotation | None = None
```

Extend `KPISummary` with two new optional fields:
```python
    mom_significance: str | None = None   # "significant", "inconclusive", "noise"
    yoy_significance: str | None = None
```

#### 3. `src/datapulse/analytics/repository.py`
In `get_kpi_summary()`, after computing `mom_growth` and `yoy_growth`:
- Query last 12 months of MTD values for MoM z-score calculation
- Query last 5 years of YTD values for YoY z-score calculation
- Use `compute_z_score()` and `significance_level()` from queries.py
- Populate the new `mom_significance` and `yoy_significance` fields

Add a new helper method:
```python
def get_historical_mtd_values(self, target_date: date, periods: int = 12) -> list[Decimal]:
```
- Returns the last N months' MTD values from metrics_summary for z-score calculation

In `get_daily_trend()` and `get_monthly_trend()`:
- After calling `build_trend()`, compute `StatisticalAnnotation` on the growth_pct using the historical distribution of growth values
- Attach to `TrendResult.stats`

#### 4. `frontend/src/types/api.ts`
Add:
```typescript
export interface StatisticalAnnotation {
  z_score: number | null;
  significance: "significant" | "inconclusive" | "noise";
  cv_pct: number | null;
  confidence_level: string;
}
```
Extend `TrendResult` with `stats?: StatisticalAnnotation`
Extend `KPISummary` with `mom_significance?: string` and `yoy_significance?: string`

#### 5. `frontend/src/components/dashboard/kpi-card.tsx`
Add a traffic light indicator dot next to growth percentages:
- Green dot for `"significant"`
- Yellow dot for `"inconclusive"`
- Red dot for `"noise"`
- Tooltip explaining the significance level

#### Tests:
- `tests/test_statistical_confidence.py`: Unit tests for `compute_z_score`, `significance_level`, `coefficient_of_variation`
- Extend `tests/test_analytics_repository.py`: Test that KPISummary now includes significance fields
- Extend `tests/test_analytics_models.py`: Test StatisticalAnnotation serialization

---

### Phase 1B: Why Engine — Waterfall Revenue Decomposition (Feature 1)

**Files to create:**

#### 1. `src/datapulse/analytics/diagnostics_repository.py` (NEW)
```python
class DiagnosticsRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_revenue_decomposition(
        self,
        current_filters: AnalyticsFilter,
        previous_filters: AnalyticsFilter,
        dimensions: list[str] | None = None,
    ) -> WaterfallAnalysis:
```

SQL logic per dimension (product, customer, staff, site, billing_way):
```sql
WITH current_period AS (
    SELECT {dim_key}, {dim_name}, SUM(total_net_amount) AS value
    FROM {table}
    WHERE {current_where}
    GROUP BY {dim_key}, {dim_name}
),
previous_period AS (
    SELECT {dim_key}, {dim_name}, SUM(total_net_amount) AS value
    FROM {table}
    WHERE {previous_where}
    GROUP BY {dim_key}, {dim_name}
)
SELECT
    COALESCE(c.{dim_name}, p.{dim_name}) AS entity_name,
    COALESCE(c.value, 0) - COALESCE(p.value, 0) AS impact,
    '{dimension}' AS dimension
FROM current_period c
FULL OUTER JOIN previous_period p ON c.{dim_key} = p.{dim_key}
ORDER BY ABS(COALESCE(c.value, 0) - COALESCE(p.value, 0)) DESC
LIMIT 20
```

- Run this query for each dimension, collect all drivers
- Sort by absolute impact descending
- Return top N drivers with their percentage contribution to total change

Dimension map (reuse from comparison_repository pattern):
```python
_DIMENSION_MAP = {
    "product": ("public_marts.agg_sales_by_product", "product_key", "drug_name"),
    "customer": ("public_marts.agg_sales_by_customer", "customer_key", "customer_name"),
    "staff": ("public_marts.agg_sales_by_staff", "staff_key", "staff_name"),
    "site": ("public_marts.agg_sales_by_site", "site_key", "site_name"),
}
```

#### 2. `src/datapulse/analytics/models.py` — Add new models

```python
class RevenueDriver(BaseModel):
    model_config = ConfigDict(frozen=True)
    dimension: str          # "product", "customer", "staff", "site"
    entity_name: str
    entity_key: int | None = None
    impact: JsonDecimal     # absolute change in EGP
    pct_of_change: JsonDecimal  # % contribution to total change
    direction: str          # "positive" or "negative"
    significance: str | None = None  # from StatisticalAnnotation

class WaterfallAnalysis(BaseModel):
    model_config = ConfigDict(frozen=True)
    current_total: JsonDecimal
    previous_total: JsonDecimal
    total_change: JsonDecimal
    total_change_pct: JsonDecimal | None = None
    drivers: list[RevenueDriver]
    period_label: str       # "2026-03 vs 2026-02"
```

#### 3. `src/datapulse/analytics/service.py` — Add method

```python
def get_why_changed(
    self,
    filters: AnalyticsFilter | None = None,
    dimensions: list[str] | None = None,
) -> WaterfallAnalysis:
```
- Compute current and previous period filters (same pattern as `get_top_movers`)
- Delegate to `DiagnosticsRepository.get_revenue_decomposition()`
- Apply statistical significance from Phase 1A to each driver

Update `__init__` to accept optional `diagnostics_repo: DiagnosticsRepository | None = None`

#### 4. `src/datapulse/api/deps.py` — Update `get_analytics_service`

Import `DiagnosticsRepository` and pass it to `AnalyticsService`:
```python
diagnostics_repo = DiagnosticsRepository(session)
return AnalyticsService(
    repo, detail_repo, breakdown_repo, comparison_repo,
    hierarchy_repo, advanced_repo, diagnostics_repo
)
```

#### 5. `src/datapulse/api/routes/analytics.py` — Add endpoint

```python
@router.get("/why-changed", response_model=WaterfallAnalysis)
@limiter.limit("30/minute")
def get_why_changed(
    request: Request,
    response: Response,
    service: ServiceDep,
    params: Annotated[AnalyticsQueryParams, Depends()],
    dimensions: Annotated[str | None, Query(pattern="^(product|customer|staff|site)(,(product|customer|staff|site))*$")] = None,
) -> WaterfallAnalysis:
    _set_cache(response, 300)
    dim_list = dimensions.split(",") if dimensions else None
    return service.get_why_changed(_to_filter(params), dim_list)
```

#### 6. `frontend/src/hooks/use-why-changed.ts` (NEW)
```typescript
export function useWhyChanged(dimensions?: string) {
  const { filters: filterParams } = useFilters();
  const params = { ...filterParams, ...(dimensions ? { dimensions } : {}) };
  // SWR hook calling /api/v1/analytics/why-changed
}
```

#### 7. `frontend/src/types/api.ts` — Add types
```typescript
export interface RevenueDriver { ... }
export interface WaterfallAnalysis { ... }
```

#### 8. `frontend/src/components/dashboard/waterfall-chart.tsx` (NEW)
- Recharts BarChart with stacked positive/negative bars
- Green bars for positive drivers, red for negative
- Total change bar at the end
- `useChartTheme()` for dark/light mode
- Drill-down: click a bar to filter dashboard by that dimension

#### Tests:
- `tests/test_diagnostics_repository.py` (NEW): Mock session, test SQL execution, test driver ranking
- `tests/test_why_changed_service.py` (NEW): Test period computation, dimension filtering
- `tests/test_why_changed_endpoint.py` (NEW): TestClient, test query params, test response shape

---

## Phase 2: Customer Health Score (Feature 3)

**Goal:** Go beyond static RFM with a composite 0-100 health score tracking directional trends and generating movement alerts.

### dbt Model

#### `dbt/models/marts/features/feat_customer_health.sql` (NEW)

SQL strategy:
1. Use `feat_customer_segments` as the base
2. Compute rolling 3-month trends for R/F/M using `agg_sales_by_customer` with LAG windows
3. Add return rate and product diversity metrics
4. Normalize each component to 0-100 using NTILE or min-max scaling
5. Compute weighted composite score: `recency_trend * 0.30 + frequency_trend * 0.25 + monetary_trend * 0.25 + return_health * 0.10 + diversity * 0.10`

```sql
{{
    config(
        materialized='table',
        schema='marts',
        post_hook=[
            "ALTER TABLE {{ this }} ENABLE ROW LEVEL SECURITY",
            "ALTER TABLE {{ this }} FORCE ROW LEVEL SECURITY",
            -- RLS policies (same pattern as feat_customer_segments)
        ]
    )
}}

WITH monthly_customer AS (
    SELECT tenant_id, customer_key,
           year * 100 + month AS year_month,
           SUM(total_net_amount) AS monthly_revenue,
           SUM(transaction_count) AS monthly_txns
    FROM {{ ref('agg_sales_by_customer') }}
    GROUP BY tenant_id, customer_key, year, month
),
rolling AS (
    SELECT *,
        AVG(monthly_revenue) OVER (
            PARTITION BY tenant_id, customer_key
            ORDER BY year_month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ) AS avg_revenue_3m,
        LAG(AVG(monthly_revenue) OVER (
            PARTITION BY tenant_id, customer_key
            ORDER BY year_month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ), 3) OVER (PARTITION BY tenant_id, customer_key ORDER BY year_month) AS avg_revenue_prev_3m
    FROM monthly_customer
),
-- ... compute trends, normalize, score ...
```

#### `dbt/models/marts/features/_features__models.yml` — Add schema entry for `feat_customer_health`

### Backend

#### `src/datapulse/analytics/health_repository.py` (NEW)

```python
class CustomerHealthRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_health_scores(
        self, filters: AnalyticsFilter, segment: str | None = None, limit: int = 50
    ) -> list[CustomerHealthScore]:
        """Return health scores with optional segment filter."""

    def get_health_distribution(self) -> CustomerHealthSummary:
        """Return distribution of scores across bands (critical/at-risk/healthy/thriving)."""

    def get_health_movements(
        self, lookback_months: int = 1
    ) -> list[HealthMovement]:
        """Return customers who moved between health bands."""
```

SQL for movements: Compare current `feat_customer_health` with a snapshot from N months ago. Since we materialize as a table, we need a separate approach:
- Option A: Store monthly snapshots (new migration table `customer_health_snapshots`)
- Option B: Compute "previous health" by re-deriving from the rolling window with a month offset
- **Recommended: Option B** to avoid new storage overhead. Use the dbt model's `avg_revenue_prev_3m` column to derive the previous score in the same query.

#### `src/datapulse/analytics/models.py` — Add models

```python
class CustomerHealthScore(BaseModel):
    model_config = ConfigDict(frozen=True)
    customer_key: int
    customer_name: str
    health_score: int              # 0-100
    health_band: str              # "critical", "at_risk", "healthy", "thriving"
    recency_score: JsonDecimal
    frequency_score: JsonDecimal
    monetary_score: JsonDecimal
    return_health: JsonDecimal
    diversity_score: JsonDecimal
    trend_direction: str          # "improving", "declining", "stable"
    rfm_segment: str

class CustomerHealthSummary(BaseModel):
    model_config = ConfigDict(frozen=True)
    total_customers: int
    thriving_count: int
    healthy_count: int
    at_risk_count: int
    critical_count: int
    avg_score: JsonDecimal
    score_distribution: list[HealthBand]

class HealthBand(BaseModel):
    model_config = ConfigDict(frozen=True)
    band: str
    count: int
    pct: JsonDecimal
    avg_score: JsonDecimal

class HealthMovement(BaseModel):
    model_config = ConfigDict(frozen=True)
    from_band: str
    to_band: str
    customer_count: int
    direction: str  # "improved", "declined"
    example_customers: list[str]  # top 3 names for context
```

#### `src/datapulse/analytics/service.py` — Add methods

```python
@cached(ttl=300, prefix=_CACHE_PREFIX)
def get_customer_health(self, filters=None, segment=None, limit=50):
    ...

@cached(ttl=300, prefix=_CACHE_PREFIX)
def get_customer_health_summary(self):
    ...

@cached(ttl=600, prefix=_CACHE_PREFIX)
def get_customer_health_movements(self, lookback_months=1):
    ...
```

Update `__init__` to accept `health_repo: CustomerHealthRepository | None = None`

#### `src/datapulse/api/deps.py` — Update factory

Add `CustomerHealthRepository` import and instantiation in `get_analytics_service`.

#### `src/datapulse/api/routes/analytics.py` — Add endpoints

```python
@router.get("/customer-health", response_model=list[CustomerHealthScore])
@router.get("/customer-health/summary", response_model=CustomerHealthSummary)
@router.get("/customer-health/movements", response_model=list[HealthMovement])
```

### Frontend

#### `frontend/src/hooks/use-customer-health.ts` (NEW)
Three hooks: `useCustomerHealth`, `useCustomerHealthSummary`, `useCustomerHealthMovements`

#### `frontend/src/types/api.ts` — Add TypeScript interfaces

#### `frontend/src/components/dashboard/customer-health-card.tsx` (NEW)
- Score distribution donut chart
- Movement alert banner ("47 customers moved from Healthy to At Risk")
- Sortable table of individual customer scores

### Tests
- `tests/test_health_repository.py` (NEW)
- `tests/test_customer_health_service.py` (NEW)
- `tests/test_customer_health_endpoints.py` (NEW)

---

## Phase 3: Forecast Auto-Selection by Accuracy (Feature 4)

**Goal:** Replace naive length-based method selection with accuracy-driven selection. Add ensemble forecasting.

### Backend Changes

#### 1. `src/datapulse/core/config.py` — Add ForecastConfig settings

```python
# Forecasting
forecast_confidence_level: float = 0.80       # 80% CI default
forecast_holdout_ratio: float = 0.15          # 15% of series for validation
forecast_ensemble_top_n: int = 2              # average top N methods
forecast_min_series_length: int = 6           # minimum points to forecast
```

#### 2. `src/datapulse/forecasting/methods.py` — Major refactor

Replace `select_method()` with:

```python
def select_best_method(
    series: list[float],
    horizon: int,
    seasonal_periods: int,
    *,
    monthly: bool = False,
    holdout_ratio: float = 0.15,
) -> tuple[str, ForecastAccuracy]:
    """Run all eligible methods on holdout data, return the one with lowest MAPE."""
```

Logic:
1. Split series: train = series[:-holdout], holdout = series[-holdout:]
2. For each eligible method (holt_winters, seasonal_naive, sma):
   - Check minimum series length requirement
   - Run backtest against holdout
   - Record MAPE
3. Return method name with lowest MAPE + its accuracy metrics

Add ensemble function:
```python
def ensemble_forecast(
    series: list[float],
    horizon: int,
    seasonal_periods: int,
    methods: list[str],
    weights: list[float] | None = None,
    *,
    start_date: date | None = None,
    monthly: bool = False,
    confidence: float = 0.80,
) -> list[ForecastPoint]:
    """Weighted average of multiple methods' forecasts."""
```

Add confidence level parameterization:
- Map confidence level to z-score: `{0.80: 1.2816, 0.90: 1.6449, 0.95: 1.9600}`
- Pass z-score through to all forecast functions instead of hardcoded 1.2816

#### 3. `src/datapulse/forecasting/models.py` — Extend

Add to `ForecastResult`:
```python
    competing_methods: list[MethodComparison] | None = None
    is_ensemble: bool = False
```

New model:
```python
class MethodComparison(BaseModel):
    model_config = ConfigDict(frozen=True)
    method: str
    mape: JsonDecimal
    mae: JsonDecimal
    selected: bool
```

#### 4. `src/datapulse/forecasting/service.py` — Update `run_all_forecasts`

Replace calls to `select_method()` with `select_best_method()`:

```python
# Before:
method_name = select_method(len(daily_values), 7)

# After:
method_name, accuracy = select_best_method(
    daily_values, horizon=30, seasonal_periods=7
)
```

For each forecast, also store competing method MAPE scores in the `ForecastResult`.

Add optional ensemble: if top 2 methods have MAPE within 5% of each other, use ensemble.

#### 5. `src/datapulse/api/routes/forecasting.py` — Add confidence parameter

```python
@router.get("/revenue")
def get_revenue_forecast(
    ...
    confidence: Annotated[float, Query(ge=0.80, le=0.95)] = 0.80,
):
```

### Frontend
- `frontend/src/components/dashboard/forecast-card.tsx` — Add method badge showing which algorithm was selected and its MAPE
- `frontend/src/types/api.ts` — Add `MethodComparison` interface

### Tests
- Extend `tests/test_forecasting_methods.py`: Test `select_best_method` with various series lengths
- `tests/test_forecast_ensemble.py` (NEW): Test weighted averaging, edge cases
- Extend `tests/test_forecasting_service.py`: Verify competing_methods populated

---

## Phase 4: Real-Time Anomaly Detection Pipeline (Feature 5)

**Goal:** Automated anomaly detection that runs after pipeline refresh, stores results, and surfaces alerts on the dashboard.

### Migration

#### `migrations/013_create_anomaly_alerts.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS public.anomaly_alerts (
    id               SERIAL PRIMARY KEY,
    tenant_id        INT NOT NULL DEFAULT 1 REFERENCES bronze.tenants(tenant_id),
    detected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    metric           TEXT NOT NULL,         -- 'daily_revenue', 'transaction_count', etc.
    dimension        TEXT,                  -- 'product', 'customer', 'site', NULL=overall
    dimension_key    INT,                   -- FK to relevant dimension
    dimension_name   TEXT,
    actual_value     NUMERIC(18,4) NOT NULL,
    expected_value   NUMERIC(18,4),
    lower_bound      NUMERIC(18,4),
    upper_bound      NUMERIC(18,4),
    deviation_pct    NUMERIC(8,2),
    detection_method TEXT NOT NULL,         -- 'iqr', 'z_score', 'isolation_forest'
    severity         TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    is_suppressed    BOOLEAN NOT NULL DEFAULT false,
    suppression_reason TEXT,               -- 'holiday:eid_al_fitr', 'known_event:...'
    acknowledged     BOOLEAN NOT NULL DEFAULT false,
    acknowledged_at  TIMESTAMPTZ,
    acknowledged_by  TEXT,
    pipeline_run_id  UUID,
    UNIQUE (tenant_id, metric, dimension, dimension_key, detected_at::DATE)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_anomaly_tenant_active
    ON public.anomaly_alerts(tenant_id, acknowledged, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_severity
    ON public.anomaly_alerts(tenant_id, severity, detected_at DESC);

-- RLS (same pattern as migration 011)
ALTER TABLE public.anomaly_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_alerts FORCE ROW LEVEL SECURITY;
-- ... owner_all and reader_select policies ...
```

### New Module: `src/datapulse/anomalies/`

#### `src/datapulse/anomalies/__init__.py` (NEW)
Empty init.

#### `src/datapulse/anomalies/models.py` (NEW)

```python
class AnomalyAlert(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: int | None = None
    metric: str
    dimension: str | None = None
    dimension_key: int | None = None
    dimension_name: str | None = None
    actual_value: JsonDecimal
    expected_value: JsonDecimal | None = None
    lower_bound: JsonDecimal | None = None
    upper_bound: JsonDecimal | None = None
    deviation_pct: JsonDecimal | None = None
    detection_method: str
    severity: str
    is_suppressed: bool = False
    suppression_reason: str | None = None
    detected_at: datetime

class AnomalyReport(BaseModel):
    model_config = ConfigDict(frozen=True)
    alerts: list[AnomalyAlert]
    total_detected: int
    total_suppressed: int
    run_timestamp: datetime

class ActiveAnomalySummary(BaseModel):
    model_config = ConfigDict(frozen=True)
    total_active: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    latest_alerts: list[AnomalyAlert]
```

#### `src/datapulse/anomalies/detectors.py` (NEW)

Three detection strategies as pure functions:

```python
def detect_iqr_anomalies(
    values: list[float],
    labels: list[str],
    multiplier: float = 1.5,
) -> list[tuple[str, float, float, float, float]]:
    """IQR-based detection. Returns (label, value, expected, lower, upper)."""

def detect_zscore_anomalies(
    values: list[float],
    labels: list[str],
    threshold: float = 2.5,
) -> list[tuple[str, float, float, float, float]]:
    """Z-score based detection."""

def detect_isolation_forest_anomalies(
    values: list[float],
    labels: list[str],
    contamination: float = 0.05,
) -> list[tuple[str, float, float, float, float]]:
    """Isolation Forest detection (sklearn). Optional — gracefully skip if not installed."""
```

Note on scikit-learn: Use try/except import. If sklearn is not available, skip isolation forest and rely on IQR + Z-score only. This keeps the dependency optional.

#### `src/datapulse/anomalies/calendar.py` (NEW)

Egyptian holiday calendar for contextual suppression:

```python
EGYPTIAN_HOLIDAYS: dict[str, list[tuple[int, int]]] = {
    "new_year": [(1, 1)],
    "revolution_day": [(1, 25)],
    "sinai_liberation": [(4, 25)],
    "labour_day": [(5, 1)],
    "june_30_revolution": [(6, 30)],
    "july_23_revolution": [(7, 23)],
    "armed_forces_day": [(10, 6)],
}

# Islamic holidays shift yearly — use approximate windows
ISLAMIC_HOLIDAY_WINDOWS: dict[str, int] = {
    "eid_al_fitr": 4,      # 4-day window
    "eid_al_adha": 5,      # 5-day window
    "ramadan": 30,          # entire month
    "islamic_new_year": 1,
    "mawlid": 1,
}

def is_holiday_window(check_date: date) -> tuple[bool, str | None]:
    """Check if a date falls within a known Egyptian holiday window."""

def get_holiday_dates(year: int) -> list[tuple[date, str]]:
    """Return all fixed + estimated Islamic holidays for a year."""
```

For Islamic holidays: use the `hijri-converter` library (lightweight, pure Python) or hardcode approximate Gregorian dates for 2024-2027.

#### `src/datapulse/anomalies/service.py` (NEW)

```python
class AnomalyDetectionService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def run_detection(self, pipeline_run_id: UUID | None = None) -> AnomalyReport:
        """Run all anomaly checks and store results."""
        # 1. Fetch recent daily revenue series (last 90 days)
        # 2. Fetch per-site, per-product daily values
        # 3. Run IQR + Z-score (+ isolation forest if available) on each
        # 4. Check holiday calendar for suppression
        # 5. Insert new anomaly_alerts rows
        # 6. Return report

    def get_active_alerts(self, limit: int = 20) -> ActiveAnomalySummary:
        """Return unacknowledged anomalies."""

    def get_alert_history(
        self, days: int = 30, severity: str | None = None
    ) -> list[AnomalyAlert]:
        """Return historical anomalies."""

    def acknowledge_alert(self, alert_id: int, user: str) -> None:
        """Mark an alert as acknowledged."""
```

#### `src/datapulse/anomalies/repository.py` (NEW)

```python
class AnomalyRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_daily_metric_series(self, metric: str, days: int = 90) -> list[tuple[date, float]]:
        """Fetch daily values for a metric from metrics_summary or agg tables."""

    def save_alerts(self, alerts: list[AnomalyAlert], pipeline_run_id: UUID | None) -> int:
        """Insert anomaly alerts. Returns count of rows inserted."""

    def get_active_alerts(self, limit: int = 20) -> list[AnomalyAlert]:
        """SELECT ... WHERE acknowledged = false ORDER BY severity, detected_at DESC"""

    def get_alert_history(self, days: int = 30, severity: str | None = None) -> list[AnomalyAlert]:
        """Historical alerts with optional severity filter."""

    def acknowledge(self, alert_id: int, user: str) -> bool:
        """UPDATE anomaly_alerts SET acknowledged = true, ..."""
```

### Pipeline Integration

#### `src/datapulse/pipeline/executor.py` — Add anomaly stage

```python
def run_anomaly_detection(
    self,
    run_id: UUID,
    tenant_id: str = "1",
) -> ExecutionResult:
    """Run anomaly detection after pipeline completes."""
    # Same pattern as run_forecasting():
    # 1. Create session with tenant isolation
    # 2. Instantiate AnomalyDetectionService
    # 3. Call service.run_detection(run_id)
    # 4. Return ExecutionResult
```

Hook this into the pipeline orchestration so it runs after the dbt gold layer and forecasting stages complete.

### API Endpoints

#### `src/datapulse/api/routes/anomalies.py` (NEW)

```python
router = APIRouter(
    prefix="/anomalies",
    tags=["anomalies"],
    dependencies=[Depends(get_current_user)],
)

@router.get("/active", response_model=ActiveAnomalySummary)
@router.get("/history", response_model=list[AnomalyAlert])
@router.post("/{alert_id}/acknowledge")
```

#### `src/datapulse/api/deps.py` — Add factory
```python
def get_anomaly_service(session: SessionDep) -> AnomalyDetectionService:
    return AnomalyDetectionService(session)
```

#### `src/datapulse/api/app.py` — Register router
```python
from datapulse.api.routes import anomalies
app.include_router(anomalies.router, prefix="/api/v1")
```

### Frontend

#### `frontend/src/hooks/use-anomalies.ts` — Already exists (rename/extend `use-ai-anomalies.ts`)
Add: `useActiveAnomalies`, `useAnomalyHistory`, `useAcknowledgeAnomaly`

#### `frontend/src/types/api.ts` — Add types

#### `frontend/src/components/dashboard/anomaly-banner.tsx` (NEW)
- Red/orange/yellow alert banner at top of dashboard
- Shows count of active anomalies by severity
- Expandable to show list of latest alerts
- "Acknowledge" button per alert

#### `frontend/src/components/dashboard/anomaly-timeline.tsx` (NEW)
- Timeline chart showing anomaly occurrences over time
- Color-coded by severity
- Click to see details

### Tests
- `tests/test_anomaly_detectors.py` (NEW): Test IQR, Z-score, isolation forest functions
- `tests/test_anomaly_calendar.py` (NEW): Test Egyptian holiday detection
- `tests/test_anomaly_service.py` (NEW): Test full detection pipeline
- `tests/test_anomaly_repository.py` (NEW): Mock session, test SQL
- `tests/test_anomaly_endpoints.py` (NEW): TestClient integration
- `tests/test_pipeline_executor_anomaly.py` (NEW): Test anomaly stage in executor

---

## Dependency Graph & Sequencing

```
Phase 1A (Statistical Confidence)
    |
    v
Phase 1B (Why Engine) -- depends on 1A for significance annotations
    |
    v
Phase 2 (Customer Health Score) -- independent, but benefits from 1A stats
    |
    v
Phase 3 (Forecast Auto-Selection) -- independent
    |
    v
Phase 4 (Anomaly Detection) -- depends on Phase 3 (uses forecast residuals)
```

Each phase is independently deployable:
- Phase 1A: No migration needed, backend+frontend change only
- Phase 1B: No migration needed, new repository + route
- Phase 2: Requires `dbt run` for new model, no migration
- Phase 3: No migration, modifies existing forecasting module
- Phase 4: Requires migration 013, new module + routes

---

## Summary: All New Files

### Backend
| File | Type | Phase |
|------|------|-------|
| `src/datapulse/analytics/diagnostics_repository.py` | NEW | 1B |
| `src/datapulse/analytics/health_repository.py` | NEW | 2 |
| `src/datapulse/anomalies/__init__.py` | NEW | 4 |
| `src/datapulse/anomalies/models.py` | NEW | 4 |
| `src/datapulse/anomalies/detectors.py` | NEW | 4 |
| `src/datapulse/anomalies/calendar.py` | NEW | 4 |
| `src/datapulse/anomalies/service.py` | NEW | 4 |
| `src/datapulse/anomalies/repository.py` | NEW | 4 |
| `src/datapulse/api/routes/anomalies.py` | NEW | 4 |

### Backend (Modified)
| File | Phase |
|------|-------|
| `src/datapulse/analytics/queries.py` | 1A |
| `src/datapulse/analytics/models.py` | 1A, 1B, 2 |
| `src/datapulse/analytics/repository.py` | 1A |
| `src/datapulse/analytics/service.py` | 1B, 2 |
| `src/datapulse/api/deps.py` | 1B, 2, 4 |
| `src/datapulse/api/routes/analytics.py` | 1B, 2 |
| `src/datapulse/api/app.py` | 4 |
| `src/datapulse/core/config.py` | 3 |
| `src/datapulse/forecasting/methods.py` | 3 |
| `src/datapulse/forecasting/models.py` | 3 |
| `src/datapulse/forecasting/service.py` | 3 |
| `src/datapulse/api/routes/forecasting.py` | 3 |
| `src/datapulse/pipeline/executor.py` | 4 |

### dbt
| File | Type | Phase |
|------|------|-------|
| `dbt/models/marts/features/feat_customer_health.sql` | NEW | 2 |
| `dbt/models/marts/features/_features__models.yml` | MODIFY | 2 |

### Migrations
| File | Type | Phase |
|------|------|-------|
| `migrations/013_create_anomaly_alerts.sql` | NEW | 4 |

### Frontend
| File | Type | Phase |
|------|------|-------|
| `frontend/src/hooks/use-why-changed.ts` | NEW | 1B |
| `frontend/src/hooks/use-customer-health.ts` | NEW | 2 |
| `frontend/src/components/dashboard/waterfall-chart.tsx` | NEW | 1B |
| `frontend/src/components/dashboard/customer-health-card.tsx` | NEW | 2 |
| `frontend/src/components/dashboard/anomaly-banner.tsx` | NEW | 4 |
| `frontend/src/components/dashboard/anomaly-timeline.tsx` | NEW | 4 |
| `frontend/src/types/api.ts` | MODIFY | 1A, 1B, 2, 3, 4 |
| `frontend/src/components/dashboard/kpi-card.tsx` | MODIFY | 1A |
| `frontend/src/components/dashboard/forecast-card.tsx` | MODIFY | 3 |

### Tests
| File | Type | Phase |
|------|------|-------|
| `tests/test_statistical_confidence.py` | NEW | 1A |
| `tests/test_diagnostics_repository.py` | NEW | 1B |
| `tests/test_why_changed_service.py` | NEW | 1B |
| `tests/test_why_changed_endpoint.py` | NEW | 1B |
| `tests/test_health_repository.py` | NEW | 2 |
| `tests/test_customer_health_service.py` | NEW | 2 |
| `tests/test_customer_health_endpoints.py` | NEW | 2 |
| `tests/test_forecast_ensemble.py` | NEW | 3 |
| `tests/test_anomaly_detectors.py` | NEW | 4 |
| `tests/test_anomaly_calendar.py` | NEW | 4 |
| `tests/test_anomaly_service.py` | NEW | 4 |
| `tests/test_anomaly_repository.py` | NEW | 4 |
| `tests/test_anomaly_endpoints.py` | NEW | 4 |
| `tests/test_pipeline_executor_anomaly.py` | NEW | 4 |
| `tests/conftest.py` | MODIFY | 1B, 2, 4 |

---

## Verification Steps (Per Phase)

### Phase 1A Verification
1. `pytest tests/test_statistical_confidence.py -v` -- all pass
2. `pytest tests/test_analytics_repository.py -v` -- existing + new tests pass
3. Start dev server, hit `GET /api/v1/analytics/summary` -- response includes `mom_significance`, `yoy_significance`
4. Hit `GET /api/v1/analytics/trends/daily` -- response `TrendResult` includes `stats` field
5. Frontend: KPI cards show colored significance dots

### Phase 1B Verification
1. `pytest tests/test_diagnostics_repository.py tests/test_why_changed_service.py tests/test_why_changed_endpoint.py -v`
2. Hit `GET /api/v1/analytics/why-changed?start_date=2026-03-01&end_date=2026-03-31` -- returns `WaterfallAnalysis` with drivers
3. Hit `GET /api/v1/analytics/why-changed?dimensions=product,customer` -- filters to those dimensions only
4. Frontend: Waterfall chart renders with positive/negative bars

### Phase 2 Verification
1. `dbt run --select feat_customer_health` -- succeeds
2. `dbt test --select feat_customer_health` -- passes
3. `pytest tests/test_health_repository.py tests/test_customer_health_service.py tests/test_customer_health_endpoints.py -v`
4. Hit `GET /api/v1/analytics/customer-health/summary` -- returns distribution across bands
5. Hit `GET /api/v1/analytics/customer-health/movements` -- returns movement data
6. Frontend: Customer health card renders with donut chart and movement alerts

### Phase 3 Verification
1. `pytest tests/test_forecasting_methods.py tests/test_forecast_ensemble.py -v`
2. `pytest tests/test_forecasting_service.py -v`
3. Run forecasting pipeline -- verify `competing_methods` populated in forecast_results
4. Hit `GET /api/v1/forecasting/revenue?confidence=0.95` -- wider confidence bands
5. Frontend: Forecast card shows winning method badge

### Phase 4 Verification
1. Run migration: `psql < migrations/013_create_anomaly_alerts.sql`
2. `pytest tests/test_anomaly_detectors.py tests/test_anomaly_calendar.py tests/test_anomaly_service.py tests/test_anomaly_repository.py tests/test_anomaly_endpoints.py -v`
3. Trigger pipeline run -- verify anomaly detection stage executes
4. Hit `GET /api/v1/anomalies/active` -- returns active alerts
5. Hit `POST /api/v1/anomalies/1/acknowledge` -- marks alert as acknowledged
6. Frontend: Alert banner appears on dashboard with active anomaly count

---

## Risk Mitigations

1. **No scipy dependency**: All statistics use Python stdlib `statistics` module (mean, stdev, quantiles). Z-scores are computed manually. Only sklearn is optionally used for isolation forest, with graceful fallback.

2. **No float for money**: All financial computations use `Decimal`. New models use `JsonDecimal`. z-scores/statistical values can use regular `Decimal` since they are derived metrics, not financial amounts.

3. **SQL injection prevention**: All new queries use parameterized `:param` bindings. Dynamic table/column names use whitelist validation (same pattern as `ALLOWED_RANKING_TABLES`).

4. **RLS compliance**: New `anomaly_alerts` table has `tenant_id` + RLS policies. New dbt model has RLS post-hooks. All new repository queries execute within tenant-scoped sessions.

5. **Backward compatibility**: All new fields on existing models use `| None = None` defaults. Existing API responses are unchanged for clients that don't consume new fields.

6. **Performance**: Why Engine runs one SQL query per dimension (4-5 queries max). Customer health is precomputed in dbt. Anomaly detection runs offline after pipeline, not in request path.
