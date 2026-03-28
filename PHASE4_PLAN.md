# DataPulse — Phase 4: Public Website & Landing Page

> **Goal**: Build a stunning, professional landing page that showcases DataPulse as a modern SaaS product.
> **Stack**: Next.js 14 + TypeScript + Tailwind CSS (no new dependencies)
> **Theme**: Midnight-pharma dark theme with optional light toggle

---

## Architectural Overview

### The Core Challenge

Separate public-facing marketing pages from the authenticated dashboard — **without breaking any existing URLs**.

### Solution: Next.js Route Groups

```
frontend/src/app/
├── layout.tsx                    # Minimal root (html + body only)
├── globals.css                   # Shared styles + light/dark CSS vars
│
├── (marketing)/                  # Public website — NO sidebar
│   ├── layout.tsx                # Navbar + Footer wrapper
│   ├── page.tsx                  # Landing page at /
│   └── not-found.tsx             # Marketing 404
│
└── (dashboard)/                  # App dashboard — WITH sidebar
    ├── layout.tsx                # Sidebar + Providers + ErrorBoundary
    ├── dashboard/page.tsx        # /dashboard (unchanged URL)
    ├── products/page.tsx         # /products (unchanged URL)
    ├── customers/page.tsx        # /customers (unchanged URL)
    ├── staff/page.tsx            # /staff (unchanged URL)
    ├── sites/page.tsx            # /sites (unchanged URL)
    ├── returns/page.tsx          # /returns (unchanged URL)
    ├── pipeline/page.tsx         # /pipeline (unchanged URL)
    └── insights/page.tsx         # /insights (unchanged URL)
```

Route groups `(parenthesized)` do NOT affect URLs. After migration:
- `/` renders the landing page (instead of redirecting)
- `/dashboard`, `/products`, etc. work exactly as before
- Each group has its own layout (navbar vs sidebar)

---

## Sub-Phase 4.1: Foundation — Route Group Migration

**Goal**: Restructure the app to support two independent layouts.

### Tasks

#### 1. Create Dashboard Route Group

**New file**: `frontend/src/app/(dashboard)/layout.tsx`

Move the current root layout's inner content here:
```tsx
// Sidebar + Providers + ErrorBoundary + main wrapper
// This is literally the current layout.tsx body, extracted
```

**Move** all existing page directories into `(dashboard)/`:
```
dashboard/  →  (dashboard)/dashboard/
products/   →  (dashboard)/products/
customers/  →  (dashboard)/customers/
staff/      →  (dashboard)/staff/
sites/      →  (dashboard)/sites/
returns/    →  (dashboard)/returns/
pipeline/   →  (dashboard)/pipeline/
insights/   →  (dashboard)/insights/
```

Also move: `not-found.tsx`, `error.tsx` → `(dashboard)/`

#### 2. Strip Root Layout

**Modify**: `frontend/src/app/layout.tsx`

Strip to minimal shell:
```tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-page text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
```

No Sidebar, no Providers — those live in `(dashboard)/layout.tsx` now.

#### 3. Create Marketing Layout Shell

**New file**: `frontend/src/app/(marketing)/layout.tsx`

```tsx
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";

export default function MarketingLayout({ children }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
```

#### 4. Delete Root Redirect

**Delete**: `frontend/src/app/page.tsx` (the `redirect("/dashboard")` file)

Replaced by `(marketing)/page.tsx` in Sub-Phase 4.3.

#### 5. Extend Tailwind Config

**Modify**: `frontend/tailwind.config.ts`

Add new landing page animations:
```ts
keyframes: {
  // Existing: fadeIn, slideUp
  // New:
  float:        { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
  shimmer:      { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
  scaleIn:      { from: { opacity: "0", transform: "scale(0.95)" }, to: { opacity: "1", transform: "scale(1)" } },
  slideInLeft:  { from: { opacity: "0", transform: "translateX(-20px)" }, to: { opacity: "1", transform: "translateX(0)" } },
  slideInRight: { from: { opacity: "0", transform: "translateX(20px)" }, to: { opacity: "1", transform: "translateX(0)" } },
},
animation: {
  // Existing: fade-in, slide-up
  // New:
  "float": "float 6s ease-in-out infinite",
  "shimmer": "shimmer 3s linear infinite",
  "scale-in": "scaleIn 0.5s ease-out forwards",
  "slide-in-left": "slideInLeft 0.6s ease-out forwards",
  "slide-in-right": "slideInRight 0.6s ease-out forwards",
}
```

