# Phase 2: Automation & Monitoring (COMPLETED)

> All sub-phases (2.0–2.8) are complete. This is the consolidated reference document.

---

# Phase 2 -- Automation & AI

> **Status**: DONE
> **Timeline**: Completed across Phases 2.0 through 2.8
> **Goal**: Transform DataPulse from a manual import-and-query tool into a fully automated, self-monitoring analytics pipeline with AI-powered insights.

---

## Visual Overview

```
                          Phase 2 -- Automation & AI
 ============================================================================

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

 ============================================================================

  Infrastructure        Execution          Monitoring         Presentation
  +-----------+       +-----------+       +-----------+       +-----------+
  | 2.0 Infra |  -->  | 2.3 Exec  |  -->  | 2.5 QC    |  -->  | 2.7 Dash  |
  | 2.1 n8n   |       | 2.4 Watch |       | 2.6 Notify|       | 2.8 AI    |
  | 2.2 Track |       +-----------+       +-----------+       +-----------+
  +-----------+
```

---

## Sub-Phase Index

| Phase | Title | Status | Plan |
|-------|-------|--------|------|
| 2.0 | [Infra Prep](./2.0-infra-prep.md) | DONE | API volumes, deps, config, CORS |
| 2.1 | [n8n + Redis Infrastructure](./2.1-n8n-infrastructure.md) | DONE | Docker services, health check workflow |
| 2.2 | [Pipeline Tracking](./2.2-pipeline-tracking.md) | DONE | pipeline_runs table, CRUD API, 53 tests |
| 2.3 | [Webhook Trigger & Execution](./2.3-webhook-execution.md) | DONE | Executor module, trigger endpoint, n8n workflow |
| 2.4 | [File Watcher](./2.4-file-watcher.md) | DONE | watchdog directory monitor, auto-trigger |
| 2.5 | [Data Quality Gates](./2.5-quality-gates.md) | DONE | 7 check functions, quality table, 79 tests |
| 2.6 | [Notifications](./2.6-notifications.md) | DONE | 4 n8n sub-workflows, Slack integration |
| 2.7 | [Pipeline Dashboard](./2.7-pipeline-dashboard.md) | DONE | /pipeline page, 5 components, E2E tests |
| 2.8 | [AI-Light](./2.8-ai-light.md) | DONE | OpenRouter client, anomaly detection, /insights |

---

## Key Outcomes

- **Zero-touch pipeline**: New files dropped into the watch directory automatically trigger the full Bronze-Silver-Gold pipeline.
- **Quality enforcement**: Every pipeline stage passes through 7 automated quality checks before proceeding.
- **Real-time visibility**: Pipeline runs, quality results, and AI insights are surfaced on dedicated dashboard pages.
- **Proactive alerting**: Success, failure, and daily quality digest notifications delivered via Slack.
- **AI narratives**: Statistical anomaly detection combined with LLM-generated change narratives provide actionable insights without manual analysis.

---

## Test Coverage

| Phase | Tests |
|-------|-------|
| 2.2 Pipeline Tracking | 53 |
| 2.3 Webhook Execution | 15 |
| 2.5 Quality Gates | 79 |
| 2.7 Pipeline Dashboard | E2E (Playwright) |
| **Total** | **147+ unit/integration + E2E** |

---

## 2.0 Infra Prep

> **Status**: DONE

---

## Objective

Prepare the existing Docker and API infrastructure for the automation phases that follow. Ensure the API service has proper volume mounts, dependencies, configuration, and CORS settings to support n8n webhooks, pipeline execution, and frontend communication.

---

## Scope

- API container volume mounts for data and dbt directories
- Python dependency additions for pipeline and quality modules
- Configuration extensions in Pydantic Settings
- CORS policy updates to allow n8n and frontend origins

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Docker volume mounts | `api` service mounts `./data` and `./dbt` directories for pipeline execution |
| Dependency updates | Added pipeline/executor dependencies to `pyproject.toml` |
| Config extensions | New settings in `src/datapulse/config.py` for pipeline paths and limits |
| CORS updates | Extended `CORS_ORIGINS` to include n8n and additional frontend origins |
| Security headers | Added `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` to API middleware |

---

## Technical Details

