# POS Terminal Visual Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Gemini POV macro-visual layer onto the live `/terminal` page — ambient halos, restyled cards, dark gradient ClinicalPanel header, indigo gradient checkout — without touching backend, removing guardrails, or inventing clinical signals.

**Architecture:** Token-first refresh. Add new POS-scoped CSS variables to `globals.css`, then re-bind components to those variables. Preserve all current behavior, RTL, light/dark parity, and existing guardrail tests. Single PR, ~13–15 files.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, lucide-react, vitest + react-testing-library, ESLint. No new deps.

**Spec:** `docs/superpowers/specs/2026-04-30-pos-terminal-visual-port-design.md`

---

## File Map

| Path | Action | Responsibility |
|---|---|---|
| `frontend/src/app/globals.css` | modify | Add `--pos-accent-from`, `--pos-accent-to`, `--pos-glow-indigo`, `--pos-glow-purple`, `--pos-success-from/to`, `--pos-tab-active-border`, `--pos-stock-low/ok` tokens; add `.pos-glow-halo` utility |
| `frontend/src/app/(pos)/terminal/page.tsx` | modify | Mount `<div className="pos-glow-halo">` once on `<main>`; mount `<OrderTabs>` above cart panel |
| `frontend/src/components/pos/terminal/OrderTabs.tsx` | **create** | Single styled tab + disabled `+` (multi-cart unwired) |
| `frontend/src/components/pos/terminal/ClinicalPanel.tsx` | modify | Wrap header in dark gradient card with stethoscope watermark; keep `ContentBadges` honest |
| `frontend/src/components/pos/terminal/CartTable.tsx` | modify | Card row visual polish — Rx pill gated on real `is_controlled`; qty stepper restyle |
| `frontend/src/components/pos/terminal/TotalsHero.tsx` | modify | Grand total restyle to use `--pos-accent-from` + EGP suffix muted |
| `frontend/src/components/pos/terminal/ChargeButton.tsx` | modify | Indigo gradient + halo shadow in dark, slate-900 in light |
| `frontend/src/components/pos/VoucherCodeModal.tsx` | modify | Purple gradient submit button + uppercase mono input |
| `frontend/src/components/pos/terminal/CheckoutConfirmModal.tsx` | modify | `rounded-3xl` shell + tokenized backdrop |
| `frontend/src/components/pos/terminal/ManagerPinOverrideModal.tsx` | modify | Same shell tokens |
| `frontend/src/components/pos/terminal/ShiftOpenModal.tsx` | modify | Same shell tokens |
| `frontend/src/__tests__/components/pos/terminal/OrderTabs.test.tsx` | **create** | Renders tab name + count; `+` disabled with tooltip |
| `frontend/src/__tests__/components/pos/terminal/ClinicalPanel.test.tsx` | modify | Add assertion the new gradient header testid renders; existing `safety-score-gauge` guardrail stays |

Estimated diff: ~600 lines across 13 files.

---

## Task 1: Add POS Macro-Visual Tokens to `globals.css`

**Files:**
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Locate the existing POS tokens block**

Run: `grep -n "pos-line\|pos-card" frontend/src/app/globals.css | head -10`
Expected: lines listing existing `--pos-line`, `--pos-card`, etc. tokens. We'll add new tokens in the same block.

- [ ] **Step 2: Add new tokens to `:root` block**

Find the `:root {` block (around line 42) and append before its closing `}`:

```css
  /* ── POS macro-visual tokens (Gemini POV port) ── */
  --pos-accent-from: #6366f1;
  --pos-accent-to: #9333ea;
  --pos-accent-fg: #a5b4fc;
  --pos-glow-indigo: 99 102 241;
  --pos-glow-purple: 168 85 247;
  --pos-success-from: #10b981;
  --pos-success-to: #14b8a6;
  --pos-tab-active-border: #6366f1;
  --pos-stock-low: #f43f5e;
  --pos-stock-ok: #10b981;
```

- [ ] **Step 3: Mirror the same tokens into `.dark` block**

Find the `.dark {` block and append the same block of declarations. Values stay identical for now — the `.pos-glow-halo` utility itself controls dark-only visibility.

- [ ] **Step 4: Add the `.pos-glow-halo` utility at the end of the file**

```css
/* Ambient indigo+purple background blobs — dark mode only.
   Mount once on terminal <main>. Parent must have position:relative + overflow:hidden. */
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
  top: -10%;
  inset-inline-end: -5%;
  background: rgb(var(--pos-glow-indigo));
}
.pos-glow-halo::after {
  bottom: -10%;
  inset-inline-start: -5%;
  background: rgb(var(--pos-glow-purple));
}
```

