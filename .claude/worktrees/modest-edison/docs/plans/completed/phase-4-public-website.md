# Phase 4: Public Website & Marketing (COMPLETED)

**Status**: DONE
**Completed**: All 6 sub-phases delivered

## Overview

Phase 4 delivers a public-facing marketing website within the existing Next.js 14 frontend. The implementation uses a route group restructure to separate marketing pages from the authenticated app, with zero new dependencies and zero image assets.

The frontend was restructured into two route groups:

| Route Group | Purpose | Layout |
|-------------|---------|--------|
| `(marketing)` | Public pages — landing, pricing, legal | Navbar + Footer |
| `(app)` | Authenticated dashboard pages | Sidebar + Header |

### Key Constraints

- **Zero new dependencies** — everything built with Next.js 14, Tailwind CSS, and native browser APIs
- **Zero images** — all visuals are CSS-only (dashboard mockup, pipeline diagram, icons)
- **Dark/light mode** — inherits the existing `next-themes` setup
- **Accessible** — skip-to-content link, ARIA attributes, keyboard navigation, reduced motion support

### Deliverables Summary

- Route group restructure with marketing and app layouts
- Hero section with CSS-only dashboard mockup
- Features grid (6 cards) and pipeline visualization (4 steps)
- Stats banner with animated count-up
- 3 pricing cards and FAQ accordion (8 questions)
- Tech badges section
- Waitlist form with API route
- Privacy policy and terms of service pages
- CTA section
- Full SEO: meta tags, Open Graph, Twitter cards, JSON-LD, sitemap.xml, robots.txt, OG image generation
- 18 E2E tests
- Accessibility: skip-to-content, ARIA, keyboard nav, reduced motion

---

## 4.1 — Setup and Hero Section (DONE)

### Objective

Restructure the Next.js routing to support both public marketing pages and the authenticated dashboard, then build the hero section as the landing page centrepiece.

### Route Group Restructure

- [x] Create `(marketing)` route group for public pages
- [x] Create `(app)` route group for authenticated dashboard pages
- [x] Move existing dashboard routes (`/dashboard`, `/products`, `/customers`, `/staff`, `/sites`, `/returns`, `/pipeline`) into `(app)`
- [x] Create marketing layout with navbar and footer components
- [x] Preserve existing app layout (sidebar + header) for `(app)` routes
- [x] Ensure root `/` renders the marketing landing page

### Marketing Layout

- [x] **Navbar** — logo, navigation links (Features, Pricing, FAQ), CTA button, mobile hamburger menu
- [x] **Footer** — logo, link columns, copyright, legal links
- [x] Responsive design across all breakpoints
- [x] Dark/light mode compatibility via existing `next-themes` setup

### Hero Section

- [x] Headline and subheadline copy
- [x] Primary CTA button (links to waitlist/signup)
- [x] Secondary CTA button (links to features section)
- [x] **CSS-only dashboard mockup** — a visual representation of the analytics dashboard built entirely with Tailwind CSS utility classes, no images or SVGs
- [x] Responsive: mockup hidden or simplified on mobile
- [x] Smooth scroll to sections via anchor links

### File Structure

```
frontend/src/app/
├── (marketing)/
│   ├── layout.tsx           # Navbar + Footer wrapper
│   ├── page.tsx             # Landing page (hero + sections)
│   └── ...
├── (app)/
│   ├── layout.tsx           # Existing sidebar layout
│   ├── dashboard/
│   ├── products/
│   └── ...
└── layout.tsx               # Root layout (providers, fonts)
```

### Key Components

```
frontend/src/components/marketing/
├── navbar.tsx
├── footer.tsx
├── hero-section.tsx
└── dashboard-mockup.tsx   # CSS-only dashboard visual
```

### Design Notes

- The CSS-only dashboard mockup uses Tailwind utilities to render a simplified version of the analytics dashboard: KPI cards, chart shapes, sidebar skeleton
- No `<img>` tags, no SVG files, no external assets
- Animations use `@keyframes` defined in `globals.css` or Tailwind `animate-*` classes
- All animations respect `prefers-reduced-motion`

---

## 4.2 — Features and Pipeline Visualization (DONE)

### Objective

Build the features grid and pipeline visualization sections to communicate the product's capabilities and data flow architecture.

### Features Grid

- [x] 6 feature cards in a responsive grid (1 col mobile, 2 col tablet, 3 col desktop)
- [x] Each card: icon (CSS/emoji), title, description
- [x] Cards cover: data import, automated cleaning, analytics, dashboards, quality gates, security
- [x] Hover effects and dark/light mode styling
- [x] Accessible card markup with appropriate heading levels

### Pipeline Visualization