### Docker Compose Changes

The `api` service was updated with volume mounts so the pipeline executor can access raw data files and invoke dbt:

```yaml
api:
  volumes:
    - ./data:/app/data
    - ./dbt:/app/dbt
```

### CORS Configuration

Allowed origins extended to support automation services:

```python
CORS_ORIGINS: list[str] = [
    "http://localhost:3000",   # frontend
    "http://localhost:5678",   # n8n
]
```

Allowed headers expanded: `Content-Type`, `Authorization`, `X-API-Key`, `X-Pipeline-Token`.

### Rate Limiting

Rate limits configured for the upcoming endpoints:
- Analytics endpoints: 60 requests/minute
- Pipeline mutation endpoints: 5 requests/minute

---

## Key Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Volume mounts, service dependencies |
| `src/datapulse/config.py` | Pydantic settings extensions |
| `src/datapulse/api/app.py` | CORS middleware, security headers |
| `pyproject.toml` | Dependency additions |

---

## Dependencies

- Phase 1.x (all prior phases complete)
- Docker Compose infrastructure operational
- PostgreSQL 16 running with bronze/silver/gold schemas

---

## 2.1 n8n Infrastructure

> **Status**: DONE

---

## Objective

Deploy n8n workflow automation and Redis cache as Docker services, establishing the orchestration layer for automated pipeline execution, quality checks, and notifications.

---

## Scope

- n8n Docker service with persistent storage and PostgreSQL backend
- Redis Docker service for n8n caching and queue management
- Health check workflow running every 5 minutes against the API
- Network configuration for inter-service communication

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| n8n Docker service | `datapulse-n8n` container on port 5678, PostgreSQL-backed |
| Redis Docker service | `datapulse-redis` container (internal network only) |
| Health check workflow | `2.1.1_health_check.json` -- polls `GET /health` every 5 min |
| Docker networking | All services on shared `datapulse` network |

---

## Technical Details

### Docker Compose Services

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

### Health Check Workflow

The `2.1.1_health_check.json` workflow:
1. **Cron trigger**: Fires every 5 minutes
2. **HTTP request**: `GET http://api:8000/health`
3. **Condition check**: Verifies `status === "healthy"` and database connectivity
4. **Alert path**: On failure, logs the error for downstream notification workflows

### n8n Schema

Migration `004_create_n8n_schema.sql` creates a dedicated `n8n` schema with appropriate grants, isolating n8n's internal tables from application data.

---

## Key Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | n8n + Redis service definitions |
| `n8n/workflows/2.1.1_health_check.json` | Health check workflow (every 5 min) |
| `migrations/004_create_n8n_schema.sql` | n8n schema + grants |

---

## Dependencies

- Phase 2.0 (infra prep complete)
- PostgreSQL 16 running
- API service operational with `/health` endpoint

---

## 2.2 Pipeline Tracking

> **Status**: DONE

---

## Objective

Build a pipeline run tracking system that records every pipeline execution with status, timing, metadata, and tenant isolation. Expose this via a CRUD API so the frontend and n8n can query and manage pipeline runs.

---

## Scope

- `pipeline_runs` database table with RLS
- Pipeline module: Pydantic models, SQLAlchemy repository, business logic service
- 5 CRUD API endpoints under `/api/v1/pipeline/`
- Comprehensive test coverage (53 tests)

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Database table | `public.pipeline_runs` with UUID PK, JSONB metadata, RLS |
| Migration | `005_create_pipeline_runs.sql` |
| Pydantic models | `PipelineRunCreate`, `PipelineRunUpdate`, `PipelineRunResponse`, `PipelineRunList` |
| Repository | SQLAlchemy CRUD for pipeline_runs (create, read, update, list, filter) |
| Service | Business logic layer (start_run, complete_run, fail_run) |
| API endpoints | 5 endpoints: list, get, create, update, delete |
| Tests | 53 unit/integration tests |

---

## Technical Details

### Database Schema

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

