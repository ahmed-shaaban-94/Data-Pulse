# DataPulse — Phase 4: Public Website & Landing Page

> **Goal**: Build a modern, conversion-optimized landing page for DataPulse SaaS platform.
> **Prerequisite**: All Phases 1.x–2.x complete (dashboard, API, pipeline, AI-Light).

---

## Architecture Overview

The current frontend uses a sidebar-based layout for the dashboard. The landing page needs a **completely different layout** (top navbar + footer, no sidebar). We use **Next.js 14 Route Groups** to cleanly separate the two:

```
src/app/
  layout.tsx              # Minimal root: <html>, <body>, metadata, globals.css ONLY
  not-found.tsx           # Shared 404 page
  error.tsx               # Shared error boundary
  (marketing)/            # Public pages — navbar + footer layout
    layout.tsx
    page.tsx              # Landing page (/, the hero + all sections)
    pricing/page.tsx      # Dedicated pricing page (optional)
    privacy/page.tsx      # Privacy policy
    terms/page.tsx        # Terms of service
  (app)/                  # Dashboard — sidebar layout (existing)
    layout.tsx            # Sidebar + Providers + ErrorBoundary
    dashboard/page.tsx
    products/page.tsx
    customers/page.tsx
    staff/page.tsx
    sites/page.tsx
    returns/page.tsx
    pipeline/page.tsx
    insights/page.tsx
```

**Key insight**: Route group names `(marketing)` and `(app)` do NOT appear in URLs. `/dashboard` stays `/dashboard`. Root `/` becomes the landing page instead of redirecting to `/dashboard`.

---

## Phase 4.1 — Project Setup & Landing Hero

**Goal**: Route group restructure + marketing layout shell + hero section.
**Complexity**: L (structural refactor)
**Dependencies**: None (foundation phase)

### Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `src/app/(marketing)/layout.tsx` | Marketing shell: `<Navbar>` + `{children}` + `<Footer>`. No sidebar, no SWR/FilterProvider. |
| 2 | `src/app/(marketing)/page.tsx` | Landing page assembling all sections (Hero + Features + HowItWorks + Stats + Pricing + FAQ + CTA). |
| 3 | `src/app/(app)/layout.tsx` | Dashboard shell: moves Sidebar + Providers + ErrorBoundary from current root layout. |
| 4 | `src/components/marketing/navbar.tsx` | Responsive top nav: logo, links (Features, How It Works, Pricing, FAQ as `#anchors`), CTA button. Mobile hamburger. |
| 5 | `src/components/marketing/footer.tsx` | 4-column footer: Product, Company, Legal, Social. Copyright line. |
| 6 | `src/components/marketing/hero-section.tsx` | Headline + subtitle + 2 CTAs + stylized dashboard mockup (pure CSS, no images). |
| 7 | `src/components/marketing/section-wrapper.tsx` | Reusable section: `id` for anchors, max-width container, padding, optional bg variant. |
| 8 | `src/lib/marketing-constants.ts` | All marketing copy centralized: nav links, footer links, features, pricing, FAQ, stats. |

### Files to Modify

| File | Change |
|------|--------|
| `src/app/layout.tsx` | **Slim down**: remove Sidebar, Providers, ErrorBoundary. Keep only `<html>`, `<body>`, metadata, globals.css. |
| `src/app/page.tsx` | **Delete**: remove redirect to /dashboard. Replaced by `(marketing)/page.tsx`. |
| `tailwind.config.ts` | Add marketing tokens: `accent-glow`, gradient colors, new animations (`glow-pulse`, `float`). |
| `src/app/globals.css` | Add: `scroll-behavior: smooth`, `.gradient-text`, `.glow-card`, `.section-divider`. |
| `src/middleware.ts` | Update CSP `img-src` to allow marketing images (`https:`). |

### Files to Move (content unchanged, path only)

| From | To |
|------|-----|
| `src/app/dashboard/` | `src/app/(app)/dashboard/` |
| `src/app/products/` | `src/app/(app)/products/` |
| `src/app/customers/` | `src/app/(app)/customers/` |
| `src/app/staff/` | `src/app/(app)/staff/` |
| `src/app/sites/` | `src/app/(app)/sites/` |
| `src/app/returns/` | `src/app/(app)/returns/` |
| `src/app/pipeline/` | `src/app/(app)/pipeline/` |
| `src/app/insights/` | `src/app/(app)/insights/` |

### Component Hierarchy