- [x] 4-step horizontal pipeline diagram: Import -> Clean -> Analyze -> Visualize
- [x] CSS-only connectors between steps (lines/arrows, no images)
- [x] Each step: icon, label, brief description
- [x] Responsive: stacks vertically on mobile
- [x] Colour-coded steps matching the medallion architecture (bronze/silver/gold)

### Stats Banner

- [x] Animated count-up numbers (pure CSS or minimal JS, no dependencies)
- [x] Key metrics displayed: rows processed, tables, quality checks, uptime
- [x] Numbers animate on scroll into viewport (Intersection Observer)
- [x] Respects `prefers-reduced-motion` — shows final values instantly

### Tech Badges

- [x] Grid of technology badges showing the stack
- [x] Text-only badges styled with Tailwind (no logos/images)
- [x] Categories: data processing, database, frontend, infrastructure

### Key Components

```
frontend/src/components/marketing/
├── features-section.tsx       # 6-card grid
├── pipeline-section.tsx       # 4-step visualization
├── stats-banner.tsx           # Animated count-up
└── tech-badges.tsx            # Technology stack badges
```

### Design Notes

- Pipeline steps use the project's medallion colour scheme: Bronze (#CD7F32), Silver (#C0C0C0), Gold (#FFD700), adapted for dark/light modes
- Count-up animation uses `requestAnimationFrame` or CSS counters — no external animation libraries
- All sections use `id` attributes for anchor-link navigation from the navbar

---

## 4.3 — Pricing and FAQ (DONE)

### Objective

Build the pricing cards and FAQ accordion sections for the landing page.

### Pricing Cards

- [x] 3 pricing tiers displayed as cards (Starter, Professional, Enterprise)
- [x] Each card: tier name, price, feature list, CTA button
- [x] "Popular" or "Recommended" badge on the middle tier
- [x] Responsive: stack on mobile, side-by-side on desktop
- [x] Hover/focus effects on cards and buttons
- [x] Dark/light mode styling

### FAQ Accordion

- [x] 8 questions covering common concerns (data security, import formats, pricing, setup, etc.)
- [x] Native `<details>` / `<summary>` or custom accordion with keyboard support
- [x] Smooth expand/collapse animation
- [x] Accessible: proper ARIA roles, keyboard navigation (Enter/Space to toggle)

### CTA Section

- [x] Full-width call-to-action banner between sections or at page bottom
- [x] Compelling copy with primary action button
- [x] Gradient or accent background that works in both themes

### Key Components

```
frontend/src/components/marketing/
├── pricing-section.tsx        # 3 pricing cards
├── faq-section.tsx            # 8-question accordion
└── cta-section.tsx            # Call-to-action banner
```

### Design Notes

- Pricing values are hardcoded (no API) — this is a marketing page
- FAQ content is stored as a typed array in the component, not fetched
- Accordion uses `aria-expanded`, `aria-controls`, and `role="region"` for screen readers
- All interactive elements have visible focus indicators

---

## 4.4 — Auth Pages and Waitlist (DONE)

### Objective

Build the waitlist signup form with an API route, and add legal pages (privacy policy, terms of service).

### Waitlist Form

- [x] Email input with validation (HTML5 + client-side)
- [x] Submit button with loading state
- [x] Success/error feedback messages
- [x] API route to handle submissions (`/api/waitlist`)
- [x] Server-side validation of email format
- [x] Rate limiting or basic spam protection
- [x] Accessible form: labels, error announcements, focus management

### API Route

- [x] `POST /api/waitlist` Next.js API route
- [x] Validates email format server-side
- [x] Returns appropriate status codes (200 success, 400 validation error, 429 rate limit)
- [x] Stores submissions (in-memory, file, or database — implementation detail)

### Legal Pages

- [x] `/privacy` — Privacy policy page
- [x] `/terms` — Terms of service page
- [x] Static content rendered with consistent marketing layout
- [x] Linked from the footer

### File Structure

```
frontend/src/app/
├── (marketing)/
│   ├── privacy/
│   │   └── page.tsx
│   └── terms/
│       └── page.tsx
└── api/
    └── waitlist/
        └── route.ts           # POST handler
```

### Key Components

```
frontend/src/components/marketing/
└── waitlist-form.tsx          # Email form with validation
```

### Design Notes

- The waitlist form is embedded in the landing page (hero or CTA section), not a separate page
- Legal pages use prose-friendly typography (Tailwind `prose` class or equivalent)
- No third-party form services — the API route is self-contained within Next.js

---

## 4.5 — SEO and Performance (DONE)

### Objective

Implement comprehensive SEO and ensure optimal performance scores for the public website.

### Meta Tags

