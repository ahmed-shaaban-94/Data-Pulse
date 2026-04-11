# Subscription Plan Review (COMPLETED)

> **Status**: COMPLETED
> **Completed**: 2026-04-05
> **Originally Created**: 2026-04-03

---

## Summary

DataPulse reached a mature state with a complete medallion pipeline, 79+ API endpoints, 13 frontend pages, 9 Android screens, and 97.3% backend test coverage. This review identified and executed **6 high-impact improvement tracks** to harden the codebase into a production-grade, interview-ready portfolio piece.

| # | Track | Priority | Outcome |
|---|-------|----------|---------|
| 1 | Frontend Testing | CRITICAL | 70%+ component coverage via Vitest + RTL + E2E hardening — DONE |
| 2 | Pipeline Retry & Rollback | HIGH | Exponential backoff, stage checkpoints, dead letter queue — DONE |
| 3 | Quality Gates Enhancement | HIGH | Configurable rule engine, profiling, anomaly detection — DONE |
| 4 | Android Feature Parity | MEDIUM | 6 new screens, offline-first, push notifications — DONE |
| 5 | Observability Stack | HIGH | Prometheus + Grafana + Loki, 5 dashboards, 10 alert rules — DONE |
| 6 | API Improvements | MEDIUM | Cursor pagination, filter DSL, CSV/Excel export — DONE |

---

## Track 1 — Frontend Testing (DONE)

**Objective**: Comprehensive frontend testing with unit tests (Vitest + React Testing Library), integration tests, and hardened E2E tests (Playwright) — achieving 70%+ component coverage.

**Coverage targets achieved:**

| Layer | Target | Metric |
|-------|--------|--------|
| Component unit tests | 70% | Lines covered by Vitest |
| Hook tests | 90% | All hooks have happy + error path tests |
| E2E tests | 15 critical flows | User journeys tested end-to-end |
| Overall frontend | 60%+ | Combined Vitest coverage |

**Key deliverables:**

- Vitest + React Testing Library infrastructure with MSW for API mocking
- 40+ component unit tests (KPI cards, charts, tables, filters, error states)
- 20+ hook tests for all SWR hooks (loading/error state coverage)
- 10+ page-level integration tests
- E2E hardening: fixed flaky timeouts (30s), added `data-testid` coverage, enabled in CI
- Coverage gate enforced in CI

**Test infrastructure layout:**

```
frontend/
├── vitest.config.ts
└── src/__tests__/
    ├── setup.ts                    # RTL + MSW global setup
    ├── mocks/
    │   ├── handlers.ts             # MSW handlers for all API endpoints
    │   └── server.ts
    ├── components/                 # 40+ component tests
    ├── hooks/                      # 20+ hook tests
    └── pages/                      # 6 page integration tests
```

**E2E hardening fixes:**

| Issue | Fix |
|-------|-----|
| Flaky timeout failures | Increased to 30s, added `waitForLoadState('networkidle')` |
| Missing data-testid | Added to all interactive elements |
| CI environment | Docker-based Playwright with `--project=chromium` only |
| Screenshot artifacts | Uploaded on failure via GitHub Actions artifacts |

**Dependencies:** `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`, `msw` v2

---

## Track 2 — Pipeline Retry & Rollback (DONE)

**Objective**: Retry with exponential backoff for transient failures, stage-level rollback for data consistency, and partial re-execution (resume from last successful stage).

**Key deliverables:**

- `@with_retry` decorator with configurable exponential backoff
- Stage-level checkpoint system persisted in `pipeline_runs.metadata` JSONB
- Bronze rollback: `DELETE FROM bronze.sales WHERE _pipeline_run_id = ?`
- dbt rollback: pre/post snapshot comparison with full-refresh fallback
- Dead letter table for permanently failed runs (with RLS)
- State machine with validated transitions
- 3 new API endpoints (resume, dead-letters list, dead-letter resolve)
- 30+ tests

**Pipeline state machine transitions:**

```
PENDING → BRONZE → QUALITY_BRONZE → SILVER → QUALITY_SILVER
       → GOLD → QUALITY_GOLD → FORECASTING → COMPLETED
       (any stage) → FAILED → RETRYING → (resume from checkpoint)
```

**Checkpoint metadata stored in `pipeline_runs.metadata` JSONB:**

```json
{
  "checkpoint": {
    "last_successful_stage": "silver",
    "completed_stages": ["bronze", "quality_bronze", "silver", "quality_silver"],
    "stage_timings": { "bronze": { "duration_s": 45.2 } },
    "retry_history": [{ "stage": "gold", "attempt": 1, "error": "timeout" }]
  }
}
```