-- RLS policy
ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_runs FORCE ROW LEVEL SECURITY;
```

### Module Structure

```
src/datapulse/pipeline/
    __init__.py
    models.py       # Pydantic models (Create/Update/Response/List)
    repository.py   # SQLAlchemy CRUD operations
    service.py      # Business logic (start/complete/fail)
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/pipeline/runs` | List pipeline runs (paginated, filterable) |
| `GET` | `/api/v1/pipeline/runs/{id}` | Get single pipeline run |
| `POST` | `/api/v1/pipeline/runs` | Create new pipeline run |
| `PATCH` | `/api/v1/pipeline/runs/{id}` | Update pipeline run |
| `DELETE` | `/api/v1/pipeline/runs/{id}` | Delete pipeline run |

### Pipeline Status Flow

```
pending --> running --> completed
                   \-> failed
```

---

## Key Files

| File | Purpose |
|------|---------|
| `migrations/005_create_pipeline_runs.sql` | Table creation + RLS |
| `src/datapulse/pipeline/__init__.py` | Module init |
| `src/datapulse/pipeline/models.py` | Pydantic models |
| `src/datapulse/pipeline/repository.py` | SQLAlchemy CRUD |
| `src/datapulse/pipeline/service.py` | Business logic |
| `src/datapulse/api/routes/pipeline.py` | API route handlers |
| `src/datapulse/api/deps.py` | Dependency injection |
| `tests/` | 53 tests |

---

## Dependencies

- Phase 2.1 (n8n infrastructure operational)
- PostgreSQL with RLS support
- SQLAlchemy 2.0 async sessions
- FastAPI dependency injection

---

## 2.3 Webhook Execution

> **Status**: DONE

---

## Objective

Enable end-to-end pipeline execution triggered by webhooks. Build the executor module that runs the bronze loader and dbt transformations as sub-processes, and wire it into n8n for fully automated pipeline orchestration.

---

## Scope

- Pipeline executor module (bronze loader + dbt subprocess execution)
- 4 new API endpoints (trigger + 3 execute stages)
- n8n full pipeline workflow with webhook trigger
- 15 integration tests

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Executor module | `src/datapulse/pipeline/executor.py` -- stage execution logic |
| Pydantic models | `TriggerRequest`, `TriggerResponse`, `ExecuteRequest`, `ExecutionResult` |
| API endpoints | 4 endpoints: trigger, execute/bronze, execute/silver, execute/gold |
| n8n workflow | `2.3.1_full_pipeline_webhook.json` -- webhook-triggered full pipeline |
| Tests | 15 integration tests |

---

## Technical Details

### Executor Architecture

The executor module orchestrates pipeline stages by invoking sub-processes:

```python
# Bronze stage: invoke the bronze loader
async def execute_bronze(run_id: UUID, source_path: str) -> ExecutionResult:
    # Calls: python -m datapulse.bronze.loader --source <path>
    ...

# Silver stage: invoke dbt run for staging models
async def execute_silver(run_id: UUID) -> ExecutionResult:
    # Calls: dbt run --select staging --project-dir /app/dbt
    ...

# Gold stage: invoke dbt run for marts models
async def execute_gold(run_id: UUID) -> ExecutionResult:
    # Calls: dbt run --select marts --project-dir /app/dbt
    ...
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/pipeline/trigger` | Trigger a full pipeline run |
| `POST` | `/api/v1/pipeline/execute/bronze` | Execute bronze stage only |
| `POST` | `/api/v1/pipeline/execute/silver` | Execute silver stage only |
| `POST` | `/api/v1/pipeline/execute/gold` | Execute gold stage only |

### n8n Full Pipeline Workflow

`2.3.1_full_pipeline_webhook.json` orchestrates the complete pipeline:

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
Success Notification
     |
     v (on error)
Failure Alert
```

### Trigger Flow

1. Webhook receives POST request (from n8n, file watcher, or manual trigger)
2. Creates a `pipeline_run` record with status `pending`
3. Sequentially executes bronze -> silver -> gold stages
4. Updates pipeline run status at each stage transition
5. On completion: marks run as `completed`, fires success notification
6. On error: marks run as `failed`, captures error message, fires failure alert

---

## Key Files

| File | Purpose |
|------|---------|
| `src/datapulse/pipeline/executor.py` | Stage execution (bronze, silver, gold) |
| `src/datapulse/pipeline/models.py` | Trigger/Execute Pydantic models |
| `src/datapulse/api/routes/pipeline.py` | Trigger + execute endpoints |
| `n8n/workflows/2.3.1_full_pipeline_webhook.json` | Full pipeline n8n workflow |

