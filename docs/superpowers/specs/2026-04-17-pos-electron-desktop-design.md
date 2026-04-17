# DataPulse POS Desktop — Phase 1 Design

**Date:** 2026-04-17
**Branch:** `feat/pos-electron-desktop`
**Status:** Approved — ready for implementation planning
**Owner:** Platform / Pipeline Engineering

---

## 1. Goal & Non-Goals

### 1.1 Goal

Ship a production-ready Windows desktop POS **for single-terminal pharmacy sites**
that owners can install, use offline for half a day, and trust with real transactions.
The desktop app wraps the existing DataPulse Next.js frontend in an Electron shell
and adds hardware integration, local persistence, an offline sync engine, a signed
auto-updating installer, and a professional UI/UX layer designed for cashier speed.

**Deployment envelope — Phase 1 is restricted to single-terminal sites.** Multi-till
pharmacies are out of scope until F1 ships, because two terminals operating from
independent local stock snapshots can oversell, select conflicting batches, and drift
reconciliation during even brief sync lag. See §1.4 for enforcement.

### 1.2 Non-goals for this phase

The following are **explicitly deferred** to later phases and must not leak into the
Phase 1 scope. They are sized separately and will each get their own design + plan.

| Phase | Theme | Why deferred |
|-------|-------|--------------|
| F1 | Multi-terminal LAN coordination | **Hard prerequisite for multi-till sites** — Phase 1 hard-refuses to activate on tenants with >1 registered terminal |
| F2 | Live analytics ribbon + drill-through panel | Value multiplier — needs Phase 1 baseline |
| F3 | Prescription intake + controlled-substance logbook + FIFO | Regulatory workflow, sized separately |
| F4 | Customer-facing dual-display | Hardware dependency, small but isolated |
| F5 | Voice + AI assist | Not in roadmap for this cycle |

### 1.4 Single-terminal enforcement

Multi-terminal sites are not supported in Phase 1. The restriction is enforced at
**three layers** so it cannot be bypassed by configuration error:

1. **Tenant flag** — `tenants.pos_multi_terminal_allowed BOOLEAN NOT NULL DEFAULT false`.
   Toggling to `true` is a manual DBA operation reserved for F1.
2. **Server guard** — `POST /pos/terminals` (open a new terminal) fails with 409
   when the tenant already has an `open` or `active` terminal and `pos_multi_terminal_allowed=false`.
3. **Client guard** — on launch, the client calls `GET /pos/capabilities`; if the
   server reports `multi_terminal: false` and another terminal is already open for
   the tenant, this terminal refuses to open a shift and shows
   `⛔ Another terminal is already active for this pharmacy — close it first`.

This makes "two tills during an outage" structurally impossible: the second terminal
cannot even open a shift, online or offline.

### 1.3 Definition of done

A pharmacist at a **single-terminal pharmacy** can:

1. Install the signed `DataPulse-POS-1.0.0-Setup.exe` without SmartScreen warnings
2. Open a shift with opening cash on a terminal (server rejects a second concurrent terminal)
3. Scan 10 items with a USB barcode scanner → cart populates, total updates
4. Complete a cash transaction → receipt prints on 80mm thermal printer marked
   `✓ CONFIRMED` (server accepted sync within the checkout round-trip), cash
   drawer opens, change due is shown
5. **Unplug the network**, ring up 5 more transactions → all still succeed, receipts
   still print but marked `⏳ PROVISIONAL — awaiting confirmation`, UI shows offline banner
6. Plug the network back in → queued transactions sync within 30s, banner flashes
   "synced", all transactions appear in the DataPulse analytics dashboard, and the
   history row flips from `provisional` → `confirmed`
7. If a queued transaction is rejected by the server (stock, auth, shift-state
   mismatch) → it surfaces in `/settings → Sync Issues` with a **reconciliation
   workflow** (retry, override, or record-as-loss) and **shift close is blocked
   until every queued mutation is either `synced` or `reconciled`**
8. Close the shift with closing cash → variance is calculated, shift summary prints
9. Restart the machine → app auto-launches to tray, app auto-updates **only when
   server capability check and schema compatibility check both pass**; a new release
   requiring a non-downgradeable schema change waits until the queue is drained

---

## 2. Five Pillars

1. **Hardware integration** — keyboard-emulation barcode scanner, ESC/POS thermal printer, cash drawer kick
2. **Half-day offline mode with provisional semantics** — local SQLite catalog + transaction queue; offline sales are *provisional* until server-confirmed; explicit reconciliation workflow for rejected queue items; shift close blocked while unreconciled items exist
3. **Sync infrastructure + capability negotiation** — required `Idempotency-Key` contract (non-optional on server), `GET /pos/capabilities` version/feature negotiation, retry with exponential backoff, separate push + pull workers
4. **Packaging, updater, security** — signed NSIS installer, auto-update via GitHub Releases with server-capability + schema-compatibility gating, Windows DPAPI-backed offline auth with terminal-scoped grants, Sentry crash reporting
5. **Professional UI/UX** — dark-first cart-dominant terminal, keyboard + touch dual-primary, Arabic + English, accessibility-first, clear provisional/confirmed visual distinction

---

## 3. Architecture

### 3.1 Process topology

```
┌─────────────────────────────────────────────────────────────┐
│                      Electron main process                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  window  │ │   tray   │ │  updater │ │ crash-report │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ db/ (better-sqlite3)  │  hardware/ (printer, drawer) │  │
│  │ sync/ (queue, retry)  │  ipc/ (handlers + zod schemas)│ │
│  └──────────────────────────────────────────────────────┘  │
│                        ▲                                    │
│                        │ IPC (contextBridge)                │
│                        ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │       Next.js renderer (reuses existing frontend)    │  │
│  │   lib/pos/offline-db.ts   — routes reads to IPC      │  │
│  │   hooks/usePosScanner     — keyboard-emulation       │  │
│  │   components/pos/*        — cart, payment, etc.      │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS + Idempotency-Key
                           ▼
         ┌────────────────────────────────────┐
         │   DataPulse API (FastAPI)          │
         │   + pos_idempotency_keys table     │
         │   + Depends(idempotency_handler)   │
         └────────────────────────────────────┘
```

### 3.2 Main-process module layout

