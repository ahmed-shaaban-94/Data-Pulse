# Phase 2: Automation & Monitoring (COMPLETED)

> **Status**: DONE
> **Timeline**: Completed across sub-phases 2.0 through 2.8
> **Goal**: Transform DataPulse from a manual import-and-query tool into a fully automated, self-monitoring analytics pipeline with AI-powered insights.

---

## Overview

Phase 2 built the complete automation and monitoring layer on top of the Phase 1 data pipeline. Starting from infrastructure preparation, it progressed through deploying n8n + Redis, adding pipeline run tracking, enabling webhook-triggered execution, implementing a file watcher for zero-touch operation, enforcing data quality gates, wiring up Slack notifications, building a pipeline dashboard, and finally delivering AI-powered anomaly detection and narratives.

### Architecture Flow

```
  2.0 Infra Prep          Volumes, deps, config, CORS
       |
       v
  2.1 n8n + Redis         Docker services, health check workflow
       |
       v
  2.2 Pipeline Tracking   pipeline_runs table, CRUD API, 53 tests
       |
       v
  2.3 Webhook Execution   Executor module, trigger API, n8n workflow
       |
       v
  2.4 File Watcher        watchdog monitor, debounce, auto-trigger
       |
       v
  2.5 Quality Gates       7 check functions, quality_checks table, 79 tests
       |
       v
  2.6 Notifications       4 n8n sub-workflows, Slack integration
       |
       v
  2.7 Pipeline Dashboard  /pipeline page, 5 components, E2E tests
       |
       v
  2.8 AI-Light            OpenRouter client, anomaly detection, /insights page
```

### Key Outcomes

- **Zero-touch pipeline**: New files dropped into the watch directory automatically trigger the full Bronze-Silver-Gold pipeline.
- **Quality enforcement**: Every pipeline stage passes through 7 automated quality checks before proceeding.
- **Real-time visibility**: Pipeline runs, quality results, and AI insights are surfaced on dedicated dashboard pages.
- **Proactive alerting**: Success, failure, and daily quality digest notifications delivered via Slack.
- **AI narratives**: Statistical anomaly detection combined with LLM-generated change narratives provide actionable insights without manual analysis.

### Test Coverage

| Sub-Phase | Tests |
|-----------|-------|
| 2.2 Pipeline Tracking | 53 |
| 2.3 Webhook Execution | 15 |
| 2.5 Quality Gates | 79 |
| 2.7 Pipeline Dashboard | E2E (Playwright) |
| **Total** | **147+ unit/integration + E2E** |

---

## 2.0 Infra Prep

> **Status**: DONE

### Objective

Prepare the existing Docker and API infrastructure for the automation phases that follow. Ensure the API service has proper volume mounts, dependencies, configuration, and CORS settings to support n8n webhooks, pipeline execution, and frontend communication.

### Deliverables

| Deliverable | Description |
|-------------|-------------|
| Docker volume mounts | `api` service mounts `./data` and `./dbt` directories for pipeline execution |
| Dependency updates | Added pipeline/executor dependencies to `pyproject.toml` |
| Config extensions | New settings in `src/datapulse/config.py` for pipeline paths and limits |
| CORS updates | Extended `CORS_ORIGINS` to include n8n and additional frontend origins |
| Security headers | Added `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` to API middleware |

### Technical Details

**Docker Compose** — the `api` service was updated with volume mounts so the pipeline executor can access raw data files and invoke dbt:

```yaml
api:
  volumes:
    - ./data:/app/data
    - ./dbt:/app/dbt
```

**CORS** — allowed origins extended to support automation services:

```python
CORS_ORIGINS: list[str] = [
    "http://localhost:3000",   # frontend
    "http://localhost:5678",   # n8n
]
```

Allowed headers: `Content-Type`, `Authorization`, `X-API-Key`, `X-Pipeline-Token`.

**Rate limits**: Analytics endpoints 60 req/min; pipeline mutation endpoints 5 req/min.

### Key Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Volume mounts, service dependencies |
| `src/datapulse/config.py` | Pydantic settings extensions |
| `src/datapulse/api/app.py` | CORS middleware, security headers |
| `pyproject.toml` | Dependency additions |

---

## 2.1 n8n + Redis Infrastructure

> **Status**: DONE

### Objective

Deploy n8n workflow automation and Redis cache as Docker services, establishing the orchestration layer for automated pipeline execution, quality checks, and notifications.