---

## Dependencies

- Phase 2.2 (pipeline tracking operational)
- Bronze loader (`src/datapulse/bronze/loader.py`) functional
- dbt project configured and runnable (`dbt/`)
- n8n service running (Phase 2.1)

---

## 2.4 File Watcher

> **Status**: DONE

---

## Objective

Implement a directory monitoring service that automatically detects new Excel/CSV files dropped into the raw data directory and triggers the full pipeline without manual intervention.

---

## Scope

- watchdog-based directory monitor service
- Debounce logic to avoid duplicate triggers from file system events
- Auto-trigger of pipeline execution on new file detection
- Docker service integration

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| File watcher service | watchdog-based directory monitor for `data/raw/sales/` |
| Debounce logic | Prevents duplicate triggers from rapid file system events |
| Pipeline auto-trigger | Calls pipeline trigger API on new file detection |
| Docker service | Containerized watcher service in `docker-compose.yml` |
| File filtering | Watches for `.xlsx`, `.xls`, `.csv` extensions only |

---

## Technical Details

### Architecture

```
data/raw/sales/
     |
     |  (new file dropped)
     v
File Watcher Service (watchdog)
     |
     |  (debounce: wait for file write to complete)
     v
POST /api/v1/pipeline/trigger
     |
     v
Full Pipeline Execution (bronze -> silver -> gold)
```

### Watcher Implementation

The file watcher uses the `watchdog` library to monitor the configured raw data directory:

- **Event types**: `FileCreatedEvent`, `FileModifiedEvent`
- **File filter**: Only `.xlsx`, `.xls`, `.csv` files trigger the pipeline
- **Debounce**: Configurable delay (default: several seconds) to wait for large file writes to complete before triggering
- **Deduplication**: Tracks recently processed files to prevent re-triggering on modification events that follow creation events

### Debounce Strategy

Large Excel files may generate multiple file system events as they are written. The debounce logic:

1. On first event for a file, starts a timer
2. Subsequent events for the same file reset the timer
3. When the timer expires without new events, the pipeline is triggered
4. Prevents the same file from triggering multiple pipeline runs

### Docker Integration

The watcher runs as a dedicated Docker service with access to the shared data volume:

```yaml
watcher:
  volumes:
    - ./data:/app/data
  depends_on:
    - api
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/datapulse/watcher/` | File watcher module |
| `docker-compose.yml` | Watcher service definition |
| `src/datapulse/config.py` | `RAW_SALES_PATH` configuration |

---

## Dependencies

- Phase 2.3 (pipeline trigger API operational)
- `watchdog` Python package
- Shared Docker volume mount for `data/raw/sales/`
- API service running and accessible

---

## 2.5 Quality Gates

> **Status**: DONE

---

## Objective

Implement automated data quality checks that run after each pipeline stage, enforcing quality gates that can block downstream processing if critical thresholds are breached. Persist quality results for auditing and dashboard visibility.

---

## Scope

- `quality_checks` database table with RLS
- Quality module: 7 check functions, repository, orchestration service
- 2 API endpoints for quality data retrieval and ad-hoc checks
- Integration with n8n pipeline workflow (quality gate nodes)
- 79 tests

---

## Deliverables

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

---

## Technical Details

### Database Schema

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

### 7 Quality Check Functions

| Check | Description | Gate Behavior |
|-------|-------------|---------------|
| `row_count` | Verifies row count is within expected bounds | Blocks if zero rows |
| `null_rate` | Checks null percentage per column against threshold | Warns above threshold |
| `schema_drift` | Detects unexpected column additions or removals | Blocks on missing required columns |
| `duplicate_rate` | Measures duplicate row percentage | Warns above threshold |
| `value_range` | Validates numeric columns fall within expected ranges | Warns on outliers |
| `freshness` | Checks data recency (max date within expected window) | Warns if stale |
| `completeness` | Verifies required columns have minimum fill rate | Blocks below minimum |

### Module Structure

