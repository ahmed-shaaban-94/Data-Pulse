# Handoff: DataPulse Pharmacy POS + Thermal Receipts

## Overview

This handoff covers two connected surfaces of the DataPulse "Omni · AI · Delivery · Clinical Edition" pharmacy POS:

1. **POS Terminal** (`ui-kit-pos.html`) — the cashier's primary screen. Arabic/RTL-first, touch + keyboard driven, combining cart, catalog, and a clinical/AI side panel on a single 1920×1080 surface.
2. **Thermal Receipts** (`ui-kit-receipts.html`) — three 80 mm thermal-print receipts rendered from the same system: standard **Sales**, **Insurance co-pay**, and **Delivery dispatch** slip.

Both surfaces share a single design system (cyan/navy dark UI with a warm off-white paper tone for print). The POS drives transactions; the receipts are printed at the end of each transaction — including bilingual AR/EN copy, QR code, barcode, loyalty, counseling tip, and cross-sell.

## About the Design Files

The files in this bundle are **design references created in HTML** — static prototypes showing the intended look, layout, typography, and hierarchy. They are **not production code** to drop into the app as-is.

The task is to **recreate these designs inside the target codebase's existing environment** (the existing React + Tailwind pharmacy POS referenced in the repo), using its established component patterns, routing, state, and data layer. Treat the HTML as a pixel-reference: match spacing, colors, type, and editorial moves exactly, but implement them as real React components wired into the live data model (cart, shift, customer, insurance, delivery).

The receipt surfaces render both on-screen (for preview) and on thermal printers via the browser print pipeline (80 mm roll, 203 DPI). Keep both render paths in mind — colors degrade to pure black ink, dashed separators must survive, and Fraunces fallbacks to a serif stack.

## Fidelity

**High-fidelity (hifi)** — pixel-perfect mockups with final colors, typography, spacing, and component states. Every hex value, font size, radius, and padding number in this document is intentional and should be reproduced exactly. Substitute equivalent tokens from the codebase where a direct mapping exists; invent new tokens only when necessary and note them.

---

## Screens / Views

### 1 · POS Terminal (`ui-kit-pos.html`)

**Canvas:** 1920 × 1080, dark background `#050e17` with two radial glows (cyan top-left 6%, violet top-right 4%).

**Top-level structure (top → bottom):**
1. **Intro strip** (design-doc only — remove in production) — eyebrow `005`, serif H1 "The counter, *but clinical*.", meta on right.
2. **Terminal frame** — 24 px rounded dark card with the actual UI.
3. **Annotation rail** (design-doc only — remove in production) — four cards explaining editorial choices.

Inside the terminal frame:

#### 1.1 Status strip (top, 32 px)
- Left: green `sync` pill — dot + text "Connected · cloud sync" · small mono "last sync 08:47:12".
- Right: gold `commish` pill ("Earned shift commission · 84.20 EGP") + trophy target bar showing "62% · 15K target".
- Background: `#050e17`, bottom border `#122a40`.
- All text mono 10 px, letter-spacing .14em, uppercase.

#### 1.2 Masthead (64 px)
- Left: `DataPulse Omni` logo mark (40 px cyan pulse icon in a 1 px cyan-tinted box) + wordmark in Inter 900 22 px, with "Omni" in 300 weight cyan. Subtitle mono 9 px green "AI · DELIVERY · CLINICAL EDITION".
- Right: digital clock (mono Arabic-Indic numerals ٠٨:٤٧:٣٢) + user chip showing "د. أحمد مجدي / SHIFT SHF-2841 · T01".
- Subtle cyan glow gradient top.

#### 1.3 Body (3-column grid, 4fr / 3fr / 2.5fr, 14 px gap, min-height 820 px)