- [ ] **Step 5: Build to verify CSS parses**

Run: `pnpm --filter frontend build` (or `next build` from `frontend/`)
Expected: build succeeds with no CSS error. If it errors on `inset-inline-end`/`-start` (Tailwind v4 should accept), fall back to RTL-aware logical properties via `:dir(rtl)` selectors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(pos): add macro-visual tokens + glow-halo utility (Gemini POV port)"
```

---

## Task 2: Create `OrderTabs.tsx` (single tab + disabled `+`)

**Files:**
- Create: `frontend/src/components/pos/terminal/OrderTabs.tsx`
- Test: `frontend/src/__tests__/components/pos/terminal/OrderTabs.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/__tests__/components/pos/terminal/OrderTabs.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderTabs } from "@/components/pos/terminal/OrderTabs";

describe("OrderTabs", () => {
  it("renders the active tab with order name and item count", () => {
    render(<OrderTabs orderName="طلب #101" itemCount={2} />);
    expect(screen.getByTestId("order-tab-active")).toHaveTextContent("طلب #101");
    expect(screen.getByTestId("order-tab-count")).toHaveTextContent("2");
  });

  it("renders a disabled + button with multi-cart-coming-soon tooltip", () => {
    render(<OrderTabs orderName="طلب #101" itemCount={0} />);
    const addBtn = screen.getByTestId("order-tab-add");
    expect(addBtn).toBeDisabled();
    expect(addBtn).toHaveAttribute("title", expect.stringContaining("Multi-cart"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter frontend test -- OrderTabs`
Expected: FAIL — module `@/components/pos/terminal/OrderTabs` not found.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/components/pos/terminal/OrderTabs.tsx`:

```tsx
"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderTabsProps {
  orderName: string;
  itemCount: number;
}

export function OrderTabs({ orderName, itemCount }: OrderTabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Active orders">
      <button
        type="button"
        role="tab"
        aria-selected="true"
        data-testid="order-tab-active"
        className={cn(
          "group relative flex min-w-[140px] items-center gap-2 rounded-t-xl px-4 py-2",
          "border-t-2 text-sm font-bold transition-all",
          "bg-card text-[var(--pos-accent-from)]",
          "border-[var(--pos-tab-active-border)]",
          "shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]",
        )}
      >
        <span className="flex-1 truncate text-right">{orderName}</span>
        <span
          data-testid="order-tab-count"
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px]",
            "bg-[rgb(var(--pos-glow-indigo)/0.10)] text-[var(--pos-accent-from)]",
          )}
        >
          {itemCount}
        </span>
      </button>
      <button
        type="button"
        disabled
        data-testid="order-tab-add"
        title="Multi-cart coming soon"
        className={cn(
          "rounded-t-xl px-3 py-2",
          "bg-surface-strong/50 text-text-tertiary opacity-50",
          "cursor-not-allowed",
        )}
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter frontend test -- OrderTabs`
Expected: PASS — both test cases green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pos/terminal/OrderTabs.tsx \
        frontend/src/__tests__/components/pos/terminal/OrderTabs.test.tsx
git commit -m "feat(pos): add OrderTabs visual stub (multi-cart unwired)"
```

---

## Task 3: Mount glow halo + OrderTabs on terminal page

**Files:**
- Modify: `frontend/src/app/(pos)/terminal/page.tsx`

- [ ] **Step 1: Locate the `<main>` element**

Run: `grep -n "<main" frontend/src/app/(pos)/terminal/page.tsx`
Note the line number — we need to add `relative overflow-hidden` classes if not already there, plus inject the halo as the first child.

- [ ] **Step 2: Read the surrounding render block**

Read `frontend/src/app/(pos)/terminal/page.tsx` lines around the `<main>`. Identify where the cart panel section starts.

- [ ] **Step 3: Add halo + OrderTabs imports**

Near the top of the file, add to the import list:

```tsx
import { OrderTabs } from "@/components/pos/terminal/OrderTabs";
```

- [ ] **Step 4: Inject halo as first child of `<main>`**

In the JSX, locate `<main className="..."` and ensure its className includes `relative overflow-hidden`. As the first child of `<main>`, add:

```tsx
<div className="pos-glow-halo" aria-hidden="true" />
```

- [ ] **Step 5: Mount `<OrderTabs>` above cart panel**

Find the cart panel `<section>` (the one rendering `CartTable` / cart UI). Just **before** that `<section>`, in the same parent flex container, add:

```tsx
<OrderTabs
  orderName="طلب #101"
  itemCount={itemCount}
/>
```

(If you have a real "current order name" in cart state, use that; otherwise the static "طلب #101" is fine for this PR — visual treatment only.)

- [ ] **Step 6: Run dev server and visually verify in dark mode**

Run: `pnpm --filter frontend dev`
Open `/terminal` in the browser, switch to dark theme. Confirm:
- Subtle indigo blob top-right and purple blob bottom-left, behind content
- Single tab "طلب #101" visible above the cart panel
- `+` button is dimmed and not clickable
- Switch to light theme — halos invisible, tab still renders

- [ ] **Step 7: Run all terminal tests to verify no regression**

Run: `pnpm --filter frontend test -- terminal`
Expected: all tests still pass, including existing guardrails.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/(pos)/terminal/page.tsx
git commit -m "feat(pos): mount glow halo + OrderTabs on terminal page"
```

---

## Task 4: ClinicalPanel dark gradient header card

**Files:**
- Modify: `frontend/src/components/pos/terminal/ClinicalPanel.tsx`
- Test: `frontend/src/__tests__/components/pos/terminal/ClinicalPanel.test.tsx`

- [ ] **Step 1: Write the failing test for the new header testid**

Open `frontend/src/__tests__/components/pos/terminal/ClinicalPanel.test.tsx`. Add a new test case after the existing guardrail tests:

```tsx
it("renders the dark gradient header card with the drug name", () => {
  // Use whichever existing render helper / mock the file uses
  renderClinicalPanel({ drugName: "أوجمنتين", activeIngredient: "Amoxicillin" });
  const header = screen.getByTestId("clinical-header-card");
  expect(header).toBeInTheDocument();
  expect(header).toHaveTextContent("أوجمنتين");
});

it("never renders a safety-score-gauge testid (guardrail)", () => {
  renderClinicalPanel({ drugName: "أوجمنتين", activeIngredient: "Amoxicillin" });
  expect(screen.queryByTestId("safety-score-gauge")).toBeNull();
});
```

(The second guardrail test may already exist — if so, leave it in place and only add the first.)

- [ ] **Step 2: Run test to verify the new one fails**

Run: `pnpm --filter frontend test -- ClinicalPanel`
Expected: the `clinical-header-card` test FAILS — testid not found. Existing guardrail still passes.

- [ ] **Step 3: Refactor `ClinicalPanel.tsx` to wrap header in gradient card**

Open `frontend/src/components/pos/terminal/ClinicalPanel.tsx`. Locate `SelectedSkuHeader` (around line 73). Replace its outer container with:

```tsx
<div
  data-testid="clinical-header-card"
  className={cn(
    "relative overflow-hidden rounded-2xl p-5 mb-4",
    "bg-gradient-to-br from-slate-900 to-slate-800",
    "dark:from-black dark:to-slate-900",
    "border border-[var(--pos-line)]",
    "text-white",
  )}
>
  {/* Stethoscope watermark — decorative */}
  <Stethoscope
    aria-hidden="true"
    size={140}
    className="absolute -bottom-6 -left-6 rotate-12 text-white/5"
  />
  {/* Existing badges go in top-right corner */}
  {badges && (
    <div className="absolute top-3 right-3">
      <ContentBadges {...badges} />
    </div>
  )}
  <h2 className="relative z-10 pr-12 text-xl font-black leading-tight">
    {drugName}
  </h2>
  {activeIngredient && (
    <p className="relative z-10 pr-12 text-sm font-medium text-indigo-200">
      {activeIngredient}
    </p>
  )}
</div>
```

Add `import { Stethoscope } from "lucide-react";` to the imports if not already present.

- [ ] **Step 4: Run tests to verify both pass**

Run: `pnpm --filter frontend test -- ClinicalPanel`
Expected:
- New `clinical-header-card` test PASS
- Existing `safety-score-gauge` guardrail PASS (no gauge rendered)
- `badge-counseling` and `badge-alternatives` tests still PASS

If existing tests fail because they queried by structure rather than testid, adjust by adding equivalent queries — do not remove guardrails.

- [ ] **Step 5: Run lint + type-check**

Run: `pnpm --filter frontend lint && pnpm --filter frontend type-check`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/pos/terminal/ClinicalPanel.tsx \
        frontend/src/__tests__/components/pos/terminal/ClinicalPanel.test.tsx
git commit -m "feat(pos): ClinicalPanel dark gradient header card (no safety gauge)"
```

---

## Task 5: TotalsHero — restyle grand total to accent token

**Files:**
- Modify: `frontend/src/components/pos/terminal/TotalsHero.tsx`

- [ ] **Step 1: Read the current TotalsHero**

Run: `cat frontend/src/components/pos/terminal/TotalsHero.tsx | head -80`
Identify the element rendering the grand total.

- [ ] **Step 2: Update the grand-total element**

Replace the current grand-total className/structure with (preserving existing count-up logic):

```tsx
<div className="flex justify-between items-end pt-3 border-t border-[var(--pos-line)] mt-2">
  <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
    المطلوب دفعه
  </span>
  <div className="flex items-baseline gap-1">
    <span
      className="text-3xl font-black leading-none tracking-tight"
      style={{ color: "var(--pos-accent-from)" }}
      data-testid="grand-total-value"
    >
      {/* existing count-up wrapper */}
    </span>
    <span className="text-sm font-bold text-text-tertiary mb-0.5">ج.م</span>
  </div>
</div>
```

If TotalsHero already has a `grand-total-value` testid, keep the existing testid; only change classes and structure around it.

- [ ] **Step 3: Run TotalsHero tests**

Run: `pnpm --filter frontend test -- TotalsHero`
Expected: PASS. Count-up animation behavior unchanged.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/pos/terminal/TotalsHero.tsx
git commit -m "feat(pos): TotalsHero grand-total uses --pos-accent-from token"
```

---

## Task 6: ChargeButton — indigo gradient + halo

**Files:**
- Modify: `frontend/src/components/pos/terminal/ChargeButton.tsx`

- [ ] **Step 1: Read current ChargeButton**

Run: `cat frontend/src/components/pos/terminal/ChargeButton.tsx`

- [ ] **Step 2: Replace the button's color/shadow classes**

Change the button's className to:

```tsx
className={cn(
  "w-full flex items-center justify-center gap-3 py-4",
  "rounded-xl text-white font-black text-lg",
  // Light: solid slate. Dark: indigo→purple gradient with glow.
  "bg-slate-900",
  "dark:bg-gradient-to-r dark:from-[var(--pos-accent-from)] dark:to-[var(--pos-accent-to)]",
  "dark:shadow-[0_8px_20px_rgba(var(--pos-glow-indigo)/0.20)]",
  "hover:scale-[1.02] active:scale-[0.98] transition-all",
  "disabled:opacity-50 disabled:grayscale disabled:hover:scale-100",
)}
```

Keep all behavior — `onClick`, `disabled`, F12 hint, icon — unchanged.

- [ ] **Step 3: Run ChargeButton + checkout-related tests**

Run: `pnpm --filter frontend test -- ChargeButton`
Expected: PASS (visual change only).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/pos/terminal/ChargeButton.tsx
git commit -m "feat(pos): ChargeButton indigo gradient + halo in dark mode"
```

---

## Task 7: VoucherCodeModal — purple gradient submit + uppercase mono input

**Files:**
- Modify: `frontend/src/components/pos/VoucherCodeModal.tsx`

- [ ] **Step 1: Locate the submit button and input**

Run: `grep -n 'type="submit"\|<input' frontend/src/components/pos/VoucherCodeModal.tsx`

- [ ] **Step 2: Update the input className** to include uppercase + mono treatment

```tsx
className={cn(
  /* existing classes */,
  "font-mono text-xl text-center uppercase tracking-widest",
)}
```

- [ ] **Step 3: Update the submit button className**

```tsx
className={cn(
  "w-full py-4 text-white font-black text-lg rounded-xl transition-all active:scale-[0.98]",
  "bg-gradient-to-r from-purple-600 to-indigo-600",
  "hover:from-purple-500 hover:to-indigo-500",
  "shadow-lg shadow-purple-500/30",
  "disabled:opacity-50 disabled:active:scale-100",
)}
```

- [ ] **Step 4: Run VoucherCodeModal tests**

Run: `pnpm --filter frontend test -- VoucherCodeModal`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pos/VoucherCodeModal.tsx
git commit -m "feat(pos): VoucherCodeModal purple gradient submit + uppercase mono input"
```

---

## Task 8: Shared modal shells — `rounded-3xl` + tokenized backdrop

**Files:**
- Modify: `frontend/src/components/pos/terminal/CheckoutConfirmModal.tsx`
- Modify: `frontend/src/components/pos/terminal/ManagerPinOverrideModal.tsx`
- Modify: `frontend/src/components/pos/terminal/ShiftOpenModal.tsx`

- [ ] **Step 1: Read each modal to find its outer wrapper / backdrop divs**

Run for each:
```
grep -n "fixed inset-0\|rounded-" frontend/src/components/pos/terminal/CheckoutConfirmModal.tsx
grep -n "fixed inset-0\|rounded-" frontend/src/components/pos/terminal/ManagerPinOverrideModal.tsx
grep -n "fixed inset-0\|rounded-" frontend/src/components/pos/terminal/ShiftOpenModal.tsx
```

- [ ] **Step 2: For each modal, normalize the backdrop to:**

```tsx
className={cn(
  "fixed inset-0 z-[100] flex items-center justify-center",
  "bg-slate-900/40 dark:bg-black/60 backdrop-blur-md",
  "transition-opacity",
)}
```

- [ ] **Step 3: For each modal, normalize the inner shell rounding to `rounded-3xl`**

If the inner panel already uses `rounded-2xl` or `rounded-xl`, change to `rounded-3xl`. Leave other classes alone.

- [ ] **Step 4: Run modal tests**

Run: `pnpm --filter frontend test -- "CheckoutConfirmModal|ManagerPinOverrideModal|ShiftOpenModal"`
Expected: PASS. If any test asserted on a specific rounded class, update the assertion to match `rounded-3xl`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pos/terminal/CheckoutConfirmModal.tsx \
        frontend/src/components/pos/terminal/ManagerPinOverrideModal.tsx \
        frontend/src/components/pos/terminal/ShiftOpenModal.tsx
git commit -m "feat(pos): unify shared modal shells (rounded-3xl + tokenized backdrop)"
```

---

## Task 9: CartTable — Rx pill gated on real `is_controlled`

**Files:**
- Modify: `frontend/src/components/pos/terminal/CartTable.tsx`
- Possibly modify: type definitions if `is_controlled` is missing

- [ ] **Step 1: Verify whether the cart line type exposes `is_controlled`**

Run: `grep -rn "is_controlled" frontend/src/types frontend/src/contexts frontend/src/hooks | head -20`
Expected outcomes:
- **If `is_controlled: boolean` exists on cart line / product type** → proceed to Step 2 with the real field.
- **If it does NOT exist** → skip Rx pill rendering entirely; add a `// TODO(is-controlled): render Rx pill once backend exposes is_controlled` comment in CartTable. **Do not fabricate the field.**

- [ ] **Step 2 (only if field exists): Add the Rx pill render**

In CartTable's row render, after the price element, add:

```tsx
{item.is_controlled === true && (
  <span
    data-testid="badge-controlled"
    className={cn(
      "rounded border px-1.5 py-0.5 text-[9px] font-bold",
      "border-rose-200 bg-rose-100 text-rose-700",
      "dark:border-rose-700/50 dark:bg-rose-900/30 dark:text-rose-400",
    )}
  >
    Rx
  </span>
)}
```

- [ ] **Step 3: Run CartTable + QuickPickGrid tests (the latter has the badge-controlled guardrail)**

Run: `pnpm --filter frontend test -- "CartTable|QuickPickGrid"`
Expected: PASS. The QuickPickGrid guardrail asserting no `badge-controlled` testid renders unless `is_controlled === true` must still pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/pos/terminal/CartTable.tsx
git commit -m "feat(pos): CartTable Rx pill (gated on real is_controlled field)"
```

If the field does not exist, the commit message becomes:

```bash
git commit -m "chore(pos): note CartTable Rx pill blocked on backend is_controlled"
```

---

## Task 10: Final verification gate

**Files:**
- None (verification only)

- [ ] **Step 1: Run lint**

Run: `pnpm --filter frontend lint`
Expected: clean. Fix any new warnings.

- [ ] **Step 2: Run type-check**

Run: `pnpm --filter frontend type-check`
Expected: clean.

- [ ] **Step 3: Run full frontend test suite**

Run: `pnpm --filter frontend test`
Expected: all green. Pay attention to:
- `ClinicalPanel.test.tsx` — `safety-score-gauge` guardrail still passes
- `QuickPickGrid.test.tsx` — `badge-controlled` guardrail still passes
- `ScanBar.test.tsx` — flash tests still pass
- New `OrderTabs.test.tsx` — passes

- [ ] **Step 4: Run production build**

Run: `pnpm --filter frontend build`
Expected: builds successfully.

- [ ] **Step 5: Manual browser walk in dev**

Run: `pnpm --filter frontend dev`
Open `/terminal`. Walk through:
1. Open shift (modal styled with `rounded-3xl` shell)
2. Scan a SKU (flash works)
3. Add to cart (cart row renders, qty stepper works)
4. Open voucher modal (purple submit button), apply `PULSE20`
5. Hover a product card (lift + glow)
6. Click "شاشة الدفع (F12)" — checkout modal opens with consistent shell
7. Toggle theme — light mode renders cleanly, halos invisible
8. Verify RTL: Arabic text right-aligned everywhere
9. Capture before/after screenshots for the PR

- [ ] **Step 6: Compare against the user's target screenshot**

Open the user's target screenshot side-by-side with the running `/terminal` dark mode. Walk through the 13 acceptance criteria in spec §10. Note any deltas.

- [ ] **Step 7: Push and open PR**

```bash
git push -u origin claude/stupefied-zhukovsky-5d8b49
gh pr create --title "feat(pos): terminal visual port (Gemini POV macro layer)" \
             --body "$(cat <<'EOF'
## Summary
- Token-first visual refresh on the POS terminal page
- Adds ambient indigo+purple glow halos (dark only), order tab style, ClinicalPanel dark gradient header card, indigo-gradient checkout button, unified rounded-3xl modal shells
- Continuation of PR #795 (micro-polish) and #796 (receipt) — this is the macro layer
- Spec: docs/superpowers/specs/2026-04-30-pos-terminal-visual-port-design.md

## Out of scope
- No backend changes
- No safetyScore gauge or requiresRx-from-substring badge (guardrail tests preserved)
- No multi-cart business logic (visual stub only, + button disabled)
- Other (pos) routes untouched

## Test plan
- [x] Lint + type-check clean
- [x] All frontend tests pass, including ClinicalPanel/QuickPickGrid/ScanBar guardrails
- [x] Production build green
- [x] Manual walk: open shift → scan → add → voucher → checkout in dark + light + RTL

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 8: Run cross-model review**

Use the `zambahola` skill or run `/zambahola` to send the PR diff to OpenAI Codex for an independent review. Address any high-confidence findings.

---

## Self-Review Checklist (engineer should run before declaring done)

1. **Spec coverage**
   - §4 Token layer → Task 1 ✓
   - §5.1 TopStatusStrip → unchanged (already done in PR #795; nothing to do)
   - §5.2 OrderTabs → Task 2 ✓
   - §5.3 QuickPickGrid → unchanged (already polished in PR #795; Rx pill gated check covered in Task 9 via shared `is_controlled` decision)
   - §5.4 ClinicalPanel header → Task 4 ✓
   - §5.5 TotalsHero → Task 5 ✓
   - §5.6 Cart quick-action row → **NOTE:** existing CartPanel/CartTable layout differs significantly from mockup; deferred to a follow-up sub-task if scope permits — see "Optional Task 11" below if needed
   - §5.7 ChargeButton → Task 6 ✓
   - §5.8 VoucherCodeModal → Task 7 ✓
   - §5.9 Shared modal shells → Task 8 ✓
   - §5.10 Terminal page halo + dir="rtl" → Task 3 ✓

2. **Placeholder scan** — no TBDs in steps; every step has concrete code or commands.

3. **Type consistency** — `OrderTabsProps` defined in Task 2 matches usage in Task 3. `is_controlled` is the same field name in Task 9 and the existing QuickPickGrid guardrail.

4. **Guardrail respect** — Task 4 explicitly preserves `safety-score-gauge` guardrail. Task 9 explicitly preserves `badge-controlled` guardrail.

---

## Optional Task 11 (if §5.6 cart quick-actions becomes a must-have)

If during Task 10 manual walk the cart panel feels visually incomplete vs. the target screenshot, add a 3-tile quick-action row (Hold / Customer / Voucher) as a small new component `CartQuickActions.tsx`. Keep it below 80 lines. Wire to existing handlers:
- Hold → existing hold handler (or disable + tooltip if not wired)
- Customer → existing `CustomerBar` / `InsuranceModal` open
- Voucher → existing voucher modal open

Only add this if the PR reviewer or manual walk says the cart panel feels visually unfinished. Otherwise it's a clean follow-up PR.