```
(marketing)/layout.tsx
  Navbar
    Logo (Activity icon + "DataPulse")
    NavLinks (#features | #how-it-works | #pricing | #faq)
    CTA Button ("Get Started")
    MobileMenuToggle -> SlideOutMenu
  {children}
    HeroSection
      Headline: "Turn Raw Sales Data into Revenue Intelligence"
      Subtitle
      CTA Primary: "Start Free Trial"
      CTA Secondary: "Watch Demo"
      DashboardMockup (CSS-only fake KPI grid + chart with glow)
  Footer
    4 columns + copyright
```

### Implementation Details

1. **Root layout becomes minimal** — `<html lang="en" className="dark"><body>{children}</body></html>` plus metadata. All provider/sidebar logic moves to `(app)/layout.tsx`.

2. **Navbar scroll behavior** — `"use client"` with scroll listener: apply `backdrop-blur-md bg-page/80` after scrolling 50px. Anchor links use CSS `scroll-behavior: smooth`.

3. **Dashboard mockup** — Pure CSS/Tailwind: dark card with fake KPI boxes, gradient-filled chart area, subtle glow. Zero bytes, more impressive than a screenshot.

4. **Root `/` no longer redirects** — Landing page replaces the redirect. Users go to `/dashboard` via CTA or direct link.

---

## Phase 4.2 — Features & How It Works

**Goal**: Feature showcase grid + pipeline visualization.
**Complexity**: M
**Dependencies**: Phase 4.1

### Files to Create

| # | File | Purpose |
|---|------|---------|
| 9 | `src/components/marketing/features-grid.tsx` | 6 feature cards in responsive grid (1→2→3 cols). `.glow-card` hover effect. |
| 10 | `src/components/marketing/feature-card.tsx` | Single card: lucide icon + title + description. |
| 11 | `src/components/marketing/how-it-works.tsx` | 4-step horizontal pipeline: Import → Clean → Analyze → Visualize. Gradient connecting line. |
| 12 | `src/components/marketing/pipeline-step.tsx` | Single step: numbered circle + icon + label + description. |
| 13 | `src/hooks/use-intersection-observer.ts` | Custom hook for scroll-triggered animations. Returns `ref` + `isVisible`. `once: true` option. |

### Files to Modify

| File | Change |
|------|--------|
| `src/app/(marketing)/page.tsx` | Add `<FeaturesGrid>` + `<HowItWorks>` sections. |
| `src/lib/marketing-constants.ts` | Add `FEATURES` (6 items) + `PIPELINE_STEPS` (4 items). |
| `src/app/globals.css` | Add `.animate-on-scroll` with opacity/transform transition. |

### Feature Cards Content

| Icon | Title | Description |
|------|-------|-------------|
| FileUp | Upload & Import | Import Excel and CSV files with automatic schema detection |
| Sparkles | Data Cleaning | Automated deduplication, normalization, and validation |
| ShieldCheck | Quality Gates | 7 automated quality checks ensure data integrity |
| BarChart3 | Real-time Analytics | Interactive dashboards with KPIs, trends, and rankings |
| Brain | AI Insights | AI-powered anomaly detection and narrative summaries |
| GitBranch | Pipeline Automation | File watcher auto-triggers the full data pipeline |

### Pipeline Steps

```
[1. Import] ---→ [2. Clean] ---→ [3. Analyze] ---→ [4. Visualize]
  FileUp         Sparkles        BarChart3         Monitor
  Bronze          Silver           Gold            Dashboard
```

- Connected by gradient line (teal→blue) via CSS `::after` pseudo-element
- Vertical layout on mobile, horizontal on desktop

---

## Phase 4.3 — Social Proof & Pricing

**Goal**: Stats banner, pricing tiers, FAQ, tech badges.
**Complexity**: M
**Dependencies**: Phase 4.2 (uses intersection observer hook)

### Files to Create

| # | File | Purpose |
|---|------|---------|
| 14 | `src/components/marketing/stats-banner.tsx` | 4 animated stats with count-up on scroll. Full-width gradient bg. |
| 15 | `src/components/marketing/pricing-section.tsx` | 3 pricing cards. Middle card (Pro) highlighted with accent border + "Popular" badge. |
| 16 | `src/components/marketing/pricing-card.tsx` | Single card: tier, price, features list, CTA. `isPopular` prop for emphasis. |
| 17 | `src/components/marketing/faq-section.tsx` | Accordion FAQ list. Single-item-open behavior. |
| 18 | `src/components/marketing/faq-item.tsx` | Single FAQ item: question + collapsible answer. ChevronDown rotates on open. |
| 19 | `src/components/marketing/tech-badges.tsx` | Pill-shaped badges for tech stack: Next.js, PostgreSQL, dbt, Polars, FastAPI, Docker. Text-only, no images. |

