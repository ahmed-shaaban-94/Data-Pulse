# POS + Receipts v9 — Design System Port & Feature Enrichment

**Branch:** `claude/crazy-meninsky-9eb208` (current worktree)
**Source artifacts:**
- `C:/Users/user/Downloads/DataPulse pos  Design System/design_handoff_pos_receipts/` — hi-fi design handoff (README + HTML mockups + tokens)
- `C:/Users/user/Downloads/DataPulse pos  Design System/pos/DataPulse POS v9.js` — Gemini monolithic feature-rich prototype (reference only)
**Packaging target:** existing `pos-desktop/` Electron scaffold (M2 pre-work done)

---

## Baked-in design decisions (from advisor review)

1. **Tokens are scoped**, not global. All Omni palette tokens live under `.pos-omni` wrapper class applied at `(pos)/layout.tsx`. The dashboard theme stays untouched.
2. **Payment flow becomes a modal first, 3-column layout second.** Re-skin happens as each component moves — no "re-skin now, move later" churn. The existing inline `Keypad + PaymentTiles + ActivePaymentStrip + ChargeButton` stack on the right column is replaced by a **CheckoutModal** (opened by the charge CTA) so the right column can become the **Clinical/AI panel**.
3. **Backend-existence triage per feature** — every ported feature is tagged `EXISTS / STUB / CUT`. No UI that has no signal to display.
4. **Phase F runs in parallel with Phase E** — feature inventory is independent of token swap.
5. **Cross-model review** uses `zambahola` (Codex) at Phase 5 Optimization — Gemini CLI is not installed on this machine.

---

## Backend feature triage (verified by grep on src/datapulse/pos and src/datapulse/analytics)

| Feature (from Gemini v9) | Backend status | Phase disposition |
|---|---|---|
| Shift open + opening cash float | **EXISTS** (`pos/_service_shift.py`, `models/shift.py`) | D5 — wire ShiftOpenModal |
| Commission per cart line + daily target | **EXISTS** (`pos/terminal.py`, `models/terminal.py`) | D4 — status strip |
| Churn risk signal per customer | **EXISTS** (full chain: `analytics/churn_repository.py`, `analytics/services/churn.py`, `api/routes/analytics/churn.py`) | D3 — churn alert card |
| Counseling text per drug | **MISSING** | D2 — stub via `drug.counseling` nullable field + fixture fallback; ticket `pos-drug-counseling-field` for backend |
| AI cross-sell per drug | **MISSING** | D2 — stub with `[]`; ticket `pos-crosssell-endpoint` |
| Generic alternatives per drug | **partial** — product search exists, alternatives relation does not | D2 — stub; ticket |
| Delivery toggle + rider dispatch | **PARTIAL** (`pos/_service_terminal.py` has some refs) | D0 — in CheckoutModal with local state; backend ticket if needed |
| Manager PIN override | **EXISTS** (RBAC + audit) | D5 — simple modal |
| WhatsApp receipt send | **MISSING** | Cut from Phase 1; add as Phase Post-C ticket |
| Thermal receipt print (3 variants) | **PARTIAL** (`api/routes/_pos_receipts.py` exists) | Phase C |

---

## Phase E — Design Tokens, Fonts, Print CSS (foundation, low-risk)

**Scope: this PR.**

### E.1 Add IBM Plex Sans Arabic via `next/font/google`
- Edit `frontend/src/app/(pos)/layout.tsx`:
  - Import `IBM_Plex_Sans_Arabic` from `next/font/google`.
  - Load weights 400/500/600/700, variable `--font-plex-arabic`.
  - Append variable class to the root div alongside existing `fraunces.variable` + `jetbrainsMono.variable`.
- Fraunces & JetBrains Mono already loaded — no change needed.

### E.2 Add scoped Omni tokens under `.pos-omni`
- Edit `frontend/src/app/globals.css`:
  - Add a new `.pos-omni { … }` block exposing the handoff palette (`--bg #050e17`, `--panel #0c1f30`, `--ink #e8ecf2`, `--cyan #00c7f2`, `--gold #d4af37`, `--amber #ffab3d`, `--green #1dd48b`, `--red #ff7b7b`, `--violet #7467f8`, all the `--ink-faint`/`--line-dim`/etc. per README § Design Tokens).
  - Add radii + shadow helpers (`--pos-radius-hero 24px`, `--pos-shadow-cta`, `--pos-shadow-grand-total`).
  - Add paper tokens for receipts (`--pos-paper #f5f2ec`, `--pos-ink #1a1814`, `--pos-ink-2 #5a5650`).
  - These vars are **NOT** promoted to `@theme` — they stay as CSS custom properties usable via `var(--...)` inside `.pos-omni`.

### E.3 Wrap `(pos)` route group in `.pos-omni`
- Edit `(pos)/layout.tsx` root div: add `pos-omni font-[var(--font-plex-arabic)]` to the existing className.