### Deliverables

| Deliverable | Description |
|-------------|-------------|
| n8n Docker service | `datapulse-n8n` container on port 5678, PostgreSQL-backed |
| Redis Docker service | `datapulse-redis` container (internal network only) |
| Health check workflow | `2.1.1_health_check.json` — polls `GET /health` every 5 min |
| Docker networking | All services on shared `datapulse` network |

### Technical Details

```yaml
n8n:
  container_name: datapulse-n8n
  image: n8nio/n8n
  ports:
    - "127.0.0.1:5678:5678"
  environment:
    - DB_TYPE=postgresdb
    - DB_POSTGRESDB_HOST=postgres
    - DB_POSTGRESDB_DATABASE=datapulse
  volumes:
    - n8n_data:/home/node/.n8n
  depends_on:
    - postgres
    - redis

redis:
  container_name: datapulse-redis
  image: redis:7-alpine
```

**Health Check Workflow** (`2.1.1_health_check.json`):
1. Cron trigger fires every 5 minutes
2. HTTP request to `GET http://api:8000/health`
3. Verifies `status === "healthy"` and database connectivity
4. On failure, logs the error for downstream notification workflows

**Migration** `004_create_n8n_schema.sql` creates a dedicated `n8n` schema with appropriate grants, isolating n8n's internal tables from application data.

### Key Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | n8n + Redis service definitions |
| `n8n/workflows/2.1.1_health_check.json` | Health check workflow (every 5 min) |
| `migrations/004_create_n8n_schema.sql` | n8n schema + grants |

---

## 2.2 Pipeline Tracking

> **Status**: DONE

### Objective

Build a pipeline run tracking system that records every pipeline execution with status, timing, metadata, and tenant isolation. Expose this via a CRUD API so the frontend and n8n can query and manage pipeline runs.

### Deliverables

| Deliverable | Description |
|-------------|-------------|
| Database table | `public.pipeline_runs` with UUID PK, JSONB metadata, RLS |
| Migration | `005_create_pipeline_runs.sql` |
| Pydantic models | `PipelineRunCreate`, `PipelineRunUpdate`, `PipelineRunResponse`, `PipelineRunList` |
| Repository | SQLAlchemy CRUD for pipeline_runs (create, read, update, list, filter) |
| Service | Business logic layer (start_run, complete_run, fail_run) |
| API endpoints | 5 endpoints: list, get, create, update, delete |
| Tests | 53 unit/integration tests |

### Technical Details

**Database Schema**:

```sql
CREATE TABLE public.pipeline_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    stage           TEXT,
    started_at      TIMESTAMPTZ DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    error_message   TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_runs FORCE ROW LEVEL SECURITY;
```

**Module Structure**:

```
src/datapulse/pipeline/
    __init__.py
    models.py       # Pydantic models (Create/Update/Response/List)
    repository.py   # SQLAlchemy CRUD operations
    service.py      # Business logic (start/complete/fail)
```

**API Endpoints**:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/pipeline/runs` | List pipeline runs (paginated, filterable) |
| `GET` | `/api/v1/pipeline/runs/{id}` | Get single pipeline run |
| `POST` | `/api/v1/pipeline/runs` | Create new pipeline run |
| `PATCH` | `/api/v1/pipeline/runs/{id}` | Update pipeline run |
| `DELETE` | `/api/v1/pipeline/runs/{id}` | Delete pipeline run |

**Status Flow**: `pending --> running --> completed` or `running --> failed`

### Key Files

| File | Purpose |
|------|---------|
| `migrations/005_create_pipeline_runs.sql` | Table creation + RLS |
| `src/datapulse/pipeline/models.py` | Pydantic models |
| `src/datapulse/pipeline/repository.py` | SQLAlchemy CRUD |
| `src/datapulse/pipeline/service.py` | Business logic |
| `src/datapulse/api/routes/pipeline.py` | API route handlers |

---

## 2.3 Webhook Trigger & Pipeline Execution

> **Status**: DONE

### Objective

Enable end-to-end pipeline execution triggered by webhooks. Build the executor module that runs the bronze loader and dbt transformations as sub-processes, and wire it into n8n for fully automated pipeline orchestration.

### Deliverables

| Deliverable | Description |
|-------------|-------------|
| Executor module | `src/datapulse/pipeline/executor.py` — stage execution logic |
| Pydantic models | `TriggerRequest`, `TriggerResponse`, `ExecuteRequest`, `ExecutionResult` |
| API endpoints | 4 endpoints: trigger, execute/bronze, execute/silver, execute/gold |
| n8n workflow | `2.3.1_full_pipeline_webhook.json` — webhook-triggered full pipeline |
| Tests | 15 integration tests |

### Technical Details

**Executor Architecture** — orchestrates pipeline stages by invoking sub-processes:

```python
async def execute_bronze(run_id: UUID, source_path: str) -> ExecutionResult:
    # Calls: python -m datapulse.bronze.loader --source <path>