**New API endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/pipeline/runs/{id}/resume` | Resume from last checkpoint |
| GET | `/api/v1/pipeline/dead-letters` | List dead letter entries |
| POST | `/api/v1/pipeline/dead-letters/{id}/resolve` | Mark resolved |

**New modules:**

```
src/datapulse/pipeline/
├── retry.py           # @with_retry decorator + RetryExhaustedError
├── state_machine.py   # PipelineStage enum + transition validation
├── rollback.py        # Per-stage rollback functions
├── checkpoint.py      # JSONB checkpoint read/write
└── dead_letter.py     # Dead letter repository + service

migrations/
└── 008_add_pipeline_retry.sql   # _pipeline_run_id column, dead_letters table
```

---

## Track 3 — Quality Gates Enhancement (DONE)

**Objective**: Transform quality gates from 7 hard-coded checks into a configurable rule engine with per-tenant thresholds, historical quality trending, data profiling, and anomaly detection.

**Key deliverables:**

- `quality_rules` table with per-tenant configurable thresholds and JSONB config
- `QualityEngine` class with pluggable check registry
- Quality rules CRUD API (4 endpoints) + frontend management UI
- Daily quality scorecard with trending chart
- Column-level data profiling (min/max/mean/median/stddev/nulls/cardinality/distribution)
- Statistical anomaly detection (z-score > 3σ on key metrics)
- 40+ tests

**Configurable check registry:**

```
CHECK_REGISTRY: row_count, null_rate, schema_drift, row_delta,
                dedup_effective, financial_signs, dbt_tests,
                freshness (new), custom_sql (new)
```

**Rule severity model:** `error` (blocking gate) vs `warn` (non-blocking, logged only)

**New API endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/pipeline/quality-rules` | List rules for tenant |
| POST | `/api/v1/pipeline/quality-rules` | Create rule |
| PUT | `/api/v1/pipeline/quality-rules/{id}` | Update thresholds |
| DELETE | `/api/v1/pipeline/quality-rules/{id}` | Disable/delete rule |
| GET | `/api/v1/pipeline/quality-scorecard` | Daily scores + trend |
| GET | `/api/v1/pipeline/profile/{stage}` | Data profile for stage |
| GET | `/api/v1/analytics/anomalies` | Detected anomalies |

**New frontend components:** `quality-rules-table.tsx`, `quality-rule-form.tsx`, `quality-scorecard.tsx`, `data-profile-card.tsx`, `anomaly-badge.tsx`

**New modules:**

```
src/datapulse/pipeline/
├── quality_engine.py      # Configurable check engine
├── quality_rules_repo.py  # CRUD for quality_rules
├── profiler.py            # Table/column statistical profiling
└── anomaly.py             # Z-score anomaly detection

migrations/
└── 009_create_quality_rules.sql
```

---

## Track 4 — Android Feature Parity (DONE)

**Objective**: Bring the Android app to full feature parity with the web dashboard — 6 new screens, offline-first caching, and push notifications.

**Key deliverables:**

- 6 new screens: Goals, Alerts, AI Insights, SQL Lab, Reports, Explore
- Offline-first architecture: Room as source of truth + WorkManager sync (every 15 min)
- Push notifications via Firebase Cloud Messaging (FCM) with deep links
- Biometric authentication (fingerprint/face)
- KPI home screen widget (refreshes every 30 min)
- 30+ tests

**Offline-first data flow:**

```
Compose UI ← ViewModel ← Repository
                              ├── Room (Local — source of truth, works offline)
                              └── Retrofit (Remote)
                                      ↑
                              SyncWorker (WorkManager, every 15 min)
```

**Push notification flow:**

```
Pipeline event → n8n → POST /api/v1/notifications/push
→ Backend → Firebase Admin SDK → FCM → Android device
→ FCMService → NotificationBuilder → Deep link to pipeline/alerts screen
```

**New navigation routes:** `goals`, `alerts`, `insights`, `sql_lab`, `reports`, `explore`

**New Android dependencies:** `firebase-messaging`, `androidx.work:work-runtime-ktx`, `androidx.glance:glance-appwidget`, `androidx.biometric:biometric`

**New module structure:**

```
android/app/src/main/kotlin/com/datapulse/android/
├── presentation/goals/, alerts/, insights/, sqllab/, reports/, explore/
├── data/local/dao/ + entity/    # Room DAOs and entities
├── data/remote/                 # Retrofit API interfaces
├── data/sync/                   # SyncWorker + SyncManager
├── notification/                # FCMService, channels, builder
└── widget/                      # KPI AppWidget
```

---

## Track 5 — Observability Stack (DONE)

**Objective**: Full observability (Prometheus + Grafana + Loki) via Docker Compose with pre-built dashboards for API performance, pipeline health, database stats, and infrastructure.

