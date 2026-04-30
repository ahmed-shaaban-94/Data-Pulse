# POS Extraction — Phase 1 Recon

**Date:** 2026-04-30
**For:** docs/superpowers/specs/2026-04-30-pos-desktop-extraction-design.md §5 (Phase 1)
**Status:** Read-only inventory. Drives the Phase 1 implementation plan.

Four parallel `Explore` agents mapped the dependency graph that Phase 1's
`git mv` moves will hit. Findings consolidated below.

---

## 1. Imports recon

### Outbound (POS → non-POS) — cross-cuts to rewrite

22 unique non-POS modules are imported across 67 POS files. Highest-volume
cross-cuts:

| Module | Import count | Recommendation when POS moves |
|---|---|---|
| `@/lib/utils` (`cn` helper) | 43× | Keep external — utility is dashboard-wide. Either alias `@shared/utils` from pos-desktop, or duplicate the 30-line `cn` impl. |
| `@/types/pos` (type defs) | 13× | Move with POS to `pos-desktop/src/types/pos.ts`. Frontend has no inbound use (see §1.2). |
| `@/lib/api-client` (`fetchAPI`, `postAPI`, `patchAPI`) | 11× | Move with POS — Phase 1 sub-PR for typed API client (spec §5.3) replaces this anyway. |
| `@/lib/auth-bridge` (`useSession`, `signIn`, `AUTH_PROVIDER`, `CLERK_KEY_CONFIGURED`) | 5× | Move with POS — already named "bridge", was always meant to be desktop-side. |
| `@/lib/pos/*` (`print-bridge`, `ipc`, `offline-db`, `format-drug-name`) | 10× | Move with POS — already POS-scoped. |
| `@/components/empty-state`, `@/components/auth-provider`, `@/components/branding/brand-provider`, `@/components/error-boundary`, `@/components/ui/toast` | various | Keep external — generic UI. |
| `@/hooks/use-active-shift`, `use-branding`, `use-drug-search`, `use-eligible-promotions`, `use-jwt-bridge`, `use-manager-override`, `use-offline-state`, `use-renderer-crash-bridge`, `use-voucher-validate`, `use-pos-terminal` | various | Mixed — `use-pos-terminal` (POS-named) moves; the others stay generic and the import alias becomes external. |
| `@/lib/swr-config` | 1× (layout.tsx) | Keep external. |

**Cross-cut summary:**

- `@/lib/utils` — keep external (43×, dashboard-wide).
- `@/types/pos`, `@/lib/api-client`, `@/lib/auth-bridge`, `@/lib/pos/*` — **move with POS**.
- `@/components/{empty-state, auth-provider, branding, error-boundary, ui/toast}` — keep external.
- `@/hooks/use-{active-shift, branding, drug-search, eligible-promotions, jwt-bridge, manager-override, offline-state, renderer-crash-bridge, voucher-validate}` — keep external.
- `@/hooks/use-pos-terminal` — move with POS (currently lives outside `frontend/src/hooks/use-pos-*` glob — recheck location).

### Inbound (non-POS → POS) — call-sites that break on extraction

**Zero.** No file outside the POS code paths imports from POS code. The
boundary is already clean — Phase 1 sub-PR 1 (`git mv`) won't break any
non-POS call-site.

> This is the most important recon finding. It means the extraction is
> mechanically reversible up until the cart-store unification step.

### Dynamic imports

None. All imports are static — no `import('@/components/pos/...')` to
worry about during the move.

---

## 2. Tests recon

### Totals

- **71 frontend POS tests** (Vitest unit + Playwright e2e)
- **23 Electron unit tests** under `pos-desktop/electron/__tests__/`
- **66 backend POS tests** under `tests/test_pos_*.py`
- **Total: 160 tests** that must stay green through every Phase 1 sub-PR.

### Category distribution (frontend + Electron + backend, deduplicated)

| Category | Count | Notes |
|---|---|---|
| terminal-flow | 53 | Cart, scan, checkout, voucher, idempotency, devices, txn commit |
| offline | 30 | Sync queue, grants, signatures, capabilities, JWT bridge |
| catalog | 17 | Product search, GUC, promotions, customer lookup |
| utility | 26 | Helpers, layer-boundary tests, format/scanner/keymap |
| receipt | 6 | PDF, thermal, email, WhatsApp, print-bridge |
| shift | 7 | Open/close, reconcile, commission, close-guard |
| clinical | 3 | Pharmacist verify, controlled substance, drug-clinical |
| update | 3 | Update policy, admin release service + endpoint (Phase 2 added these) |
| delivery | 1 | Delivery dispatch |

### Cross-tier boundaries (high-attention during Phase 1)

Five test pairs span web ↔ desktop and need careful stub coordination:

1. **Idempotency-key handling** — `frontend/src/__tests__/hooks/use-pos-checkout.test.tsx` ↔ `tests/test_pos_idempotency.py`
2. **Offline sync bridge** — `frontend/src/__tests__/lib/pos/offline-db.test.ts` ↔ `pos-desktop/electron/__tests__/sync/*`
3. **Receipt rendering** — `frontend/src/__tests__/lib/pos/print-bridge.test.ts` ↔ `tests/test_pos_receipt.py` ↔ `pos-desktop/electron/__tests__/hardware/index.test.ts`
4. **Device grants** — `pos-desktop/electron/__tests__/authz/grants.test.ts` ↔ `tests/test_pos_grants.py`
5. **Terminal session** — `frontend/src/__tests__/app/(pos)/terminal.test.tsx` ↔ `tests/test_pos_service_terminal.py`

These five pairs decide the order of Phase 1 sub-PRs:
- Move terminal-flow + receipt + clinical first (lowest cross-tier coupling).
- Move offline last (highest coupling — Electron sync tests already use mocks of the frontend layer).

---

## 3. Assets recon

### POS-only public assets (move to pos-desktop)

**None.** No `frontend/public/**` file is referenced exclusively by POS code.

### Shared public assets (leave alone)

| Asset | Why it stays |
|---|---|
| `/favicon.ico`, `/manifest.json`, `/icons/icon-{192,512,maskable-192,maskable-512}.png`, `/icons/icon{,maskable}.svg`, `/sw.js` | All used by root `layout.tsx` metadata, PWA manifest, or `pwa-register.tsx`. POS only references them transitively via the root layout. |

### Relative-path asset imports inside POS

**None.** POS code uses absolute `/public/` paths or inline assets only —
no `import logo from './logo.png'` style imports to worry about.

### Next.js-specific patterns to migrate (Phase 1 sub-PR 2 / Vite)

| Location | Pattern | Vite replacement |
|---|---|---|
| `frontend/src/app/(pos)/layout.tsx:4` | `import { Fraunces, JetBrains_Mono, Cairo } from "next/font/google"` | Either CDN-hosted Google Fonts via `<link>` in `index.html`, or self-hosted `.woff2` in `pos-desktop/public/fonts/` with manual `--font-*` CSS variable injection. The current `display: "swap"` behavior is preserved by both options. |

**Single migration point.** No other Next.js-specific patterns affect POS
assets.

---

## 4. Styles recon

### POS-only CSS custom properties

**55 POS-only tokens** to move from `frontend/src/app/globals.css` →
`pos-desktop/src/styles/globals.css`:

- `.pos-root` block, lines 1086–1124 (15 base tokens: bg, card, ink scale, accent, status, paper)
- `.pos-omni` block, lines 1295–1361 (40 expanded tokens: panel scale, gold/accent variants, paper details, radii, shadows, fonts, plus 12 from the Gemini POV upgrade)