async def execute_silver(run_id: UUID) -> ExecutionResult:
    # Calls: dbt run --select staging --project-dir /app/dbt

async def execute_gold(run_id: UUID) -> ExecutionResult:
    # Calls: dbt run --select marts --project-dir /app/dbt
```

**API Endpoints**:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/pipeline/trigger` | Trigger a full pipeline run |
| `POST` | `/api/v1/pipeline/execute/bronze` | Execute bronze stage only |
| `POST` | `/api/v1/pipeline/execute/silver` | Execute silver stage only |
| `POST` | `/api/v1/pipeline/execute/gold` | Execute gold stage only |

**n8n Full Pipeline Workflow** (`2.3.1_full_pipeline_webhook.json`):

```
Webhook Trigger
     |
     v
Bronze Stage  -->  Quality Check (bronze)
     |
     v
Silver Stage  -->  Quality Check (silver)
     |
     v
Gold Stage    -->  Quality Check (gold)
     |
     v
Success Notification  /  Failure Alert (on error)
```

**Trigger Flow**:
1. Webhook receives POST (from n8n, file watcher, or manual trigger)
2. Creates a `pipeline_run` record with status `pending`
3. Sequentially executes bronze -> silver -> gold
4. Updates run status at each stage transition
5. On completion: marks `completed`, fires success notification
6. On error: marks `failed`, captures error message, fires failure alert

### Key Files

| File | Purpose |
|------|---------|
| `src/datapulse/pipeline/executor.py` | Stage execution (bronze, silver, gold) |
| `src/datapulse/pipeline/models.py` | Trigger/Execute Pydantic models |
| `src/datapulse/api/routes/pipeline.py` | Trigger + execute endpoints |
| `n8n/workflows/2.3.1_full_pipeline_webhook.json` | Full pipeline n8n workflow |

---

## 2.4 File Watcher

> **Status**: DONE

### Objective

Implement a directory monitoring service that automatically detects new Excel/CSV files dropped into the raw data directory and triggers the full pipeline without manual intervention.

### Deliverables

| Deliverable | Description |
|-------------|-------------|
| File watcher service | watchdog-based directory monitor for `data/raw/sales/` |
| Debounce logic | Prevents duplicate triggers from rapid file system events |
| Pipeline auto-trigger | Calls pipeline trigger API on new file detection |
| Docker service | Containerized watcher service in `docker-compose.yml` |
| File filtering | Watches for `.xlsx`, `.xls`, `.csv` extensions only |

### Technical Details

**Architecture**:

```
data/raw/sales/
     |  (new file dropped)
     v
File Watcher Service (watchdog)
     |  (debounce: wait for file write to complete)
     v
POST /api/v1/pipeline/trigger
     |
     v
Full Pipeline Execution (bronze -> silver -> gold)
```

**Watcher Implementation** uses the `watchdog` library:
- **Event types**: `FileCreatedEvent`, `FileModifiedEvent`
- **File filter**: Only `.xlsx`, `.xls`, `.csv` files trigger the pipeline
- **Debounce**: Configurable delay to wait for large file writes to complete before triggering
- **Deduplication**: Tracks recently processed files to prevent re-triggering on modification events that follow creation events

**Debounce Strategy**:
1. On first event for a file, starts a timer
2. Subsequent events for the same file reset the timer
3. When the timer expires without new events, the pipeline is triggered
4. Prevents the same file from triggering multiple pipeline runs

**Docker Integration**:

```yaml
watcher:
  volumes:
    - ./data:/app/data
  depends_on:
    - api
```

### Key Files

| File | Purpose |
|------|---------|
| `src/datapulse/watcher/` | File watcher module |
| `docker-compose.yml` | Watcher service definition |
| `src/datapulse/config.py` | `RAW_SALES_PATH` configuration |