### Files to Modify

| File | Change |
|------|--------|
| `src/app/(marketing)/page.tsx` | Add Stats, Pricing, FAQ, TechBadges sections. |
| `src/lib/marketing-constants.ts` | Add `STATS`, `PRICING_TIERS`, `FAQ_ITEMS`. |

### Stats

| Stat | Value |
|------|-------|
| Rows Processed | 2.2M+ |
| Data Quality Score | 99.5% |
| Speed vs Pandas | 10x Faster |
| API Endpoints | 25+ |

### Pricing Tiers

| Tier | Price | Highlights |
|------|-------|-----------|
| **Starter** | $0/mo | 1 data source, 10K rows, basic dashboard, community support |
| **Pro** *(Popular)* | $49/mo | 5 sources, 1M rows, AI insights, pipeline automation, priority support |
| **Enterprise** | Custom | Unlimited everything, SSO, dedicated support, custom integrations |

### FAQ Items (6-8 questions)

- What data formats does DataPulse support?
- How does the medallion architecture work?
- What quality checks are included?
- Can I use my own AI/LLM provider?
- Is my data secure?
- How long does setup take?
- What's included in the free tier?
- Do you offer custom integrations?

---

## Phase 4.4 — Auth & Waitlist

**Goal**: Email collection, API endpoint, legal pages.
**Complexity**: M
**Dependencies**: Phase 4.1 (footer links)

### Files to Create

| # | File | Purpose |
|---|------|---------|
| 20 | `src/components/marketing/waitlist-form.tsx` | `"use client"`: email input + submit. States: idle → loading → success → error. |
| 21 | `src/components/marketing/cta-section.tsx` | Full-width CTA band: "Ready to transform your sales data?" + waitlist form. |
| 22 | `src/app/(marketing)/privacy/page.tsx` | Privacy policy (static TSX content). |
| 23 | `src/app/(marketing)/terms/page.tsx` | Terms of service (static TSX content). |
| 24 | `src/app/api/waitlist/route.ts` | Next.js Route Handler: POST `{ email }` → validate → store → respond. |

### Files to Modify

| File | Change |
|------|--------|
| `src/app/(marketing)/page.tsx` | Add `<CTASection>` before footer. |
| `src/components/marketing/footer.tsx` | Add `/privacy` and `/terms` links. |

### Waitlist API

```
POST /api/waitlist
Body: { "email": "user@example.com" }
Response: { "success": true, "message": "You're on the list!" }
```

**MVP approach**: Next.js Route Handler writes to `waitlist.json` file (simple, works in Docker standalone). Production would migrate to proper database.

**Form UX**:
- Loading: Loader2 icon with `animate-spin`
- Success: Checkmark + "You're on the list!" message
- Error: Red error message + retry
- Client-side email validation + server-side re-validation
- Rate limiting (in-memory IP counter)

---

## Phase 4.5 — SEO, Performance & Analytics

**Goal**: Search engine optimization, structured data, performance.
**Complexity**: S
**Dependencies**: Phase 4.1 + Phase 4.3 (FAQ data for JSON-LD)

### Files to Create

| # | File | Purpose |
|---|------|---------|
| 25 | `src/app/(marketing)/metadata.ts` | Shared marketing metadata constants (site name, base URL, OG defaults). |
| 26 | `src/app/sitemap.ts` | Next.js sitemap convention: `/`, `/pricing`, `/privacy`, `/terms`. |
| 27 | `src/app/robots.ts` | Allow crawlers for marketing pages, disallow `/dashboard`, `/api/`. |
| 28 | `src/components/marketing/json-ld.tsx` | Server component: `<script type="application/ld+json">` for Organization, WebSite, FAQPage. |
| 29 | `src/app/opengraph-image.tsx` | Next.js OG image generation via `ImageResponse` (dynamic, no static file). |

### Files to Modify

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Add `metadataBase`, `openGraph` defaults, `twitter` card, `icons`. |
| `src/app/(marketing)/page.tsx` | Export page-specific `metadata` + add `<JsonLd>` component. |
| `next.config.mjs` | Add `images` config, `headers()` for cache-control. |

### Robots Configuration