Token families:
- **Surface/ink** — `--pos-bg`, `--pos-card`, `--pos-ink`...`--pos-ink-4`, `--pos-line`, `--pos-line-strong`, `--pos-line-dim`
- **Accent palette** — `--pos-accent`, `--pos-accent-hi`, `--pos-accent-from/to/fg`, `--pos-accent-deep`
- **Status** — `--pos-green`, `--pos-amber`, `--pos-red`, `--pos-purple`, `--pos-gold`, `--pos-stock-low/ok`
- **Receipt paper** — `--pos-paper`, `--pos-paper-ink`, `--pos-paper-ink-2`, `--pos-paper-ink-faint`, `--pos-paper-ink-muted`, `--pos-paper-totals`, `--pos-paper-zebra`, `--pos-paper-rule`, `--pos-paper-ribbon-{from,to}`, `--pos-paper-highlight`, `--pos-paper-red`
- **Gemini POV upgrade (#797)** — `--pos-glow-indigo`, `--pos-glow-purple`, `--pos-success-{from,to}`, `--pos-tab-active-border`
- **Geometry** — `--pos-radius-{sm,md,lg,card,hero}`
- **Elevation** — `--pos-shadow-{terminal,cta,cta-hover,grand-total,receipt}`
- **Typography** — `--pos-font-{arabic,sans,mono,display}`

### POS-only CSS rule blocks

**40 rules** to move:

- **Print pipeline (lines 573–608):** `.pos-print-root`, `.pos-print-paper`, `.pos-print-{chrome,muted,ribbon,zebra,totals-box,grand,field-cell}`
- **Animations (lines 1129–1264):** `.pos-glow-halo` (+ `::before`/`::after`), `.pos-display`, `@keyframes dpScan{,Flash,FlashError}`, `.pos-scan-flash{,-error}`, `.pos-provisional-rail`, `@keyframes dpRowEnter`, `@keyframes dpSlideUp`, `@keyframes dpKeyFade`
- **Receipt surface (lines 1364–1517):** `.pos-omni .font-{arabic,display,mono}`, `.pos-omni .pos-grand-total`, `.pos-omni .pos-eyebrow`, `.pos-omni .pos-receipt` (+ `::before`/`::after`/`[data-paper-noise]::after`), `.pos-omni .pos-ink-block`, print variants, `@page { size: 80mm auto }`, `.active-tactile`

### POS-only Tailwind extensions

**None.** POS uses only stock Tailwind utilities + native variants
(`rtl:`, `ltr:`, `dark:`). No custom `@layer utilities` rules,
`tailwind-variants` definitions, or theme extensions to migrate.

### Shared tokens (leave alone in `frontend/src/app/globals.css`)

`--text-primary`, `--text-secondary`, `--accent-color`, `--bg-page`,
`--bg-card`, `--border-color` — all used by both POS and dashboard
routes. Keep.

### Gemini visual-port (#796/#797) integrity check

**PASS** — every token introduced by tonight's visual port is
correctly scoped:

- `--pos-accent-{from,to,fg}`, `--pos-glow-{indigo,purple}`, `--pos-tab-active-border`, `--pos-success-{from,to}`, `--pos-stock-{low,ok}` are all in `.pos-omni`.
- `.pos-glow-halo`, `.pos-display`, animation keyframes, `.pos-receipt[data-paper-noise]::after` are POS-only selectors.
- No leakage into `:root`, `body`, or non-POS class selectors.

Phase 1 sub-PR 2 (Vite migration) can move these en bloc with no
dashboard regression.

---

## 5. Migration path summary

Phase 1 file moves, in order:

1. **Sub-PR 1 — mechanical move**
   - `git mv frontend/src/app/(pos)` → `pos-desktop/src/pages/`
   - `git mv frontend/src/components/pos` → `pos-desktop/src/components/`
   - `git mv frontend/src/hooks/use-pos-*` → `pos-desktop/src/hooks/`
   - `git mv frontend/src/store/pos-cart-store.ts` → `pos-desktop/src/store/cart-store.ts`
   - `git mv frontend/src/contexts/pos-cart-context.tsx` → `pos-desktop/src/contexts/`
   - `git mv frontend/src/lib/pos/*` → `pos-desktop/src/lib/`
   - `git mv frontend/src/types/pos.ts` → `pos-desktop/src/types/pos.ts`
   - Codemod: `@/components/pos/...` → `@pos/components/...` and similar across the 67 importing files
   - Drop tokens from `frontend/src/app/globals.css` (lines 1086–1124, 1295–1361, plus the 40 rule blocks)
   - **Gate:** all 160 tests still green

2. **Sub-PR 2 — Vite migration**
   - Add `pos-desktop/vite.config.ts`, `pos-desktop/index.html`
   - Convert each `pages/*.tsx` to React Router routes
   - Replace `next/font/google` with self-hosted fonts in `pos-desktop/public/fonts/` + manual CSS variable wiring
   - Switch `electron/main.ts` from `node server.js` spawn to `BrowserWindow.loadFile('dist/index.html')`
   - Delete `pos-desktop/scripts/build.sh`'s standalone-copy block + the `extraResources: resources/nextjs` block in `electron-builder.yml`
   - **Gate:** Electron app launches, all IPC works, frontend tests still green

3. **Sub-PR 3 — cart-store unification**
   - Delete `pos-desktop/src/contexts/pos-cart-context.tsx` (was the duplicate)
   - Snapshot tests asserting the surviving Zustand store covers every existing call-site
   - **Gate:** terminal-flow + receipt + clinical tests stay green; opus-model design call if snapshot diffs surprise us

---

## 6. Risk surface from recon

Recon **lowered** these spec-§8 risks:

| Spec risk | Original likelihood | Recon adjustment |
|---|---|---|
| Phase 1 migration breaks the running web POS | medium | **lowered to low** — zero inbound non-POS → POS imports means non-POS callers don't break |
| Embedded Next.js → static React loses an SSR feature | low | **stays low** — single Next.js-specific pattern (`next/font/google`) and it has clean Vite replacements |
| Cart-store unification loses a behavior | medium | **unchanged** — recon found 14 call-sites of `usePosCart` to snapshot; design call still warranted |

Recon **raised** these:

| New risk | Why |
|---|---|
| Codemod scope (sub-PR 1) is larger than spec estimate | 67 files import from POS code (spec said ~50). Allow extra time. |
| `@/lib/utils` `cn` import (43×) needs a deliberate keep-or-move call | Most imports overall, lightweight, but a coupling decision either way. |

---

## 7. Output for Phase 1 plan

The Phase 1 implementation plan author should:

1. Treat §5's "keep / drop / merge / cross-cut" lists as resolved by this recon.
2. Use the §5 migration path as the sub-PR breakdown.
3. Pre-write the codemod for §5 step 1 (the @/components/pos/... rewrite) — it's the largest mechanical change.
4. Before sub-PR 3, schedule the cart-store design call (Opus model per spec §7).

This recon does **not** authorize Phase 1 work. Spec §5 still gates Phase 1
behind "Phase 2 ships and is healthy for ≥1 release cycle." This document
is the input that lets the plan get written quickly when the gate opens.
