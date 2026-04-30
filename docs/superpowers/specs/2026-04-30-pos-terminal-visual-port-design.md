# POS Terminal Visual Port — Gemini POV Mockup → Live Terminal

**Date:** 2026-04-30
**Author:** Claude (Opus 4.7) with Ahmed Shaaban
**Status:** Approved — ready for implementation plan
**Scope:** 1 PR
**Model recommended for execution:** Sonnet 4.6

## 1. Context

The team shipped two Gemini-inspired POS uplift PRs:

- **PR #795 (`6def3e9c`)** — *visual cherry-picks* additive to terminal page (wordmark, gradient hairline, scan flashes, voucher halo, count-up totals, content badges replacing fake safety score)
- **PR #796 (`bc6e0f00`)** — receipt visual uplift

The user has provided a new Gemini POV mockup at `C:\Users\user\Desktop\gemeni pov - pos.jsx` (600-line monolith with mock data) and a target screenshot showing the desired final look. The mockup represents the macro-vibe upgrade that PR #795 deliberately did not deliver — PR #795 was scoped as *micro-polish only*, not a redesign.

This spec covers the **macro-visual** port: ambient halos, multi-cart tabs, restyled product grid cards, ClinicalPanel dark gradient header, indigo gradient checkout button, header chrome density.

## 2. Problem & Goals

### Problem

The live `/terminal` page does not visually match the agreed Gemini direction. PR #795 added safe additive polish but left the page structurally identical to its pre-Gemini look. The user wants the page to look like the target screenshot.

### Goals

1. Visual delivery of ~95% of the target screenshot, in one PR.
2. Preserve all current behavior — checkout, FEFO, manager-pin override, voucher service, scan flash, RBAC, offline.
3. Preserve light/dark parity. Dark is default.
4. Bind new visual decisions to CSS custom-property tokens, not hardcoded Tailwind colors.
5. Pass all existing guardrail tests (`ClinicalPanel.test.tsx`, `QuickPickGrid.test.tsx`, `ScanBar.test.tsx`).
6. RTL preserved.

### Non-goals

- Backend changes.
- New dependencies.
- `safetyScore` gauge or `requiresRx`-from-substring badge (guardrail-blocked; would require Option B backend work).
- Hard-stop "Clinical Alert Interruption" modal keyed off synthetic threshold.
- Multi-cart business logic if the cart store does not already support it (visual treatment only — single-tab as one styled tab, with TODO comment for follow-up).
- Restyling other (pos) routes: `checkout`, `drugs`, `shift`, `history`, `pos-returns`, `sync-issues`. Shared modals only.
- Mock data leaking into the live page.

## 3. Approach: Token-First Visual Refresh

Pull mockup decisions into the existing CSS custom-property layer in `frontend/src/app/globals.css`, then update components to consume those tokens. This preserves the architectural convention already in place (`--pos-ink-*`, `--text-primary`, `--accent-color`) and enables future Figma-token sync.

### Approaches considered (rejected)

- **Direct Tailwind overwrite** — hardcodes `slate-900`, `indigo-500` throughout, breaks token convention, light mode degrades, makes future re-skin painful.
- **Layered glow-only pass** — too narrow; would not deliver the target screenshot.

## 4. Token Layer (`frontend/src/app/globals.css`)

Add new POS-scoped tokens. Define in both `:root` (light) and `.dark` blocks.

```css
:root {
  /* New POS macro-visual tokens */
  --pos-accent-from: #6366f1;       /* indigo-500 */
  --pos-accent-to:   #9333ea;       /* purple-600 */
  --pos-accent-fg:   #a5b4fc;       /* indigo-300 — for text on accent gradient */
  --pos-glow-indigo: 99 102 241;    /* RGB triplet for box-shadow / blur halos */
  --pos-glow-purple: 168 85 247;
  --pos-success-from: #10b981;      /* emerald-500 */
  --pos-success-to:   #14b8a6;      /* teal-500 */
  --pos-tab-active-border: #6366f1; /* indigo-500 */

  /* Stock state — mirrors mockup pill colors */
  --pos-stock-low:  #f43f5e;        /* rose-500 — used when stock < threshold */
  --pos-stock-ok:   #10b981;        /* emerald-500 */
}

.dark {
  /* Same values, but glow halos are visible only in dark — see utility below */
  --pos-accent-from: #6366f1;
  --pos-accent-to:   #9333ea;
  /* ... */
}
```