### Deliverables
- [x] Route groups created
- [x] All dashboard pages migrated (zero URL changes)
- [x] Root `/` ready for landing page
- [x] Marketing layout shell in place
- [x] No visual regressions on dashboard

---

## Sub-Phase 4.2: Core Marketing Components

**Goal**: Build shared components used across all landing page sections.

### Components

#### 1. Intersection Observer Hook

**New file**: `frontend/src/hooks/use-intersection-observer.ts`

Custom hook for scroll-triggered animations:
- Observes element visibility
- Triggers once (no re-triggering on scroll back)
- Default threshold: 0.1, rootMargin: "0px 0px -50px 0px"
- Returns `{ ref, isVisible }`

#### 2. Animated Section Wrapper

**New file**: `frontend/src/components/marketing/animated-section.tsx`

```tsx
// Wraps children with opacity-0 → animation on scroll
// Props: animation type, delay, className
// Types: "slide-up" | "fade-in" | "scale-in" | "slide-in-left" | "slide-in-right"
```

#### 3. Navbar (Sticky + Transparent → Opaque)

**New file**: `frontend/src/components/marketing/navbar.tsx`

Features:
- Fixed position, `z-50`
- Transparent initially → `bg-card/95 backdrop-blur-md` after 50px scroll
- Logo: Activity icon + "DataPulse" (links to `/`)
- Nav links: Features | How It Works | Pricing | FAQ (smooth scroll anchors)
- CTA: "Go to Dashboard" button → `/dashboard`
- Mobile: hamburger menu with slide-out panel
- Scroll listener for background transition

#### 4. Footer

**New file**: `frontend/src/components/marketing/footer.tsx`

4-column grid layout:
| Product | Resources | Company | Connect |
|---------|-----------|---------|---------|
| Features | Documentation | About | GitHub |
| Pricing | API Reference | Contact | Twitter |
| Dashboard | Changelog | Privacy | LinkedIn |

Plus: logo + tagline row, copyright bar.

#### 5. Section Heading

**New file**: `frontend/src/components/marketing/section-heading.tsx`

Reusable centered header: badge pill + h2 title + description paragraph.

#### 6. Gradient Text

**New file**: `frontend/src/components/marketing/gradient-text.tsx`

Utility: `bg-gradient-to-r from-accent to-blue bg-clip-text text-transparent`

### Deliverables
- [x] Scroll-aware navbar with mobile menu
- [x] Footer with link columns
- [x] Intersection observer hook + animated wrapper
- [x] Reusable section heading + gradient text

---

## Sub-Phase 4.3: Hero + Features + How It Works

**Goal**: Build the first three major landing page sections.

### Sections

#### 1. Landing Page Compositor

**New file**: `frontend/src/app/(marketing)/page.tsx`

Composes all sections. Fully static — `export const metadata` for SEO. No `"use client"` at page level.

#### 2. Hero Section

**New file**: `frontend/src/components/marketing/hero.tsx`

Design:
```
┌─────────────────────────────────────────────────────┐
│            (radial teal glow, top-center)            │
│                                                       │
│      Transform Raw Sales Data Into                   │
│        ✨ Actionable Insights ✨                     │
│              (gradient text)                          │
│                                                       │
│   Import, clean, analyze, and visualize millions     │
│   of rows — powered by AI and automation.            │
│                                                       │
│    [Get Started Free]  [Watch Demo]                  │
│                                                       │
│   ● 2M+ rows processed  ● Real-time dashboards      │
│   ● AI-powered insights  ● Zero config setup        │
│                                                       │
│      ◇ (floating shapes, animate-float)  ◇          │
└─────────────────────────────────────────────────────┘
```

- Full viewport height
- Radial gradient background (subtle teal glow)
- Floating CSS-only geometric decorations (`animate-float` with staggered delays)
- No images — pure CSS/text for performance

