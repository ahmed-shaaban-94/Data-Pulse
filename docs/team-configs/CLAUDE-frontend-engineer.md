# DataPulse — Frontend Dashboard Engineer

## My Role
I own the entire Next.js frontend: 26 pages, 87 components, 40 SWR hooks, state management, Recharts visualizations, Tailwind theming, and API client.

## Project Context
DataPulse is a multi-tenant pharma sales analytics SaaS. The frontend consumes 84 FastAPI endpoints via SWR hooks and displays interactive dashboards with charts, tables, and filters.

**Stack**: Next.js 14.2.35, TypeScript 5.9.3, Tailwind CSS 3.4.17, SWR 2.3.3, Recharts 2.15.3, NextAuth 4.24.13, react-day-picker 9.14.0, Radix UI, next-themes.

## My Files & Directories

### Primary Ownership
- `frontend/src/app/(app)/` — 19 authenticated pages (dashboard, products, customers, staff, sites, returns, explore, insights, pipeline, sql-lab, reports, alerts, goals)
- `frontend/src/app/(marketing)/` — Shared with QA (landing, terms, privacy)
- `frontend/src/components/` — 87 components (ui, layout, dashboard, shared, filters, features, marketing)
- `frontend/src/hooks/` — 40 SWR hooks
- `frontend/src/contexts/` — FilterContext (URL state) + DashboardDataContext
- `frontend/src/lib/` — api-client, formatters, date-utils, constants, swr-config, utils
- `frontend/src/types/` — api.ts, filters.ts (must match backend Pydantic models)
- `frontend/src/middleware.ts` — Route protection + security headers
- `frontend/src/lib/auth.ts` — NextAuth + Auth0 config
- `frontend/tailwind.config.ts`, `frontend/src/app/globals.css`

## Key Patterns

### SWR Hook (standard for all 40 hooks)
```typescript
export function useSummary() {
  const { filters } = useFilters();
  return useSWR<KPISummary>(
    swrKey('/api/v1/analytics/summary', filters),
    fetchAPI
  );
}
```

### Filter Context (URL-driven state)
```typescript
// Filters stored in URL params — bookmarkable, shareable
const filters = {
  start_date: searchParams.get('start_date') ?? undefined,
  end_date: searchParams.get('end_date') ?? undefined,
  category, brand, site_key, staff_key, limit
};
const updateFilter = (key, value) => {
  const params = new URLSearchParams(searchParams);
  value === undefined ? params.delete(key) : params.set(key, String(value));
  router.push(`?${params}`);
};
```

### Dashboard Data Context (prevents N+1 API calls)
```typescript
// Single GET /api/v1/analytics/dashboard → shared across 12+ components
<DashboardDataProvider>  {/* one API call */}
  <KPIGrid />             {/* reads from context */}
  <DailyTrendChart />     {/* reads from context */}
  <MonthlyTrendChart />   {/* reads from context */}
</DashboardDataProvider>
```

### Component Pattern (Loading/Error/Empty)
```typescript
export function ProductOverview() {
  const { data, error, isLoading, mutate } = useTopProducts();
  if (isLoading) return <LoadingCard />;
  if (error) return <ErrorRetry onRetry={() => mutate()} />;
  if (!data?.items?.length) return <EmptyState message="No data" />;
  return <ChartCard title="Top Products"><RankingTable items={data.items} /></ChartCard>;
}
```

### Code Splitting
```typescript
import { KPIGrid } from '@/components/dashboard/kpi-grid';  // Above fold: eager
const CalendarHeatmap = dynamic(                              // Below fold: lazy
  () => import('@/components/dashboard/calendar-heatmap'),
  { loading: () => <LoadingCard /> }
);
```

### Chart Theme (dark/light)
```typescript
const theme = useChartTheme();
// Always use theme.colors.blue, theme.grid, theme.text — never hardcode
<Area stroke={theme.colors.blue} fill={theme.colors.blue} fillOpacity={0.1} />
```

### Formatters
```typescript
formatCurrency(value)  // EGP 1,234,567
formatCompact(value)   // 1.2M
formatPercent(value)   // +12.3%
```

## Available Agents
- `/add-page <name> <desc>` — Page + loading + hook + component + sidebar nav
- `/add-chart <type> <name> <desc>` — Recharts component + theme + ChartCard

## Quick Commands
```bash
cd frontend && npm run dev          # Dev server
cd frontend && npx tsc --noEmit     # Type check
cd frontend && npm run lint         # ESLint
cd frontend && npm run build        # Production build
```

## API Client
```typescript
// lib/api-client.ts
fetchAPI<T>(url)           // GET with Bearer token + 15s timeout + Decimal parsing
postAPI<T>(path, body)     // POST with JSON body
swrKey(path, params)       // Stable cache key (sorted params)
```
- Auth: NextAuth session (primary) → localStorage (fallback)
- Decimal: `parseDecimals()` prevents JavaScript precision loss
- Proxy: Next.js rewrites `/api/v1/*` to `INTERNAL_API_URL` (server-side)

## Integration Points
- **I consume** → Analytics Engineer's 84 API endpoints (JSON)
- **Auth** → Platform Engineer's Auth0 config
- **Types** → `types/api.ts` must match backend Pydantic models
- **Filters** → URL params → SWR keys → API query params → SQL WHERE

## Rules
- Always use `useChartTheme()` for chart colors — never hardcode
- Always handle 3 states: loading, error, empty
- SWR key must include ALL relevant filter params
- `"use client"` directive required for components using hooks
- Dynamic imports for below-fold heavy components
- Theme: CSS variables in globals.css, not Tailwind color classes
- Sidebar nav items in `lib/constants.ts`
- Print styles: `@media print` in globals.css, `print:hidden` class
