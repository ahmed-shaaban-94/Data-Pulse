# JupyterLab and pgAdmin Usage Analysis

**Date**: April 5, 2026  
**Status**: SAFE TO REMOVE (both)

---

## Executive Summary

Both **JupyterLab** and **pgAdmin** are **development-only conveniences** and **can be safely removed** from production. They add 2.5GB+ combined container overhead and are not essential to the application's core functionality.

- **JupyterLab**: Only provides interactive shell access for manual exploration. No notebooks exist, no code depends on it, and production uses profiles to disable it.
- **pgAdmin**: Only a UI for database admin. All actual operations (schema management, migrations, queries) use `psql` CLI or dbt, which work fine without it.

---

## Detailed Findings

### 1. JupyterLab Analysis

#### Configuration
- **Service**: `app` (datapulse-app)
- **Port**: 8888
- **Container**: Python 3.12 + JupyterLab
- **Memory**: 2GB
- **Dockerfile**: Lines 42-53

```dockerfile
# ── App stage: full tooling with jupyterlab ────────────────────────
FROM base AS app

RUN pip install --no-cache-dir "." jupyterlab

RUN useradd -m -u 1000 appuser
USER appuser

EXPOSE 8888

# Default command: keep container running for interactive use
CMD ["tail", "-f", "/dev/null"]
```

#### Usage Pattern
- **Startup**: Runs with `docker compose up` but does nothing by default
- **Command**: `tail -f /dev/null` (keep container alive for manual entry)
- **No automatic scripts**: No startup scripts, no health checks that depend on JupyterLab
- **Port**: Only exposed, never actually used by any service
- **Health check**: Tests HTTP on :8888 but only for readiness, not actual usage

#### Makefile Usage
The Makefile uses `app` container as runtime environment for scripts, not as JupyterLab server:
```makefile
test: docker exec -it datapulse-app pytest ...
lint: docker exec -it datapulse-app ruff check ...
dbt:  docker exec -it datapulse-app dbt build ...
load: docker exec -it datapulse-app python -m datapulse.bronze.loader ...
```

These same commands work perfectly in the `api` container (same Python environment).

#### Notebooks
- **Directory**: `/notebooks/` exists but empty (only `.gitkeep`)
- **No .ipynb files**: Zero Jupyter notebooks in entire project
- **No exploratory code**: No data exploration workflow documented

#### Production Behavior
```yaml
# docker-compose.prod.yml
app:
  profiles: ["dev"]  # Disabled in production!
```

#### Dependencies
- **No services depend on app**: Not referenced in any health checks or dependencies
- **No code depends on JupyterLab**: No imports, no kernel connections


### 2. pgAdmin Analysis

#### Configuration
- **Service**: `pgadmin` (datapulse-pgadmin)
- **Port**: 5050
- **Container**: `dpage/pgadmin4:8.14`
- **Memory**: 256MB
- **Status**: Email + password from environment

#### Usage Pattern
- **Web UI only**: Graphical interface to databases
- **For manual administration**: Viewing tables, running ad-hoc queries
- **No automated operations**: No scripts, APIs, or services call pgAdmin
- **One-way dependency**: PostgreSQL must be healthy for pgAdmin, but nothing needs pgAdmin

#### Production Behavior
```yaml
# docker-compose.prod.yml
pgadmin:
  ports: !reset []
  profiles: ["dev"]  # Disabled in production!
```

pgAdmin is **disabled in production** via profiles.

#### Alternative Tools Already In Use
- **psql CLI**: Direct database access for scripts/migrations
- **dbt**: All schema management and transformations
- **SQL migrations**: `scripts/prestart.sh` runs migrations via `psql`
- **API healthchecks**: Monitor database health via `pg_isready`

#### Code Dependencies
- **Zero imports** of pgAdmin libraries
- **No connection URLs** to pgAdmin in code
- **Migrations run independently** via `prestart` service

---

## Service Dependency Graph

```
ACTIVE SERVICES (Production + Development):
├── postgres (required by all)
├── redis (required by api, celery-worker, n8n)
├── api (required by frontend, nginx)
├── frontend (required by nginx)
├── celery-worker (required by api)
├── n8n (optional workflow automation)
├── prestart (runs at startup, then exits)
├── nginx (production only)

DEV-ONLY SERVICES (can be removed):
├── pgadmin (optional UI, no dependencies)
└── app (optional environment, no dependencies)

PREVIOUSLY REMOVED:
├── traefik (replaced by nginx)
├── keycloak (replaced by Auth0)
└── lightdash (replaced by Next.js dashboard)
```

---

## Impact Analysis

### If We Remove JupyterLab

#### What Breaks
- Nothing. No code, workflows, or documentation depends on it.

#### What Changes
1. Remove JupyterLab from Dockerfile:
```dockerfile
# OLD:
RUN pip install --no-cache-dir "." jupyterlab

# NEW:
RUN pip install --no-cache-dir "."
```