```
src/datapulse/pipeline/
    quality.py              # 7 check functions + QualityCheckResult model
    quality_repository.py   # SQLAlchemy CRUD for quality_checks
    quality_service.py      # Orchestration: run all checks, gate logic
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/pipeline/quality` | Get quality check results (filterable by run, stage) |
| `POST` | `/api/v1/pipeline/quality-check` | Run quality checks on a specific stage |

### Gate Logic

The quality service evaluates all check results and determines whether the pipeline should proceed:

```
All checks pass          --> gate OPEN, proceed to next stage
Any check fails (block)  --> gate CLOSED, pipeline fails
Any check fails (warn)   --> gate OPEN with warnings logged
```

### n8n Integration

Quality gate nodes are embedded in the full pipeline workflow (`2.3.1_full_pipeline_webhook.json`):

```
Bronze Execute --> Bronze QC Gate --> Silver Execute --> Silver QC Gate --> Gold Execute --> Gold QC Gate --> Success
                        |                                    |                                  |
                        v (fail)                             v (fail)                            v (fail)
                   Failure Alert                        Failure Alert                       Failure Alert
```

---

## Key Files

| File | Purpose |
|------|---------|
| `migrations/007_create_quality_checks.sql` | Table creation + RLS |
| `src/datapulse/pipeline/quality.py` | 7 check functions + models |
| `src/datapulse/pipeline/quality_repository.py` | SQLAlchemy CRUD |
| `src/datapulse/pipeline/quality_service.py` | Orchestration + gate logic |
| `src/datapulse/api/routes/pipeline.py` | Quality API endpoints |
| `n8n/workflows/2.3.1_full_pipeline_webhook.json` | Quality gate nodes |

---

## Dependencies

- Phase 2.3 (pipeline execution operational)
- Phase 2.2 (pipeline_runs table exists for foreign key)
- PostgreSQL with RLS support
- SQLAlchemy 2.0 async sessions

---

## 2.6 Notifications

> **Status**: DONE

---

## Objective

Implement proactive notification workflows that inform the team about pipeline outcomes, quality issues, and system errors via Slack. Ensure both real-time alerts and scheduled digests are covered.

---

## Scope

- 4 n8n sub-workflows for different notification scenarios
- Slack webhook integration
- Docker Compose environment variable for `SLACK_WEBHOOK_URL`
- Notification templates with contextual pipeline data

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Success notification | `2.6.1_success_notification.json` -- Slack message on pipeline completion |
| Failure alert | `2.6.2_failure_alert.json` -- Slack `@channel` alert on pipeline failure |
| Quality digest | `2.6.3_quality_digest.json` -- Cron daily 18:00 quality summary |
| Global error handler | `2.6.4_global_error_handler.json` -- Catches unhandled n8n errors |
| Slack configuration | `SLACK_WEBHOOK_URL` environment variable in docker-compose |

---

## Technical Details

### Notification Architecture

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

### Sub-Workflow Details

#### 2.6.1 Success Notification

Triggered as a sub-workflow from the main pipeline workflow on successful completion:
- Pipeline run ID and duration
- Row counts per stage (bronze, silver, gold)
- Quality check summary (all passed)
- Formatted as a Slack block message

#### 2.6.2 Failure Alert

Triggered on pipeline failure with urgency indicators:
- `@channel` mention for immediate team attention
- Failed stage identification
- Error message and stack trace excerpt
- Pipeline run ID for investigation
- Link to pipeline dashboard

#### 2.6.3 Quality Digest

Scheduled cron workflow running daily at 18:00:
- Summarizes all quality checks from the past 24 hours
- Highlights any warnings or failures
- Provides pass/fail ratio per stage
- Trends compared to previous day

#### 2.6.4 Global Error Handler

Catches any unhandled errors across all n8n workflows:
- Error workflow name and node
- Error message and timestamp
- Prevents silent failures in the automation layer

### Slack Integration

```yaml
# docker-compose.yml
n8n:
  environment:
    - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}
```

The webhook URL is stored in `.env` (never hardcoded) and passed to n8n as an environment variable, referenced in all notification workflows.

---

## Key Files