**Column 1 — Cart (widest)**
- **Customer bar** (top): phone input with violet phone icon, then customer card showing avatar, name "أستاذة منى (مريضة ضغط)", sub "نقاط الولاء: 300 · VIP منذ 2023", and outstanding credit (currently 0.00 EGP).
- **Churn alert** (red): "⚡ Churn risk detected — AI" + "6 days late on كونكور 5 ملجم refill. Prompt refill + wellness check recommended."
- **Scan bar**: large dark input with cyan scan icon on right, kbd hint `/` on left. Placeholder "مسح باركود أو بحث عن صنف...".
- **Cart list**: scrollable column of cart items. Each item is a 4-col grid: `trash · qty-box · body · sum`. Active item has cyan border + soft glow. Items show name, per-unit price tag (mono, muted), optional gold "bonus %" tag (commission trigger), and right-aligned mono 22 px sum.
- **Cart foot** (sticky bottom): subtotal label "إجمالي السلة · 4 أصناف", large Fraunces 52 px grand total "EGP 445.00" cyan with glow, full-width cyan gradient "بدء الدفع وتوجيه الطلب" CTA with trailing `⏎ Enter` kbd.

**Column 2 — Quick catalog**
- Pane head: "الأصناف السريعة" with cyan search icon + "5 of 214 SKUs" mono meta.
- 2-col grid of 120 px SKU buttons. Each button has:
  - A 2 px top accent line colored by category/signal (cyan default, amber = low stock, red = reorder, gold = bonus, green = in stock, violet = generic).
  - Top row: price chip (mono bold 12 px, green for normal, colored when signaled), optional gold star for bonus SKUs.
  - Arabic product name (700, 14 px).
  - Foot: stock count (red "15 · reorder" when critical), expiry date (mono 9 px muted).
  - Press state: 2 px translate-Y + border-bottom 2→4 px "tactile key" feel.
- Below grid: **signature editorial stripe** — "Shift SHF-2841" cyan tag + "47 transactions · avg basket 184 EGP · 12 deliveries dispatched · opened 08:00".

**Column 3 — Clinical / AI panel**
- Pane head: "التثقيف والدعم السريري" + "SELECTED" mono meta.
- Selected SKU header: Arabic product name (20 px, 700), two pills (generic name in gray, category in cyan), then a **cyan counseling box** with speech-bubble icon, "Counseling tip" eyebrow, and the Arabic tip text.
- Stats grid (2 cols): **الرصيد الحي** (live stock, red 24 px "8"), **أقرب انتهاء** (nearest expiry, 18 px "08/2026"), full-width row showing rack location "رف C-05" + "+31.5 EGP margin · 24%" (green mono).
- **AI Cross-sell** section: mono eyebrow "AI Cross-sell · boosts basket +18%", then gold-tinted rows with product name, reason ("ROUTE · أثناء المضاد الحيوي" / "PROTECT · يحمي من اضطرابات القولون"), and gold "+ إضافة" button.
- **Generic alternatives**: mono eyebrow, row with product name, green "يوفر 35 EGP" savings pill, cyan price chip "95.00".

---

### 2 · Thermal Receipts (`ui-kit-receipts.html`)

**Canvas:** dark presentation surface. Three 320 px (≈ 80 mm at 203 DPI) paper receipts arranged in a 3-column rack. In production, only one receipt renders at a time for print.

**Shared paper anatomy (all three receipts):**

- **Paper**: `#f5f2ec` warm off-white, with a subtle 2 px horizontal scanline pattern (opacity .015) to mimic thermal texture.
- **Torn edges**: `::before` and `::after` pseudo-elements draw zigzag tears (14 × 14 px sawtooth, top mirrored) — these should **not** be printed; suppress in `@media print` since the actual paper roll is perforated.
- **Shadow**: `0 30px 60px -20px rgba(0,0,0,.5)` to ground the paper on the dark canvas.
- **Padding**: 22 px top / 20 px horizontal / 0 bottom (inner content has 26 px bottom padding).
- **Ink colors**: `--ink #1a1814`, `--ink-2 #5a5650`, `--ink-faint #a8a098`. No color hex values in print — degrade gracefully to black.