---

## 2.5 Data Quality Gates

> **Status**: DONE

### Objective

Implement automated data quality checks that run after each pipeline stage, enforcing quality gates that can block downstream processing if critical thresholds are breached. Persist quality results for auditing and dashboard visibility.

### Deliverables

| Deliverable | Description |
|-------------|-------------|
| Database table | `public.quality_checks` with SERIAL PK, RLS, JSONB details |
| Migration | `007_create_quality_checks.sql` |
| 7 check functions | `row_count`, `null_rate`, `schema_drift`, `duplicate_rate`, `value_range`, `freshness`, `completeness` |
| Quality repository | SQLAlchemy CRUD for quality_checks table |
| Quality service | Orchestration: run checks, persist results, gate logic |
| API endpoints | 2 endpoints: GET quality results, POST quality-check |
| n8n integration | Quality gate nodes in `2.3.1_full_pipeline_webhook.json` |
| Tests | 79 unit/integration tests |

### Technical Details

**Database Schema**:

```sql
CREATE TABLE public.quality_checks (
    id              SERIAL PRIMARY KEY,
    pipeline_run_id UUID REFERENCES public.pipeline_runs(id),
    tenant_id       UUID NOT NULL,
    stage           TEXT NOT NULL,          -- bronze, silver, gold
    check_name      TEXT NOT NULL,          -- row_count, null_rate, etc.
    passed          BOOLEAN NOT NULL,
    expected_value  TEXT,
    actual_value    TEXT,
    details         JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.quality_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_checks FORCE ROW LEVEL SECURITY;
```

**7 Quality Check Functions**:

| Check | Description | Gate Behavior |
|-------|-------------|---------------|
| `row_count` | Verifies row count is within expected bounds | Blocks if zero rows |
| `null_rate` | Checks null percentage per column against threshold | Warns above threshold |
| `schema_drift` | Detects unexpected column additions or removals | Blocks on missing required columns |
| `duplicate_rate` | Measures duplicate row percentage | Warns above threshold |
| `value_range` | Validates numeric columns fall within expected ranges | Warns on outliers |
| `freshness` | Checks data recency (max date within expected window) | Warns if stale |
| `completeness` | Verifies required columns have minimum fill rate | Blocks below minimum |

**Module Structure**:

```
src/datapulse/pipeline/
    quality.py              # 7 check functions + QualityCheckResult model
    quality_repository.py   # SQLAlchemy CRUD for quality_checks
    quality_service.py      # Orchestration: run all checks, gate logic
```

**API Endpoints**:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/pipeline/quality` | Get quality check results (filterable by run, stage) |
| `POST` | `/api/v1/pipeline/quality-check` | Run quality checks on a specific stage |

**Gate Logic**:

```
All checks pass          --> gate OPEN, proceed to next stage
Any check fails (block)  --> gate CLOSED, pipeline fails
Any check fails (warn)   --> gate OPEN with warnings logged
```

**n8n Integration** — quality gate nodes embedded in the full pipeline workflow:

```
Bronze Execute --> Bronze QC Gate --> Silver Execute --> Silver QC Gate --> Gold Execute --> Gold QC Gate --> Success
                       |                                   |                                  |
                       v (fail)                            v (fail)                           v (fail)
                  Failure Alert                       Failure Alert                      Failure Alert
```

### Key Files

| File | Purpose |
|------|---------|
| `migrations/007_create_quality_checks.sql` | Table creation + RLS |
| `src/datapulse/pipeline/quality.py` | 7 check functions + models |
| `src/datapulse/pipeline/quality_repository.py` | SQLAlchemy CRUD |
| `src/datapulse/pipeline/quality_service.py` | Orchestration + gate logic |
| `src/datapulse/api/routes/pipeline.py` | Quality API endpoints |
| `n8n/workflows/2.3.1_full_pipeline_webhook.json` | Quality gate nodes |

---

## 2.6 Notifications

> **Status**: DONE

### Objective

Implement proactive notification workflows that inform the team about pipeline outcomes, quality issues, and system errors via Slack. Ensure both real-time alerts and scheduled digests are covered.

### Deliverables

| Deliverable | Description |
|-------------|-------------|
| Success notification | `2.6.1_success_notification.json` — Slack message on pipeline completion |
| Failure alert | `2.6.2_failure_alert.json` — Slack `@channel` alert on pipeline failure |
| Quality digest | `2.6.3_quality_digest.json` — Cron daily 18:00 quality summary |
| Global error handler | `2.6.4_global_error_handler.json` — Catches unhandled n8n errors |
| Slack configuration | `SLACK_WEBHOOK_URL` environment variable in docker-compose |

### Technical Details

**Notification Architecture**:

```
Pipeline Execution
     |
     +--> Success --> 2.6.1 Success Notification --> Slack #datapulse-pipeline
     |
     +--> Failure --> 2.6.2 Failure Alert         --> Slack #datapulse-pipeline (@channel)
     |
     +--> Any n8n error --> 2.6.4 Global Handler  --> Slack #datapulse-alerts