```
pos-desktop/electron/
├── main.ts                       # bootstrap, window, tray, lifecycle (EXISTS)
├── preload.ts                    # contextBridge surface (EXISTS — expand)
├── db/
│   ├── connection.ts             # better-sqlite3 singleton, PRAGMAs
│   ├── migrate.ts                # forward-only migration runner
│   ├── migrations/
│   │   ├── 001_initial.sql
│   │   ├── 002_add_batches.sql
│   │   └── …
│   ├── products.ts               # search (FTS5), upsertBatch
│   ├── stock.ts
│   ├── queue.ts                  # enqueue, pending, markSynced, markFailed
│   ├── shifts.ts
│   ├── settings.ts               # key/value store
│   └── audit.ts
├── hardware/
│   ├── printer.ts                # node-thermal-printer wrapper
│   ├── drawer.ts                 # ESC p kick via printer, fallback serialport
│   ├── scanner.ts                # noop in main (renderer owns scanner)
│   └── mock.ts                   # HARDWARE_MODE=mock adapters
├── sync/
│   ├── push.ts                   # drain queue with backoff
│   ├── pull.ts                   # catalog + stock cursors
│   ├── online.ts                 # /health ping + navigator.onLine fusion
│   └── worker.ts                 # schedules push + pull
├── ipc/
│   ├── handlers.ts               # ipcMain.handle('db:*', 'printer:*', …)
│   └── contracts.ts              # Zod schemas (re-exported by renderer)
├── updater/
│   └── index.ts                  # electron-updater wrapper, end-of-shift prompt
├── logging/
│   └── index.ts                  # pino rotation + redaction
└── shared/
    └── types.ts                  # re-exports from src/datapulse/pos/models
```

### 3.3 Renderer changes

```
frontend/src/
├── lib/pos/
│   ├── offline-db.ts             # NEW — if electronAPI exists use IPC, else API
│   ├── scanner-keymap.ts         # NEW — keystroke buffering (onscan.js pattern)
│   └── ipc.ts                    # NEW — typed wrapper over window.electronAPI
├── hooks/
│   ├── use-pos-scanner.ts        # NEW — subscribes to scanner-keymap
│   ├── use-offline-state.ts      # NEW — online/offline + pending count
│   ├── use-pos-cart.ts           # EXISTS — adapt to offline-db
│   └── use-pos-checkout.ts       # EXISTS — adapt to offline-db
└── components/pos/
    ├── OfflineBadge.tsx          # EXISTS — wire to use-offline-state
    └── *                         # EXISTS — restyle per §7
```

### 3.4 Backend changes (DataPulse API)

| Change | Why |
|---|---|
| Migration `XXX_pos_idempotency_keys.sql` | Request deduplication for offline retries |
| `src/datapulse/api/deps.py::idempotency_handler` | Shared FastAPI dependency — replay cached response, 409 on hash-mismatch |
| Apply dependency to `POST /pos/transactions`, `POST /pos/transactions/{id}/void`, `POST /pos/returns`, `POST /pos/shifts/{id}/close`, `POST /pos/terminals/{id}/close` | Every mutating POS endpoint |
| Verify / add `GET /pos/catalog/products?site=&since=` | Client-pulled catalog snapshot |
| Verify / add `GET /pos/catalog/stock?site=&since=` | Client-pulled stock snapshot |
| Nightly cleanup task in `src/datapulse/tasks/` | Delete expired idempotency keys |

### 3.5 Data flow — checkout (online, server-confirmed path)

1. Cashier presses **F2** → renderer navigates to `/checkout`
2. Cashier enters payment method + tendered → submit
3. Renderer generates `client_txn_id` (UUID v4)
4. Renderer writes to local `transactions_queue` (status=`pending`, `confirmation=provisional`)
5. Renderer calls `ipcRenderer.invoke('sync:push-one', local_id)` with a **3s timeout**
6. Main sends `POST /pos/transactions` with `Idempotency-Key: <client_txn_id>`
7. On 2xx within the timeout → main updates row to `synced` + `confirmation=confirmed`,
   persists server `id` + `receipt_number`
8. Renderer receives success → receipt payload marked **`✓ CONFIRMED`** →
   `ipcRenderer.invoke('printer:print', payload)`
9. For cash/mixed payments → `ipcRenderer.invoke('drawer:open')`
10. Renderer shows change-due modal, returns to `/terminal` on dismiss

### 3.6 Data flow — checkout (offline / timeout, provisional path)

**Provisional semantics:** the physical sale (cash taken, receipt printed, drawer
opened) is allowed to complete even when the server hasn't confirmed, but the sale
is marked **provisional** on every surface until confirmation lands. The design
makes it impossible to end a shift while any provisional sale is unresolved.

- Steps 1–4 identical to online flow
- Step 5 fails (network error **or** timeout > 3s) → queue row stays
  `pending`, `confirmation=provisional`; background worker keeps retrying
- Step 8 runs, but receipt payload includes a **`⏳ PROVISIONAL — pending confirmation`**
  banner at the top and a line at the bottom: *"This receipt is pending server
  confirmation. If any item is rejected, a corrective receipt will be issued."*
- Step 9 (drawer open) runs for cash payments
- UI toast: **"Provisional sale — awaiting server confirmation"**
- Top offline banner reflects count: `⚠ Offline — 3 provisional · Last sync 2 min ago`

**Resolution states — after sync attempt:**

| Server response | Local state transition | User surface |
|---|---|---|
| 2xx | `provisional → confirmed` | history row updates, green toast: "3 sales confirmed" |
| 409 (idempotency replay) | Treated as 2xx — server already has this transaction | same as 2xx |
| 4xx (stock/auth/shift mismatch) | `provisional → rejected` | **appears in `/settings → Sync Issues` with reconciliation workflow**; cashier sees red chip in top banner |
| 5xx / network | Stays `provisional`, retry with backoff | no UI change |

**Reconciliation workflow for rejected items** (`/settings → Sync Issues`):