### E.4 Print stylesheet for 80mm receipts
- Edit `globals.css`:
  - `@media print { @page { size: 80mm auto; margin: 0; } .pos-no-print { display: none !important; } .pos-receipt { background: white; color: black; color-adjust: exact; -webkit-print-color-adjust: exact; } .pos-receipt [data-torn-edge] { display: none; } }`

### E.5 Verify
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npx next lint`
- Visual smoke: open `/terminal` — no regression on existing layout; Plex Arabic applied to Arabic strings.

---

## Phase F — Gemini code inventory report (parallel with E, no code)

**Scope: this PR, a report in `docs/brain/decisions/2026-04-22-pos-v9-feature-inventory.md`.**

Produce a 4-column markdown table:

| Feature | Gemini v9 (exists) | Current repo (exists) | Design handoff (specs) | Disposition |

Walk every logical feature in the Gemini file. For each row, state:
- **Port** — move to target codebase in Phase D.
- **Re-spec** — design handoff differs from Gemini; follow handoff.
- **Cut** — not in handoff, not in backend → drop.
- **Defer** — needs backend work → ticket created.

Also create a "Components to build vs re-skin vs keep" section:
- Build new: `TopStatusStrip`, `CustomerBar`, `ChurnAlertCard`, `ClinicalPanel`, `CounselingTip`, `CrossSellList`, `GenericAlternativesList`, `CheckoutModal`, `ShiftOpenModal`, `ManagerPinOverrideModal`.
- Re-skin: `ScanBar`, `QuickPickGrid`, `CartTable`, `PaymentTiles`, `TotalsHero` (possibly demoted).
- Potentially remove: `ActivePaymentStrip`, `ChargeButton`, `Keypad` from terminal page (they migrate inside `CheckoutModal`).

---

## Phase D — Terminal UI re-shape + feature port (MULTI-PR)

### D0 — Modal-ize the payment flow (first PR after E/F)
- Create `frontend/src/components/pos/terminal/CheckoutModal.tsx`.
- Move `Keypad + PaymentTiles + ActivePaymentStrip + ChargeButton` into the modal.
- Add `DeliveryToggle + RiderPicker` sub-component.
- Terminal page: single charge CTA `بدء الدفع وتوجيه الطلب` opens modal; `Enter` keyboard shortcut opens modal (not direct checkout).
- No right-column changes yet — right column is just TotalsHero until D1.
- Tests: update `/app/(pos)/terminal` Playwright specs.

### D1 — Shift terminal grid from 2-col to 3-col
- Change `main` grid from `[1.45fr_1fr]` to `[4fr_3fr_2.5fr]` per handoff § 1.3.
- Middle column (3fr) hosts `QuickPickGrid` promoted to 2-col SKU buttons with category accent bars, price chips, bonus stars, expiry meta. Re-skin per § "Quick catalog".
- Right column (2.5fr) holds a placeholder `ClinicalPanelSkeleton` until D2.
- Cart stays in left column; re-skin: cyan active border, Fraunces grand total per § "Cart foot".
- Responsive: `<1400px` → 2-col (clinical below cart); `<900px` → stack with mobile-fallback route per handoff.

### D2 — Clinical/AI panel (right column)
- New `frontend/src/components/pos/terminal/ClinicalPanel.tsx` binding to `activeCartItemId`.
- Sub-components: `SelectedSkuHeader`, `CounselingTipBox` (cyan bubble), `ClinicalStatsGrid` (live stock / nearest expiry / shelf + margin), `CrossSellList` (gold-tinted rows), `GenericAlternativesList`.
- Data: extend `usePosProducts` / add `usePosDrugClinical(drugCode)` hook hitting `/api/v1/pos/drugs/{code}/clinical` (new endpoint; stub with 200 + shape while backend catches up).
- Empty state: mono eyebrow "SELECT AN ITEM" + short Arabic hint, per handoff § Empty states.

### D3 — Customer bar + Churn alert (left column top)
- New `frontend/src/components/pos/terminal/CustomerBar.tsx`: phone input (violet icon) + resolved `CustomerCard`.
- New `ChurnAlertCard` — red card with `BrainCircuit` icon, shown only when churn signal present.
- Wire to existing `/api/v1/analytics/churn/customer/{phone}` (verified exists).

### D4 — Top status strip
- New `frontend/src/components/pos/terminal/TopStatusStrip.tsx`: green sync pill (left) + gold commission pill + trophy target bar (right).
- Replace current simple `<header>` in `(pos)/terminal/page.tsx`.
- Commission + target read from `shift` context (extend `usePosShift`).

### D5 — Shift modal + Manager PIN
- New `ShiftOpenModal` — blocks terminal until shift is open (Gemini v9 pattern § ShiftModal).
- New `ManagerPinOverrideModal` — trash-cart-item + sensitive ops gate behind PIN (Gemini v9 pattern § ManagerOverrideModal).
- Wire to existing `/api/v1/pos/shifts/open` + RBAC manager-PIN endpoint.

### D6 — Editorial polish
- Apply Fraunces grand total with cyan glow text-shadow.
- Apply "tactile key" press animation on Quick Catalog SKU buttons (2px translate-Y + border-bottom thickening).
- RTL correctness sweep — replace every `margin-left/right` with `margin-inline-start/end`. Keep phone input `dir="ltr"`.

---

## Phase C — Thermal receipts (MULTI-PR)

### C.1 Three receipt templates (no print yet)
- New `frontend/src/components/pos/receipts/ReceiptPaper.tsx` — shared `.pos-receipt` shell with torn edges (on-screen only), scanline texture, 80mm canvas.
- New `SalesReceipt.tsx`, `InsuranceReceipt.tsx`, `DeliveryReceipt.tsx`.
- All share `BrandBlock`, `MetaGrid`, `CustomerBlock`, `SectionHead`, `ItemList`, `TotalsBlock`, `GrandTotalBlock` (Fraunces), `PaymentRow`, `CounselingBlock` (inverted ink), `QrBlock`, `BarcodeBlock`, `ThanksFooter`.
- Insurance adds `InsurancePanel` (split: inverted-ink insurer box + bordered patient box).
- Delivery adds `DeliveryBlock` (address/landmark/rider/ETA) + 2-col `SignatureBlock`.

### C.2 Real QR + real Code-128 barcode
- Install `qrcode.react` (or `react-qr-code`) + `bwip-js` as frontend deps.
- Replace CSS placeholder QR with real generator pointing to `datapulse.health/r/<invoiceId>`.
- Replace `Libre Barcode 128` font with `bwip-js` PNG/SVG rendering.

### C.3 Print pipeline
- On `/checkout` success, `window.print()` with `<ReceiptPaper variant={receiptType}>` as the only visible element.
- Verify `@media print` suppresses app chrome, torn edges, and dashed design-doc rails.
- Print-safe color degradation: paper stays warm off-white, inverted counsel block stays solid black (via `color-adjust: exact`).

### C.4 Wire to transaction completion
- Extend `usePosCheckout` to emit `onSuccess({ transaction })` that flips a state variable to render `<ReceiptPaper>` and calls `window.print()`.
- Preserve existing `ReceiptPreview` (can be a thin wrapper).

---

## Phase K — Electron packaging (continues `pos-desktop/`)

### K.1 Install native deps (M2 proper)
- `cd pos-desktop && npm install better-sqlite3 node-thermal-printer electron-updater`
- `npm install --save-dev jest ts-jest @types/jest @types/better-sqlite3 electron-rebuild`
- `npx electron-rebuild`

### K.2 Wire renderer to Next.js app
- `pos-desktop/electron/main.ts`: in dev, `loadURL("http://localhost:3000/terminal")`; in prod, run embedded Next.js server or load static export.
- Update `contextBridge.exposeInMainWorld` in `preload.ts` to register every handler declared in `ipc/contracts.ts`.

### K.3 SQLite + thermal printer adapters
- Implement `db/connection.ts` + `db/migrate.ts` against `db/schema.sql`.
- Swap `hardware/index.ts` from `mock` to `real` — wire `node-thermal-printer` for receipt printing (parallel path: print from Electron, not `window.print()` — lower latency, better cash-drawer support).

### K.4 Packaging
- `npm run package:dir` (NSIS dir) → smoke test.
- `npm run package` (NSIS installer) for Windows.
- Cross-check installer: app launches, reaches terminal, scans a fake barcode, prints a receipt on mock printer.

---

## Phase 5 (per multi-frontend) — Optimization via `zambahola`

After D, C, and K land, invoke `/zambahola` on the diff set for an independent Codex adversarial review. Integrate feedback before final merge.

---

## Test Plan

- **Phase E:** `tsc --noEmit`, `next lint`, visual smoke of `/terminal` with Plex Arabic applied.
- **Phase F:** no code — just the inventory doc exists and is correct.
- **Phase D:** expand Playwright specs in `frontend/e2e/` for 3-col layout, checkout modal flow, clinical panel activation, shift modal, manager PIN.
- **Phase C:** Playwright print-path spec (use `page.emulateMedia({ media: 'print' })` + screenshot comparison).
- **Phase K:** manual smoke test of Electron packaged build on Windows; Jest in `pos-desktop/` for main process.

---

## Out of scope (explicit cuts)

- WhatsApp receipt delivery (backend missing — future ticket).
- AI cross-sell endpoint (backend missing — stub in Phase D2; future ticket).
- Counseling text as first-class drug column (backend missing — stub + ticket).
- Loyalty points accrual logic (UI shows value, backend unchanged this phase).
- Real cash drawer integration (mock until K.3).

---

## Branching

- Phase E + Phase F ship together in this branch → PR title: `feat(pos): design system v9 foundation — scoped tokens, fonts, Gemini inventory`.
- Phase D0–D6 each a separate PR.
- Phase C.1–C.4 each a separate PR.
- Phase K.1–K.4 each a separate PR.

Total: ~14 PRs. Foundation + inventory (this PR) is the only one that must land first.