Daily Cron (18:00)
     |
     +--> 2.6.3 Quality Digest                    --> Slack #datapulse-quality
```

**Sub-Workflow Details**:

- **2.6.1 Success Notification**: Pipeline run ID and duration, row counts per stage, quality check summary, formatted as a Slack block message.
- **2.6.2 Failure Alert**: `@channel` mention, failed stage identification, error message and stack trace excerpt, pipeline run ID, link to pipeline dashboard.
- **2.6.3 Quality Digest**: Daily at 18:00; summarizes all quality checks from the past 24 hours, highlights warnings/failures, provides pass/fail ratio per stage, trends vs. previous day.
- **2.6.4 Global Error Handler**: Catches any unhandled errors across all n8n workflows; prevents silent failures in the automation layer.

**Slack Integration** — webhook URL stored in `.env`, passed to n8n as an environment variable:

```yaml
n8n:
  environment:
    - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}
```

### Key Files

| File | Purpose |
|------|---------|
| `n8n/workflows/2.6.1_success_notification.json` | Pipeline success Slack message |
| `n8n/workflows/2.6.2_failure_alert.json` | Pipeline failure Slack alert |
| `n8n/workflows/2.6.3_quality_digest.json` | Daily quality summary digest |
| `n8n/workflows/2.6.4_global_error_handler.json` | Global n8n error handler |

---

## 2.7 Pipeline Dashboard

> **Status**: DONE

### Objective

Build a dedicated frontend page for pipeline monitoring, providing real-time visibility into pipeline runs, execution history, quality check results, and manual trigger capabilities.

### Deliverables

| Deliverable | Description |
|-------------|-------------|
| Pipeline page | `/pipeline` route with full pipeline dashboard |
| Overview component | Current pipeline status, last run summary |
| History component | Paginated list of past pipeline runs |
| Status badge | Visual status indicator (pending/running/completed/failed) |
| Quality details | Expandable quality check results per pipeline run |
| Trigger component | Manual pipeline trigger button with confirmation |
| SWR hooks | 3 hooks for pipeline runs, quality data, trigger status |
| postAPI function | POST request helper for pipeline trigger endpoint |
| E2E tests | Playwright specs for pipeline dashboard |

### Technical Details

**Component Structure**:

```
frontend/src/
  app/pipeline/
    page.tsx                            # Pipeline dashboard page
  components/pipeline/
    pipeline-overview.tsx               # Current status summary
    pipeline-history.tsx                # Run history table
    pipeline-status-badge.tsx           # Status badge (color-coded)
    pipeline-quality-details.tsx        # Quality check results
    pipeline-trigger.tsx                # Manual trigger button