#### 3. Features Grid

**New file**: `frontend/src/components/marketing/features.tsx`

6 feature cards (3x2 grid desktop, 1-col mobile):

| Icon | Title | Description |
|------|-------|-------------|
| Upload | **Data Import** | Drag-and-drop Excel/CSV. Millions of rows in seconds. |
| Sparkles | **Smart Cleaning** | Automated deduplication, type detection, standardization. |
| Layers | **Medallion Pipeline** | Bronze→Silver→Gold ensures quality at every stage. |
| BarChart3 | **Interactive Dashboards** | Real-time charts, KPIs, and drill-down analytics. |
| Brain | **AI Insights** | Anomaly detection and AI summaries surface hidden patterns. |
| Workflow | **Automation** | Automated pipelines with quality gates and Slack alerts. |

Each card: Lucide icon, hover effect (`border-accent/30`), staggered `AnimatedSection`.

#### 4. How It Works Stepper

**New file**: `frontend/src/components/marketing/how-it-works.tsx`

4-step connected flow:

```
  ①  Import  ——→  ②  Clean  ——→  ③  Analyze  ——→  ④  Visualize
   Upload          Sparkles       BarChart3         LineChart
```

- Horizontal on desktop, vertical on mobile
- Connecting line with gradient (accent → blue)
- Steps appear on scroll via `AnimatedSection`

### Deliverables
- [x] Landing page rendering at `/`
- [x] Hero with gradient effects + floating decorations
- [x] 6-card features grid with hover effects
- [x] 4-step "How It Works" stepper

---

## Sub-Phase 4.4: Preview + Pricing + Testimonials + FAQ + CTA

**Goal**: Complete all remaining landing page sections.

### Sections

#### 1. Dashboard Preview

**New file**: `frontend/src/components/marketing/dashboard-preview.tsx`

CSS-only mock dashboard (no screenshots needed):
```
┌─────────────────────────────────────────┐
│ ┌──┐  ┌─────────────────────────────┐   │
│ │▌▌│  │  ▓▓▓  ▓▓▓  ▓▓▓  ▓▓▓       │   │
│ │▌▌│  │  KPI   KPI   KPI  KPI      │   │
│ │▌▌│  ├─────────────────────────────┤   │
│ │▌▌│  │  📈 Chart area              │   │
│ │▌▌│  │  ████ ██ ████████ ███      │   │
│ └──┘  └─────────────────────────────┘   │
│         [ Live Dashboard Preview ]       │
└─────────────────────────────────────────┘
```

- 3D perspective tilt: `perspective(1000px) rotateX(2deg) rotateY(-2deg)`
- Floating "Live Preview" badge
- "See it in action →" link to `/dashboard`
- Crisp at any resolution (no image assets)

#### 2. Pricing Section

**New file**: `frontend/src/components/marketing/pricing.tsx`

3-tier layout, middle card highlighted:

| | Starter | Professional | Enterprise |
|---|---------|-------------|-----------|
| **Price** | Free | $49/mo | Custom |
| **Sources** | 1 | Unlimited | Unlimited |
| **Rows** | 100K | 10M | Unlimited |
| **Dashboards** | 5 | Unlimited | Unlimited |
| **AI Insights** | - | ✓ | ✓ |
| **API Access** | - | ✓ | ✓ |
| **SSO** | - | - | ✓ |
| **Support** | Community | Email | Dedicated |
| **Badge** | — | ⭐ Most Popular | — |
| **CTA** | Get Started | Start Free Trial | Contact Sales |

Professional card: accent border, "Most Popular" pill, `scale-105`.

#### 3. Testimonials

**New file**: `frontend/src/components/marketing/testimonials.tsx`

3-column grid with placeholder testimonials:
- Quote text + author name + role + company
- Avatar: initials circle (gradient background)
- Decorative large semi-transparent Quote icon
- Realistic pharma/sales domain context

#### 4. FAQ Accordion

**New file**: `frontend/src/components/marketing/faq.tsx`

6-8 questions with smooth expand/collapse:

```
▸ What data formats does DataPulse support?
▾ How is my data secured?
    DataPulse uses tenant-scoped Row Level Security (RLS)
    on PostgreSQL. All data is isolated per tenant...
▸ Can I connect to my existing database?
▸ How long does setup take?
▸ What's included in the free tier?
▸ Do you offer on-premise deployment?
```

- CSS `grid-template-rows: 0fr → 1fr` transition (no JS height calc)
- ChevronDown icon rotates on open
- Client component with `useState`

#### 5. Final CTA

**New file**: `frontend/src/components/marketing/cta.tsx`

Full-width gradient section:
```
┌─────────────────────────────────────────────┐
│   gradient: accent/10 → page                 │
│                                               │
│    Ready to Transform Your Sales Data?       │
│    Start analyzing in minutes, not months.   │
│                                               │
│    [Get Started Free]  [Contact Sales]       │
└─────────────────────────────────────────────┘
```

### Deliverables
- [x] Dashboard preview (CSS mock)
- [x] 3-tier pricing section
- [x] Testimonials grid
- [x] Accordion FAQ
- [x] Final CTA section

---

## Sub-Phase 4.5: Light/Dark Theme Toggle

**Goal**: Optional light theme for marketing pages (dashboard stays dark).

### Strategy: CSS Variables

**Key insight**: The codebase already uses custom color tokens (`bg-page`, `text-text-primary`). Making them CSS-variable-backed means **zero changes to existing components**.

#### 1. Update Tailwind Colors to CSS Variables

**Modify**: `frontend/tailwind.config.ts`

```ts
colors: {
  page: "var(--bg-page)",          // was: "#0D1117"
  card: "var(--bg-card)",          // was: "#161B22"
  border: "var(--border)",         // was: "#30363D"
  divider: "var(--divider)",       // was: "#21262D"
  "text-primary": "var(--text-primary)",    // was: "#E6EDF3"
  "text-secondary": "var(--text-secondary)", // was: "#A8B3BD"
  accent: "#00BFA5",               // stays constant
}
```

#### 2. Add Light Theme Variables

**Modify**: `frontend/src/app/globals.css`

```css
:root {
  /* Dark theme (default) — existing values */
  --bg-page: #0D1117;
  --bg-card: #161B22;
  --border: #30363D;
  --divider: #21262D;
  --text-primary: #E6EDF3;
  --text-secondary: #A8B3BD;
}

html.light {
  --bg-page: #FFFFFF;
  --bg-card: #F6F8FA;
  --border: #D0D7DE;
  --divider: #E8ECEF;
  --text-primary: #1F2328;
  --text-secondary: #656D76;
}
```

#### 3. Theme Hook

**New file**: `frontend/src/hooks/use-theme.ts`

- Manages `"light" | "dark"` state
- Persists to `localStorage` key `"datapulse-theme"`
- Toggles class on `<html>` element

#### 4. Theme Toggle Button

**New file**: `frontend/src/components/marketing/theme-toggle.tsx`

Sun/Moon icon button, integrated into navbar.

#### 5. Force Dark on Dashboard

**Modify**: `frontend/src/app/(dashboard)/layout.tsx`

Add `useEffect` to force `document.documentElement.classList.add("dark")` on mount.

### Deliverables
- [x] Light/dark toggle on marketing navbar
- [x] CSS variable-based theming (zero component changes)
- [x] Dashboard always forced dark
- [x] localStorage persistence

---

## Sub-Phase 4.6: SEO, Metadata & Performance

**Goal**: Optimize for search engines and Core Web Vitals.

### Tasks

#### 1. Enhanced Metadata

**Modify**: `frontend/src/app/(marketing)/page.tsx`

```tsx
export const metadata: Metadata = {
  title: "DataPulse | Transform Sales Data Into Actionable Insights",
  description: "Import Excel/CSV, clean with automated pipelines, analyze with AI...",
  keywords: ["sales analytics", "data pipeline", "business intelligence", "dashboard"],
  openGraph: {
    title: "DataPulse | Sales Analytics Platform",
    type: "website",
    url: "https://datapulse.app",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DataPulse | Sales Analytics Platform",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};
```

#### 2. Sitemap

**New file**: `frontend/src/app/sitemap.ts`