Add one utility class:

```css
/* Ambient indigo+purple background blobs, dark-mode only.
   Place once on the terminal <main>. Position absolute-fill with overflow:hidden
   on the parent so blobs clip cleanly. */
.pos-glow-halo {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 600ms ease;
}
.dark .pos-glow-halo { opacity: 0.20; }
.pos-glow-halo::before,
.pos-glow-halo::after {
  content: "";
  position: absolute;
  width: 24rem;
  height: 24rem;
  border-radius: 9999px;
  filter: blur(120px);
}
.pos-glow-halo::before {
  top: -10%; right: -5%;
  background: rgb(var(--pos-glow-indigo));
}
.pos-glow-halo::after {
  bottom: -10%; left: -5%;
  background: rgb(var(--pos-glow-purple));
}
@media (prefers-reduced-motion: reduce) {
  .pos-glow-halo { transition: none; }
}
```

## 5. Component Changes

All under `frontend/src/components/pos/terminal/` unless noted. Existing tests must keep passing; new visual changes get focused tests where they introduce new testable surfaces.

### 5.1 `TopStatusStrip.tsx`

**Already in #795:** Pharma OS wordmark + cyan→indigo gradient hairline.

**Add:**

- User/shift mini-card on the right side of the wordmark cluster: avatar circle (use existing `<User />` icon if no avatar URL), pharmacist name from `useActiveShift`, shift label below.
- Online/offline pill: existing `useOfflineState` already provides this data. Style: emerald pill when online, amber pill with `WifiOff` icon when offline.
- Pending sync counter pill: **first verify** whether `useOfflineState` (or a sibling hook like `usePosOfflineQueue`) exposes a pending count. If yes, render the pill with that count; hide when 0. If no such count exists yet, render the offline pill *without* a counter and add a `// TODO(sync-count): wire to queue service when count is exposed` comment. **Do not invent a fake count.**
- Theme toggle button: re-style existing toggle to the rounded square with sun/moon icon as in mockup.
- Time chip: clock icon + HH:MM:SS in mono. Only show in dark theme to match mockup density.

### 5.2 New: `OrderTabs.tsx`

Renders above the cart panel. Reads from `usePosCart`.

**Behavior depends on cart store capability:**

- If `usePosCart` already supports multiple parallel orders: render full multi-cart tabs (active tab styled with `--pos-tab-active-border`, inactive tabs muted, `+` button to create new order, `×` on hover to close).
- If it does **not** (likely): render a single styled tab showing the current order name and item count, with a `+` button that is **disabled** + tooltipped *"Multi-cart coming soon"*. Add a `// TODO(multi-cart): wire to store when usePosCart supports parallel orders` comment.

This is honest visual treatment without inventing state.

### 5.3 `QuickPickGrid.tsx` (and `QuickPickTile`)

Re-style each tile to match mockup product card:

- `rounded-2xl` border + `bg-card` token.
- **Top row**: pill-shaped icon block (lucide `Pill`, indigo for normal, rose for `requiresRx === true` *only when that field is real* — otherwise omit) on one side, price prominent (`font-black text-lg`) with small "ج.م" suffix on the other.
- **Middle**: drug name (`font-bold`), active-ingredient muted (`text-tertiary` token).
- **Bottom row**: category chip (left, `bg-surface-strong` token), stock pill (right, color via `--pos-stock-low` if `<10` else `--pos-stock-ok`).
- **Selected/hover state**: indigo border + scale `1.02` + subtle gradient overlay (already partly in #795 from the cyan press overlay; extend).

**Guardrail:** existing test asserting no "controlled-substance" badge stays. The `requiresRx` rose pill is gated on `tile.is_controlled === true` (real backend field). If catalog data doesn't expose `is_controlled` yet, the pill never renders. `data-testid="badge-controlled"` must remain absent unless `is_controlled === true`.

### 5.4 `ClinicalPanel.tsx`

**Add a dark gradient header card** at the top of the panel:

- Background: `bg-gradient-to-br from-slate-900 to-slate-800` in dark, lighter equivalent in light.
- Stethoscope watermark: positioned absolute, `text-white/5`, rotated.
- Drug name in `text-xl font-black`, active ingredient in muted indigo.
- Existing `ContentBadges` (✓ نصيحة / ✓ بدائل) move into top-left corner of this header — visually replacing the safety-score gauge ring from the mockup but with **honest data**.
- **No `safetyScore` SVG ring. No `safety-score-gauge` testid. Guardrail tests pass.**
- "AI Pulse" / "نبض الذكاء الاصطناعي" advisory card below header retains current honest copy.
- Stock + FEFO mini-cards retain current data wiring.

### 5.5 `TotalsHero.tsx`

Already has count-up. Restyle:

- Subtotal row + voucher discount row in muted text.
- Grand total: `text-3xl font-black` in `--pos-accent-from` color, with EGP suffix muted.
- Border-top divider above total.

### 5.6 Quick-action row (above totals on cart panel)

3-column grid in `CartPanel.tsx` or a new `CartQuickActions.tsx` if the file is approaching 400 lines:

- **Hold** (amber tile): `bg-amber-50 dark:bg-amber-900/20`, `text-amber-700`.
- **Customer / Insurance** (blue tile): opens existing `InsuranceModal` / `CustomerBar` flow.
- **Voucher** (purple tile): opens `VoucherCodeModal`. Active state when voucher is applied.

### 5.7 Checkout button (`CheckoutConfirmModal` trigger / `ChargeButton`)

- Indigo gradient bg in dark (`bg-gradient-to-r from-[var(--pos-accent-from)] to-[var(--pos-accent-to)]`).
- `slate-900` solid in light.
- Deep shadow halo: `shadow-[0_8px_20px_rgba(var(--pos-glow-indigo),0.20)]` in dark.
- F12 keybinding hint already in place.

### 5.8 `VoucherCodeModal.tsx`

Already has amber halo from #795. Add:

- Submit button: purple gradient (`from-purple-600 to-indigo-600`).
- Input style: `font-mono text-xl text-center uppercase tracking-widest`.

### 5.9 `ManagerPinOverrideModal.tsx`, `CheckoutConfirmModal.tsx`, `ShiftOpenModal.tsx`

Apply consistent shared modal style from mockup:

- `rounded-3xl` shells.
- Header section with icon-in-pill + title + subtitle.
- `bg-card` body, `bg-surface-strong` footer.
- Backdrop: `bg-slate-900/40 dark:bg-black/60 backdrop-blur-md`.

No behavioral change.

### 5.10 `app/(pos)/terminal/page.tsx`

- Add `<div className="pos-glow-halo" aria-hidden />` once at the top of `<main>`.
- Add `dir="rtl"` if not already on a parent (verify).
- Layout proportions match mockup: cart panel `w-[32%]`, catalog `w-[43%]`, clinical `w-[25%]`.

## 6. What Is Explicitly Out

- ❌ `safetyScore` numeric or gauge.
- ❌ `requiresRx` rose badge derived from anything other than a backend-supplied `is_controlled` boolean.
- ❌ Hard-stop clinical-alert modal keyed off synthetic threshold.
- ❌ Multi-cart logic if not already in store.
- ❌ Backend / dbt / API changes.
- ❌ Restyling of `checkout`, `drugs`, `shift`, `history`, `pos-returns`, `sync-issues` routes.
- ❌ New dependencies.
- ❌ Mock data in live page.

## 7. Testing Strategy

### Existing tests must keep passing

- `__tests__/components/pos/terminal/ClinicalPanel.test.tsx` — including the guardrail test that `safety-score-gauge` testid never renders.
- `__tests__/components/pos/terminal/QuickPickGrid.test.tsx` — including the guardrail that `badge-controlled` never renders unless `is_controlled === true`.
- `__tests__/components/pos/terminal/ScanBar.test.tsx`.
- All other terminal tests.

### New tests

- `OrderTabs.test.tsx` — renders order name + count; `+` button disabled state when multi-cart not supported; tooltip text.
- Snapshot test for `ClinicalPanel` dark gradient header (no gauge testid).
- `CartQuickActions.test.tsx` if extracted.

### Verification gate (before PR)

1. `pnpm --filter frontend lint` clean.
2. `pnpm --filter frontend type-check` clean.
3. `pnpm --filter frontend test` green (incl. guardrails).
4. `pnpm --filter frontend build` green.
5. **Manual browser walk** at `/terminal`:
   - Open shift → scan → add → voucher apply → checkout simulation.
   - Both light and dark themes.
   - RTL rendering correct.
   - Capture before/after screenshots for PR.
6. `/code-review` then `/zambahola` cross-model review.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Multi-cart visuals imply behavior we don't have | Disabled `+` button + tooltip + TODO comment; explicit in PR description |
| `is_controlled` field not present in `PosProductResult` type | Pill simply does not render; verify type definition; do not invent the field |
| Color contrast in dark mode for accent gradients | Test against WCAG AA on glass backgrounds during manual walk |
| Light-mode degrades because mockup is dark-first | Light tokens defined in `:root`; spot-check every component in light mode during manual walk |
| Performance: `pos-glow-halo` blur(120px) on a large element | One element only, `position: absolute`, behind content; measure FPS in Chrome perf tab during scan flash to confirm no jank |
| Bundle size growth | No new deps; class additions only |
| Accessibility: ambient halos on `prefers-reduced-motion` | Halo has no animation, just static blur — no motion concern; verify |

## 9. Files Touched (estimate)

```
frontend/src/app/globals.css                                       (+~40 lines tokens + utility)
frontend/src/app/(pos)/terminal/page.tsx                           (~15 line delta)
frontend/src/components/pos/terminal/TopStatusStrip.tsx            (rework)
frontend/src/components/pos/terminal/OrderTabs.tsx                 (NEW)
frontend/src/components/pos/terminal/QuickPickGrid.tsx             (rework tile)
frontend/src/components/pos/terminal/ClinicalPanel.tsx             (header card)
frontend/src/components/pos/terminal/TotalsHero.tsx                (typography + token bind)
frontend/src/components/pos/CartPanel.tsx                          (quick-actions row)
frontend/src/components/pos/terminal/ChargeButton.tsx              (gradient)
frontend/src/components/pos/VoucherCodeModal.tsx                   (purple submit)
frontend/src/components/pos/terminal/CheckoutConfirmModal.tsx      (modal shell tokens)
frontend/src/components/pos/terminal/ManagerPinOverrideModal.tsx   (modal shell tokens)
frontend/src/components/pos/terminal/ShiftOpenModal.tsx            (modal shell tokens)
frontend/src/__tests__/components/pos/terminal/OrderTabs.test.tsx  (NEW)
```

~13–15 files. Each file stays under 400 lines per CLAUDE.md.

## 10. Visual Acceptance Criteria

The user supplied a target screenshot showing the desired dark-mode rendering (image inline in conversation, not saved to disk). Acceptance is met when manual walkthrough at `/terminal` in dark mode visually matches that screenshot in:

1. Header chrome (wordmark, hairline, user mini-card, sync/offline pills, theme toggle, time chip, scan-simulation button, scan toast position).
2. Order tab row above cart panel.
3. Cart card style — drug name, price, Rx mini-pill *only when real*, qty stepper appearance, trash icon hover state.
4. Quick-action row (Hold/Customer/Voucher) tile colors and labels.
5. Subtotal + grand total typography and color hierarchy.
6. Indigo gradient checkout button with halo.
7. Search bar with magnifier + ESC chip.
8. Category chips horizontal scroll.
9. Product grid card style — pill icon, price prominence, name, active ingredient, category chip, stock pill, selected indigo border + scale.
10. Clinical panel dark gradient header card with stethoscope watermark and big drug name.
11. Ambient indigo+purple glow blobs visible behind content in dark mode only.
12. RTL layout intact.
13. Light mode renders cleanly (no broken gradients, contrast ≥ AA).

## 11. Out-of-spec follow-ups (not this PR)

- **Option B path**: backend `DrugDetail.is_controlled: bool` and `DrugDetail.safety_score: int | None` from real catalog, then re-introduce the safety gauge and Rx badge with honest data.
- **Multi-cart store work**: extend `usePosCart` to hold parallel orders, then activate the `+` button.
- **Other (pos) routes**: apply same token system to checkout, drugs, shift, history, returns, sync-issues.
- **Receipt-style pass 2** (separate PR — Prompt B from the original optimized prompt).
- **Figma token sync**: once Figma file is authoritative, use `get_variable_defs` to generate tokens automatically.

## 12. Brain Note

After merge, write `docs/brain/decisions/2026-04-30-pos-visual-port.md` capturing:

- The PR #795 / #796 → this-PR progression as the "macro layer after micro layer" pattern.
- Why guardrails (`safety-score-gauge`, `badge-controlled`) survived another visual pass.
- Token-first visual refresh as the default approach for future POS UI work.