```

**SWR Hooks**:

| Hook | Endpoint | Purpose |
|------|----------|---------|
| `use-pipeline-runs` | `GET /api/v1/pipeline/runs` | Fetch paginated pipeline runs |
| `use-pipeline-quality` | `GET /api/v1/pipeline/quality` | Fetch quality check results |
| `use-pipeline-status` | `GET /api/v1/pipeline/runs/{id}` | Fetch single run status |

**postAPI function** — POST request helper added to the API client layer:

```typescript
async function postAPI<T>(path: string, body?: unknown): Promise<T>
```

**Status Badge Colors**:

| Status | Color | Icon |
|--------|-------|------|
| `pending` | Yellow | Clock |
| `running` | Blue | Spinner |
| `completed` | Green | Check |
| `failed` | Red | X |

### Key Files

| File | Purpose |
|------|---------|
| `frontend/src/app/pipeline/page.tsx` | Pipeline dashboard page |
| `frontend/src/components/pipeline/pipeline-overview.tsx` | Status overview |
| `frontend/src/components/pipeline/pipeline-history.tsx` | Run history |
| `frontend/src/components/pipeline/pipeline-status-badge.tsx` | Status indicator |
| `frontend/src/components/pipeline/pipeline-quality-details.tsx` | Quality results |
| `frontend/src/components/pipeline/pipeline-trigger.tsx` | Manual trigger |
| `frontend/src/hooks/use-pipeline-runs.ts` | Pipeline runs SWR hook |
| `frontend/src/hooks/use-pipeline-quality.ts` | Quality data SWR hook |
| `frontend/src/lib/api-client.ts` | `postAPI` function |
| `frontend/e2e/pipeline.spec.ts` | E2E tests |

---

## 2.8 AI-Light

> **Status**: DONE

### Objective

Add AI-powered analytics capabilities using OpenRouter's free tier models. Provide statistical anomaly detection, AI-generated change narratives, and an insights dashboard — delivering actionable intelligence without expensive AI infrastructure.

### Deliverables

| Deliverable | Description |
|-------------|-------------|
| OpenRouter client | HTTP client for OpenRouter free tier API |
| AILightService | Service layer: anomaly detection + narrative generation |
| Statistical detection | Z-score based anomaly detection on time-series metrics |
| API endpoints | 4 endpoints under `/api/v1/analytics/insights/` |
| Insights page | `/insights` frontend page with anomaly cards and narratives |
| n8n workflow | Daily AI digest workflow with OpenRouter integration |

### Technical Details

**Architecture**:

```
Gold Layer Metrics (agg tables)
     |
     v
Statistical Anomaly Detection (Z-score)
     |
     +--> Anomaly flags + severity scores
     |
     v
OpenRouter Free Tier LLM
     |
     +--> Natural language narratives
     |    ("Revenue dropped 23% vs prior week,
     |     driven by Product X seasonal decline")
     |
     v
/insights Dashboard + n8n Daily Digest
```

**OpenRouter Client**:

```python
class OpenRouterClient:
    """HTTP client for OpenRouter free tier models."""
    base_url = "https://openrouter.ai/api/v1"

    async def chat_completion(
        self, messages: list[dict], model: str = "free-model"
    ) -> str:
        ...
```

The client handles rate limiting, retries, and graceful degradation when the free tier is unavailable.

**Statistical Anomaly Detection** — Z-score based against rolling historical windows:
- **Metrics monitored**: daily revenue, order count, average order value, return rate
- **Detection method**: Z-score against 30-day rolling mean/stddev
- **Severity levels**: `info` (|z| > 1.5), `warning` (|z| > 2.0), `critical` (|z| > 3.0)
- **No external AI dependency**: Pure statistical computation, always available

**AI Narrative Generation** — when anomalies are detected, the service constructs a prompt with the anomaly data points, historical context (trend direction, seasonal patterns), and related dimension changes (which products/customers/sites shifted). The LLM returns a human-readable narrative explaining the likely cause.

**API Endpoints**:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/analytics/insights/anomalies` | Current anomalies with severity |
| `GET` | `/api/v1/analytics/insights/narratives` | AI-generated change narratives |
| `GET` | `/api/v1/analytics/insights/summary` | Combined anomaly + narrative summary |
| `GET` | `/api/v1/analytics/insights/health` | AI service health and quota status |

**Graceful Degradation** — the system is designed to function without the AI layer:
- Statistical anomaly detection works purely on local data (no external calls)
- If OpenRouter is unavailable, anomalies are still surfaced without narratives
- The `/insights` page shows anomaly cards even when narrative generation fails
- Health endpoint reports AI service availability

**n8n Daily Digest** — a scheduled workflow that runs daily (morning), calls the insights summary API, formats anomalies and narratives into a Slack message, and posts to the team channel.

### Key Files

| File | Purpose |
|------|---------|
| `src/datapulse/ai/client.py` | OpenRouter HTTP client |
| `src/datapulse/ai/service.py` | AILightService (anomalies + narratives) |
| `src/datapulse/ai/models.py` | Pydantic models (Anomaly, Narrative, InsightSummary) |
| `src/datapulse/api/routes/insights.py` | 4 API endpoints |
| `frontend/src/app/insights/page.tsx` | Insights dashboard page |
| `frontend/src/hooks/use-insights.ts` | SWR hook for insights API |
| `n8n/workflows/` | Daily AI digest workflow |