2. Option A: Remove `app` service entirely
   - Saves 2GB memory
   - Makefile commands must use `api` container
   - Recommended for production

3. Option B: Mark as dev-only profile
   - Still available: `docker compose --profile dev up`
   - Maintains status quo for manual development

#### Makefile Changes (if removing entirely)
```makefile
# Change all: datapulse-app → datapulse-api
test:
  docker exec datapulse-api pytest ...

dbt:
  docker exec datapulse-api dbt build ...
```

#### Documentation Updates
- README.md: Remove from service table
- CLAUDE.md: Remove port 8888 references
- Team configs: Update service tables
- docker-compose.yml: Update comments

### If We Remove pgAdmin

#### What Breaks
- Nothing. No code, workflows, or documentation depends on it.

#### What Changes
1. Remove `pgadmin` service from docker-compose.yml
2. Remove `pgadmin_data` volume
3. Update Makefile output

#### DBA Operations
```bash
# OLD (pgAdmin UI):
# Open localhost:5050 → click database → run queries

# NEW (psql):
docker exec datapulse-db psql -U datapulse -d datapulse

# OR locally:
psql -h localhost -U datapulse -d datapulse
```

#### Documentation Updates
- README.md: Remove from service table
- CLAUDE.md: Remove port 5050 references
- Team configs: Update service tables
- docker-compose.yml: Update comments

---

## Recommended Migration Path

### Step 1: Make Dev-Only Explicit (5 minutes) ⭐ DO THIS FIRST

```yaml
# docker-compose.yml
pgadmin:
  profiles: ["dev"]
  # ... rest of config

app:
  profiles: ["dev"]
  # ... rest of config
```

**Result**:
- Development: `docker compose --profile dev up` includes everything
- Production: Already disabled via docker-compose.prod.yml
- Memory saved in production: ~2.5GB

### Step 2: Update Documentation (1 hour)
- README.md: Remove from main service table, add note about dev profile
- CLAUDE.md: Update port reference
- Makefile: Update help text
- CONTRIBUTING.md: Document that JupyterLab is dev-only

### Step 3: Complete Removal (2-4 hours, optional)
If engineering time permits:

**A. Remove both services entirely**
```yaml
# docker-compose.yml
# DELETE: pgadmin service block
# DELETE: app service block
# DELETE: pgadmin_data from volumes
```

**B. Update Dockerfile**
```dockerfile
# Remove app stage entirely
# FROM base AS app ... (DELETE)
# Keep only: base, prestart, api
```

**C. Update Makefile**
```makefile
# Change all docker exec -it datapulse-app to datapulse-api
```

**D. Update CI/CD**
- Remove `app` from docker-build matrix (.github/workflows/ci.yml)
- Remove `app` from deploy-prod matrix
- Keep only: `api`, `frontend`

---

## Risk Assessment

### Removal Risk: VERY LOW ✅

#### Verified Non-Breaking
- ✅ No notebooks depend on JupyterLab
- ✅ No code imports jupyter libraries
- ✅ No services depend on port 8888
- ✅ No services depend on pgAdmin
- ✅ Production explicitly disables both
- ✅ Makefile targets work with `api` container
- ✅ dbt runs independently
- ✅ Migrations run via `prestart` service
- ✅ Database ops use `psql` CLI

#### What Could Go Wrong
1. Developer expects JupyterLab
   - **Mitigation**: Document in CONTRIBUTING.md
   
2. Need interactive data exploration
   - **Mitigation**: Use `psql` + Python REPL or Power BI dashboard
   
3. pgAdmin needed for production diagnosis
   - **Mitigation**: Use `psql` + `docker exec`

---

## Command Reference

### Current Setup
```bash
# Everything (8 services)
docker compose up -d

# Production (6 services, disabled in prod file)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### After Step 1 (profiles explicit)
```bash
# Development with dev tools (pgadmin + app)
docker compose --profile dev up -d

# Development without dev tools
docker compose up -d

# Production (unchanged)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### After Step 3 (full removal)
```bash
# Development (6 services, same as production)
docker compose up -d

# Production (identical)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Summary

**JupyterLab and pgAdmin are developer conveniences, NOT application requirements.**

| Aspect | Status |
|--------|--------|
| Code depends on them | ❌ No |
| Notebooks exist | ❌ No |
| Services depend on them | ❌ No |
| Production uses them | ❌ No |
| Required for CI/CD | ❌ No |
| Required for migrations | ❌ No |
| Required for dbt | ❌ No |
| Can use psql instead of pgAdmin | ✅ Yes |
| Can use `api` container instead of `app` | ✅ Yes |

**Recommended Action**: Implement Step 1 (5 min) immediately for clarity. Schedule Step 3 (2-4 hrs) for next cleanup cycle if desired.

**Files Affected if Removing**:
- docker-compose.yml
- docker-compose.prod.yml
- Dockerfile
- Makefile
- README.md
- docs/team-configs/*.md (5 files)
- .github/workflows/ci.yml
- .github/workflows/deploy-prod.yml
