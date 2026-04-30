# Charge "no items to check out" — pre-existing bug surfaced 2026-04-30

**Surfaced during:** POS terminal visual port (PR #TBD). User clicked Charge, hit `/checkout` page, saw "Checkout Failed — API error 400: Transaction 8 has no items to check out".

**Status:** Root cause identified. Out of scope for the visual port PR — needs its own fix.

## Symptom

- User clicks the Charge CTA on `/terminal`.
- Page navigates to `/checkout`.
- POST `/api/v1/pos/transactions/{id}/checkout` returns 400 `{"detail":"Transaction N has no items to check out"}`.
- The `/checkout` page renders an unstyled black void with "Checkout Failed" + "Try Again" button (separate UI gap — see §Secondary issues).

## Root cause

The cart context (`usePosCart` / `pos-cart-context`) is **client-only state**. Items added via `addItem(...)` (terminal page line 174, 718) are never POSTed to the backend transaction's `/items` endpoint.

The flow:

1. User scans / quick-picks → cart context grows in memory.
2. User clicks Charge → terminal page line 318 `handleCheckout` calls `checkout.createTransaction(...)` which mints a brand-new draft transaction in the backend (line 323).
3. Page redirects to `/checkout` with `transactionId` in localStorage.
4. `/checkout` page line 165 immediately POSTs `/transactions/{id}/checkout` — without ever calling `checkout.addItem` to populate the txn.
5. Backend `_service_checkout.py:71-76` correctly errors: `items = self._repo.get_transaction_items(...)` is empty → `"Transaction N has no items to check out"`.

**The cart-to-backend sync step is missing.** The `usePosCheckout.addItem` method exists ([use-pos-checkout.ts:52](frontend/src/hooks/use-pos-checkout.ts#L52)) but is **not called** anywhere on the cart-add path.

## Why "Transaction 7" in URL but "Transaction 8" in error

Likely race: the user's browser had a stale `pending_checkout` localStorage entry pointing at an old empty txn (id 7), while the click also fired off a new createTransaction (id 8). Either way both txns are empty server-side because items are never POSTed.

## Fix sketch (separate PR)

Two viable approaches:

**A) Sync-on-add (chatty but simple):** in terminal page's `addQuickPick` and `handleScanSubmit`, after local `addItem(...)`, also call `checkout.addItem(transactionId, ...)`. Requires creating the draft txn earlier — when the shift opens or on first add — instead of at Charge-time.

**B) Bulk-sync at Charge (one round trip):** in `handleCheckout`, after `createTransaction`, loop through `items` from `usePosCart` and POST each via `checkout.addItem(txnId, item)`, then call `checkout.checkout(txnId, ...)`. Slightly more latency on Charge click but matches existing structure. Add an optimistic spinner.

**Recommend B** — fewer state-sync edge cases (no cart-line-vs-server-line drift), no "ghost draft" txns when the cashier abandons a cart, atomic at Charge click.

## Secondary issues from the same screenshot

1. **`/api/v1/pos/shifts/current` → 404.** Suggests shift state desync — terminal believed a shift was open. Could be cookie/session staleness; needs investigation but unrelated to Charge.
2. **CSP blocking Sentry ingest** to `o4511146883416064.ingest.de.sentry.io` — environment CSP missing the Sentry endpoint in `connect-src`. Separate config issue.
3. **Checkout-error UI is unstyled** — black void with bare text. The error branch in `/checkout/page.tsx` doesn't use the new modal shell tokens or any chrome. Worth a follow-up PR to wrap the failure state in `ModalShell` or at least the dashboard chrome.

## Reproducibility

100% reproducible — any cart → Charge will fail because no items are ever sent to the backend transaction.

## Test gap

No e2e covers the end-to-end charge happy-path against a live backend. The `e2e/pos-terminal.spec.ts` referenced for "no items to check" appears to mock the failure rather than guard the success path. Adding a real integration test would have caught this.