**Section stack (from top):**
1. **Brand block** — 38 px icon mark (2 px ink border, 10 px radius), Inter 900 "DataPulse Omni" wordmark, mono 9 px uppercase sub, Plex Sans Arabic branch name + mono address line. Bottom: 1 px dashed ink-2 separator.
2. **Meta grid** — 2-col mono 10.5 px: Invoice #, Date, Shift, Time, full-width Cashier row. Labels `--ink-2`, values `--ink`.
3. **Customer block** — mono 9 px uppercase eyebrow (Customer / Patient / etc), Plex Sans Arabic 13 px name, mono phone + ID.
4. **Section head** ("Items · 4") — mono 9 px, letter-spacing .22em, uppercase, with trailing dashed rule that fills remaining space (flex:1 + dashed border-bottom).
5. **Item list** — name (Plex Sans Arabic 12.5 px 700), then qty row `2 × 130.00` on the right, `260.00` mono price on the left.
6. **Totals block** — lines for subtotal, discount (in `#c14a4a` red), VAT (10 px muted "VAT included (14%)"), bordered top + bottom dashed.
7. **Grand total** — centered, 38 px Fraunces 800 total with Inter small "EGP" prefix, then italic Fraunces 10 px English long-form amount ("four hundred twenty-two & 75/100").
8. **Payment row** — method icon + label on right, mono amount on left.
9. **Counseling block** — **inverted ink** (black fill, paper text), 6 px radius, mono uppercase "Pharmacist counseling" / "Note to rider" eyebrow + the counseling text. Highlighted words use `#ffd967` gold. *This is the signature editorial moment of the receipt.*
10. **Cross-sell / extras** (sales only) — dashed-bordered list "قد تحتاج أيضاً · You may also need".
11. **Loyalty band** (sales only) — "نقاط الولاء المكتسبة" + "+ 42" green + "الرصيد 342 pts" mono.
12. **QR block** — 80 px ink QR (drawn with CSS conic-gradient + 3 finder-pattern corner squares to avoid any external dependency) + Arabic note explaining what scanning does.
13. **Barcode** — Libre Barcode 128 font at 56 px, printed invoice string below in mono 10 px.
14. **Thanks footer** — Arabic thank-you (Plex Sans 13 px 700), italic Fraunces English echo, mono URL line.

**Receipt-specific modules:**

- **Sales (`INV-38291`)** — VIP discount 5% line (red), Visa payment method, cross-sell list, loyalty band.
- **Insurance (`INV-38292`)** — adds an **Insurance panel** (2 px ink border, 4 px radius) with:
  - Head row: "Insurance breakdown" / "AXA Gulf · Platinum".
  - Split: left box **inverted ink** "يتحمل التأمين · 80%" with 22 px Fraunces "EGP 648.80", right box bordered "على المريض · 20%" with matching Fraunces value.
  - Approval row (dashed top): "Approval: AXA-884-3291-KX" + "Auth 09:10:44".
  - The grand total below shows only the **patient co-pay** (162.20), not the full Rx total.
- **Delivery dispatch (`DLV-5427`)** — adds a **Delivery block** (6 px radius, inverted ink):
  - Address with line breaks, italic landmark line.
  - Rider row: name + mono phone.
  - ETA: "22 min" in 24 px Fraunces gold (`#ffd967`).
  - Also adds a 2-col **signature block** (1 px ink lines + "Rider · توقيع" / "Customer · توقيع" mono eyebrows) above the barcode.
  - Grand total label is "يحصّل عند الاستلام · Cash on delivery".
  - "Note to rider" counsel block instead of pharmacist counseling.

---

## Interactions & Behavior

### POS Terminal