| File | Purpose |
|------|---------|
| `n8n/workflows/2.6.1_success_notification.json` | Pipeline success Slack message |
| `n8n/workflows/2.6.2_failure_alert.json` | Pipeline failure Slack alert |
| `n8n/workflows/2.6.3_quality_digest.json` | Daily quality summary digest |
| `n8n/workflows/2.6.4_global_error_handler.json` | Global n8n error handler |
| `docker-compose.yml` | `SLACK_WEBHOOK_URL` env var |

---

## Dependencies

- Phase 2.5 (quality gates operational for digest data)
- Phase 2.3 (pipeline execution for success/failure triggers)
- Phase 2.1 (n8n service running)
- Slack workspace with incoming webhook configured

---

## 2.7 Pipeline Dashboard

> **Status**: DONE

---

## Objective

Build a dedicated frontend page for pipeline monitoring, providing real-time visibility into pipeline runs, execution history, quality check results, and manual trigger capabilities.

---

## Scope

- `/pipeline` page in the Next.js frontend
- 5 React components for pipeline visualization
- 3 SWR hooks for data fetching
- `postAPI` function for pipeline trigger
- Playwright E2E tests

---

## Deliverables

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

---

## Technical Details

### Page Layout

```
/pipeline
+--------------------------------------------------+
|  Pipeline Dashboard                    [Trigger]  |
+--------------------------------------------------+
|                                                    |
|  Pipeline Overview                                 |
|  +----------------------------------------------+ |
|  | Last Run: #abc123  | Status: completed       | |
|  | Duration: 3m 42s   | Rows: 1.1M             | |
|  +----------------------------------------------+ |
|                                                    |
|  Run History                                       |
|  +----------------------------------------------+ |
|  | Run ID   | Stage  | Status | Started | Dur   | |
|  |----------|--------|--------|---------|-------| |
|  | abc123   | gold   | pass   | 14:30   | 3:42  | |
|  | def456   | silver | fail   | 12:15   | 1:20  | |
|  +----------------------------------------------+ |
|                                                    |
|  Quality Details (expandable per run)              |
|  +----------------------------------------------+ |
|  | Check       | Stage  | Result | Value         | |
|  |-------------|--------|--------|---------------| |
|  | row_count   | bronze | pass   | 2,269,598     | |
|  | null_rate   | silver | pass   | 0.02%         | |
|  | schema_drift| gold   | pass   | 0 changes     | |
|  +----------------------------------------------+ |
+--------------------------------------------------+
```

### Component Structure

```
frontend/src/
  app/pipeline/
    page.tsx                              # Pipeline dashboard page
  components/pipeline/
    pipeline-overview.tsx                  # Current status summary
    pipeline-history.tsx                   # Run history table
    pipeline-status-badge.tsx             # Status badge (color-coded)
    pipeline-quality-details.tsx          # Quality check results
    pipeline-trigger.tsx                  # Manual trigger button
```

### SWR Hooks

| Hook | Endpoint | Purpose |
|------|----------|---------|
| `use-pipeline-runs` | `GET /api/v1/pipeline/runs` | Fetch paginated pipeline runs |
| `use-pipeline-quality` | `GET /api/v1/pipeline/quality` | Fetch quality check results |
| `use-pipeline-status` | `GET /api/v1/pipeline/runs/{id}` | Fetch single run status |

### postAPI Function

A new `postAPI` helper added to the API client layer for mutation endpoints:

```typescript
async function postAPI<T>(path: string, body?: unknown): Promise<T>
```

Used by the trigger component to call `POST /api/v1/pipeline/trigger`.

### Status Badge Colors

| Status | Color | Icon |
|--------|-------|------|
| `pending` | Yellow | Clock |
| `running` | Blue | Spinner |
| `completed` | Green | Check |
| `failed` | Red | X |

---

## Key Files

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

## Dependencies

- Phase 2.3 (pipeline trigger API operational)
- Phase 2.5 (quality gate API operational)
- Phase 2.2 (pipeline runs API operational)
- Next.js 14 frontend (Phase 1.5)
- SWR for data fetching
- Tailwind CSS for styling

---

## 2.8 AI-Light

> **Status**: DONE

---

## Objective

Add AI-powered analytics capabilities using OpenRouter's free tier models. Provide statistical anomaly detection, AI-generated change narratives, and an insights dashboard -- delivering actionable intelligence without expensive AI infrastructure.