```
Allow: /
Allow: /pricing
Allow: /privacy
Allow: /terms
Disallow: /dashboard
Disallow: /products
Disallow: /customers
Disallow: /staff
Disallow: /sites
Disallow: /returns
Disallow: /pipeline
Disallow: /insights
Disallow: /api/
```

### JSON-LD Schemas

- **Organization**: name, url, logo, description
- **WebSite**: name, url, searchAction (optional)
- **FAQPage**: from `FAQ_ITEMS` constant (rich snippets in Google)

### Performance Notes

- Marketing pages are **Server Components** by default → zero client JS for static content
- Only `"use client"` for: navbar mobile toggle, FAQ accordion, waitlist form
- System fonts already in use → zero font loading latency
- No images needed (CSS mockups, text badges) → minimal asset weight

---

## Phase 4.6 — Polish, Testing & Deploy

**Goal**: Accessibility, responsiveness, E2E tests, final QA.
**Complexity**: M
**Dependencies**: All previous phases

### Files to Create

| # | File | Purpose |
|---|------|---------|
| 30 | `e2e/marketing.spec.ts` | 12-15 E2E specs: hero renders, nav scrolls, pricing cards, FAQ expands, waitlist submits, mobile nav, legal pages. |
| 31 | `e2e/marketing-seo.spec.ts` | SEO specs: meta tags, OG tags, JSON-LD present, canonical URL, no `noindex` on public pages. |

### Files to Modify

| File | Change |
|------|--------|
| `e2e/navigation.spec.ts` | Update: root `/` now shows landing page (not redirect). |
| `e2e/pages.spec.ts` | Verify dashboard pages still work under `(app)/`. |
| `src/components/marketing/navbar.tsx` | Add `aria-*` attributes, keyboard nav, focus trap for mobile menu. |
| `src/components/marketing/faq-item.tsx` | Add `aria-expanded`, `aria-controls`, keyboard Enter/Space toggle. |
| `src/components/marketing/waitlist-form.tsx` | Add `aria-live="polite"`, proper `<label>`, focus management. |
| `playwright.config.ts` | Add mobile viewport project: `devices['iPhone 13']`. |
| `src/app/globals.css` | Add `@media (prefers-reduced-motion: reduce)` to disable animations. |

### E2E Test Specs

```
marketing.spec.ts:
  - "hero section renders with headline and CTA"
  - "navbar links scroll to correct sections"
  - "mobile menu opens and closes"
  - "features grid shows 6 cards"
  - "how it works shows 4 steps"
  - "pricing cards show 3 tiers"
  - "FAQ accordion expands on click"
  - "waitlist form validates email"
  - "waitlist form submits successfully"
  - "privacy page loads"
  - "terms page loads"
  - "footer links are present"

marketing-seo.spec.ts:
  - "meta title and description present"
  - "Open Graph tags present"
  - "JSON-LD script tag present"
  - "canonical URL set"
  - "robots meta allows indexing"
```

### Accessibility Checklist

- [ ] All interactive elements keyboard-accessible
- [ ] Color contrast WCAG AA (current: 13.5:1 — well above 4.5:1)
- [ ] `aria-label` on icon-only buttons
- [ ] Skip-to-content link at top of marketing layout
- [ ] Single `<h1>` per page, proper heading hierarchy
- [ ] `prefers-reduced-motion` media query
- [ ] Focus visible styles on all interactive elements

### Responsive Breakpoints

| Component | Mobile | md (768px) | lg (1024px) |
|-----------|--------|------------|-------------|
| Navbar | Hamburger menu | Hamburger menu | Horizontal links |
| Hero CTAs | Stacked | Side by side | Side by side |
| Features | 1 column | 2 columns | 3 columns |
| Pipeline | Vertical | Horizontal | Horizontal |
| Pricing | 1 column | 1 column | 3 columns |
| Footer | 2x2 grid | 4 columns | 4 columns |

---

## Dependency Graph

```
Phase 4.1 (Setup + Hero)
    |
    +-----> Phase 4.2 (Features + How It Works)
    |           |
    |           +-----> Phase 4.3 (Social Proof + Pricing)
    |                       |
    |                       +-----> Phase 4.5 (SEO) [needs FAQ from 4.3]
    |
    +-----> Phase 4.4 (Auth + Waitlist) [parallel with 4.2/4.3]
    |
    +-----> Phase 4.6 (Polish + Testing) [after all content phases]
```

> **Parallelizable**: Phases 4.2 and 4.4 can run in parallel after 4.1.

---

## Complete File Inventory (31 new files)