**Key deliverables:**

- Prometheus server with scrape configs for all services
- 5 pre-built Grafana dashboards (provisioned via YAML)
- Loki + Promtail for centralized Docker log aggregation
- `prometheus_fastapi_instrumentator` middleware for automatic HTTP metrics
- Custom pipeline metrics (run counters, stage histograms, quality score gauges)
- `postgres_exporter`, `redis_exporter`, `node_exporter`
- 10 Prometheus alert rules → Alertmanager → Slack
- $0 additional cost (all self-hosted)

**Architecture:**

```
FastAPI /metrics  PostgreSQL :9187  Redis :9121
        └──────────────┬────────────────┘
                  Prometheus :9090 ◄── All exporters
                       │
                  Grafana :3001 ◄── Loki :3100 ◄── Promtail
                       │
                  Alertmanager :9093 → Slack
```

**5 Grafana dashboards:**

| Dashboard | Key Panels |
|-----------|-----------|
| API Performance | Request rate, P50/P95/P99 latency, error rate, top slow endpoints |
| Pipeline Health | Runs today, success rate, stage breakdown, quality score trend |
| Database | Connection pool, cache hit ratio, table sizes, slow queries |
| Infrastructure | CPU/memory/disk/network per container, Redis memory + hit rate |
| Quality Gates | Daily score trend, check pass rates, failures by stage |

**10 Prometheus alert rules:** HighErrorRate, HighLatency, PipelineFailure, PipelineSlow, HighConnectionCount, LowCacheHitRatio, RedisHighMemory, HighCPU, HighMemory, DiskSpaceLow

**Custom pipeline metrics (prometheus_client):**

- `datapulse_pipeline_runs_total` — Counter by tenant + status
- `datapulse_pipeline_duration_seconds` — Histogram by tenant
- `datapulse_stage_duration_seconds` — Histogram by stage
- `datapulse_quality_score` — Gauge by tenant + stage
- `datapulse_active_pipeline_runs` — Gauge

**Resource requirements:** ~1.5GB RAM, ~3GB/month disk (30d retention)

**File structure:**

```
observability/
├── prometheus/prometheus.yml + rules/datapulse.yml
├── grafana/provisioning/ + dashboards/ (5 JSON files)
├── loki/loki-config.yml
├── promtail/promtail-config.yml
└── alertmanager/alertmanager.yml

src/datapulse/
├── api/middleware/metrics.py   # FastAPI instrumentator setup
└── pipeline/metrics.py         # Custom pipeline metric definitions
```

---

## Track 6 — API Improvements (DONE)

**Objective**: Upgrade the API with cursor-based pagination, advanced filter DSL, CSV/Excel export, multi-field sorting, and enhanced OpenAPI documentation.

**Key deliverables:**

- Keyset cursor pagination with opaque `next_cursor` / `prev_cursor` tokens
- Standardized `CursorPage[T]` response wrapper
- Filter DSL: `?filter[field][op]=value` with field whitelist (SQL injection prevention)
- CSV streaming export (row-by-row, no full in-memory load)
- Excel export via `openpyxl`
- Multi-field sorting: `?sort=field1:asc,field2:desc`
- Enhanced OpenAPI metadata at `/docs` and `/redoc`
- Full backward compatibility (existing `limit` param still works)
- 25+ tests

**Why keyset over offset:**

```
Page 1000:  Offset = 500ms, Keyset = 0ms   (keyset seeks directly to cursor position)
Page 10000: Offset = 5000ms, Keyset = 0ms  (offset unusable at scale)
```

**Filter DSL operators:** `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `between`, `like`, `is_null`

**New export endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/export/products` | CSV or Excel export |
| GET | `/api/v1/export/customers` | CSV or Excel export |
| GET | `/api/v1/export/staff` | CSV or Excel export |
| GET | `/api/v1/export/sites` | CSV or Excel export |
| GET | `/api/v1/export/returns` | CSV or Excel export |
| GET | `/api/v1/export/daily-trends` | CSV or Excel export |

**Paginated response format:**

```json
{
  "items": [...],
  "next_cursor": "eyJuZXRfc2FsZXMiOiAxMjM0NTZ9",
  "has_next": true,
  "has_prev": false,
  "total_count": 17803
}
```

**New modules:**

```
src/datapulse/api/
├── pagination.py    # Cursor encode/decode, CursorPage[T] model
├── filters.py       # FilterDSL parser + SQLAlchemy applier
├── sorting.py       # Sort param parser + SQLAlchemy applier
└── routes/export.py # CSV/Excel streaming export endpoints
```

**New dependency:** `openpyxl` (Excel generation)