```ts
// Generates sitemap.xml with / and /pricing
// Dashboard routes excluded
```

#### 3. Robots.txt

**New file**: `frontend/src/app/robots.ts`

```ts
// Allows: /
// Disallows: /dashboard, /products, /customers, etc.
// Points to sitemap.xml
```

#### 4. JSON-LD Structured Data

Add `SoftwareApplication` schema to the marketing page for rich search results.

#### 5. Image Optimization

**Modify**: `frontend/next.config.mjs`

```js
images: { formats: ["image/avif", "image/webp"] }
```

#### 6. OpenGraph Image

**New file**: `frontend/public/og-image.png` — branded social share image (1200x630).

### Deliverables
- [x] Rich OpenGraph + Twitter card metadata
- [x] sitemap.xml + robots.txt
- [x] Dashboard routes excluded from crawling
- [x] Structured data markup
- [x] Image optimization config

---

## Sub-Phase 4.7: E2E Tests

**Goal**: Comprehensive Playwright coverage for the landing page.

### Test Files

#### 1. Landing Page Tests

**New file**: `frontend/e2e/landing.spec.ts`

```
✓ Root / renders landing page (not redirect)
✓ Navbar visible with logo and nav links
✓ Hero renders headline and CTA buttons
✓ "Get Started" CTA links to /dashboard
✓ Features section renders 6 cards
✓ How It Works renders 4 steps
✓ Pricing renders 3 tier cards
✓ "Most Popular" badge on Professional tier
✓ FAQ accordion opens/closes on click
✓ Smooth scroll: clicking "Features" scrolls to #features
✓ Mobile: hamburger menu opens
✓ Mobile: no horizontal scroll
✓ Footer renders all link columns
✓ Page has correct meta title
```

#### 2. Navigation Integration Tests

**New file**: `frontend/e2e/landing-navigation.spec.ts`

```
✓ "Go to Dashboard" navigates to /dashboard
✓ Dashboard sidebar NOT visible on landing page
✓ Landing navbar NOT visible on dashboard pages
✓ Back navigation from dashboard to landing works
```

#### 3. Update Existing Tests

**Modify**: `frontend/e2e/navigation.spec.ts`

- Update: root `/` now shows landing page (not redirect to dashboard)
- Add: navigating from `/` to `/dashboard` shows dashboard

### Deliverables
- [x] 15+ E2E specs covering all sections
- [x] Navigation integration tests
- [x] Existing tests updated for new routing
- [x] Mobile responsiveness tests

---

## Sub-Phase 4.8: Polish & Accessibility

**Goal**: Final visual polish, a11y audit, and performance verification.

### Tasks

#### 1. Accessibility

- All interactive elements: proper ARIA labels
- FAQ accordion: `aria-expanded`, `aria-controls`, `role="region"`
- Navbar mobile menu: `aria-hidden`, focus trap
- Color contrast: WCAG AA compliance
- Skip-to-content link
- Semantic HTML: `<section>`, `<nav>`, `<footer>`, `<article>`

#### 2. Visual Polish

- Subtle noise/grain texture overlay on hero (inline SVG data URI)
- 60fps scroll animations verified
- Viewport testing: 320px, 768px, 1024px, 1440px
- Smooth transitions on all interactive elements

#### 3. Performance Verification

- Landing page fully static (SSG at build time)
- Only `Navbar`, `FAQ`, `ThemeToggle`, `AnimatedSection` are client components
- Verify Docker standalone build works with new route structure
- Lighthouse audit: target 95+ on all metrics

#### 4. Marketing 404

**New file**: `frontend/src/app/(marketing)/not-found.tsx`

Marketing-themed 404 with link back to `/` (not dashboard).

### Deliverables
- [x] WCAG AA compliance
- [x] All viewports tested
- [x] Lighthouse 95+
- [x] Docker build verified

---

## Complete File Manifest

### New Files (27)