- [x] Page-level `<title>` and `<meta name="description">` via Next.js `metadata` export
- [x] Open Graph tags: `og:title`, `og:description`, `og:image`, `og:url`, `og:type`
- [x] Twitter Card tags: `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- [x] Canonical URLs

### Structured Data

- [x] JSON-LD schema markup on the landing page
- [x] Schema types: `SoftwareApplication`, `Organization`, or `WebSite` as appropriate
- [x] Rendered via `<script type="application/ld+json">` in the page head

### Crawlability

- [x] `sitemap.xml` — generated or static, listing all public routes
- [x] `robots.txt` — allows crawling of marketing pages, disallows app routes
- [x] Both served from the public root

### OG Image Generation

- [x] Dynamic OG image generation using Next.js `ImageResponse` API (or static fallback)
- [x] Branded image with title text, no external image dependencies
- [x] Served at the OG image URL referenced in meta tags

### Performance

- [x] Zero new dependencies added to the bundle
- [x] CSS-only visuals (no image downloads, no icon fonts)
- [x] Minimal client-side JavaScript on marketing pages
- [x] Server-side rendering for all marketing content

### File Structure

```
frontend/src/app/
├── sitemap.ts                 # Dynamic sitemap generation
├── robots.ts                  # Robots.txt generation
├── opengraph-image.tsx        # OG image generation (or static in public/)
└── (marketing)/
    └── page.tsx               # metadata export with OG/Twitter tags
```

### Performance Targets

| Metric | Target |
|--------|--------|
| Lighthouse Performance | 95+ |
| Lighthouse SEO | 100 |
| Lighthouse Accessibility | 95+ |
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Cumulative Layout Shift | < 0.1 |

### Design Notes

- Next.js 14 `metadata` API is used (not `<Head>` from `next/head`)
- Sitemap includes: `/`, `/privacy`, `/terms`; excludes all `(app)` routes
- robots.txt disallows `/dashboard`, `/products`, `/customers`, `/staff`, `/sites`, `/returns`, `/pipeline`

---

## 4.6 — Polish and Testing (DONE)

### Objective

Final polish, accessibility audit, and comprehensive E2E test coverage for the public website.

### Accessibility

- [x] **Skip-to-content link** — visible on focus, jumps to `#main-content`
- [x] **ARIA attributes** — landmarks (`nav`, `main`, `footer`), labels on interactive elements, live regions for form feedback
- [x] **Keyboard navigation** — all interactive elements reachable via Tab, accordion operable with Enter/Space, Escape closes mobile menu
- [x] **Reduced motion** — all animations wrapped in `prefers-reduced-motion` media query; count-up shows final value immediately
- [x] **Colour contrast** — meets WCAG AA in both dark and light themes
- [x] **Focus indicators** — visible ring on all focusable elements

### Visual Polish

- [x] Consistent spacing and typography across all sections
- [x] Smooth section transitions on scroll
- [x] Mobile menu animation
- [x] Button hover/active/focus states
- [x] Dark/light mode tested across all sections

### E2E Tests — 18 Playwright Specs

| Area | Tests |
|------|-------|
| Navigation | Navbar links, smooth scroll, mobile menu toggle |
| Hero | Headline visible, CTA buttons present, dashboard mockup renders |
| Features | 6 feature cards rendered, correct headings |
| Pipeline | 4 steps visible, correct labels |
| Stats | Numbers visible (count-up completion) |
| Pricing | 3 cards, correct tier names, CTA buttons |
| FAQ | Accordion expand/collapse, keyboard interaction |
| Waitlist | Form submission, validation errors, success state |
| Legal | Privacy and terms pages load, content present |
| SEO | Meta tags present, OG tags, sitemap accessible |
| Accessibility | Skip link works, focus management, ARIA attributes |
| Theme | Dark/light toggle works on marketing pages |

### Test Commands

```bash
# Run all E2E tests
docker compose exec frontend npx playwright test

# Run only marketing/website tests
docker compose exec frontend npx playwright test e2e/website

# Run with UI mode (local dev)
npx playwright test --ui
```

### File Structure

```
frontend/e2e/
├── website.spec.ts            # Public website E2E tests (18 specs)
├── dashboard.spec.ts          # Existing dashboard tests
├── navigation.spec.ts         # Existing nav tests
└── ...
```

### Definition of Done

- [x] All 18 E2E tests pass
- [x] Lighthouse scores meet targets (Performance 95+, SEO 100, Accessibility 95+)
- [x] Zero new npm dependencies added
- [x] Zero image assets added
- [x] Both dark and light modes visually verified
- [x] Mobile responsive across all breakpoints
- [x] All interactive elements keyboard-accessible
