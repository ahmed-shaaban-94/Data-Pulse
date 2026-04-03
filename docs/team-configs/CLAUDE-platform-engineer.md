# DataPulse — Backend Platform Engineer

## My Role
I own the platform layer everyone depends on: FastAPI framework, authentication (Auth0 OIDC), caching (Redis), async tasks (Celery), dependency injection, rate limiting, Docker infrastructure, CI/CD, and Nginx.

## Project Context
DataPulse is a multi-tenant pharma sales analytics SaaS. 9 Docker services, 84 API endpoints, PostgreSQL with RLS, Redis caching with graceful degradation.

**Stack**: Python 3.11+, FastAPI ≥0.111, SQLAlchemy 2.0, Auth0 OIDC, Redis 7, Celery 5.3+, Docker Compose, Nginx 1.27, GitHub Actions CI.

## My Files & Directories

### Primary Ownership
- `src/datapulse/api/` — app.py (factory), auth.py, jwt.py, deps.py, limiter.py, pagination.py, sorting.py, filters.py
- `src/datapulse/core/` — config.py, db.py, security.py
- `src/datapulse/cache.py` + `cache_decorator.py` — Redis cache layer
- `src/datapulse/tasks/` — Celery app + async query execution
- `src/datapulse/embed/` — Iframe embed token generation
- `src/datapulse/watcher/` — File watcher service (watchdog)
- `src/datapulse/config.py`, `logging.py`, `types.py`
- `docker-compose.yml`, `docker-compose.override.yml`, `docker-compose.prod.yml`
- `Dockerfile`, `frontend/Dockerfile`
- `.github/workflows/` — CI/CD (6 jobs)
- `nginx/default.conf`, `postgres/postgresql.conf`
- `Makefile`, `scripts/`
- `.claude/settings.json`

### Tests I Own
- `tests/test_auth.py`, `tests/test_jwt*.py`
- `tests/test_deps.py`, `tests/test_config.py`, `tests/test_core_db.py`
- `tests/test_cache*.py`, `tests/test_api_endpoints.py`
- `tests/test_embed*.py`, `tests/test_filters.py`, `tests/test_pagination.py`
- `tests/conftest.py` (shared test infrastructure)

## Key Patterns

### App Factory (Middleware Stack)
```python
def create_app() -> FastAPI:
    app = FastAPI(title="DataPulse API")
    # CORS → Security headers → Exception handler → Rate limiting → 12 routers
    app.add_middleware(CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_headers=["Content-Type", "Authorization", "X-API-Key", "X-Pipeline-Token"])
    return app
```

### Multi-Strategy Auth
```python
async def get_current_user(authorization, x_api_key) -> dict:
    # 1. Bearer JWT (Auth0 OIDC) — primary
    # 2. API Key (X-API-Key) — service-to-service
    # 3. Dev mode — when both unconfigured
```

### Tenant Session (RLS)
```python
def get_tenant_session(user: Depends(get_current_user)):
    tenant_id = user.get("tenant_id", "1")
    session = get_session_factory()()
    session.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_id})
    yield session
```

### Dependency Injection
```python
SessionDep = Annotated[Session, Depends(get_tenant_session)]
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]

def get_analytics_service(session: SessionDep) -> AnalyticsService:
    return AnalyticsService(AnalyticsRepository(session), ...)
```

### Redis Cache (Graceful Degradation)
```python
def get_redis_client() -> Redis | None:
    # Lazy singleton, retries every 60s
    # Returns None if unavailable — app continues without cache

@cached(ttl=600, prefix="datapulse:analytics:summary")
def method(self, ...):
    # MD5 hash of params → Redis key, skips `self`
```

## Available Agents
- `/add-docker-service <name> <image> <port>` — Add to 3 compose files + healthcheck + env
- `/coverage-check api` — Check test coverage for API module

## Quick Commands
```bash
docker compose config --quiet       # Validate compose files
docker compose up -d --build        # Start all
docker compose logs -f api          # API logs
make test                           # All tests
make lint                           # Ruff linting
pytest tests/test_auth.py tests/test_jwt*.py -v
```

## Docker Services (9)
| Service | Port | RAM | Purpose |
|---------|------|-----|---------|
| api | 8000 | 512M | FastAPI (4 uvicorn workers) |
| frontend | 3000 | 512M | Next.js (standalone) |
| postgres | 5432 | 2G | PostgreSQL 16 + RLS |
| redis | — | 256M | Cache + Celery broker |
| celery-worker | — | 512M | Async queries (4 concurrency) |
| n8n | 5678 | 512M | Workflow automation |
| app | 8888 | 2G | JupyterLab |
| pgadmin | 5050 | 256M | DB admin |
| prestart | — | — | Run migrations, exit |

## CI Pipeline (6 jobs)
| Job | Blocks PR? | What |
|-----|-----------|------|
| lint | Yes | ruff check + format |
| typecheck | No | mypy (continue-on-error) |
| test | Yes | pytest --cov-fail-under=95 |
| frontend | Yes | npm lint + tsc + build |
| docker-build | Yes | Build api, app, frontend |
| dbt-validate | Yes | dbt parse |

## Integration Points
- **I provide to everyone** → auth, sessions, caching, config, DB connections
- **conftest.py** → my test infrastructure used by all 80 test files
- **Docker** → all 9 services orchestrated by my compose files
- **Frontend proxy** → `INTERNAL_API_URL=http://api:8000` for server-side rewrites

## Rules
- CORS origins: JSON array string in `.env` (`CORS_ORIGINS=["http://localhost:3000"]`)
- Health endpoint: returns 503 when DB unreachable (not 200)
- Rate limiter: disabled in tests via `conftest.py`
- SET LOCAL scope: per-transaction only — never leaks across requests
- Secrets: always via `${VAR:?must be set}` in compose, never hardcoded
- Every new service needs: healthcheck, resource limits, restart policy, named volume
- Coverage: 95%+ enforced — conftest provides mocked repos + test client