```
# Route Group Layouts
frontend/src/app/(marketing)/layout.tsx
frontend/src/app/(marketing)/page.tsx
frontend/src/app/(marketing)/not-found.tsx
frontend/src/app/(dashboard)/layout.tsx
frontend/src/app/(dashboard)/not-found.tsx
frontend/src/app/(dashboard)/error.tsx

# SEO
frontend/src/app/sitemap.ts
frontend/src/app/robots.ts
frontend/public/og-image.png

# Marketing Components (12)
frontend/src/components/marketing/navbar.tsx
frontend/src/components/marketing/footer.tsx
frontend/src/components/marketing/hero.tsx
frontend/src/components/marketing/features.tsx
frontend/src/components/marketing/how-it-works.tsx
frontend/src/components/marketing/dashboard-preview.tsx
frontend/src/components/marketing/pricing.tsx
frontend/src/components/marketing/testimonials.tsx
frontend/src/components/marketing/faq.tsx
frontend/src/components/marketing/cta.tsx
frontend/src/components/marketing/section-heading.tsx
frontend/src/components/marketing/gradient-text.tsx
frontend/src/components/marketing/animated-section.tsx
frontend/src/components/marketing/theme-toggle.tsx

# Hooks
frontend/src/hooks/use-intersection-observer.ts
frontend/src/hooks/use-theme.ts

# Tests
frontend/e2e/landing.spec.ts
frontend/e2e/landing-navigation.spec.ts
```

### Modified Files (7)

```
frontend/src/app/layout.tsx           # Strip to minimal root
frontend/src/app/globals.css          # Add light theme CSS vars
frontend/tailwind.config.ts           # CSS var colors + new animations
frontend/next.config.mjs              # Image optimization
frontend/e2e/navigation.spec.ts       # Update root route test
```

### Moved Files (16 files into `(dashboard)/`)

```
dashboard/page.tsx + loading.tsx
products/page.tsx + loading.tsx
customers/page.tsx + loading.tsx
staff/page.tsx + loading.tsx
sites/page.tsx + loading.tsx
returns/page.tsx + loading.tsx
pipeline/page.tsx + loading.tsx
insights/page.tsx + loading.tsx
```

### Deleted Files (3)

```
frontend/src/app/page.tsx             # Replaced by (marketing)/page.tsx
frontend/src/app/not-found.tsx        # Moved to route groups
frontend/src/app/error.tsx            # Moved to route groups
```

---

## Dependency Graph & Execution Order

```
4.1 Foundation ─────┐
                     ├──→ 4.2 Core Components ─────┬──→ 4.3 Hero/Features/HowItWorks ──┐
                     │                               │                                    │
                     │                               ├──→ 4.4 Preview/Pricing/FAQ/CTA ───┤
                     │                               │                                    │
                     │                               └──→ 4.5 Light/Dark Toggle           │
                     │                                                                    │
                     │                               4.6 SEO ←───────────────────────────┤
                     │                                                                    │
                     │                               4.7 E2E Tests ←─────────────────────┤
                     │                                                                    │
                     └───────────────────────────────── 4.8 Polish ←─────────────────────┘
```

**Parallelizable**: 4.3, 4.4, 4.5 can run in parallel after 4.2.
**Sequential**: 4.1 → 4.2 → {4.3 || 4.4 || 4.5} → 4.6 → 4.7 → 4.8.

---

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Route groups** over middleware | Zero runtime cost, clean layout separation |
| **CSS variables** for theming | Every existing component gets free theme support — zero code changes |
| **Intersection Observer** over animation libs | ~20 lines custom hook vs framer-motion (150KB). Zero bundle cost |
| **CSS mock dashboard** over screenshots | Resolution-independent, no image assets, always up-to-date |
| **Static generation** for landing | All content hardcoded — pre-rendered at build time for max performance |
| **No new dependencies** | Everything achievable with React + Tailwind + Lucide. Bundle stays lean |

---

## Success Criteria

- [ ] Landing page loads at `/` with < 1s LCP
- [ ] All 8 dashboard routes work unchanged
- [ ] Lighthouse scores: 95+ Performance, 95+ Accessibility, 100 SEO
- [ ] Mobile responsive down to 320px
- [ ] Light/dark toggle persists across sessions
- [ ] 15+ E2E tests passing
- [ ] Docker build succeeds with new route structure
- [ ] Zero new npm dependencies added
