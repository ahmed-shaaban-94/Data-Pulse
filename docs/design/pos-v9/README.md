# POS v9 — Omni · AI · Delivery · Clinical Edition

This folder is the canonical copy of the design-handoff materials for the POS v9 redesign. All source artifacts the team consumed during the Phase E→F→D0→D1→D3 work live here so nobody has to chase a Downloads folder.

## Contents

### `handoff/` — high-fidelity design reference
- `README.md` — design system spec (tokens, typography, layouts, empty states, accessibility)
- `ui-kit-pos.html` — pixel-reference terminal mockup (1920×1080, Arabic/RTL)
- `ui-kit-receipts.html` — three thermal receipt variants (Sales · Insurance · Delivery) at 80 mm
- `colors_and_type.css` — DataPulse palette + type scale as plain CSS vars

> **These are design references, NOT production code.** They're pixel targets for implementation in the existing React + Tailwind codebase. Everything under `handoff/` is hi-fi: every hex value, font size, radius, and padding number is intentional.

### `gemini-reference/` — Gemini's monolithic prototype
- `DataPulse-POS-v9.js` — 591-line single-file React implementation with feature-rich UX
- `tailwind.config.js` — Gemini's v3 Tailwind config (the repo uses v4 CSS-first config; this is for cross-reference only)

> **Use as inspiration, not source of truth.** Gemini's prototype has features the repo doesn't (churn alert, commission tracker, counseling tip, manager PIN) — these are being ported phase by phase. See the feature inventory below.

## Companion docs in this repo

- Plan: [`.claude/plan/pos-design-v9.md`](../../../.claude/plan/pos-design-v9.md) — multi-PR roadmap
- Feature inventory: [`docs/brain/decisions/2026-04-22-pos-v9-feature-inventory.md`](../../brain/decisions/2026-04-22-pos-v9-feature-inventory.md) — 44-row Gemini vs repo vs handoff triage

## Shipped so far

| Phase | What | PR |
|---|---|---|
| E + F | Scoped tokens, fonts, print CSS, feature inventory | #615 merged |
| D0 | Checkout modal refactor | #619 merged |
| D1 | 3-column terminal grid + ClinicalPanelSkeleton | #622 merged |
| D3 | CustomerBar + ChurnAlertCard (fixture-backed) | #625 |

Remaining roadmap tracked as GitHub issues labeled `pos-v9/backend`, `pos-v9/frontend`, `pos-v9/electron` (see issues backlog).

## Conventions for implementation

1. **Scope all v9 styling under `.pos-omni`** (defined in `frontend/src/app/globals.css`). Never promote Omni tokens to global `:root` or `.dark`.
2. **Font families** — Fraunces for grand totals + invoice hero only ("one serif moment"); Cairo for Arabic body; JetBrains Mono for numerals/codes; Inter for English. Any deviation needs a design review.
3. **RTL correctness** — use `margin-inline-start/end`, `ps-*`/`pe-*`, never `ml-*`/`pr-*`. Keep numeric fields `dir="ltr"` inside RTL pages.
4. **Editorial principles** (from handoff §Editorial):
   - One serif moment
   - Commission is ambient (no modal/toast for commission)
   - Clinical before retail (counseling tip is largest)
   - AI triggers not chatter (no persistent AI chat panel)
   - Arabic leads, English follows
   - Paper has grain (scanlines + torn edges on-screen, stripped in print)
   - Inverted ink = pharmacist's voice