| # | File | Phase | Type |
|---|------|-------|------|
| 1 | `src/app/(marketing)/layout.tsx` | 4.1 | Create |
| 2 | `src/app/(marketing)/page.tsx` | 4.1 | Create |
| 3 | `src/app/(app)/layout.tsx` | 4.1 | Create |
| 4 | `src/components/marketing/navbar.tsx` | 4.1 | Create |
| 5 | `src/components/marketing/footer.tsx` | 4.1 | Create |
| 6 | `src/components/marketing/hero-section.tsx` | 4.1 | Create |
| 7 | `src/components/marketing/section-wrapper.tsx` | 4.1 | Create |
| 8 | `src/lib/marketing-constants.ts` | 4.1 | Create |
| 9 | `src/components/marketing/features-grid.tsx` | 4.2 | Create |
| 10 | `src/components/marketing/feature-card.tsx` | 4.2 | Create |
| 11 | `src/components/marketing/how-it-works.tsx` | 4.2 | Create |
| 12 | `src/components/marketing/pipeline-step.tsx` | 4.2 | Create |
| 13 | `src/hooks/use-intersection-observer.ts` | 4.2 | Create |
| 14 | `src/components/marketing/stats-banner.tsx` | 4.3 | Create |
| 15 | `src/components/marketing/pricing-section.tsx` | 4.3 | Create |
| 16 | `src/components/marketing/pricing-card.tsx` | 4.3 | Create |
| 17 | `src/components/marketing/faq-section.tsx` | 4.3 | Create |
| 18 | `src/components/marketing/faq-item.tsx` | 4.3 | Create |
| 19 | `src/components/marketing/tech-badges.tsx` | 4.3 | Create |
| 20 | `src/components/marketing/waitlist-form.tsx` | 4.4 | Create |
| 21 | `src/components/marketing/cta-section.tsx` | 4.4 | Create |
| 22 | `src/app/(marketing)/privacy/page.tsx` | 4.4 | Create |
| 23 | `src/app/(marketing)/terms/page.tsx` | 4.4 | Create |
| 24 | `src/app/api/waitlist/route.ts` | 4.4 | Create |
| 25 | `src/app/(marketing)/metadata.ts` | 4.5 | Create |
| 26 | `src/app/sitemap.ts` | 4.5 | Create |
| 27 | `src/app/robots.ts` | 4.5 | Create |
| 28 | `src/components/marketing/json-ld.tsx` | 4.5 | Create |
| 29 | `src/app/opengraph-image.tsx` | 4.5 | Create |
| 30 | `e2e/marketing.spec.ts` | 4.6 | Create |
| 31 | `e2e/marketing-seo.spec.ts` | 4.6 | Create |

### Files to Modify (across all phases)

| File | Phases |
|------|--------|
| `src/app/layout.tsx` | 4.1, 4.5 |
| `src/app/page.tsx` | 4.1 (delete) |
| `tailwind.config.ts` | 4.1 |
| `src/app/globals.css` | 4.1, 4.2, 4.6 |
| `src/middleware.ts` | 4.1 |
| `next.config.mjs` | 4.5 |
| `e2e/navigation.spec.ts` | 4.6 |
| `e2e/pages.spec.ts` | 4.6 |
| `playwright.config.ts` | 4.6 |

### Dashboard Files to Move (8 directories)

All existing dashboard routes move from `src/app/<route>/` to `src/app/(app)/<route>/` — file contents unchanged.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Route group restructure breaks existing URLs | High | URLs don't change (group names invisible). E2E tests verify. |
| Sidebar appears on marketing pages | Medium | Sidebar moves to `(app)/layout.tsx` only. |
| SWR/FilterProvider errors on marketing pages | Medium | Providers move to `(app)/layout.tsx` only. |
| Docker build breaks | Low | `output: "standalone"` is route-group agnostic. No Docker changes. |
| Landing page conflicts with `/` redirect | Low | Old `page.tsx` redirect deleted, replaced by landing page. |

---

## Design Principles

1. **Zero images** — All visuals built with CSS (mockups, gradients, glows). No assets in `public/`.
2. **Server-first** — Marketing pages are Server Components by default. `"use client"` only for interactivity.
3. **Copy centralized** — All marketing text in `marketing-constants.ts`. Easy to update.
4. **Same design system** — Extends existing midnight-pharma tokens. Consistent brand.
5. **Mobile-first** — All components designed mobile-first, enhanced at breakpoints.
6. **Accessible** — WCAG AA, keyboard nav, reduced motion, proper ARIA.