- **Phone input** — accepts Egyptian mobile format, triggers customer lookup (debounce 300 ms). On match: populates customer card, loads loyalty + credit + churn signal.
- **Churn alert** — shown only when AI detects a missed refill > N days (derived from customer's refill schedule). Tapping it opens a refill-dispatch sheet (out of scope for handoff, reuse existing refill flow).
- **Scan bar** — global `/` keyboard shortcut focuses it. On Enter with matching barcode, SKU is added to cart (qty 1) and cart item becomes `.active`. If no match, shake + red border.
- **Cart items**:
  - Click → becomes active (cyan border, updates clinical panel).
  - +/− buttons on qty-box; min qty 1 before the button becomes trash-confirmation.
  - Trash button → confirmation tooltip, then remove.
- **Quick catalog SKU button** — press adds to cart (qty 1) and becomes active. The 2-px border-bottom → translate-Y "key press" animation is intentional; preserve it.
- **Checkout CTA** — `Enter` shortcut. Triggers payment modal (card / cash / insurance / COD). On success, prints appropriate receipt from `ui-kit-receipts.html`.
- **Clinical panel** reacts to the currently active cart item: counseling, stats, cross-sell, and alternatives all refetch on `activeItemId` change. Empty state when nothing is selected (spec below).

### Thermal Receipts

- Pure render layer — no interactions on the paper itself.
- **Print pipeline**: `window.print()` after the transaction. `@media print` must:
  - Hide intro + annotation rail + slot heads + surrounding canvas.
  - Drop torn-edge pseudo-elements.
  - Force `color-adjust: exact` so the inverted counsel block prints as solid black.
  - Set paper size to 80 mm wide (roll length auto).
- **QR code**: in production, replace the decorative CSS QR with a real QR payload pointing to the digital-receipt URL (`datapulse.health/r/<invoiceId>`). Use any standard QR lib; match the visual: 80 × 80 px, 6 px quiet zone, solid black.
- **Barcode**: Libre Barcode 128 font renders Code-128 visually but is **not scannable**. For production, replace with a real Code-128 generator (e.g. `bwip-js` or `jsbarcode`) emitting a 56 px tall bar group; the printed invoice text stays the mono line below.

---

## State Management

### POS Terminal

```
shift: { id, cashierId, terminalId, openedAt, target, transactions, avgBasket, deliveriesCount, commissionEarned }
customer: { id, name, phone, loyaltyPoints, vipSince, outstandingCredit, churnSignals[] } | null
cart: {
  items: [{ skuId, name, qty, unitPrice, isBonus, bonusPct, activeFlag }],
  subtotal, discount, vat, total
}
activeItemId: string | null
catalog: { skus: [{ id, name, price, stock, expiry, margin, shelf, isBonus, accentColor }] }
clinical: {
  counselingTip: string,
  liveStock: number,
  nearestExpiry: string,
  shelf: string,
  marginEGP: number,
  marginPct: number,
  crossSell: [{ skuId, name, reason, reasonTag }],
  alternatives: [{ skuId, name, savingsEGP, price }]
}
```

### Receipts (derive from a single `Transaction`)

```
transaction: {
  id, type: 'sales' | 'insurance' | 'delivery',
  invoiceNo, date, time, shift, cashier, terminal,
  customer: { name, phone, memberId, kind: 'walkin'|'vip'|'patient' },
  items: [{ name, qty, unitPrice, lineTotal }],
  totals: { subtotal, discount, vat, grand },
  payment: { method, last4?, amount },
  counseling: string,
  crossSell?: string[],
  loyalty?: { earned, balance },
  insurance?: { company, plan, insurerPct, patientPct, insurerEGP, patientEGP, approvalId, authAt },
  delivery?: { address, landmark, riderName, riderPhone, etaMinutes, channel },
  qrUrl, barcodeValue, trackUrl
}
```

---

## Design Tokens

All tokens live in `colors_and_type.css` (copy included) and map to the existing DataPulse system (`frontend/src/app/globals.css`).

### Color

```
--bg         #050e17     Canvas background
--bg-2       #081826     Elevated surface
--panel      #0c1f30     Pane background
--panel-2    #102a43     Inner panel
--elevated   #163452     SKU button base
--line       #1a3752     Border / rule
--line-dim   #122a40     Subtle divider

--fg         #e8ecf2     Primary text
--fg-2       #b8c0cc     Secondary text
--mute       #7a8494     Meta labels
--dim        #5a6b7c     Footer caption
--faint      #3f4a5a     Placeholder

--cyan       #00c7f2     Primary action / live
--cyan-hi    #5cdfff     Grand total highlight
--cyan-deep  #0b7da1     Pressed cyan
--gold       #d4af37     Commission / bonus / AI cross-sell
--amber      #ffab3d     Low-stock warn
--green      #1dd48b     In-stock / savings / sync OK
--red        #ff7b7b     Churn / reorder / discount
--violet     #7467f8     Phone / generic alt

/* Receipt paper */
--paper      #f5f2ec     Warm thermal white
--ink        #1a1814     Primary ink
--ink-2      #5a5650     Secondary ink
--ink-faint  #a8a098     Dashed rules

/* Counsel-block gold on paper */
highlight    #ffd967     Gold accent on inverted ink
discount red #c14a4a     Print-safe red
```

### Typography

- **IBM Plex Sans Arabic** (400/500/600/700) — Arabic body copy, labels, button text.
- **Inter** (400/500/600/700/800/900) — English wordmark, EGP small caps.
- **JetBrains Mono** (400/500/600/700) — numerals, timestamps, codes, labels, eyebrows.
- **Fraunces** (600/700/800) — **sparingly** on grand totals, H1, insurance split values, delivery ETA. One serif moment per surface.
- **Libre Barcode 128** — visual-only barcode (replace with real generator in production).

### Spacing

Uses existing DP scale: `space-1` 4 px → `space-10` 40 px. Card gap 14 px (panes) and 48 px (receipt rack). Pane internal padding 14–20 px.

### Radii

```
--radius-sm   8px    chip, pill edges
--radius-md   12px   inputs, tiny cards
--radius-lg   14px   cart items, buttons
--radius-card 20px   panes
--radius-hero 24px   terminal frame
--radius-full 9999px sync pill, commission pill
```

### Shadow

```
terminal:     0 40px 80px rgba(0,0,0,.4), 0 0 0 1px rgba(0,199,242,.05)
checkout CTA: 0 10px 30px rgba(0,199,242,.25) → 0 16px 40px rgba(0,199,242,.4) on hover
grand total:  text-shadow: 0 0 30px rgba(0,199,242,.3)
receipt:      0 30px 60px -20px rgba(0,0,0,.5)
```

---

## Editorial Principles (keep these true)

1. **One serif moment** — Fraunces only shows up on the POS grand total, the receipt grand total, the insurance split values, and the delivery ETA. Everywhere else is Plex Sans Arabic or JetBrains Mono. Do not add serif to headings, pills, or buttons.
2. **Commission is ambient** — the gold stripe in the status bar is the entire incentive surface. Do not re-introduce modals, toasts, or dashboards for commission.
3. **Clinical before retail** — when a SKU is active, the **counseling tip is the largest surface** in the clinical panel. Stock and margin are secondary.
4. **AI triggers, not AI chatter** — churn alert appears only on customer match; cross-sell + alternatives appear only on active SKU. No persistent chat panel.
5. **Arabic leads, English follows** — every bilingual pair (thanks line, grand-total subtitle) places Arabic in Plex 13 px 700 first, then italic Fraunces English in muted ink 10–12 px.
6. **Paper has grain** — the receipt is textured off-white, not pure `#fff`. Scan lines + torn edges + shadow are mandatory on-screen; strip them for print.
7. **Inverted ink = pharmacist's voice** — the counseling block (and the rider-note block on delivery) is the only always-black chunk of the receipt. That's the clinical moment.

---

## Responsive Behavior

### POS Terminal
- **≥ 1400 px** — 3-column body (`4fr / 3fr / 2.5fr`).
- **900 – 1400 px** — 2-column body; clinical panel spans the full row at the bottom.
- **< 900 px** — 1-column stack. The terminal is not designed for mobile; provide a "switch to mobile POS" fallback route instead.

### Receipts
- **≥ 1200 px** — 3 cards across.
- **720 – 1200 px** — 2 cards across.
- **< 720 px** — 1 card, max 340 px wide.
- **Print** — single receipt at 80 mm × auto.

---

## Accessibility

- All icons have adjacent text; provide `aria-label` on icon-only buttons (trash, qty +/−).
- Cart items should be a `<ul>`, with each item an `<li>` and a focusable row. Active item: `aria-current="true"`.
- SKU buttons are real `<button>`s with keyboard activation and visible focus ring (2 px cyan outline, 2 px offset).
- Phone input: `type="tel"`, `inputmode="numeric"`, `autocomplete="tel"`, `dir="ltr"` (phone digits are LTR even in RTL page).
- Grand totals: read as "`<value>` Egyptian pounds" via `aria-label`.
- RTL correctness: layout must be `dir="rtl"` at the document level; numeric fields keep `dir="ltr"` locally. Check all `margin-left/right` usages — we use `margin-inline-start/end` throughout to stay RTL-safe.
- Color contrast: all text ≥ WCAG AA on its background. The muted-on-muted receipt "VAT" line is the closest call — keep `#5a5650` on `#f5f2ec` (passes AA large).

---

## Empty / Loading / Error States (build these)

- **Cart empty** — centered Arabic "ابدأ بمسح الصنف أو اختيار من الأصناف السريعة" with the same scan-bar hint treatment. Checkout CTA disabled.
- **Customer not found** — churn card suppressed; VIP/loyalty fields replaced with "عميل جديد · اضغط لإنشاء ملف".
- **No active SKU** — clinical panel shows a lightweight placeholder: mono eyebrow "SELECT AN ITEM" + short Arabic hint. Do not show ghost stats.
- **Insurance auth pending** — on the receipt, approval ID area shows an animated dashed outline + "جاري الاعتماد..." until the payload returns. Do not print the receipt until auth succeeds.
- **Delivery rider unassigned** — replace rider row with "جاري اختيار المندوب..." and suppress phone; suppress rider signature line until assigned.
- **Print failure** — toast "Receipt not printed — try again" with a "Retry" CTA and a "Send via WhatsApp" fallback.

---

## Assets

- **Logo mark** — cyan pulse/EKG line icon, 22 px stroke-width 2.4, inside a 40 px rounded square with cyan-tinted glass fill. Already in the repo; reuse `<PulseLogo />`.
- **Icons** — all Lucide. If not already installed, use `lucide-react`. Icon names used: `Phone`, `AlertTriangle`, `ScanLine`, `Minus`, `Plus`, `Trash2`, `Search`, `Star`, `MessageSquare`, `ArrowUpDown`, `Trophy`, `Clock`, `User`, `Users`, `CreditCard`, `Wallet`, `Truck`.
- **Fonts** — all from Google Fonts (IBM Plex Sans Arabic, Inter, JetBrains Mono, Fraunces, Libre Barcode 128). Host locally if the codebase already self-hosts.
- **QR / barcode** — drop the CSS placeholders; use a real generator in production (see Interactions).

---

## Files in this bundle

| File | Purpose |
|---|---|
| `README.md` | This document |
| `ui-kit-pos.html` | POS terminal design reference |
| `ui-kit-receipts.html` | Three thermal receipts (sales / insurance / delivery) design reference |
| `colors_and_type.css` | DataPulse token file — drop into the codebase or map to existing tokens |

Open each HTML file in a browser for pixel-reference; inspect DOM + computed styles to extract any value not explicitly listed above.