Each rejected provisional sale offers three resolution paths:
1. **Retry with override** — supervisor PIN + reason (e.g., "physical stock
   confirmed, server stock was stale"), resubmits with `X-Override-Reason` header
2. **Record as loss / no-sale adjustment** — records the physical cash-out in
   `audit_log` as `provisional_loss`, credits the cash drawer expected total
   downward by that amount, prints a reconciliation slip for the pharmacist
3. **Issue corrective void** — prints a void receipt for the customer to return;
   reopens the original receipt reference number as void

**Shift-close guard:** `POST /pos/shifts/{id}/close` refuses on the client side if
any queue row has `status in (pending, failed) AND confirmation=provisional`. The
UI shows a blocking modal: `Cannot close shift — 2 provisional sales unresolved.
Resolve them in Sync Issues first.` This makes it structurally impossible to bank
cash for an unconfirmed sale and move on.

---

## 4. Local SQLite Schema

### 4.1 Storage

- **File:** `app.getPath('userData')/pos.db`
- **Pragmas:** `journal_mode=WAL`, `foreign_keys=ON`, `synchronous=NORMAL`
- **Driver:** `better-sqlite3` (synchronous, native)

### 4.2 Tables

```sql
-- Product catalog snapshot
CREATE TABLE products (
  drug_code            TEXT PRIMARY KEY,
  drug_name            TEXT NOT NULL,
  drug_brand           TEXT,
  drug_cluster         TEXT,
  is_controlled        INTEGER NOT NULL DEFAULT 0,
  requires_pharmacist  INTEGER NOT NULL DEFAULT 0,
  unit_price           TEXT NOT NULL,          -- Decimal as string, never float
  updated_at           TEXT NOT NULL           -- ISO-8601
);

-- Full-text search shadow table
CREATE VIRTUAL TABLE products_fts USING fts5(
  drug_name, drug_brand, drug_cluster,
  content='products', content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'     -- Arabic-friendly
);

-- Stock per batch per site
CREATE TABLE stock (
  drug_code            TEXT NOT NULL REFERENCES products(drug_code),
  site_code            TEXT NOT NULL,
  batch_number         TEXT NOT NULL,
  quantity             TEXT NOT NULL,          -- Decimal as string
  expiry_date          TEXT,                   -- ISO date
  updated_at           TEXT NOT NULL,
  PRIMARY KEY (drug_code, site_code, batch_number)
);

-- Local mirror of active shift
CREATE TABLE shifts_local (
  id                   INTEGER PRIMARY KEY,    -- server id after sync
  local_id             TEXT NOT NULL UNIQUE,   -- UUID before sync
  terminal_id          INTEGER NOT NULL,
  staff_id             TEXT NOT NULL,
  site_code            TEXT NOT NULL,
  shift_date           TEXT NOT NULL,
  opened_at            TEXT NOT NULL,
  closed_at            TEXT,
  opening_cash         TEXT NOT NULL,
  closing_cash         TEXT,
  expected_cash        TEXT,
  variance             TEXT,
  pending_close        INTEGER NOT NULL DEFAULT 0
);

-- Outbound transaction queue
CREATE TABLE transactions_queue (
  local_id             TEXT PRIMARY KEY,       -- UUID
  client_txn_id        TEXT NOT NULL UNIQUE,   -- Idempotency-Key header
  endpoint             TEXT NOT NULL,          -- 'POST /pos/transactions' etc.
  payload              TEXT NOT NULL,          -- JSON
  status               TEXT NOT NULL           -- pending | syncing | synced | rejected | reconciled
    CHECK (status IN ('pending','syncing','synced','rejected','reconciled')),
  confirmation         TEXT NOT NULL DEFAULT 'provisional'
    CHECK (confirmation IN ('provisional','confirmed','reconciled')),
  reconciliation_kind  TEXT                    -- 'retry_override' | 'record_loss' | 'corrective_void' | NULL
    CHECK (reconciliation_kind IN ('retry_override','record_loss','corrective_void') OR reconciliation_kind IS NULL),
  reconciliation_note  TEXT,                   -- supervisor reason
  reconciliation_by    TEXT,                   -- staff_id who resolved
  reconciled_at        TEXT,
  server_id            INTEGER,                -- filled on 2xx
  server_response      TEXT,                   -- JSON, for receipts/audit
  retry_count          INTEGER NOT NULL DEFAULT 0,
  last_error           TEXT,
  next_attempt_at      TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX ix_queue_status_attempt ON transactions_queue(status, next_attempt_at);
CREATE INDEX ix_queue_confirmation  ON transactions_queue(confirmation);
-- Used by shift-close guard: "any unresolved provisional work blocks close"
CREATE INDEX ix_queue_open_work     ON transactions_queue(status)
  WHERE status IN ('pending','rejected');

-- Sync cursors per entity
CREATE TABLE sync_state (
  entity               TEXT PRIMARY KEY,       -- 'products' | 'stock' | 'prices'
  last_synced_at       TEXT,
  last_cursor          TEXT
);

-- Key/value settings (printer profile, site, language, density)
CREATE TABLE settings (
  key                  TEXT PRIMARY KEY,
  value                TEXT NOT NULL
);

-- Local-only audit trail (never leaves the machine)
CREATE TABLE audit_log (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  event                TEXT NOT NULL,          -- 'drawer.nosale', 'scan.miss', …
  payload              TEXT,
  created_at           TEXT NOT NULL
);

-- Schema versioning (see §4.5 for compatibility + rollback handling)
INSERT INTO settings(key,value) VALUES('schema_version','1');
INSERT INTO settings(key,value) VALUES('min_compatible_app_version','1.0.0');
```

### 4.3 IPC surface

All handlers validate payloads with **Zod** (schemas in `ipc/contracts.ts`, re-exported
to the renderer). Handler names use the `namespace:action` convention.

```
db.products.search(q, limit=20)        → PosProductResult[]
db.products.byCode(drugCode)           → PosProductResult | null
db.stock.forDrug(drugCode, siteCode)   → PosStockInfo

db.queue.enqueue(transaction)          → { local_id, client_txn_id }
db.queue.pending()                     → QueueRow[]
db.queue.rejected()                    → QueueRow[]
db.queue.stats()                       → { pending, rejected, provisional, last_sync_at }
db.queue.reconcile(local_id, kind, note, supervisorPin)
                                       → { status, confirmation, reconciled_at }

authz.currentGrant()                   → OfflineGrant | null
authz.grantState()                     → 'online' | 'offline_valid' | 'offline_expired' | 'revoked'
authz.refreshGrant()                   → OfflineGrant   // requires online
authz.verifySupervisorPin(pin)         → { ok, staff_id } | { ok: false, reason }
authz.capabilities()                   → CapabilitiesDoc   // cached

shift.canClose()                       → { ok, blockers: [{ local_id, reason }] }

db.shifts.current()                    → ShiftRecord | null
db.shifts.open(payload)                → ShiftRecord
db.shifts.close(payload)               → ShiftRecord

db.settings.get(key) / db.settings.set(key, value)

printer.print(receiptPayload)          → { success, error? }
printer.status()                       → { online, paper, cover }
printer.testPrint()                    → { success }

drawer.open()                          → { success }

sync.pushNow()                         → { pushed, failed }
sync.pullNow(entity?)                  → { pulled }
sync.state()                           → { online, last_sync_at, pending, failed }

updater.check() / updater.install()
app.version()
app.logsPath()
```

### 4.4 Decimal handling

Every financial value is a string representation of a `Decimal` throughout the
entire stack — SQLite storage, IPC payloads, and the backend's existing `JsonDecimal`.
Never `number` / `REAL`. Comparisons and arithmetic in the main process use
`decimal.js` (tiny, MIT). Rendering to the UI formats via `Intl.NumberFormat`.

### 4.5 Schema compatibility, backup, and downgrade safety

Forward-only migrations are convenient but dangerous when paired with auto-updates
and a preserved local DB. The following safeguards make bad releases recoverable.

**1. Pre-migration backup (required).** On every app launch, *before* running any
pending migration, the connection layer copies `pos.db` + `pos.db-wal` + `pos.db-shm`
to `pos.db.pre-v{current_version}.bak` (replacing any existing backup for that
version). If the migration fails or the resulting schema is detected as incompatible,
the app restores from the backup and surfaces a clear error.

**2. Bi-directional version check on startup.** Every build declares two constants:

```
APP_SCHEMA_VERSION         = N       // what this build expects
APP_MIN_COMPATIBLE_SCHEMA  = N-k     // lowest schema version this build can read
```

On startup, main reads `schema_version` from the DB and refuses to boot when the
DB is **newer** than the build (`db.schema_version > APP_SCHEMA_VERSION`). This
happens if a user downgrades after an auto-update. The UI shows:

```
⛔ Database schema is newer than this version.
Install DataPulse POS v{db.min_compatible_app_version} or later.
Your local data is preserved at: {userData}/pos.db
```

The app never opens or modifies the DB in this state.

**3. Auto-update gating on non-downgradeable schemas.** Each release's update
manifest declares:

```
{
  version: "1.4.0",
  schema_version: 4,
  requires_queue_drained: true          // set when migration is non-reversible
}
```

The updater refuses to install a version where `requires_queue_drained=true` while
any `transactions_queue` row has `status in (pending, rejected)`. UI message:
`Update postponed: 3 provisional sales must sync first.` This prevents a bad
release from stranding queued cash transactions.

**4. Reversible-by-default migrations.** Every migration ships with a `down.sql`
sibling unless explicitly marked `requires_queue_drained`. The migration runner
records both `up` and `down` SQL alongside the version in a `schema_history` table
for forensic support.

**5. Migration test suite.** CI runs, for each migration:
  - Fresh DB → apply all migrations in order → smoke-test IPC reads
  - Previous-version DB + new migration → read + write + restore backup
  - Corrupted DB file → app fails with a recoverable error, not a crash

```sql
CREATE TABLE schema_history (
  version       INTEGER PRIMARY KEY,
  applied_at    TEXT NOT NULL,
  up_sql_sha    TEXT NOT NULL,
  down_sql_sha  TEXT,                     -- NULL for requires_queue_drained
  app_version   TEXT NOT NULL
);
```

---

## 5. Hardware Integration

### 5.1 Barcode scanner — keyboard-emulation (renderer)

- `hooks/use-pos-scanner.ts` wraps a keystroke buffer
- Timing rule: ≥4 chars arriving within 50ms apart + trailing Enter = scan
- Pauses when an input field with `data-pos-scanner-ignore` is focused
- On scan → calls `db.products.byCode(code)` → adds to cart if found
- Audio feedback: short beep on success, double beep on miss (WebAudio)
- Visual feedback: flashes added cart row green 150ms; shakes search box red on miss
- Escape hatch: if a customer needs raw-HID, a main-process scanner module slots in
  behind the same event contract (`pos:scanner:scanned`) without renderer changes

### 5.2 Thermal printer — `node-thermal-printer` (main)

- Connection: USB (`PrinterTypes.EPSON` / `.STAR` / `.XPRINTER` presets) OR TCP
- Configured via settings page — store name, address, phone, logo upload, printer
  profile, paper width (80mm default, 58mm option)
- `printer.print(payload)` renders the ESC/POS byte stream server-side (in main)
- `printer.status()` runs a quick status check before each print, surfaces
  paper-out / cover-open to UI
- **Receipt preview on screen matches print output** — same font, same width,
  same line breaks
- Mock adapter in `hardware/mock.ts` logs calls to `logs/printer.mock.log`

### 5.3 Cash drawer — ESC p kick OR serialport (main)

- Default path: send ESC p command through the printer (RJ11 cable from drawer to printer)
- Alternate path: direct serialport if configured
- Auto-opens on `paymentMethod in (cash, mixed)`
- F12 "no-sale open" requires supervisor PIN (reuses `PharmacistVerification` modal pattern); logged to local `audit_log`

### 5.4 Receipt payload

```
{
  storeName, storeAddress, storePhone, logoPath,
  transactionId, receiptNumber, createdAt,
  staffName, customerName?,
  items: [{ name, qty, unitPrice, lineTotal, batch?, expiry? }],
  subtotal, discount, tax, total,
  paymentMethod, cashTendered?, changeDue?,
  languages: ['ar','en'],
  currency: 'EGP'
}
```

---

## 6. Sync Infrastructure

### 6.1 Client — push worker

- Runs every 10s when online; immediate on reconnect
- Pushes one pending row at a time (not batched — isolates failure, keeps idempotency trivial)
- On 2xx → `status='synced'`, server id + response persisted
- On 4xx (not 409 replay) → `status='failed'`, surfaced in `/settings → Sync Issues`
- On 5xx / network error → exponential backoff: 1s, 2s, 4s, 8s, 30s, 2m, 5m (cap)
- After 10 consecutive failures → `status='failed'`, user-visible error
- Concurrent push protection: SQLite `UPDATE … WHERE status='pending' LIMIT 1 RETURNING …` claims the row

### 6.2 Client — pull worker

| Entity | Cadence | Cursor |
|---|---|---|
| `products` | 30 min | `updated_at` |
| `prices` | 30 min (part of products) | `updated_at` |
| `stock` | 5 min | `updated_at` |

- Paginated, cursor-based
- On conflict with locally-pending transactions → server wins for catalog/stock reference, local wins for transaction content
- User-visible "Catalog updated 12 min ago" chip in `/settings`

### 6.3 Online detection

Combine `navigator.onLine` with a periodic `HEAD /health` ping (every 30s). State
machine: `online → degraded (ping fails once) → offline (3 pings fail) → online
(1 ping succeeds)`. Prevents flapping.

### 6.4 Server — idempotency contract (required capability, not optional)

**Idempotency is a hard backend prerequisite for this POS client — not an
additive convenience.** The client refuses to sync against any server that does
not advertise `idempotency: "v1"` in its capability response (see §6.6). This
prevents the rollback scenario where removing the idempotency migration allows
duplicate financial mutations: the client will simply stop syncing instead of
silently regressing to non-idempotent retries. Treat the idempotency migration
as an ADDITIVE, NEVER-REVERTED backend capability.

**New table:**

```sql
CREATE TABLE pos_idempotency_keys (
  key             TEXT PRIMARY KEY,
  tenant_id       INTEGER NOT NULL,
  endpoint        TEXT NOT NULL,
  request_hash    TEXT NOT NULL,                   -- SHA256(canonical body)
  response_status INTEGER,
  response_body   JSONB,
  created_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL             -- now() + 24h
);
CREATE INDEX ix_pos_idemp_expires ON pos_idempotency_keys(expires_at);
-- RLS: tenant_id scoped
ALTER TABLE pos_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_idempotency_keys FORCE ROW LEVEL SECURITY;
```

**FastAPI dependency (`api/deps.py`):**

```python
async def idempotency_handler(
    request: Request,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    session: AsyncSession = Depends(get_tenant_session),
) -> IdempotencyContext:
    body = await request.body()
    req_hash = sha256(body).hexdigest()
    existing = await session.execute(select(…))
    if existing:
        if existing.request_hash != req_hash:
            raise HTTPException(409, "Idempotency-Key reuse with different body")
        return IdempotencyContext(replay=True, status=existing.response_status,
                                   body=existing.response_body)
    return IdempotencyContext(replay=False, key=idempotency_key, hash=req_hash)
```

Wrap each target route so: if `replay=True`, return the cached response; otherwise
process the request and record `(key, hash, status, body)` in the same DB transaction
that commits the business write.

### 6.5 Nightly cleanup

Add job in `src/datapulse/tasks/cleanup_idempotency.py`:

```python
DELETE FROM pos_idempotency_keys WHERE expires_at < now();
```

Schedule via existing task scheduler.

### 6.6 Capability negotiation — `GET /pos/capabilities`

The client cannot make safety assumptions about the server. On launch and on every
network reconnect, the client fetches `GET /pos/capabilities` and caches the
response. The client refuses to push mutations if any required capability is
missing or has rolled back.

**Endpoint (unauthenticated, tenant-agnostic — advertises server features only):**

```
GET /pos/capabilities

200 OK
{
  "server_version":        "1.14.0",
  "min_client_version":    "1.0.0",
  "max_client_version":    null,             // null = no upper bound
  "idempotency":           "v1",              // required — client refuses if missing
  "capabilities": {
    "idempotency_key_header":    true,        // required
    "pos_catalog_stream":        true,        // GET /pos/catalog/*
    "pos_shift_close":           true,
    "pos_corrective_void":       true,
    "override_reason_header":    true,        // X-Override-Reason for reconciliation
    "multi_terminal":            false        // §1.4 enforcement
  },
  "enforced_policies": {
    "idempotency_ttl_hours":     24,
    "provisional_ttl_hours":     72           // server-side cap on how long a provisional can stay unconfirmed
  }
}
```

**Client behaviour:**

| Condition | Client action |
|---|---|
| `idempotency != "v1"` OR `capabilities.idempotency_key_header != true` | **Hard stop all sync.** Banner: `⛔ Server incompatible — contact support.` No retries until operator action. Existing provisional sales held. |
| `client_version < min_client_version` | Force auto-update check; if a compatible version is available, install at end-of-shift; if not, stop mutations (reads still work). |
| `client_version > max_client_version` (if set) | Block mutations, prompt for server upgrade. |
| `capabilities.multi_terminal=false` AND another terminal open for tenant | §1.4 enforcement — shift cannot open |
| Any required capability flips from `true` → missing between polls | Treat as incompatible server, stop mutations, surface banner |

**Polling:** on launch, on reconnect, and every 10 min when online. Response
cached in `settings` with a `capabilities_fetched_at` timestamp.

**Rollback posture.** Once a capability is published and clients depend on it,
removing it is a **breaking change requiring a client update**. The capabilities
doc in `docs/pos/capabilities.md` tracks every flag, when it shipped, and its
deprecation policy.

---

## 7. UI / UX

### 7.1 Design language

- **Anchor:** DataPulse dashboard style (teal `#0d9488` primary, dark `#0a0e1a`
  background) + Toast/Clover density patterns
- **Typography:** Inter (Latin) + IBM Plex Sans Arabic; 14px base, 12px dense, 20–32px totals
- **Colors:** amber `#f59e0b` warnings (offline, low stock), red `#dc2626` errors, green flash on success
- **Components:** shadcn/ui (existing) — Card, Button, Input, Dialog, Toast, Command, Sheet
- **Motion:** 150ms cart slide-in, green flash on total change, subtle only
- **Density modes:** `compact` default, `comfortable` for touchscreens, toggle in settings

### 7.2 Terminal layout (cart-dominant)

```
┌───────────────────────────────────────┬─────────────────┐
│ Cart                     #TXN-00142   │ [Search F1]     │
│ ─────────────────────────────────────│                 │
│ 1  Paracetamol 500mg        12.00    │ ┌─────────────┐ │
│    Batch ABC-2026-01  ×1             │ │Quick actions│ │
│    ───────────────────────────────── │ │ F3 Hold     │ │
│ 2  Amoxicillin 250mg        48.00    │ │ F4 Void     │ │
│    Batch XYZ-2026-03  ×2             │ │ F5 Discount │ │
│                                      │ │ F7 Shift    │ │
│ Subtotal                      60.00  │ │ F8 Reprint  │ │
│ Discount                      -0.00  │ └─────────────┘ │
│ Tax                           +8.40  │ Customer        │
│ ═══════════════════════════════════  │ Walk-in [F6]    │
│ TOTAL                  EGP 68.40     │                 │
│ [  F2 — Checkout  ]                  │ Terminal: T-1   │
│                                      │ Shaaban · shift │
└───────────────────────────────────────┴─────────────────┘
```

- Cart + total dominate. Search is a **scan-triggered modal** (Command palette style),
  not a permanent panel
- Right rail is a thin "context sidebar" — quick actions, customer, terminal info
- Total is the biggest thing on screen; visible from 2m away

### 7.3 Screen inventory

| Screen | Purpose | Layout |
|---|---|---|
| `/terminal` | Ring up customers | §7.2 above |
| `/checkout` | Payment capture | Full-screen modal over terminal |
| `/shift` | Open/close shift, cash events | Standalone with summary cards |
| `/history` | Today's transactions + reprint/void | Table + detail side-panel |
| `/pos-returns` | Refunds | 3-step wizard |
| `/settings` **(new)** | Hardware, tax, language, theme, sync issues | Tabbed, admin-only |

### 7.4 Keyboard shortcut map

| Key | Action |
|---|---|
| **F1** | Focus product search |
| **F2** | Checkout |
| **F3** | Hold / park cart |
| **F4** | Void last item |
| **F5** | Apply discount |
| **F6** | Open customer panel |
| **F7** | Shift panel (cash events) |
| **F8** | Print last receipt |
| **F9** | Toggle language AR ↔ EN |
| **F10** | Open returns |
| **F12** | Open cash drawer (no-sale, logged) |
| **Esc** | Close modal / clear search |
| **Enter** | Confirm / submit |
| **+ / −** | Qty up / down on focused line |
| **Del** | Remove focused line |
| **Ctrl+P** | Pay with cash |
| **Ctrl+K** | Command palette |

- Every shortcut shown as a chip on its button
- Shortcuts **pause** when an input has focus (except Esc, Enter, F1)
- No hidden shortcuts — if it's not on UI, it doesn't exist
- `aria-keyshortcuts` on every actionable element

### 7.5 Offline UX

- Thin amber strip at top of every page: `⚠ Offline — 3 pending · Last sync 2 min ago`
- Turns red after configurable threshold (default 4h): `⛔ Offline too long — data may be stale`
- Green flash for 2s on successful batch sync: `✓ Synced 3 transactions`
- Never blocks UI; never modal

### 7.6 i18n

- **`next-intl`** (already installed)
- Languages: `ar-EG` (default), `en-US`
- RTL auto-switches via `dir` attribute
- Currency formatted per locale; Western-numerals override available in settings
- Translation files: `frontend/messages/ar.json`, `en.json`
- F9 toggles at runtime, persisted in `settings` table

### 7.7 Accessibility

- WCAG AA contrast across both themes
- Full keyboard navigation; tab order matches reading order (flips RTL/LTR)
- Visible high-contrast focus ring on all actionables
- `aria-keyshortcuts` attribute everywhere
- Announce cart changes via a polite aria-live region

### 7.8 Cosmetic & micro-interactions

- Scan confirmation: 150ms green row flash + soft beep
- Missed scan: 150ms red shake of search bar + double beep
- Total change: brief green pulse on total digits
- Skeleton loaders instead of spinners on initial catalog sync
- Toast notifications (bottom-right) for background sync events
- Empty state illustrations on empty cart / empty history / empty returns
- Receipt preview that matches print exactly

---

## 8. Packaging, Updater, Security

### 8.1 Electron version

- **Electron 33 LTS** — current scaffold is on 33, keep
- Annual LTS rebase, not monthly
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` (already set)

### 8.2 Content Security Policy

```
default-src 'self';
script-src 'self';
connect-src 'self' https://smartdatapulse.tech https://*.sentry.io https://*.auth0.com;
img-src 'self' data: https:;
style-src 'self' 'unsafe-inline';
font-src 'self' data:;
```

Set via Next.js `headers()` config + Electron `session.defaultSession.webRequest.onHeadersReceived`.

### 8.3 Installer — `electron-builder` NSIS

- Windows x64, per-machine install
- Desktop + start-menu shortcuts, configurable install dir
- Artifact name: `DataPulse-POS-{version}-Setup.exe`
- Existing `electron-builder.yml` already has the right shape — enable the commented
  `publish:` block for GitHub Releases

### 8.4 Code signing

- **EV code-signing certificate** (DigiCert or SSL.com, ~USD 400/yr)
- Start procurement **day 1** — can take 2-3 weeks
- Cert private key in GitHub Actions secret, never in the repo
- CI signs automatically on `main` tags; local dev builds stay unsigned with a warning

### 8.5 Auto-updater

- `electron-updater` + GitHub Releases (private repo, deploy token)
- Check at launch + every 4h
- Download in background
- Prompt restart **only at end of shift** (hook into "Close shift" flow) or when app idle >30min
- Two channels: `stable` (default) and `beta` (internal QA)

### 8.6 Crash reporting — Sentry

- Electron SDK — captures main + renderer + preload
- PII redaction on (no drug codes, no prices, no names, no customer IDs)
- Breadcrumbs fed from pino logs
- Release tag matches app version
- Self-hosted Sentry if cloud budget blocked

### 8.7 Client logging

- **Pino** (structured JSON) in main process
- Rotate at 10MB, keep 7 files, stored in `app.getPath('logs')`
- Renderer: `console` + Sentry breadcrumbs
- Hidden log viewer via `Ctrl+Shift+L` for support
- Never log prices, drug codes, or customer PII

### 8.8 Offline authorization model

The terminal is a shared physical workstation. "Cache JWT + extend TTL" is not an
auth model on shared hardware — a revoked or fired staff account can keep selling
until the terminal reconnects. The offline auth model below treats the terminal
itself as the primary security boundary, independent of which staff member is
active.

#### 8.8.1 Secret storage — Windows DPAPI

All secrets (Auth0 tokens, staff role snapshots, terminal offline-grant) are
encrypted with **Windows DPAPI** (`CurrentUser` scope) before being written to
`pos.db`. A user on the same machine under a different Windows account cannot
read them; a stolen drive cannot be decrypted on another machine.

Implementation: `hardware/dpapi.ts` wraps Node's `crypto.protectData()` /
`unprotectData()` via `node-dpapi-prebuilt`. The IPC surface exposes only
opaque cipher blobs; plaintext tokens never leave the main process.

#### 8.8.2 Terminal-scoped offline grant

When a shift opens **while online**, the server issues a signed **Offline Grant**:

```
POST /pos/shifts/open
→ { shift: {...}, offline_grant: {jwt_blob} }

jwt_blob (HS256, issued by API, keyed to tenant):
{
  "iss":            "datapulse-pos",
  "terminal_id":    42,
  "tenant_id":      7,
  "staff_id":       "s-123",
  "shift_id":       1001,
  "issued_at":      "2026-04-17T06:00:00Z",
  "offline_expires_at":  "2026-04-17T18:00:00Z",    // issued_at + 12h (configurable per tenant)
  "role_snapshot": {
    "can_checkout":          true,
    "can_void":              false,
    "can_override_price":    false,
    "can_apply_discount":    true,
    "max_discount_pct":      15,
    "can_process_returns":   false,
    "can_open_drawer_no_sale": false,
    "can_close_shift":       true
  }
}
```

The grant is stored DPAPI-encrypted in `settings.offline_grant`. Its signature is
verified on every privileged action in the main process using the tenant's HS256
key (fetched at shift-open and rotated daily by the server).

#### 8.8.3 Degradation policy

| State | Allowed actions |
|---|---|
| **Online + valid JWT** | All role-appropriate actions |
| **Offline + valid grant + not expired** | Actions per `role_snapshot` — cashier can ring up sales, apply discounts ≤15%, close shift. Void/return/price-override blocked. |
| **Offline + grant expired (past `offline_expires_at`)** | **Read-only mode.** No new sales, no checkout, no shift close, no drawer. UI banner: `⛔ Offline authorization expired — reconnect to continue selling.` Existing cart can still be reviewed and voided locally. |
| **Offline + no grant** (app launched offline, no shift ever opened while online) | Read-only, no shift-open. |
| **Online + JWT refresh fails (auth revoked server-side)** | Immediate lock: banner `⛔ Session revoked — contact administrator.` Current cart preserved for 24h so supervisor can complete or void it. |

Critical rule: **`role_snapshot` is the ceiling offline, never a floor.** If the
server would have denied an action online, the offline grant must deny it too.
The shift-open grant is the only source of offline authorization — mid-shift
role changes on the server take effect on next reconnect only.

#### 8.8.4 Privileged action enforcement

Every privileged IPC handler in `main` re-verifies the grant before executing:

```ts
// Example: printer.openDrawerNoSale
ipcMain.handle('drawer:open-no-sale', async (_evt, { supervisorPin }) => {
  const grant = await authz.currentGrant();
  if (!grant || authz.isGrantExpired(grant)) {
    throw new AuthzError('offline_expired');
  }
  if (!grant.role_snapshot.can_open_drawer_no_sale) {
    throw new AuthzError('insufficient_role');
  }
  const supervisor = await authz.verifySupervisorPin(supervisorPin);
  if (!supervisor) throw new AuthzError('supervisor_invalid');
  // ... proceed
});
```

Supervisor PINs are cached at shift-open in the grant's `supervisor_pin_hashes`
field (scrypt-hashed, pepper from tenant key). Up to 5 supervisor PINs cached
per grant. A PIN rotation on the server takes effect at the next shift-open.

#### 8.8.5 Grant rotation + reconnect

On every reconnect:
- Fetch fresh grant via `POST /pos/shifts/{id}/refresh-grant`
- Replace DPAPI blob atomically
- Apply any role-snapshot changes (e.g., `can_void` flipped off → UI hides void)

If the refresh call returns 401/403 → session was revoked server-side → enter
"revoked" state (see table above), preserve cart, lock further mutations.

---

## 9. Testing

### 9.1 Unit

- **Vitest** for renderer (`frontend/src/lib/pos/*`, new hooks, components)
- **Jest** for main-process (`pos-desktop/electron/**`)
- Coverage: 85%+ on new code
- Mock IPC via Zod schema fixtures shared between sides

### 9.2 Contract

- Zod schemas in `ipc/contracts.ts` used as runtime contracts + test fixtures
- Every IPC call has a `.parse()` test case for valid + invalid payloads

### 9.3 Integration — Playwright against Electron

- `HARDWARE_MODE=mock` — printer/drawer fakes record calls
- Scenarios:
  - Open shift → scan 5 items → cash checkout → mock printer called → mock drawer opened → close shift
  - Same flow with `navigator.onLine=false` → verify offline banner + queue row + receipt
    printed with `PROVISIONAL` marker; flip online → verify banner sync flash +
    history row `provisional → confirmed`
  - Return flow: complete sale, then refund, verify refund receipt
  - Offline → online reconnect mid-queue → verify all drain
  - **Rejected-provisional reconciliation:** offline checkout → mock server returns
    4xx on reconnect for that row → verify row shows in Sync Issues → apply
    `retry_override` with supervisor PIN → verify `status=reconciled` + audit log
  - **Shift-close guard:** provisional pending → attempt close → verify modal
    blocks with blocker list; reconcile → attempt close → verify close succeeds
  - **Single-terminal enforcement:** seed two open terminals for tenant → launch
    client → verify `Another terminal active` banner + shift cannot open
  - **Capability incompatibility:** mock server returns `idempotency: null` → verify
    client hard-stops sync + banner; flip to `"v1"` → verify sync resumes
  - **Offline grant expiry:** advance mock clock past `offline_expires_at` → verify
    read-only mode + all mutating IPC calls reject with `offline_expired`
  - **Grant revocation:** online refresh returns 401 → verify locked state + cart
    preserved + banner `Session revoked`
  - **Schema downgrade refusal:** inject DB with `schema_version=99` → launch app
    → verify refuses to boot with correct "install v… or later" message
  - **Pre-migration backup:** advance schema, corrupt migration → verify restore
    from `.bak` file and app recovers

### 9.4 Backend

- pytest for `idempotency_handler`: fresh key, replay, hash-mismatch 409, TTL expiry, concurrent double-submit
- pytest for cleanup task
- Existing POS endpoint tests stay green — only change is the added header
- pytest for `GET /pos/capabilities`: returns required flags, serializes cleanly,
  is unauthenticated but rate-limited
- pytest for single-terminal guard on `POST /pos/terminals`: second concurrent
  terminal rejected with 409 when tenant flag is false; allowed when true
- pytest for offline-grant issuance on `POST /pos/shifts/open`: grant embeds
  correct role snapshot, signature verifies, `offline_expires_at` respects tenant setting
- pytest for override reconciliation path (`X-Override-Reason` header on retry)
  requiring supervisor credential and recording in audit log

### 9.5 Manual hardware smoke (pre-release checklist)

Run on a physical dev rig before each tagged release:

- [ ] Plug scanner → scan known product → adds to cart, beep
- [ ] Plug scanner → scan unknown code → red shake, error toast
- [ ] Checkout cash → receipt prints with correct formatting
- [ ] Receipt matches screen preview byte-for-byte
- [ ] Drawer kicks open on cash payment
- [ ] F12 no-sale → prompts supervisor PIN → drawer opens → audit log entry
- [ ] Unplug ethernet mid-checkout → receipt prints, queue row exists
- [ ] Re-plug ethernet → queue drains within 30s → banner flashes green
- [ ] Install signed `.exe` on clean Windows VM → no SmartScreen warning
- [ ] Published new version → auto-updater prompts at end-of-shift

---

## 10. Migration & Rollout Plan

### 10.1 Feature flag

Env var `NEXT_PUBLIC_FEATURE_POS_DESKTOP=true` gates the terminal navigation and
desktop-specific hooks. Default `false` so web frontend users never see desktop-only behaviour.

### 10.2 Pilot plan

1. **Week 1:** Internal QA install (unsigned build OK)
2. **Week 2:** One pilot pharmacy, read-only product catalog + receipts only (no drawer)
3. **Week 3:** Same pilot pharmacy, full checkout + drawer + offline mode
4. **Week 4:** Two more pilots + first signed release
5. **Week 5:** Go/no-go review; broad rollout if no critical issues

### 10.3 Data migration

None. The POS backend tables already exist; only additions are `pos_idempotency_keys`.
Local SQLite is created on first launch.

### 10.4 Rollback

**Client rollback (app uninstall or downgrade):**
- Installer's uninstaller cleanly removes the app binaries
- Local `pos.db` is preserved on uninstall (available at `%APPDATA%/datapulse-pos/`)
- A downgrade install that opens a newer-version DB refuses to boot per §4.5
  bi-directional version check; the user is told which version to install
- Pre-migration backups at `pos.db.pre-v{N}.bak` allow a support tech to manually
  restore a prior schema if needed

**Server rollback — idempotency migration is NOT revertible:**
- The idempotency migration (`pos_idempotency_keys` table + `Depends(idempotency_handler)`)
  is an **advertised capability** (§6.6 `capabilities.idempotency_key_header`).
  Once published, it must remain. Reverting it causes all connected POS clients
  to refuse to sync (§6.6 client behaviour table) — by design. This is safer than
  the alternative of silently regressing to non-idempotent retries and duplicating
  financial mutations.
- If a server defect **specifically in the idempotency handler** must be rolled
  back, the path is: ship a server hotfix that restores handler behaviour while
  keeping the capability flag `true`. Never flip the capability `false`.
- Other POS server changes (new routes, new fields) follow the normal additive
  migration pattern and can be reverted without breaking the client.

**Catalog endpoint rollback:**
- If `pos_catalog_stream` capability must be withdrawn, clients fall back to
  read-only mode (existing catalog snapshot stays usable) and stop pulling
  updates — they do not silently fail to an older unsafe path.

**Update manifest rollback:**
- Publishing a bad release to `stable` channel: yank the release from GitHub
  Releases, clients on older versions continue working; clients that already
  upgraded stay on the bad release until the next `stable` publish.
- Never rollback a release that introduced a non-downgradeable schema migration
  (§4.5) without a dedicated forward-fix release that can open the newer schema.

---

## 11. Risks & Open Items

| Risk | Mitigation |
|---|---|
| `better-sqlite3` native build fails on dev Windows | Documented setup with `windows-build-tools`; CI pre-builds binary; last-resort fallback to `sql.js` |
| Some scanners emit non-HID-keyboard codes | Preload reserves `pos:scanner:scanned` event contract; main-process scanner slots in later |
| EV cert procurement takes weeks | Start paperwork day 1; unsigned builds OK for internal QA |
| Catalog endpoints may not exist in current form | Verify against `src/datapulse/pos/repository.py` during plan phase; add endpoints if needed |
| Thermal printer drivers vary by vendor | Ship test-print + "printer profile" selector (Epson, Star, Xprinter presets) |
| Offline → online catalog drift | Show `Catalog last updated: 27 min ago` chip; force-refresh button |
| Keyboard shortcuts collide with Arabic IME | Test with Windows Arabic keyboard layout; fall back to Ctrl+shortcut alternates |
| Power loss mid-transaction | WAL journal + queue row written before API call — resumes on next launch |
| Provisional sale takes cash for a transaction the server rejects | §3.6 reconciliation workflow (retry-override / record-loss / corrective-void) + §1.3 shift-close guard blocks banking the cash until resolved |
| Terminal used while offline by revoked staff | §8.8 terminal-scoped offline grant with 12h max age, DPAPI-protected; revocation takes effect at next reconnect; read-only mode after grant expiry |
| Bad release ships non-downgradeable schema | §4.5 pre-migration backups, bi-directional version check refuses to boot on newer schema, update manifest gates incompatible releases until queue is drained |
| Server idempotency accidentally disabled in an incident | §6.6 capability negotiation — clients stop syncing instead of silently retrying non-idempotently; §10.4 designates idempotency as non-revertible capability |
| Two tills accidentally activated at a single-terminal pharmacy | §1.4 three-layer enforcement (tenant flag + server guard + client guard); second terminal cannot open a shift |

---

## 12. Success Metrics (90-day post-launch)

- **Install success rate** ≥ 98% on signed builds
- **Checkout latency (online)** p95 < 800ms
- **Checkout latency (offline)** p95 < 300ms
- **Sync latency after reconnect** p95 < 30s
- **Hardware smoke pass rate** 100% of releases
- **Sentry crash-free sessions** ≥ 99%
- **Pharmacist NPS** ≥ 40 (survey at day 30)

---

## 13. Appendix — What's already scaffolded

Partial credit from prior work (branch `feat/pos-electron-desktop` / PR #393):

- `pos-desktop/` Electron shell: `main.ts` (window, tray, single-instance, nav guard),
  `preload.ts` (contextBridge skeleton with commented Phase 2 stubs), `package.json`,
  `electron-builder.yml`, `scripts/build.sh`
- Frontend: pages `/terminal`, `/checkout`, `/shift`, `/history`, `/pos-returns`; components
  `CartItem`, `CartPanel`, `NumPad`, `PaymentPanel`, `PharmacistVerification`,
  `ProductSearch`, `ReceiptPreview`, `ReturnForm`, `ShiftSummary`, `VoidModal`,
  `OfflineBadge`
- Backend `src/datapulse/pos/`: `models.py`, `constants.py`, `service.py`, `repository.py`,
  `terminal.py`, `payment.py`, `receipt.py`, `pharmacist_verifier.py`,
  `inventory_adapter.py`, `inventory_contract.py`, `exceptions.py`

This design layers onto that scaffold; it does not discard it.

---

**End of design.**
