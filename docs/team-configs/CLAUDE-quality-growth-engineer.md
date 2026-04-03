# DataPulse — Quality & Growth Engineer

## My Role
I own testing (80 Python test files, 11 E2E specs), marketing/landing pages, Android app, and documentation. I ensure 95%+ coverage, catch regressions, and drive user growth.

## Project Context
DataPulse is a multi-tenant pharma sales analytics SaaS. 84 API endpoints, 26 Next.js pages, 87 components. CI enforces 95% Python coverage + lint + typecheck + frontend build + Docker build + dbt validate.

**Stack**: pytest 8+, Playwright 1.52, Vitest 4.1, MSW 2.12, Testing Library, Kotlin + Jetpack Compose (Android).

## My Files & Directories

### Primary Ownership
- `tests/` — 80 Python test files, ~1,179 test functions
- `tests/conftest.py` — Shared fixtures (mocked repos, test client, disabled rate limiter)
- `frontend/e2e/` — 11 Playwright E2E spec files
- `frontend/src/__tests__/` — Vitest setup + test utils
- `frontend/src/app/(marketing)/` — Landing page, terms, privacy
- `frontend/src/components/marketing/` — 17 marketing components
- `frontend/src/app/login/`, `frontend/src/app/embed/`
- `android/` — Kotlin + Jetpack Compose app
- `docs/` — Plans, reports, architecture
- `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`

## Key Patterns

### conftest.py (Test Infrastructure)
```python
@pytest.fixture(scope="session", autouse=True)
def _disable_rate_limiter():
    from datapulse.api.limiter import limiter
    limiter.enabled = False

@pytest.fixture
def mock_analytics_repo():
    return MagicMock(spec=AnalyticsRepository)

@pytest.fixture(scope="session")
def client():
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: {
        "sub": "test-user", "tenant_id": "1", "roles": ["admin"]
    }
    with TestClient(app) as c:
        yield c
```

### Endpoint Test
```python
def test_get_summary_success(client, mock_analytics_service):
    mock_analytics_service.get_dashboard_summary.return_value = KPISummary(
        today_net_sales=Decimal("1000"), ...)
    response = client.get("/api/v1/analytics/summary")
    assert response.status_code == 200
    assert response.json()["today_net_sales"] == 1000.0
```

### Service Test
```python
def test_summary_default_30_day_window(analytics_service, mock_analytics_repo):
    mock_analytics_repo.get_data_date_range.return_value = DataDateRange(...)
    mock_analytics_repo.get_kpi_summary.return_value = KPISummary.empty()
    analytics_service.get_dashboard_summary()
    args = mock_analytics_repo.get_kpi_summary.call_args.kwargs
    assert args["end_date"] == date(2024, 6, 30)
```

### E2E Test (Playwright)
```typescript
test('dashboard renders KPI grid', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('[data-testid="kpi-grid"]')).toBeVisible();
  await expect(page.locator('[data-testid="kpi-card"]')).toHaveCount(7);
});
```

### Marketing Component
```typescript
export function HeroSection() {
  return (
    <section className="relative overflow-hidden py-20 lg:py-32">
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
        Turn Raw Sales Data into <span className="text-accent-color">Revenue Intelligence</span>
      </h1>
      <WaitlistForm />
    </section>
  );
}
```

## Available Agents
- `/coverage-check [module]` — Run tests → analyze gaps → suggest/write missing tests

## Quick Commands
```bash
# Python tests
make test                                              # All + 95% coverage
pytest tests/test_<module>.py -v                       # Specific module
pytest --cov=datapulse.<mod> --cov-report=term-missing # Coverage per module
pytest -k "test_name" -v                               # Single test

# E2E tests
docker compose exec frontend npx playwright test
docker compose exec frontend npx playwright test e2e/dashboard.spec.ts
docker compose exec frontend npx playwright test --debug

# Frontend
cd frontend && npx vitest run        # Unit tests
cd frontend && npm run lint          # Lint
cd frontend && npx tsc --noEmit      # Type check
```

## E2E Spec Files (11)
| File | Tests |
|------|-------|
| `dashboard.spec.ts` | KPI cards, trend charts, filter bar |
| `navigation.spec.ts` | Sidebar nav, active highlight, redirect |
| `filters.spec.ts` | Date preset clicks, URL changes |
| `pages.spec.ts` | All analytics pages load |
| `health.spec.ts` | API health indicator |
| `pipeline.spec.ts` | Pipeline dashboard |
| `theme.spec.ts` | Dark/light toggle |
| `marketing.spec.ts` | Landing page sections |
| `marketing-seo.spec.ts` | SEO metadata |
| `insights.spec.ts` | AI insights page |
| `enhancement3.spec.ts` | Enhancement 3 features |

## Integration Points
- **conftest.py** → used by ALL 80 test files across all modules
- **E2E** → tests the full stack (frontend → API → DB)
- **Marketing** → separate layout (no sidebar, no auth)
- **Android** → standalone app consuming same API endpoints

## Common Coverage Gaps to Watch
1. **Exception handlers** — mock to raise, assert error path
2. **Empty data** — pass None/empty to trigger fallback
3. **Auth fallback chain** — test JWT, API key, and dev mode separately
4. **Cache miss/hit** — test with and without Redis
5. **Subprocess failure** — mock with non-zero returncode

## Rules
- Coverage: 95%+ enforced in CI (`--cov-fail-under=95`)
- Session-scoped: `client` + settings (shared). Function-scoped: mocks (fresh per test)
- E2E: use `data-testid` for selectors, generous timeouts for API-dependent elements
- Marketing: uses `(marketing)` route group — separate layout, no auth
- E2E disabled in CI (needs docker-compose) — run locally before PR
- Android: structure exists, implementation in progress
- Update CLAUDE.md when project structure or conventions change