---

## Scope

- OpenRouter free tier HTTP client
- AILightService with anomaly detection and narrative generation
- 4 API endpoints for AI insights
- `/insights` frontend page
- n8n daily digest workflow with AI summaries
- Statistical anomaly detection (Z-score based)

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| OpenRouter client | HTTP client for OpenRouter free tier API |
| AILightService | Service layer: anomaly detection + narrative generation |
| Statistical detection | Z-score based anomaly detection on time-series metrics |
| API endpoints | 4 endpoints under `/api/v1/analytics/insights/` |
| Insights page | `/insights` frontend page with anomaly cards and narratives |
| n8n workflow | Daily AI digest workflow with OpenRouter integration |

---

## Technical Details

### Architecture

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

### OpenRouter Client

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

### Statistical Anomaly Detection

Z-score based detection against rolling historical windows:

- **Metrics monitored**: daily revenue, order count, average order value, return rate
- **Detection method**: Z-score against 30-day rolling mean/stddev
- **Severity levels**: `info` (|z| > 1.5), `warning` (|z| > 2.0), `critical` (|z| > 3.0)
- **No external AI dependency**: Pure statistical computation, always available

### AI Narrative Generation

When anomalies are detected, the service constructs a prompt with:
- The anomaly data points and severity
- Historical context (trend direction, seasonal patterns)
- Related dimension changes (which products/customers/sites shifted)

The LLM returns a human-readable narrative explaining the likely cause.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/analytics/insights/anomalies` | Current anomalies with severity |
| `GET` | `/api/v1/analytics/insights/narratives` | AI-generated change narratives |
| `GET` | `/api/v1/analytics/insights/summary` | Combined anomaly + narrative summary |
| `GET` | `/api/v1/analytics/insights/health` | AI service health and quota status |

### Frontend: /insights Page

```
/insights
+--------------------------------------------------+
|  AI Insights                                       |
+--------------------------------------------------+
|                                                    |
|  Active Anomalies                                  |
|  +----------------------------------------------+ |
|  | [!] Revenue dropped 23% vs 30-day avg        | |
|  |     Severity: WARNING  |  Detected: Today    | |
|  +----------------------------------------------+ |
|  | [i] Order count up 15% vs 30-day avg         | |
|  |     Severity: INFO     |  Detected: Today    | |
|  +----------------------------------------------+ |
|                                                    |
|  AI Narratives                                     |
|  +----------------------------------------------+ |
|  | "Revenue decline driven by seasonal drop in   | |
|  |  Product Category X, consistent with prior    | |
|  |  year Q1 patterns. Customer segment B shows   | |
|  |  compensating growth of 8%."                  | |
|  +----------------------------------------------+ |
+--------------------------------------------------+
```

### n8n Daily Digest Workflow

A scheduled n8n workflow that:
1. Runs daily (morning)
2. Calls the insights summary API
3. Formats anomalies and narratives into a Slack message
4. Posts to the team channel

### Graceful Degradation

The system is designed to function without the AI layer:
- Statistical anomaly detection works purely on local data (no external calls)
- If OpenRouter is unavailable, anomalies are still surfaced without narratives
- The `/insights` page shows anomaly cards even when narrative generation fails
- Health endpoint reports AI service availability

---

## Key Files

| File | Purpose |
|------|---------|
| `src/datapulse/ai/client.py` | OpenRouter HTTP client |
| `src/datapulse/ai/service.py` | AILightService (anomalies + narratives) |
| `src/datapulse/ai/models.py` | Pydantic models (Anomaly, Narrative, InsightSummary) |
| `src/datapulse/api/routes/insights.py` | 4 API endpoints |
| `frontend/src/app/insights/page.tsx` | Insights dashboard page |
| `frontend/src/hooks/use-insights.ts` | SWR hook for insights API |
| `n8n/workflows/` | Daily AI digest workflow |

---

## Dependencies

- Phase 2.5 (quality gates for data validation)
- Phase 1.4 (analytics aggregation tables in gold layer)
- OpenRouter account (free tier)
- `httpx` for async HTTP client
- n8n service running (Phase 2.1)
- Slack webhook (Phase 2.6)
