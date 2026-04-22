# POS v9 — Gemini Prototype vs Current Repo vs Design Handoff

**Date:** 2026-04-22
**Author:** Claude (scope-locked session, branch `claude/crazy-meninsky-9eb208`)
**Source artifacts analyzed:**
- Gemini prototype — `C:/Users/user/Downloads/DataPulse pos  Design System/pos/DataPulse POS v9.js` (591 lines, monolithic)
- Design handoff — `C:/Users/user/Downloads/DataPulse pos  Design System/design_handoff_pos_receipts/README.md` + 2 HTML mockups
- Current repo — `frontend/src/app/(pos)/` + `frontend/src/components/pos/*`, `src/datapulse/pos/*`, `src/datapulse/analytics/churn*`

This report drives Phase D/C/K in [[../../.claude/plan/pos-design-v9.md]].

Related: [[layers/frontend]] · [[modules/pos]]

---

## Feature inventory

| # | Feature | Gemini v9 | Current repo | Design handoff | Disposition |
|---|---------|-----------|--------------|----------------|-------------|
| 1 | **Shift open modal (opening cash)** | `ShiftModal` inline (§l.199) — blocks terminal until open | `/shift` page exists; no blocking modal | Not specified (assumed before masthead appears) | **Port** — D5 as `ShiftOpenModal`, wire to existing `/api/v1/pos/shifts/open` |
| 2 | **Commission per cart line** | `commissionRate` on CATALOG items; `currentCartCommission` reducer (l.154) | backend `pos/terminal.py` + `models/terminal.py` — models exist, not surfaced in UI | Top status strip "gold commish pill" | **Port** — D4 consume via `usePosShift` |
| 3 | **Daily target / trophy bar** | `dailyTarget=15000` const; progress bar (l.400) | Not surfaced | Top status strip right side, per § 1.1 | **Port** — D4; `target` from shift config |
| 4 | **Cloud sync pill** | `isCloudSyncing`, `lastSync` state (l.54-56), 30s heartbeat | `OfflineBadge` exists (binary on/off) | Green sync pill: dot + "Connected · cloud sync" + last-sync timestamp | **Re-spec** — extend `OfflineBadge` to show timestamp, keep offline semantics |
| 5 | **Arabic-Indic digital clock** | `currentTime.toLocaleTimeString('ar-EG', ...)` | Not present | Mono Arabic-Indic `٠٨:٤٧:٣٢` | **Port** — D4 status strip right side |
| 6 | **Manager PIN override (1234/9999)** | `ManagerOverrideModal` (l.223), `requestManagerOverride` wrapper | RBAC exists; no PIN gate on cart actions | Not specified (implied via "active item" editorial) | **Port** — D5 as `ManagerPinOverrideModal`, wire to RBAC service (`src/datapulse/rbac/`) |
| 7 | **Owner mode toggle (PIN 9999)** | `isOwnerMode` state; hidden permission elevation | Dedicated admin screens exist | Not specified | **Cut** — reuse existing role-based routing instead |
| 8 | **Customer phone lookup** | `customerPhone` + `CUSTOMERS_DB` match (l.111) | No phone lookup on terminal | Customer bar top of column 1 (§ 1.3) | **Port** — D3, stub against existing customer endpoint |
| 9 | **Churn risk AI alert** | `activeCustomer.churnRisk`; `BrainCircuit` icon card (l.442) | `api/routes/analytics/churn.py` — FULL backend exists | Red churn card § 1.3 | **Port** — D3 wire to `/api/v1/analytics/churn/customer/{phone}` |
| 10 | **Outstanding credit balance** | `creditBalance` on customer; displayed in customer card (l.440) | Partial — `pos/*` has AR refs | "Outstanding credit · 0.00 EGP" per § 1.3 | **Port** — D3 with stub if endpoint absent |
| 11 | **Loyalty points display** | `points` on customer | Implied by gamification module | Customer card sub-line "نقاط الولاء: 300 · VIP منذ 2023" | **Port** — D3 best-effort from existing data |
| 12 | **Scan bar with `/` shortcut** | `searchQuery` state; no `/` shortcut in v9 | `ScanBar` component + `/` shortcut EXISTS in `(pos)/terminal/page.tsx:357` | "Scan bar: cyan icon + kbd hint `/`" | **Keep** existing ScanBar, re-skin per handoff |
| 13 | **Cart items (active border)** | `selectedItem.id === item.id` styles (l.463) | `CartTable` + `CartRow` exist | "Active item has cyan border + soft glow" | **Re-skin** — D1 apply cyan border + glow |
| 14 | **Cart trash button (with override lock)** | `removeFromCartProtected` → manager override (l.148) | `onRemove` direct | "Trash button → confirmation tooltip, then remove" (handoff) | **Port + re-spec** — D5 wrap existing `onRemove` in PIN modal for controlled/high-value |
| 15 | **Qty ± buttons** | `updateQty` with min 0.01 (l.149) | `onIncrement/onDecrement` exist | "+/− buttons; min qty 1 before trash-confirmation" | **Keep** existing, re-skin D1 |
| 16 | **Quick catalog SKU grid** | 5-item CATALOG, 2-col grid (l.495) | `QuickPickGrid` exists (9 items, 3-col per `minmax`) | 2-col 120px buttons with category accent, price chip, bonus star, stock/expiry meta | **Re-skin** — D1 rebuild `QuickPickGrid` with: 2-col, accent bar, price chip, bonus star, stock/expiry footer |
| 17 | **SKU button "tactile key" press animation** | `active:translate-y-1` + `border-b-[5px]` (l.497) | Not present | "2px translate-Y + border-bottom 2→4 px 'tactile key' feel" | **Port** — D1/D6 |
| 18 | **SKU low-stock / reorder color coding** | `selectedItem.stock <= selectedItem.reorderLevel ? 'text-[#ff7b7b]' : 'text-[#1dd48b]'` (l.535) | Not present in tiles | Category accent colors: cyan/amber/red/gold/green/violet per signal | **Port** — D1 (data: requires stock + reorderLevel on product) |
| 19 | **Fraunces grand total with cyan glow** | `text-5xl font-serif text-[#5cdfff] drop-shadow-md` (l.485) | `TotalsHero` component (style unknown to this audit) | "52px Fraunces, `--pos-shadow-grand-total`, one serif moment" | **Re-skin** — D0/D1 via new `.pos-grand-total` utility |
| 20 | **Charge CTA `بدء الدفع وتوجيه الطلب`** | Opens `CheckoutModal` (l.487) | `ChargeButton` goes to `/checkout` route | "Full-width cyan gradient CTA with `⏎ Enter` kbd" | **Re-spec** — D0 shift to modal, keyboard `Enter` same |
| 21 | **Checkout modal (cash/card/insurance/credit)** | `CheckoutModal` (l.243), 4 methods | 4 methods via `PaymentTiles` inline right column | Not specified as modal in handoff — handoff defers to repo pattern | **Port → modal** — D0 move PaymentTiles + Keypad + ActivePaymentStrip + ChargeButton into new `CheckoutModal` |
| 22 | **Tendered + change calculation** | `tenderedAmount`, `change = tendered - total` (l.167) | `cashTendered` state + keypad | Not in handoff (implicit) | **Keep** existing; merge into CheckoutModal |
| 23 | **Insurance co-pay % input** | `insuranceCoPay` slider 0-100 (l.293) | `InsuranceModal` + `ActivePaymentStrip` | Thermal receipt shows 20/80 split with approval ID | **Keep** existing, surface in CheckoutModal |
| 24 | **Insurance approval ID required** | Blocks checkout (l.170) | Full `InsuranceModal.tsx` with payload | Receipt: "Approval: AXA-884-3291-KX" dashed | **Keep** existing |
| 25 | **Delivery toggle + rider pick** | `isDeliveryOrder`, `RIDERS_DB`, delivery fee +15 EGP (l.75-77) | No delivery UI in terminal | Dispatch-only covered in receipt (`DeliveryReceipt`) — no terminal UI for rider picker specified | **Port** — D0 add `DeliveryToggle` inside CheckoutModal; backend triage: `pos/_service_terminal.py` has refs |
| 26 | **WhatsApp send receipt** | `handleSendWhatsApp` (l.191) | Not present | Fallback mentioned in print-failure state | **Defer** — backend missing (WhatsApp integration) |
| 27 | **Inline thermal receipt render + window.print** | `ThermalReceipt` comp inside same file (l.328); `setTimeout(print, 300)` | `ReceiptPreview` + `api/routes/_pos_receipts.py` | 3 variants: Sales/Insurance/Delivery with full anatomy § 2 | **Re-build** — Phase C new `ReceiptPaper` + 3 variants, replaces Gemini's single table-based receipt |
| 28 | **Clinical: counseling tip per drug** | `item.counseling` text; cyan bubble (l.522) | **MISSING** backend field on products | "Counseling tip" cyan box § 1.3 col 3 | **Stub + defer** — D2 UI with fixture, ticket `pos-drug-counseling-field` |
| 29 | **Clinical: live stock (red when low)** | `selectedItem.stock` with reorder red (l.533) | Partial (stock exists, reorder level unclear) | "الرصيد الحي" red 24px | **Port** — D2 hook to product detail |
| 30 | **Clinical: nearest expiry** | `selectedItem.expiry` (l.537) | `BatchLotRepository` exists (pharma-inventory) | "أقرب انتهاء 08/2026" | **Port** — D2 fetch FEFO from batch table |
| 31 | **Clinical: rack location** | `selectedItem.location` (l.37) | Product has `location` field | "رف C-05" | **Port** — D2 |
| 32 | **Clinical: margin EGP + %** | `margin` implied; `grossProfit`/`grossMarginPercent` reducer (l.155) | Backend has cost | "+31.5 EGP margin · 24%" | **Port** — D2 (only shown to roles with cost access) |
| 33 | **AI cross-sell list (gold rows)** | `item.crossSell` IDs; `handleAddCrossSell` (l.134) | **MISSING** cross-sell backend | Gold-tinted rows § 1.3 col 3 | **Stub + defer** — D2 UI with fixture `[]`, ticket `pos-crosssell-endpoint` |
| 34 | **Generic alternatives list** | `item.alternatives` (l.568) | Partial (product search exists, relation missing) | "Generic alternatives" with savings pill | **Stub + defer** — D2 UI with fixture, ticket |
| 35 | **RTL page direction** | `dir="rtl"` on main div (l.382) | Handled via `next-intl` in root layout | `dir="rtl"` at document level + LTR locally on phone/digits | **Keep** existing approach |
| 36 | **Keyboard: Enter = charge, Esc = close modals** | Window keydown listener (l.100) | F1-F11 shortcuts registered in (pos)/layout.tsx | `/` focuses scan, Enter on scan submits | **Merge** — D0 Enter opens CheckoutModal (was direct route); keep F-keys |
| 37 | **Intro strip / annotation rail** | Not present | Not present | Explicit design-doc only — **remove in production** | **Cut** (was a doc artifact) |
| 38 | **Empty states (cart, no SKU, no customer)** | Not present | Partial (EmptyState in CartPanel) | Handoff § Empty states | **Port** — D6 complete empty states per spec |
| 39 | **Held carts (put on hold)** | `heldCarts` state (l.63), never implemented in UI | F5 shortcut `pos:hold-transaction` dispatches event | Not in handoff | **Defer** — existing shortcut, no consumer; Phase Post-D |
| 40 | **Voucher code modal** | Not present | `VoucherCodeModal` EXISTS | Not in handoff | **Keep** existing |
| 41 | **Pharmacist verification on controlled drugs** | Not present | `PharmacistVerification` EXISTS with dedicated modal | Not in handoff | **Keep** existing (DataPulse has this, Gemini doesn't) |
| 42 | **Sync issues page** | Not present | `/sync-issues` page EXISTS | Not in handoff | **Keep** existing |
| 43 | **Scan disambiguation picker** | Not present | `ScanDisambigPicker` EXISTS | Not in handoff | **Keep** existing — Gemini silently takes first match, which is wrong |
| 44 | **Provisional/offline banner** | Not present | `ProvisionalBanner` EXISTS | Not in handoff | **Keep** existing |

---

## Components triage

### Keep (existing, may re-skin)
`ScanBar`, `CartTable`, `CartRow`, `CartItem`, `CartPanel` (receipt-ish usage),
`QuickPickGrid` (rebuild inside Phase D1 — effectively a re-spec),
`TotalsHero` (demoted or absorbed into CheckoutModal in D0),
`VoucherCodeModal`, `InsuranceModal`, `PharmacistVerification`, `OfflineBadge`, `ProvisionalBanner`, `ScanToast`, `ScanDisambigPicker`.

### Build new (Phase D/C)
`TopStatusStrip`, `CustomerBar`, `ChurnAlertCard`, `ClinicalPanel`, `CounselingTip`,
`ClinicalStatsGrid`, `CrossSellList`, `GenericAlternativesList`, `CheckoutModal`,
`DeliveryToggle`, `RiderPicker`, `ShiftOpenModal`, `ManagerPinOverrideModal`.
Receipts: `ReceiptPaper`, `BrandBlock`, `MetaGrid`, `CustomerBlock`,
`SectionHead`, `ItemList`, `TotalsBlock`, `GrandTotalBlock`, `PaymentRow`,
`CounselingBlock`, `QrBlock`, `BarcodeBlock`, `InsurancePanel`, `DeliveryBlock`,
`SignatureBlock`, `ThanksFooter`, `SalesReceipt`, `InsuranceReceipt`, `DeliveryReceipt`.

### Remove from terminal (migrate into CheckoutModal)
`Keypad`, `PaymentTiles`, `ActivePaymentStrip`, `ChargeButton`,
`ShortcutLegend` (kept but relocated).

### Cut
Intro strip, annotation rail (design-doc artifacts only).
Owner-mode PIN toggle (use RBAC instead).
Gemini's monolithic single-file structure (already modular in repo).
WhatsApp fallback (no backend — deferred).

---

## Backend tickets required

| Ticket | Description | Blocks |
|--------|-------------|--------|
| `pos-drug-counseling-field` | Add `counseling_text` column to products + optional per-insurer override | D2 clinical panel full fidelity |
| `pos-crosssell-endpoint` | `GET /api/v1/pos/drugs/{code}/cross-sell` returning `[{name, reason, reason_tag, price}]` | D2 cross-sell list |
| `pos-alternatives-endpoint` | `GET /api/v1/pos/drugs/{code}/alternatives` returning `[{name, savings_egp, price}]` | D2 alternatives |
| `pos-delivery-rider-api` | Confirm rider dispatch endpoints exist in `pos/_service_terminal.py` or add them | D0 delivery toggle full flow |
| `pos-shift-target` | Expose daily sales target on shift payload | D4 trophy progress |
| `pos-whatsapp-receipt` | WhatsApp Business API integration for receipt delivery | post-C follow-up |

---

## Editorial principles to enforce (from handoff § Editorial Principles)

1. **One serif moment** — Fraunces ONLY on POS grand total, receipt grand total, insurance split values, delivery ETA. Reviewers MUST flag any Fraunces on headings, pills, or buttons.
2. **Commission is ambient** — only the gold status-strip pill surfaces it. No modals/toasts/dashboards for commission.
3. **Clinical before retail** — when a SKU is active, counseling tip is the LARGEST surface in the clinical panel. Stock/margin are secondary.
4. **AI triggers, not AI chatter** — churn on customer match, cross-sell + alternatives on active SKU. No persistent chat.
5. **Arabic leads, English follows** — bilingual pairs: Plex 13px 700 Arabic first, then italic Fraunces English 10-12px muted.
6. **Paper has grain** — receipt is textured warm off-white. Scanlines + torn edges + shadow on-screen; stripped at print.
7. **Inverted ink = pharmacist's voice** — the counseling block is the only always-black chunk of the receipt.

---

## Risks identified

- **Layout shift (2-col → 3-col)** is the riskiest step — existing Playwright specs will break. Phase D1 must update `frontend/e2e/pos-*.spec.ts`.
- **Keypad + PaymentTiles migration into modal** — F9/F10/F11 keyboard shortcuts must still switch payment method while modal is open. Existing `onKey` handler in `(pos)/terminal/page.tsx` needs to pass through, not swallow, when modal is focused.
- **Hybrid render** — Electron can choose to render the receipt via `window.print()` OR via native `node-thermal-printer` ESC/POS commands. Different pipelines mean receipt DOM must be extractable as serializable data, not just rendered. Phase K.3 will implement.
- **Gemini's inline `CUSTOMERS_DB` + `RIDERS_DB` + `CATALOG`** are fixtures. Do NOT port these — use real APIs with loading/error states.
- **Manager PIN `1234`/`9999`** in Gemini v9 is a demo value. Production must use hashed per-tenant RBAC PINs from `rbac` module; never hard-code.

---

## Decision log

**2026-04-22** — scope set to `E → F → D → C + K (Electron)`. Feature triage above is authoritative.
Token conflicts with existing `.pos-root` resolved by making `.pos-omni` **additive** and renaming receipt paper tokens to `--pos-paper-*` prefix. See [[../../.claude/plan/pos-design-v9.md]] Phase E.
