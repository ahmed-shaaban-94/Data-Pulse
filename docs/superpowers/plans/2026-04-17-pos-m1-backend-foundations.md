# POS Desktop — M1 Backend Foundations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the backend-only prerequisites for the Electron POS desktop client: atomic commit endpoint, idempotency contract, capability negotiation, device-bound terminal credentials, Ed25519 offline grants, server-enforced override ledger, server-enforced shift-close guard, catalog streaming, and single-terminal enforcement. Nothing in this milestone touches the web frontend or the Electron app; it's strictly additive API work behind new endpoints and new FastAPI dependencies.

**Architecture:** Migrations in `migrations/NNN_*.sql` with idempotent `CREATE IF NOT EXISTS` + RLS. New FastAPI dependencies in `src/datapulse/api/deps.py` (or new modules for larger concerns). New routes added to `src/datapulse/api/routes/pos.py` where they fit, or new sub-modules under `src/datapulse/pos/` for orthogonal concerns (keys, grants, devices, overrides). Every new route is rate-limited, RLS-scoped, and covered by pytest.

**Tech Stack:** Python 3.11+ · FastAPI · SQLAlchemy 2.0 · PostgreSQL 16 · Pydantic v2 · `cryptography` (Ed25519) · `PyNaCl` (alternative) · pytest.

**Spec:** `docs/superpowers/specs/2026-04-17-pos-electron-desktop-design.md` @ `7715fd9`.

---

## File Map

### New migrations

| File | Purpose |
|---|---|
| `migrations/077_add_pos_idempotency_keys.sql` | Request dedupe table (§6.4) |
| `migrations/078_add_pos_commit_confirmed_at.sql` | `pos.transactions.commit_confirmed_at` column for server-side shift-close guard |
| `migrations/079_add_pos_terminal_devices.sql` | Device-bound terminal credentials (§8.9) |
| `migrations/080_add_pos_tenant_keys.sql` | Tenant Ed25519 signing keypairs + public key history |
| `migrations/081_add_pos_grants_issued.sql` | Server-side grant registry (issued codes + expiry) |
| `migrations/082_add_pos_override_consumptions.sql` | One-time-use override ledger (§8.8.6) |
| `migrations/083_add_pos_shifts_close_attempts.sql` | Forensic close-attempt log (§3.6) |
| `migrations/084_add_pos_tenant_flags.sql` | `tenants.pos_multi_terminal_allowed` + `pos_max_terminals` (§1.4) |

### New / modified Python modules

| File | Action | Purpose |
|---|---|---|
| `src/datapulse/pos/capabilities.py` | Create | Capability doc constants + `CapabilitiesDoc` Pydantic model |
| `src/datapulse/pos/idempotency.py` | Create | `IdempotencyContext` + `idempotency_handler` dependency factory |
| `src/datapulse/pos/tenant_keys.py` | Create | Ed25519 keypair generation, rotation, public-key list |
| `src/datapulse/pos/devices.py` | Create | Terminal device registration + `device_token_verifier` dependency |
| `src/datapulse/pos/grants.py` | Create | Offline grant issuance + `pos_grants_issued` persistence |
| `src/datapulse/pos/overrides.py` | Create | `override_token_verifier` dependency + ledger writes |
| `src/datapulse/pos/commit.py` | Create | Atomic commit endpoint handler (draft+items+checkout in one payload) |
| `src/datapulse/pos/catalog_stream.py` | Create | Cursor-paginated product + stock streams |
| `src/datapulse/api/routes/pos.py` | Modify | Wire new dependencies to existing void / checkout / shift-close routes; add new routes |
| `src/datapulse/api/deps.py` | Modify | Re-export new dependency factories |
| `src/datapulse/tasks/cleanup_pos_idempotency.py` | Create | Nightly delete expired keys |
| `src/datapulse/pos/models.py` | Modify | Add Pydantic models for capabilities, grants, devices, commit payload, close-with-claim |

### New tests

| File | Purpose |
|---|---|
| `tests/test_pos_idempotency.py` | Dedupe + TTL + 409 hash-mismatch + concurrent double-submit |
| `tests/test_pos_capabilities.py` | Endpoint returns required flags; rate-limited; no tenant state |
| `tests/test_pos_tenant_keys.py` | Keypair rotation, overlap window, verification |
| `tests/test_pos_devices.py` | Registration, signature verification, fingerprint mismatch, revocation |
| `tests/test_pos_grants.py` | Issuance, signature verification, code_id registry, grant refresh |
| `tests/test_pos_overrides.py` | Token verifier, one-time-use PK conflict, action binding |
| `tests/test_pos_commit.py` | Atomic commit, idempotent replay, stock decrement in one DB tx |
| `tests/test_pos_catalog_stream.py` | Cursor pagination, since-filter, RLS |
| `tests/test_pos_shift_close_guard.py` | Client claim check, server-side incomplete-tx check, forensic row |
| `tests/test_pos_single_terminal_guard.py` | 409 when terminal count exceeds tenant limit |
| `tests/test_pos_cleanup_task.py` | Expired keys deleted; retention invariant enforced |

---

## Conventions for every task

1. **Branch is `feat/pos-electron-desktop`.** Do not switch branches.
2. **TDD always.** Test first, watch it fail, implement, watch it pass.
3. **Commit at the end of every task** with a focused, imperative-mood message.
4. **Migrations are idempotent** — always `IF NOT EXISTS` and wrap policy creation in `DO $$ BEGIN … EXCEPTION WHEN duplicate_object … END $$`.
5. **Every new mutating route** receives `Depends(device_token_verifier)` and `Depends(idempotency_handler(…))` unless the task explicitly says otherwise.
6. **Every test** runs under `pytest` and is self-contained (creates its own fixtures; does not rely on other tests' state).
7. **Run the focused test** after each implementation step; run the full POS test suite at the end of each milestone.

---

## Task 1: Migration — `pos_idempotency_keys`

**Files:**
- Create: `migrations/077_add_pos_idempotency_keys.sql`
- Test: `tests/test_pos_idempotency.py`

- [ ] **Step 1: Create the migration file**

```sql
-- Migration: 077 — POS idempotency keys
-- Layer: POS operational
-- Idempotent.

CREATE TABLE IF NOT EXISTS pos.idempotency_keys (
    key             TEXT PRIMARY KEY,
    tenant_id       INT NOT NULL,
    endpoint        TEXT NOT NULL,
    request_hash    TEXT NOT NULL,
    response_status INT,
    response_body   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pos_idemp_expires
    ON pos.idempotency_keys (expires_at);

ALTER TABLE pos.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos.idempotency_keys FORCE  ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY owner_all ON pos.idempotency_keys
        FOR ALL TO datapulse USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_select ON pos.idempotency_keys
        FOR SELECT TO datapulse_reader
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INT);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pos.idempotency_keys TO datapulse;
GRANT SELECT ON TABLE pos.idempotency_keys TO datapulse_reader;

COMMENT ON TABLE pos.idempotency_keys IS
  'Request dedupe for POS mutating endpoints. TTL = 168h (> provisional_ttl 72h + 96h safety margin). RLS-protected.';
```

- [ ] **Step 2: Apply the migration locally**

Run:
```bash
docker compose exec postgres psql -U datapulse -d datapulse -f /migrations/077_add_pos_idempotency_keys.sql
```

Expected: `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`, policy creations complete without error.

Verify:
```bash
docker compose exec postgres psql -U datapulse -d datapulse -c "\\d pos.idempotency_keys"
```

Expected: table shown with all 8 columns + RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add migrations/077_add_pos_idempotency_keys.sql
git commit -m "feat(pos): add pos.idempotency_keys migration"
```

---

## Task 2: `IdempotencyContext` + `idempotency_handler` dependency factory

**Files:**
- Create: `src/datapulse/pos/idempotency.py`
- Create: `tests/test_pos_idempotency.py`

- [ ] **Step 1: Write the failing test for fresh-key-then-replay**

Create `tests/test_pos_idempotency.py`:

```python
"""Idempotency handler tests.

Covers: fresh key storage, replay from cache, 409 on hash mismatch,
TTL expiry, concurrent double-submit.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.orm import Session

from datapulse.pos.idempotency import (
    IDEMPOTENCY_TTL_HOURS,
    IdempotencyContext,
    check_and_claim,
    record_response,
)


def _hash(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()


def test_fresh_key_is_claimed_and_then_replayed(session: Session):
    """First request inserts the key; second request with same hash replays."""
    tenant_id = 1
    key = "idem-fresh-1"
    endpoint = "POST /pos/transactions/commit"
    body = b'{"total": "12.00"}'

    # First request — fresh
    ctx1 = check_and_claim(session, key, tenant_id, endpoint, _hash(body))
    assert ctx1.replay is False
    assert ctx1.cached_status is None

    # Record a fake 2xx response
    record_response(session, key, 200, {"ok": True})
    session.commit()

    # Second request — same hash — replay
    ctx2 = check_and_claim(session, key, tenant_id, endpoint, _hash(body))
    assert ctx2.replay is True
    assert ctx2.cached_status == 200
    assert ctx2.cached_body == {"ok": True}
```

- [ ] **Step 2: Run the test — expect import error**

Run:
```bash
cd /c/Users/Shaaban/Documents/GitHub/Data-Pulse
PYTHONPATH=src pytest tests/test_pos_idempotency.py::test_fresh_key_is_claimed_and_then_replayed -v
```

Expected: `ModuleNotFoundError: datapulse.pos.idempotency` or `ImportError`.

- [ ] **Step 3: Implement `idempotency.py`**

Create `src/datapulse/pos/idempotency.py`:

```python
"""POS request idempotency.

Dedupes retried mutating requests by client-supplied ``Idempotency-Key``.
The retention window (168h) strictly exceeds the provisional queue window
(72h) so every client retry falls inside the server's dedupe horizon.

Design ref: docs/superpowers/specs/2026-04-17-pos-electron-desktop-design.md §6.4.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Header, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

IDEMPOTENCY_TTL_HOURS: int = 168
PROVISIONAL_TTL_HOURS: int = 72


@dataclass(frozen=True)
class IdempotencyContext:
    key: str
    request_hash: str
    replay: bool
    cached_status: int | None = None
    cached_body: dict[str, Any] | None = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def check_and_claim(
    session: Session,
    key: str,
    tenant_id: int,
    endpoint: str,
    request_hash: str,
) -> IdempotencyContext:
    """Look up the key; if absent, claim a new row and return replay=False.

    Raises HTTPException(409) when a row exists with a different request_hash
    (idempotency key reuse with different body).
    """
    row = session.execute(
        text(
            """
            SELECT request_hash, response_status, response_body, expires_at
              FROM pos.idempotency_keys
             WHERE key = :key AND tenant_id = :tenant_id
            """
        ),
        {"key": key, "tenant_id": tenant_id},
    ).mappings().first()

    if row:
        if row["expires_at"] < _now():
            # Treat expired as absent — re-claim
            session.execute(
                text("DELETE FROM pos.idempotency_keys WHERE key = :key AND tenant_id = :tid"),
                {"key": key, "tid": tenant_id},
            )
        else:
            if row["request_hash"] != request_hash:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Idempotency-Key reuse with different request body.",
                )
            return IdempotencyContext(
                key=key,
                request_hash=request_hash,
                replay=True,
                cached_status=row["response_status"],
                cached_body=row["response_body"],
            )

    expires = _now() + timedelta(hours=IDEMPOTENCY_TTL_HOURS)
    try:
        session.execute(
            text(
                """
                INSERT INTO pos.idempotency_keys
                    (key, tenant_id, endpoint, request_hash, expires_at)
                VALUES (:key, :tid, :endpoint, :hash, :exp)
                """
            ),
            {"key": key, "tid": tenant_id, "endpoint": endpoint, "hash": request_hash, "exp": expires},
        )
    except IntegrityError:
        # Concurrent insert lost the race; re-read
        session.rollback()
        return check_and_claim(session, key, tenant_id, endpoint, request_hash)

    return IdempotencyContext(key=key, request_hash=request_hash, replay=False)


def record_response(
    session: Session,
    key: str,
    response_status: int,
    response_body: dict[str, Any] | None,
) -> None:
    """Persist the response for a previously-claimed key."""
    session.execute(
        text(
            """
            UPDATE pos.idempotency_keys
               SET response_status = :st, response_body = :body
             WHERE key = :key
            """
        ),
        {"key": key, "st": response_status, "body": response_body},
    )


def hash_body(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()
```

- [ ] **Step 4: Run the test to confirm it passes**

Run:
```bash
PYTHONPATH=src pytest tests/test_pos_idempotency.py::test_fresh_key_is_claimed_and_then_replayed -v
```

Expected: PASS.

- [ ] **Step 5: Add hash-mismatch test**

Append to `tests/test_pos_idempotency.py`:

```python
def test_hash_mismatch_raises_409(session: Session):
    from fastapi import HTTPException

    tenant_id = 1
    key = "idem-mismatch-1"
    endpoint = "POST /pos/transactions/commit"

    check_and_claim(session, key, tenant_id, endpoint, _hash(b'{"a":1}'))
    record_response(session, key, 200, {"ok": True})
    session.commit()

    with pytest.raises(HTTPException) as exc:
        check_and_claim(session, key, tenant_id, endpoint, _hash(b'{"a":2}'))
    assert exc.value.status_code == 409
```

- [ ] **Step 6: Run both tests**

Run:
```bash
PYTHONPATH=src pytest tests/test_pos_idempotency.py -v
```

Expected: both tests PASS.

- [ ] **Step 7: Add TTL-expiry test**

Append:

```python
def test_expired_key_is_reclaimable(session: Session, monkeypatch):
    from datapulse.pos import idempotency as idem

    tenant_id = 1
    key = "idem-ttl-1"
    endpoint = "POST /pos/transactions/commit"
    body_hash = _hash(b'{"x":1}')

    # First call uses a backdated "now" so the key expires before the next call
    far_past = datetime.now(timezone.utc) - timedelta(hours=IDEMPOTENCY_TTL_HOURS + 1)
    monkeypatch.setattr(idem, "_now", lambda: far_past)
    check_and_claim(session, key, tenant_id, endpoint, body_hash)
    session.commit()

    # Second call with real time — expired row should be deleted and re-claimed fresh
    monkeypatch.undo()
    ctx = check_and_claim(session, key, tenant_id, endpoint, body_hash)
    assert ctx.replay is False
```

- [ ] **Step 8: Run the TTL test**

Run:
```bash
PYTHONPATH=src pytest tests/test_pos_idempotency.py::test_expired_key_is_reclaimable -v
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/datapulse/pos/idempotency.py tests/test_pos_idempotency.py
git commit -m "feat(pos): add idempotency dedupe module with 168h TTL"
```

---

## Task 3: FastAPI dependency factory `idempotency_dependency`

**Files:**
- Modify: `src/datapulse/pos/idempotency.py`
- Modify: `tests/test_pos_idempotency.py`

- [ ] **Step 1: Write a failing test for the dependency**

Append to `tests/test_pos_idempotency.py`:

```python
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from datapulse.pos.idempotency import idempotency_dependency


def test_dependency_replays_cached_response(session_override):
    """On second call with same key + body, the route handler is NOT invoked —
    the cached response is returned directly."""
    app = FastAPI()
    call_count = {"n": 0}

    @app.post("/echo")
    async def echo(
        request: dict,
        idem = Depends(idempotency_dependency("POST /echo")),
    ):
        if idem.replay:
            return idem.cached_body
        call_count["n"] += 1
        body = {"echo": request.get("x"), "n": call_count["n"]}
        # test hook: real routes would call record_response in a shared transaction
        from datapulse.pos.idempotency import record_response
        from sqlalchemy.orm import Session
        sess: Session = next(session_override())
        record_response(sess, idem.key, 200, body)
        sess.commit()
        return body

    client = TestClient(app)
    # First call
    r1 = client.post("/echo", json={"x": 5}, headers={"Idempotency-Key": "k1"})
    assert r1.status_code == 200
    assert r1.json() == {"echo": 5, "n": 1}
    # Second call with same body — replay, n stays 1
    r2 = client.post("/echo", json={"x": 5}, headers={"Idempotency-Key": "k1"})
    assert r2.json()["n"] == 1
    assert call_count["n"] == 1
```

Note: `session_override` is a pytest fixture that yields a session scoped to the test DB. If it doesn't exist yet, add it to `tests/conftest.py`. Use the existing `session` fixture pattern — search for other `conftest.py` helpers under `tests/` to match the project's pattern.

- [ ] **Step 2: Run the test**

Run:
```bash
PYTHONPATH=src pytest tests/test_pos_idempotency.py::test_dependency_replays_cached_response -v
```

Expected: FAIL — `ImportError: cannot import name 'idempotency_dependency'`.

- [ ] **Step 3: Add the dependency factory to `idempotency.py`**

Append to `src/datapulse/pos/idempotency.py`:

```python
from fastapi import Depends
from datapulse.api.deps import get_tenant_session


def idempotency_dependency(endpoint: str):
    """Return a FastAPI dependency that claims or replays an idempotency key.

    Usage:
        @router.post("/foo", dependencies=[Depends(idempotency_dependency("POST /foo"))])

    Or to access ctx in the handler body:
        def handler(idem = Depends(idempotency_dependency("POST /foo"))):
            if idem.replay: return idem.cached_body
            ...
    """

    async def _dep(
        request: Request,
        idempotency_key: str = Header(..., alias="Idempotency-Key"),
        session: Session = Depends(get_tenant_session),
    ) -> IdempotencyContext:
        body = await request.body()
        # Resolve tenant_id from RLS session variable or request state
        tenant_id = int(request.state.tenant_id) if hasattr(request.state, "tenant_id") else 1
        return check_and_claim(
            session=session,
            key=idempotency_key,
            tenant_id=tenant_id,
            endpoint=endpoint,
            request_hash=hash_body(body),
        )

    return _dep
```

- [ ] **Step 4: Run the test again**

Run:
```bash
PYTHONPATH=src pytest tests/test_pos_idempotency.py -v
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/datapulse/pos/idempotency.py tests/test_pos_idempotency.py
git commit -m "feat(pos): add idempotency_dependency factory for FastAPI routes"
```

---

## Task 4: Migration — `pos.transactions.commit_confirmed_at`

**Files:**
- Create: `migrations/078_add_pos_commit_confirmed_at.sql`

- [ ] **Step 1: Create the migration**

```sql
-- Migration: 078 — Add commit_confirmed_at to pos.transactions
-- Layer: POS operational
-- Idempotent.

ALTER TABLE pos.transactions
    ADD COLUMN IF NOT EXISTS commit_confirmed_at TIMESTAMPTZ;

-- Back-fill: every existing 'completed' or 'returned' row is considered committed
UPDATE pos.transactions
   SET commit_confirmed_at = COALESCE(commit_confirmed_at, created_at)
 WHERE status IN ('completed', 'voided', 'returned')
   AND commit_confirmed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pos_txn_incomplete
    ON pos.transactions (shift_id, terminal_id)
    WHERE commit_confirmed_at IS NULL;

COMMENT ON COLUMN pos.transactions.commit_confirmed_at IS
  'Timestamp when the transaction reached final committed state. NULL while draft/in-flight. Queried by shift-close guard.';
```

Note: this migration assumes `pos.transactions.shift_id` exists. If not, check `migrations/066_create_pos_transactions.sql` and add a preceding migration that adds `shift_id BIGINT REFERENCES pos.shift_records(id)` if missing. (The design spec §3.6 assumes the column exists.)

- [ ] **Step 2: Apply locally**

Run:
```bash
docker compose exec postgres psql -U datapulse -d datapulse -f /migrations/078_add_pos_commit_confirmed_at.sql
```

Verify:
```bash
docker compose exec postgres psql -U datapulse -d datapulse -c "\\d pos.transactions" | grep commit_confirmed_at
```

Expected: `commit_confirmed_at | timestamp with time zone`.

- [ ] **Step 3: Commit**

```bash
git add migrations/078_add_pos_commit_confirmed_at.sql
git commit -m "feat(pos): add commit_confirmed_at column + partial incomplete index"
```

---

## Task 5: Migration — `pos.terminal_devices`

**Files:**
- Create: `migrations/079_add_pos_terminal_devices.sql`

- [ ] **Step 1: Create the migration**

```sql
-- Migration: 079 — POS terminal device-bound credentials
-- Layer: POS operational
-- Idempotent.

CREATE TABLE IF NOT EXISTS pos.terminal_devices (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id           INT NOT NULL,
    terminal_id         BIGINT NOT NULL REFERENCES pos.terminal_sessions(id),
    public_key          BYTEA NOT NULL,                -- raw 32-byte Ed25519 public key
    device_fingerprint  TEXT NOT NULL,                 -- sha256:<hex>
    registered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at          TIMESTAMPTZ,
    last_seen_at        TIMESTAMPTZ,
    CONSTRAINT uq_terminal_active_device UNIQUE (terminal_id)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_pos_device_tenant
    ON pos.terminal_devices (tenant_id, revoked_at);

ALTER TABLE pos.terminal_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos.terminal_devices FORCE  ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY owner_all ON pos.terminal_devices
        FOR ALL TO datapulse USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_select ON pos.terminal_devices
        FOR SELECT TO datapulse_reader
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INT);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE ON TABLE pos.terminal_devices TO datapulse;
GRANT SELECT ON TABLE pos.terminal_devices TO datapulse_reader;

COMMENT ON TABLE pos.terminal_devices IS
  'Physical-device binding for POS terminals. Each terminal_id may have at most one active (non-revoked) device.';
```

- [ ] **Step 2: Apply + verify**

Run:
```bash
docker compose exec postgres psql -U datapulse -d datapulse -f /migrations/079_add_pos_terminal_devices.sql
docker compose exec postgres psql -U datapulse -d datapulse -c "\\d pos.terminal_devices"
```

Expected: table exists with 8 columns, RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add migrations/079_add_pos_terminal_devices.sql
git commit -m "feat(pos): add pos.terminal_devices migration for device-bound credentials"
```

---

## Task 6: Migration — `pos.tenant_keys`

**Files:**
- Create: `migrations/080_add_pos_tenant_keys.sql`

- [ ] **Step 1: Create the migration**

```sql
-- Migration: 080 — POS tenant Ed25519 signing keypairs
-- Layer: POS operational
-- Idempotent.

CREATE TABLE IF NOT EXISTS pos.tenant_keys (
    key_id        TEXT PRIMARY KEY,
    tenant_id     INT NOT NULL,
    private_key   BYTEA NOT NULL,        -- encrypted at rest with server KMS in prod; raw in dev
    public_key    BYTEA NOT NULL,
    valid_from    TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until   TIMESTAMPTZ NOT NULL,
    revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pos_tkeys_tenant_active
    ON pos.tenant_keys (tenant_id, valid_until)
    WHERE revoked_at IS NULL;

ALTER TABLE pos.tenant_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos.tenant_keys FORCE  ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY owner_all ON pos.tenant_keys
        FOR ALL TO datapulse USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Readers can see public_key + key_id via a view; never the private_key
DO $$ BEGIN
    CREATE POLICY tenant_select_public ON pos.tenant_keys
        FOR SELECT TO datapulse_reader
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INT);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE ON TABLE pos.tenant_keys TO datapulse;
GRANT SELECT ON TABLE pos.tenant_keys TO datapulse_reader;

COMMENT ON TABLE pos.tenant_keys IS
  'Ed25519 signing keypairs per tenant. Rotated daily with a 7-day overlap window for grant verification. Private keys must be encrypted at rest in production (envelope encryption with server KMS).';
```

- [ ] **Step 2: Apply + verify**

```bash
docker compose exec postgres psql -U datapulse -d datapulse -f /migrations/080_add_pos_tenant_keys.sql
```

- [ ] **Step 3: Commit**

```bash
git add migrations/080_add_pos_tenant_keys.sql
git commit -m "feat(pos): add pos.tenant_keys migration for Ed25519 grant signing"
```

---

## Task 7: Migrations — `pos.grants_issued`, `pos.override_consumptions`, `pos.shifts_close_attempts`

**Files:**
- Create: `migrations/081_add_pos_grants_issued.sql`
- Create: `migrations/082_add_pos_override_consumptions.sql`
- Create: `migrations/083_add_pos_shifts_close_attempts.sql`

- [ ] **Step 1: Create `081_add_pos_grants_issued.sql`**

```sql
-- Migration: 081 — POS grants issued registry
-- Layer: POS operational
-- Idempotent.

CREATE TABLE IF NOT EXISTS pos.grants_issued (
    grant_id            TEXT PRIMARY KEY,
    tenant_id           INT NOT NULL,
    terminal_id         BIGINT NOT NULL REFERENCES pos.terminal_sessions(id),
    shift_id            BIGINT NOT NULL REFERENCES pos.shift_records(id),
    staff_id            TEXT NOT NULL,
    key_id              TEXT NOT NULL REFERENCES pos.tenant_keys(key_id),
    code_ids            JSONB NOT NULL,         -- list of { code_id } issued in this grant
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    offline_expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pos_grants_terminal
    ON pos.grants_issued (terminal_id, issued_at DESC);

ALTER TABLE pos.grants_issued ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos.grants_issued FORCE  ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY owner_all ON pos.grants_issued
        FOR ALL TO datapulse USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_select ON pos.grants_issued
        FOR SELECT TO datapulse_reader
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INT);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE ON TABLE pos.grants_issued TO datapulse;
GRANT SELECT ON TABLE pos.grants_issued TO datapulse_reader;

COMMENT ON TABLE pos.grants_issued IS
  'Authoritative server-side registry of issued offline grants + their code_id sets. Consumed by override_token_verifier.';
```

- [ ] **Step 2: Create `082_add_pos_override_consumptions.sql`**

```sql
-- Migration: 082 — POS override code consumption ledger
-- Layer: POS operational
-- Idempotent.

CREATE TABLE IF NOT EXISTS pos.override_consumptions (
    grant_id                TEXT NOT NULL REFERENCES pos.grants_issued(grant_id),
    code_id                 TEXT NOT NULL,
    tenant_id               INT NOT NULL,
    terminal_id             BIGINT NOT NULL REFERENCES pos.terminal_sessions(id),
    shift_id                BIGINT NOT NULL REFERENCES pos.shift_records(id),
    action                  TEXT NOT NULL
                            CHECK (action IN ('retry_override','void','no_sale','price_override','discount_above_limit')),
    action_subject_id       TEXT,
    consumed_at             TIMESTAMPTZ NOT NULL,
    recorded_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    request_idempotency_key TEXT,
    PRIMARY KEY (grant_id, code_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_overrides_terminal
    ON pos.override_consumptions (terminal_id, consumed_at);

ALTER TABLE pos.override_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos.override_consumptions FORCE  ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY owner_all ON pos.override_consumptions
        FOR ALL TO datapulse USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_select ON pos.override_consumptions
        FOR SELECT TO datapulse_reader
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INT);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT ON TABLE pos.override_consumptions TO datapulse;
GRANT SELECT ON TABLE pos.override_consumptions TO datapulse_reader;

COMMENT ON TABLE pos.override_consumptions IS
  'One-time-use ledger for supervisor override codes. PK (grant_id, code_id) enforces one-time use via PK conflict.';
```

- [ ] **Step 3: Create `083_add_pos_shifts_close_attempts.sql`**

```sql
-- Migration: 083 — POS shifts close attempts forensic log
-- Layer: POS operational
-- Idempotent.

CREATE TABLE IF NOT EXISTS pos.shifts_close_attempts (
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shift_id                    BIGINT NOT NULL REFERENCES pos.shift_records(id),
    tenant_id                   INT NOT NULL,
    terminal_id                 BIGINT NOT NULL REFERENCES pos.terminal_sessions(id),
    attempted_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    outcome                     TEXT NOT NULL
                                CHECK (outcome IN ('accepted','rejected_client','rejected_server')),
    claimed_unresolved_count    INT,
    claimed_unresolved_digest   TEXT,
    server_incomplete_count     INT,
    rejection_reason            TEXT
);

CREATE INDEX IF NOT EXISTS idx_pos_close_attempts_shift
    ON pos.shifts_close_attempts (shift_id, attempted_at DESC);

ALTER TABLE pos.shifts_close_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos.shifts_close_attempts FORCE  ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY owner_all ON pos.shifts_close_attempts
        FOR ALL TO datapulse USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_select ON pos.shifts_close_attempts
        FOR SELECT TO datapulse_reader
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INT);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT ON TABLE pos.shifts_close_attempts TO datapulse;
GRANT SELECT ON TABLE pos.shifts_close_attempts TO datapulse_reader;

COMMENT ON TABLE pos.shifts_close_attempts IS
  'Forensic log of every POST /pos/shifts/{id}/close attempt (accepted or rejected). Retained indefinitely.';
```

- [ ] **Step 4: Apply all three**

```bash
for m in 081_add_pos_grants_issued 082_add_pos_override_consumptions 083_add_pos_shifts_close_attempts; do
  docker compose exec postgres psql -U datapulse -d datapulse -f /migrations/${m}.sql
done
```

Verify each with `\d pos.<table>`.

- [ ] **Step 5: Commit**

```bash
git add migrations/081_add_pos_grants_issued.sql \
        migrations/082_add_pos_override_consumptions.sql \
        migrations/083_add_pos_shifts_close_attempts.sql
git commit -m "feat(pos): add grants, overrides, and close-attempts migrations"
```

---

## Task 8: Migration — tenant single-terminal flags

**Files:**
- Create: `migrations/084_add_pos_tenant_flags.sql`

- [ ] **Step 1: Create the migration**

```sql
-- Migration: 084 — Tenant POS multi-terminal flags
-- Layer: tenants (core)
-- Idempotent.

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS pos_multi_terminal_allowed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS pos_max_terminals INT NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.tenants.pos_multi_terminal_allowed IS
  'Phase 1 POS is restricted to single-terminal sites. Flip to true only after F1 multi-terminal coordination ships.';
COMMENT ON COLUMN public.tenants.pos_max_terminals IS
  'Hard cap on concurrent active POS terminals per tenant. Default 1.';
```

Note: adjust the target table name if tenants are in a different schema. Grep `CREATE TABLE tenants` in `migrations/`.

- [ ] **Step 2: Apply + verify**

```bash
docker compose exec postgres psql -U datapulse -d datapulse -f /migrations/084_add_pos_tenant_flags.sql
docker compose exec postgres psql -U datapulse -d datapulse -c "\\d public.tenants" | grep pos_
```

- [ ] **Step 3: Commit**

```bash
git add migrations/084_add_pos_tenant_flags.sql
git commit -m "feat(pos): add tenant pos_multi_terminal_allowed + pos_max_terminals flags"
```

---

## Task 9: Tenant Ed25519 keypair module

**Files:**
- Create: `src/datapulse/pos/tenant_keys.py`
- Create: `tests/test_pos_tenant_keys.py`

- [ ] **Step 1: Write a failing test for key generation**

Create `tests/test_pos_tenant_keys.py`:

```python
"""Tenant keypair tests.

Covers: keypair generation, rotation, overlap window, public-key fetch.
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy.orm import Session

from datapulse.pos.tenant_keys import (
    KEY_ROTATION_INTERVAL,
    KEY_OVERLAP_WINDOW,
    active_private_key,
    list_public_keys,
    rotate_tenant_key,
)


def test_rotate_creates_new_signing_key_and_keeps_old_valid(session: Session):
    tenant_id = 1

    key1 = rotate_tenant_key(session, tenant_id)
    session.commit()
    assert key1.public_key and key1.private_key

    key2 = rotate_tenant_key(session, tenant_id)
    session.commit()
    assert key2.key_id != key1.key_id

    # Both appear in public-key listing (overlap window)
    keys = list_public_keys(session, tenant_id)
    ids = {k.key_id for k in keys}
    assert key1.key_id in ids
    assert key2.key_id in ids

    # active_private_key returns the newest non-revoked
    active = active_private_key(session, tenant_id)
    assert active.key_id == key2.key_id
```

- [ ] **Step 2: Run it (expect ImportError)**

```bash
PYTHONPATH=src pytest tests/test_pos_tenant_keys.py -v
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement `tenant_keys.py`**

Create `src/datapulse/pos/tenant_keys.py`:

```python
"""Per-tenant Ed25519 signing keypairs for offline grants.

Keys rotate daily; public keys stay valid for a 7-day overlap window so
clients can verify grants signed before the last rotation.

Design ref: §8.8.2 Key management.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    PrivateFormat,
    PublicFormat,
    NoEncryption,
)
from sqlalchemy import text
from sqlalchemy.orm import Session

KEY_ROTATION_INTERVAL = timedelta(days=1)
KEY_OVERLAP_WINDOW = timedelta(days=7)


@dataclass(frozen=True)
class TenantKey:
    key_id: str
    tenant_id: int
    private_key: bytes        # raw 32-byte Ed25519 private scalar
    public_key: bytes         # raw 32-byte Ed25519 public key
    valid_from: datetime
    valid_until: datetime


def _now() -> datetime:
    return datetime.now(timezone.utc)


def rotate_tenant_key(session: Session, tenant_id: int) -> TenantKey:
    """Generate a new keypair and insert it. Previous keys remain valid
    for ``KEY_OVERLAP_WINDOW`` past their original ``valid_until``.
    """
    key_id = str(uuid.uuid4())
    sk = Ed25519PrivateKey.generate()
    priv_bytes = sk.private_bytes(
        encoding=Encoding.Raw,
        format=PrivateFormat.Raw,
        encryption_algorithm=NoEncryption(),
    )
    pub_bytes = sk.public_key().public_bytes(
        encoding=Encoding.Raw,
        format=PublicFormat.Raw,
    )
    valid_from = _now()
    valid_until = valid_from + KEY_ROTATION_INTERVAL + KEY_OVERLAP_WINDOW

    session.execute(
        text(
            """
            INSERT INTO pos.tenant_keys
                (key_id, tenant_id, private_key, public_key, valid_from, valid_until)
            VALUES (:kid, :tid, :priv, :pub, :vf, :vu)
            """
        ),
        {"kid": key_id, "tid": tenant_id, "priv": priv_bytes, "pub": pub_bytes,
         "vf": valid_from, "vu": valid_until},
    )
    return TenantKey(key_id, tenant_id, priv_bytes, pub_bytes, valid_from, valid_until)


def active_private_key(session: Session, tenant_id: int) -> TenantKey:
    """Return the most recent non-revoked key for signing new grants."""
    row = session.execute(
        text(
            """
            SELECT key_id, tenant_id, private_key, public_key, valid_from, valid_until
              FROM pos.tenant_keys
             WHERE tenant_id = :tid AND revoked_at IS NULL AND valid_until > :now
          ORDER BY valid_from DESC
             LIMIT 1
            """
        ),
        {"tid": tenant_id, "now": _now()},
    ).mappings().first()
    if not row:
        return rotate_tenant_key(session, tenant_id)
    return TenantKey(**row)


def list_public_keys(session: Session, tenant_id: int) -> list[TenantKey]:
    """Return all non-revoked keys whose validity window still permits
    grant verification (i.e. ``valid_until >= now``).
    """
    rows = session.execute(
        text(
            """
            SELECT key_id, tenant_id, private_key, public_key, valid_from, valid_until
              FROM pos.tenant_keys
             WHERE tenant_id = :tid AND revoked_at IS NULL AND valid_until > :now
          ORDER BY valid_from DESC
            """
        ),
        {"tid": tenant_id, "now": _now()},
    ).mappings().all()
    return [TenantKey(**r) for r in rows]
```

- [ ] **Step 4: Run the test**

```bash
PYTHONPATH=src pytest tests/test_pos_tenant_keys.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/datapulse/pos/tenant_keys.py tests/test_pos_tenant_keys.py
git commit -m "feat(pos): add tenant Ed25519 keypair rotation module"
```

---

## Task 10: `GET /pos/tenant-key` endpoint

**Files:**
- Modify: `src/datapulse/api/routes/pos.py`
- Modify: `tests/test_pos_tenant_keys.py`

- [ ] **Step 1: Add a Pydantic response model in `src/datapulse/pos/models.py`**

Append:

```python
class TenantPublicKey(BaseModel):
    """Public Ed25519 key advertised to POS clients for grant verification."""
    model_config = ConfigDict(frozen=True)

    key_id:       str
    public_key:   str         # base64-url of raw 32-byte public key
    valid_from:   datetime
    valid_until:  datetime


class TenantKeysResponse(BaseModel):
    model_config = ConfigDict(frozen=True)
    keys: list[TenantPublicKey]
```

- [ ] **Step 2: Write a failing route test**

Append to `tests/test_pos_tenant_keys.py`:

```python
def test_tenant_key_endpoint_returns_rotated_keys(api_client, session: Session):
    """GET /pos/tenant-key returns all currently-valid public keys."""
    tenant_id = 1
    rotate_tenant_key(session, tenant_id)
    rotate_tenant_key(session, tenant_id)
    session.commit()

    r = api_client.get(
        "/api/v1/pos/tenant-key",
        headers={"Authorization": "Bearer dev-token-tenant-1"},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["keys"]) >= 2
    for k in data["keys"]:
        assert len(k["public_key"]) > 20  # base64-url is > raw
        assert "key_id" in k
        assert "valid_from" in k and "valid_until" in k
```

Use the project's existing `api_client` fixture (search under `tests/conftest.py`). If it does not yet produce an auth'd request, match the pattern used by other POS tests (e.g. `test_pos_service.py`) for getting a session with a JWT.

- [ ] **Step 3: Add the route to `src/datapulse/api/routes/pos.py`**

Append (before the `@router.get("/products/search")` block):

```python
from base64 import urlsafe_b64encode
from datapulse.pos.models import TenantKeysResponse, TenantPublicKey
from datapulse.pos.tenant_keys import list_public_keys


@router.get("/tenant-key", response_model=TenantKeysResponse)
@limiter.limit("30/minute")
def tenant_key(
    request: Request,
    user: CurrentUser,
    session=Depends(get_tenant_session),
):
    """Return the tenant's currently-valid POS signing public keys.

    The client uses these keys to verify offline grants (§8.8.2).
    Private keys never leave the server.
    """
    tenant_id = _tenant_id_of(user)
    keys = list_public_keys(session, tenant_id)
    return TenantKeysResponse(
        keys=[
            TenantPublicKey(
                key_id=k.key_id,
                public_key=urlsafe_b64encode(k.public_key).decode().rstrip("="),
                valid_from=k.valid_from,
                valid_until=k.valid_until,
            )
            for k in keys
        ]
    )
```

Add the import for `get_tenant_session` at the top of the file if missing:

```python
from datapulse.api.deps import get_pos_service, get_tenant_session
```

- [ ] **Step 4: Run the test**

```bash
PYTHONPATH=src pytest tests/test_pos_tenant_keys.py::test_tenant_key_endpoint_returns_rotated_keys -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/datapulse/api/routes/pos.py src/datapulse/pos/models.py tests/test_pos_tenant_keys.py
git commit -m "feat(pos): add GET /pos/tenant-key endpoint"
```

---

## Task 11: Capabilities endpoint

**Files:**
- Create: `src/datapulse/pos/capabilities.py`
- Modify: `src/datapulse/pos/models.py`
- Modify: `src/datapulse/api/routes/pos.py`
- Create: `tests/test_pos_capabilities.py`

- [ ] **Step 1: Add capability constants in `src/datapulse/pos/capabilities.py`**

```python
"""POS capability document — feature-only, unauthenticated.

Design ref: §6.6.
"""

from __future__ import annotations

POS_SERVER_VERSION: str = "1.0.0"
POS_MIN_CLIENT_VERSION: str = "1.0.0"
POS_MAX_CLIENT_VERSION: str | None = None

IDEMPOTENCY_PROTOCOL_VERSION: str = "v1"
CAPABILITIES_VERSION: str = "v1"

IDEMPOTENCY_TTL_HOURS: int = 168
PROVISIONAL_TTL_HOURS: int = 72
OFFLINE_GRANT_MAX_AGE_HOURS: int = 12

CAPABILITIES: dict[str, bool] = {
    "idempotency_key_header":   True,
    "pos_commit_endpoint":      True,
    "pos_catalog_stream":       True,
    "pos_shift_close":          True,
    "pos_corrective_void":      True,
    "override_reason_header":   True,
    "terminal_device_token":    True,
    "offline_grant_asymmetric": True,
    "multi_terminal_supported": False,
}
```

- [ ] **Step 2: Add Pydantic model to `src/datapulse/pos/models.py`**

```python
class CapabilitiesDoc(BaseModel):
    model_config = ConfigDict(frozen=True)
    server_version:   str
    min_client_version: str
    max_client_version: str | None
    idempotency:      str
    capabilities:     dict[str, bool]
    enforced_policies: dict[str, int]
    tenant_key_endpoint: str
    device_registration_endpoint: str
```

- [ ] **Step 3: Write the failing test**

Create `tests/test_pos_capabilities.py`:

```python
def test_capabilities_returns_required_flags(api_client):
    r = api_client.get("/api/v1/pos/capabilities")
    assert r.status_code == 200
    body = r.json()
    assert body["idempotency"] == "v1"
    assert body["capabilities"]["idempotency_key_header"] is True
    assert body["capabilities"]["pos_commit_endpoint"] is True
    assert body["capabilities"]["multi_terminal_supported"] is False
    assert body["enforced_policies"]["idempotency_ttl_hours"] == 168
    assert body["enforced_policies"]["provisional_ttl_hours"] == 72


def test_capabilities_is_unauthenticated(api_client):
    """§6.6: capabilities endpoint is feature-only, no tenant data, no auth."""
    r = api_client.get("/api/v1/pos/capabilities")
    assert r.status_code == 200
    # Response must not contain tenant-scoped keys
    body = r.json()
    for forbidden in ("tenant_id", "active_terminals", "staff_id"):
        assert forbidden not in body
```

- [ ] **Step 4: Add the route**

Append to `src/datapulse/api/routes/pos.py`:

```python
from datapulse.pos.capabilities import (
    CAPABILITIES,
    CAPABILITIES_VERSION,
    IDEMPOTENCY_PROTOCOL_VERSION,
    IDEMPOTENCY_TTL_HOURS,
    OFFLINE_GRANT_MAX_AGE_HOURS,
    POS_MAX_CLIENT_VERSION,
    POS_MIN_CLIENT_VERSION,
    POS_SERVER_VERSION,
    PROVISIONAL_TTL_HOURS,
)
from datapulse.pos.models import CapabilitiesDoc


# NOTE: this route is registered on its own un-authenticated sub-router so it
# does NOT inherit the require_pos_plan + get_current_user guards from the
# module-level `router`. Clients must be able to fetch capabilities before
# authenticating (§6.6).
capabilities_router = APIRouter(prefix="/pos", tags=["pos"])


@capabilities_router.get("/capabilities", response_model=CapabilitiesDoc)
@limiter.limit("60/minute")
def capabilities(request: Request):
    return CapabilitiesDoc(
        server_version=POS_SERVER_VERSION,
        min_client_version=POS_MIN_CLIENT_VERSION,
        max_client_version=POS_MAX_CLIENT_VERSION,
        idempotency=IDEMPOTENCY_PROTOCOL_VERSION,
        capabilities=dict(CAPABILITIES),
        enforced_policies={
            "idempotency_ttl_hours":       IDEMPOTENCY_TTL_HOURS,
            "provisional_ttl_hours":       PROVISIONAL_TTL_HOURS,
            "offline_grant_max_age_hours": OFFLINE_GRANT_MAX_AGE_HOURS,
        },
        tenant_key_endpoint="/api/v1/pos/tenant-key",
        device_registration_endpoint="/api/v1/pos/terminals/register-device",
    )
```

Make sure the new `capabilities_router` is included in `src/datapulse/api/app.py` (or wherever routers are registered). Grep for `include_router(pos` in that file and add a sibling line.

- [ ] **Step 5: Run tests**

```bash
PYTHONPATH=src pytest tests/test_pos_capabilities.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/datapulse/pos/capabilities.py \
        src/datapulse/pos/models.py \
        src/datapulse/api/routes/pos.py \
        src/datapulse/api/app.py \
        tests/test_pos_capabilities.py
git commit -m "feat(pos): add GET /pos/capabilities feature-only endpoint"
```

---

## Task 12: Device registration endpoint

**Files:**
- Create: `src/datapulse/pos/devices.py`
- Modify: `src/datapulse/pos/models.py`
- Modify: `src/datapulse/api/routes/pos.py`
- Create: `tests/test_pos_devices.py`

- [ ] **Step 1: Add Pydantic models**

Append to `src/datapulse/pos/models.py`:

```python
from typing import Literal


class DeviceRegisterRequest(BaseModel):
    model_config = ConfigDict(frozen=True)
    terminal_id:         int = Field(ge=1)
    public_key:          str = Field(min_length=32)    # base64-url raw 32-byte ed25519 pubkey
    device_fingerprint:  str = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    admin_credential:    str = Field(min_length=6, max_length=256)


class DeviceRegisterResponse(BaseModel):
    model_config = ConfigDict(frozen=True)
    device_id:           int
    terminal_id:         int
    registered_at:       datetime
```

- [ ] **Step 2: Write a failing test for registration**

Create `tests/test_pos_devices.py`:

```python
from base64 import urlsafe_b64encode
import hashlib

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat


def _fresh_device():
    sk = Ed25519PrivateKey.generate()
    pk = sk.public_key().public_bytes(encoding=Encoding.Raw, format=PublicFormat.Raw)
    return sk, urlsafe_b64encode(pk).decode().rstrip("=")


def test_register_device_creates_row(api_client, open_terminal):
    """POST /pos/terminals/register-device inserts a device row and returns device_id."""
    _, pub_b64 = _fresh_device()
    fp = "sha256:" + hashlib.sha256(b"host-A|mac|guid").hexdigest()

    r = api_client.post(
        "/api/v1/pos/terminals/register-device",
        json={
            "terminal_id": open_terminal["id"],
            "public_key": pub_b64,
            "device_fingerprint": fp,
            "admin_credential": "dev-admin-token",
        },
        headers={"Authorization": "Bearer dev-token-tenant-1-admin"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["device_id"] >= 1
    assert body["terminal_id"] == open_terminal["id"]


def test_register_device_rejects_second_registration_for_same_terminal(api_client, open_terminal):
    _, pub_b64 = _fresh_device()
    fp = "sha256:" + hashlib.sha256(b"host-A").hexdigest()
    payload = {
        "terminal_id": open_terminal["id"],
        "public_key": pub_b64,
        "device_fingerprint": fp,
        "admin_credential": "dev-admin-token",
    }
    headers = {"Authorization": "Bearer dev-token-tenant-1-admin"}

    r1 = api_client.post("/api/v1/pos/terminals/register-device", json=payload, headers=headers)
    assert r1.status_code == 200

    # Second register for the same terminal from a different key → 409
    _, pub2 = _fresh_device()
    r2 = api_client.post(
        "/api/v1/pos/terminals/register-device",
        json={**payload, "public_key": pub2, "device_fingerprint": "sha256:" + hashlib.sha256(b"host-B").hexdigest()},
        headers=headers,
    )
    assert r2.status_code == 409
```

Note: `open_terminal` is a fixture you must add to `tests/conftest.py` that opens a terminal session and returns its row as a dict. Use `PosService.open_terminal` or a direct SQL INSERT into `pos.terminal_sessions` matching that table's columns.

- [ ] **Step 3: Implement `devices.py`**

Create `src/datapulse/pos/devices.py`:

```python
"""Device-bound POS terminal credentials.

Design ref: §8.9.
"""

from __future__ import annotations

from base64 import urlsafe_b64decode
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from fastapi import Header, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

CLOCK_SKEW_TOLERANCE_MINUTES = 2


@dataclass(frozen=True)
class TerminalDevice:
    id: int
    tenant_id: int
    terminal_id: int
    public_key: bytes
    device_fingerprint: str
    revoked_at: datetime | None


def register_device(
    session: Session,
    *,
    tenant_id: int,
    terminal_id: int,
    public_key_b64: str,
    device_fingerprint: str,
) -> int:
    """Insert a new device row; raises on conflict."""
    pk_bytes = urlsafe_b64decode(public_key_b64 + "==")
    if len(pk_bytes) != 32:
        raise HTTPException(status_code=400, detail="public_key must be 32 raw bytes")

    existing = session.execute(
        text(
            """SELECT id FROM pos.terminal_devices
                WHERE terminal_id = :tid AND revoked_at IS NULL"""
        ),
        {"tid": terminal_id},
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="terminal already has a registered device")

    row = session.execute(
        text(
            """
            INSERT INTO pos.terminal_devices
                (tenant_id, terminal_id, public_key, device_fingerprint)
            VALUES (:tenant, :tid, :pk, :fp)
            RETURNING id
            """
        ),
        {"tenant": tenant_id, "tid": terminal_id, "pk": pk_bytes, "fp": device_fingerprint},
    ).first()
    return int(row[0])


def load_active_device(
    session: Session, terminal_id: int, tenant_id: int
) -> TerminalDevice | None:
    row = session.execute(
        text(
            """
            SELECT id, tenant_id, terminal_id, public_key, device_fingerprint, revoked_at
              FROM pos.terminal_devices
             WHERE terminal_id = :tid
               AND tenant_id   = :tenant
               AND revoked_at IS NULL
            """
        ),
        {"tid": terminal_id, "tenant": tenant_id},
    ).mappings().first()
    if not row:
        return None
    return TerminalDevice(**row)


def verify_signature(public_key: bytes, message: bytes, signature: bytes) -> bool:
    try:
        Ed25519PublicKey.from_public_bytes(public_key).verify(signature, message)
        return True
    except (InvalidSignature, ValueError):
        return False
```

- [ ] **Step 4: Add the route to `pos.py`**

```python
from datapulse.pos.models import DeviceRegisterRequest, DeviceRegisterResponse
from datapulse.pos.devices import register_device


@router.post(
    "/terminals/register-device",
    response_model=DeviceRegisterResponse,
    dependencies=[Depends(require_permission("pos:admin"))],
)
@limiter.limit("10/minute")
def register_terminal_device(
    request: Request,
    payload: DeviceRegisterRequest,
    user: CurrentUser,
    session=Depends(get_tenant_session),
):
    tenant_id = _tenant_id_of(user)
    device_id = register_device(
        session,
        tenant_id=tenant_id,
        terminal_id=payload.terminal_id,
        public_key_b64=payload.public_key,
        device_fingerprint=payload.device_fingerprint,
    )
    session.commit()
    return DeviceRegisterResponse(
        device_id=device_id,
        terminal_id=payload.terminal_id,
        registered_at=datetime.now(timezone.utc),
    )
```

Confirm `pos:admin` permission exists in `src/datapulse/rbac/`. If not, substitute `require_permission("admin")` or an equivalent manager-level permission and log a TODO to add a dedicated `pos:admin` permission in a later migration.

- [ ] **Step 5: Run tests**

```bash
PYTHONPATH=src pytest tests/test_pos_devices.py -v
```

Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add src/datapulse/pos/devices.py \
        src/datapulse/pos/models.py \
        src/datapulse/api/routes/pos.py \
        tests/test_pos_devices.py
git commit -m "feat(pos): add device registration endpoint + devices module"
```

---

## Task 13: `device_token_verifier` dependency

**Files:**
- Modify: `src/datapulse/pos/devices.py`
- Modify: `tests/test_pos_devices.py`

- [ ] **Step 1: Write failing tests for signature verification + fingerprint + skew**

Append to `tests/test_pos_devices.py`:

```python
import hashlib, json, time
from datetime import datetime, timedelta, timezone


def _sign(sk, method, path, idempotency_key, terminal_id, body, signed_at_iso):
    body_hash = hashlib.sha256(body).hexdigest()
    digest = "\n".join([
        method, path, idempotency_key, str(terminal_id), body_hash, signed_at_iso,
    ]).encode()
    return urlsafe_b64encode(sk.sign(digest)).decode().rstrip("=")


def test_device_verifier_accepts_valid_signature(api_client, registered_device):
    """Valid Ed25519 signature + fingerprint + recent signed_at passes."""
    # Hit the echo route that applies device_token_verifier
    sk = registered_device["sk"]
    terminal_id = registered_device["terminal_id"]
    body = b'{"hello":"world"}'
    signed_at = datetime.now(timezone.utc).isoformat()
    sig = _sign(sk, "POST", "/api/v1/pos/__debug/echo", "idem-1", terminal_id, body, signed_at)

    r = api_client.post(
        "/api/v1/pos/__debug/echo",
        content=body,
        headers={
            "Authorization": "Bearer dev-token-tenant-1",
            "Content-Type": "application/json",
            "Idempotency-Key": "idem-1",
            "X-Terminal-Id": str(terminal_id),
            "X-Device-Fingerprint": registered_device["fingerprint"],
            "X-Signed-At": signed_at,
            "X-Terminal-Token": sig,
        },
    )
    assert r.status_code == 200


def test_device_verifier_rejects_wrong_signature(api_client, registered_device):
    terminal_id = registered_device["terminal_id"]
    body = b'{"hello":"world"}'
    signed_at = datetime.now(timezone.utc).isoformat()

    r = api_client.post(
        "/api/v1/pos/__debug/echo",
        content=body,
        headers={
            "Authorization": "Bearer dev-token-tenant-1",
            "Content-Type": "application/json",
            "Idempotency-Key": "idem-2",
            "X-Terminal-Id": str(terminal_id),
            "X-Device-Fingerprint": registered_device["fingerprint"],
            "X-Signed-At": signed_at,
            "X-Terminal-Token": "aGVsbG8=",
        },
    )
    assert r.status_code == 401


def test_device_verifier_rejects_skewed_timestamp(api_client, registered_device):
    sk = registered_device["sk"]
    terminal_id = registered_device["terminal_id"]
    body = b'{}'
    # 10 minutes in the future: should fail (> 2 min skew)
    signed_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    sig = _sign(sk, "POST", "/api/v1/pos/__debug/echo", "idem-3", terminal_id, body, signed_at)

    r = api_client.post(
        "/api/v1/pos/__debug/echo",
        content=body,
        headers={
            "Authorization": "Bearer dev-token-tenant-1",
            "Content-Type": "application/json",
            "Idempotency-Key": "idem-3",
            "X-Terminal-Id": str(terminal_id),
            "X-Device-Fingerprint": registered_device["fingerprint"],
            "X-Signed-At": signed_at,
            "X-Terminal-Token": sig,
        },
    )
    assert r.status_code == 401


def test_device_verifier_rejects_fingerprint_mismatch(api_client, registered_device):
    sk = registered_device["sk"]
    terminal_id = registered_device["terminal_id"]
    body = b'{}'
    signed_at = datetime.now(timezone.utc).isoformat()
    sig = _sign(sk, "POST", "/api/v1/pos/__debug/echo", "idem-4", terminal_id, body, signed_at)

    r = api_client.post(
        "/api/v1/pos/__debug/echo",
        content=body,
        headers={
            "Authorization": "Bearer dev-token-tenant-1",
            "Content-Type": "application/json",
            "Idempotency-Key": "idem-4",
            "X-Terminal-Id": str(terminal_id),
            "X-Device-Fingerprint": "sha256:" + "0" * 64,
            "X-Signed-At": signed_at,
            "X-Terminal-Token": sig,
        },
    )
    assert r.status_code == 401
```

Add a `registered_device` fixture to `tests/conftest.py` that opens a terminal, registers a device, and returns `{sk, pk, fingerprint, terminal_id, device_id}`.

- [ ] **Step 2: Implement the verifier in `devices.py`**

Append:

```python
from dataclasses import dataclass
import hashlib
from base64 import urlsafe_b64decode

@dataclass(frozen=True)
class DeviceProof:
    terminal_id: int
    device: TerminalDevice
    signed_at: datetime
    idempotency_key: str


async def device_token_verifier(
    request: Request,
    x_terminal_id: int = Header(..., alias="X-Terminal-Id"),
    x_device_fingerprint: str = Header(..., alias="X-Device-Fingerprint"),
    x_signed_at: str = Header(..., alias="X-Signed-At"),
    x_terminal_token: str = Header(..., alias="X-Terminal-Token"),
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    session: Session = Depends(lambda: None),          # replaced below
) -> DeviceProof:
    """Verify per-request device-bound Ed25519 proof (§8.9.2)."""
    from datapulse.api.deps import get_tenant_session
    # FastAPI will substitute the real session; the Depends(lambda) placeholder
    # is only here so the signature type-checks at module load time.
    raise RuntimeError("device_token_verifier must be used as a FastAPI dependency")


# Real dependency (FastAPI picks up this function; the stub above is a typing helper)
async def _device_token_verifier_impl(
    request: Request,
    x_terminal_id: int = Header(..., alias="X-Terminal-Id"),
    x_device_fingerprint: str = Header(..., alias="X-Device-Fingerprint"),
    x_signed_at: str = Header(..., alias="X-Signed-At"),
    x_terminal_token: str = Header(..., alias="X-Terminal-Token"),
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    session: Session = Depends(__import__("datapulse.api.deps", fromlist=["get_tenant_session"]).get_tenant_session),
) -> DeviceProof:
    tenant_id = int(request.state.tenant_id) if hasattr(request.state, "tenant_id") else 1

    device = load_active_device(session, x_terminal_id, tenant_id)
    if device is None:
        raise HTTPException(status_code=401, detail="unknown device")
    if device.revoked_at is not None:
        raise HTTPException(status_code=401, detail="device revoked")

    if device.device_fingerprint != x_device_fingerprint:
        # TODO: auto-revoke per §8.9.4
        raise HTTPException(status_code=401, detail="fingerprint mismatch")

    try:
        signed_at_dt = datetime.fromisoformat(x_signed_at.replace("Z", "+00:00"))
    except ValueError as e:
        raise HTTPException(status_code=400, detail="invalid X-Signed-At") from e

    now = datetime.now(timezone.utc)
    if signed_at_dt > now + timedelta(minutes=CLOCK_SKEW_TOLERANCE_MINUTES):
        raise HTTPException(status_code=401, detail="signed_at in the future")

    body = await request.body()
    body_hash = hashlib.sha256(body).hexdigest()
    digest = "\n".join([
        request.method,
        request.url.path,
        idempotency_key,
        str(x_terminal_id),
        body_hash,
        x_signed_at,
    ]).encode()

    signature = urlsafe_b64decode(x_terminal_token + "==")
    if not verify_signature(device.public_key, digest, signature):
        raise HTTPException(status_code=401, detail="signature verification failed")

    return DeviceProof(
        terminal_id=x_terminal_id,
        device=device,
        signed_at=signed_at_dt,
        idempotency_key=idempotency_key,
    )


# Expose the impl under the canonical name
device_token_verifier = _device_token_verifier_impl
```

(The type-hint-only stub pattern is there because `device_token_verifier` may be imported by other modules for type hints; in practice the `_impl` is what FastAPI calls.)

- [ ] **Step 3: Add a debug route that uses the verifier (for tests)**

In `src/datapulse/api/routes/pos.py`, add (guarded by an `ENV=test` or `DATAPULSE_DEBUG_ROUTES=true` setting — never in prod):

```python
import os

from datapulse.pos.devices import device_token_verifier, DeviceProof


if os.getenv("DATAPULSE_DEBUG_ROUTES", "").lower() == "true":

    @router.post("/__debug/echo")
    async def _debug_echo(
        request: Request,
        user: CurrentUser,
        proof: DeviceProof = Depends(device_token_verifier),
    ):
        return {"ok": True, "terminal_id": proof.terminal_id}
```

Set `DATAPULSE_DEBUG_ROUTES=true` in the test environment (e.g. via `tests/conftest.py` `monkeypatch.setenv(...)`).

- [ ] **Step 4: Run the tests**

```bash
PYTHONPATH=src DATAPULSE_DEBUG_ROUTES=true pytest tests/test_pos_devices.py -v
```

Expected: all four device tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/datapulse/pos/devices.py \
        src/datapulse/api/routes/pos.py \
        tests/test_pos_devices.py \
        tests/conftest.py
git commit -m "feat(pos): add device_token_verifier with Ed25519 + fingerprint + skew checks"
```

---

## Task 14: `GET /pos/terminals/active-for-me` + single-terminal enforcement on `POST /pos/terminals`

**Files:**
- Modify: `src/datapulse/api/routes/pos.py`
- Modify: `src/datapulse/pos/models.py`
- Modify: `src/datapulse/pos/service.py` (or wherever `open_terminal` business logic lives)
- Create: `tests/test_pos_single_terminal_guard.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_pos_single_terminal_guard.py
def test_active_for_me_returns_caller_tenant_terminals(api_client, open_terminal):
    r = api_client.get(
        "/api/v1/pos/terminals/active-for-me",
        headers={"Authorization": "Bearer dev-token-tenant-1"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["multi_terminal_allowed"] is False
    ids = [t["terminal_id"] for t in body["active_terminals"]]
    assert open_terminal["id"] in ids


def test_second_terminal_open_rejected(api_client, open_terminal):
    """With pos_max_terminals=1, opening a second concurrent terminal fails 409."""
    r = api_client.post(
        "/api/v1/pos/terminals",
        json={"site_code": "S1", "terminal_name": "T2", "opening_cash": "0.00"},
        headers={"Authorization": "Bearer dev-token-tenant-1"},
    )
    assert r.status_code == 409
    assert "multi_terminal" in r.json()["detail"].lower() or "limit" in r.json()["detail"].lower()
```

- [ ] **Step 2: Add the `active-for-me` endpoint + guard on `POST /pos/terminals`**

In `src/datapulse/pos/models.py`:

```python
class ActiveTerminalRow(BaseModel):
    model_config = ConfigDict(frozen=True)
    terminal_id:         int
    device_fingerprint:  str | None
    opened_at:           datetime


class ActiveForMeResponse(BaseModel):
    model_config = ConfigDict(frozen=True)
    active_terminals:         list[ActiveTerminalRow]
    multi_terminal_allowed:   bool
    max_terminals:            int
```

In `src/datapulse/api/routes/pos.py`, append:

```python
from datapulse.pos.models import ActiveForMeResponse, ActiveTerminalRow


@router.get("/terminals/active-for-me", response_model=ActiveForMeResponse)
@limiter.limit("60/minute")
def active_for_me(
    request: Request,
    user: CurrentUser,
    session=Depends(get_tenant_session),
):
    tenant_id = _tenant_id_of(user)
    rows = session.execute(
        text(
            """
            SELECT ts.id            AS terminal_id,
                   td.device_fingerprint,
                   ts.opened_at
              FROM pos.terminal_sessions ts
         LEFT JOIN pos.terminal_devices td
                ON td.terminal_id = ts.id AND td.revoked_at IS NULL
             WHERE ts.tenant_id = :tid AND ts.status IN ('open', 'active', 'paused')
            """
        ),
        {"tid": tenant_id},
    ).mappings().all()

    flags = session.execute(
        text("""SELECT pos_multi_terminal_allowed, pos_max_terminals
                  FROM public.tenants WHERE id = :tid"""),
        {"tid": tenant_id},
    ).mappings().first() or {"pos_multi_terminal_allowed": False, "pos_max_terminals": 1}

    return ActiveForMeResponse(
        active_terminals=[ActiveTerminalRow(**r) for r in rows],
        multi_terminal_allowed=bool(flags["pos_multi_terminal_allowed"]),
        max_terminals=int(flags["pos_max_terminals"]),
    )
```

Then modify the existing `open_terminal` route (`POST /pos/terminals`) so it queries the same guard:

```python
# At the top of open_terminal route body:
active_count = session.execute(
    text("""SELECT count(*) FROM pos.terminal_sessions
             WHERE tenant_id = :tid AND status IN ('open','active','paused')"""),
    {"tid": _tenant_id_of(user)},
).scalar() or 0

max_terminals = session.execute(
    text("""SELECT pos_max_terminals FROM public.tenants WHERE id = :tid"""),
    {"tid": _tenant_id_of(user)},
).scalar() or 1

if active_count >= max_terminals:
    raise HTTPException(
        status_code=409,
        detail=f"multi_terminal limit reached ({active_count}/{max_terminals})",
    )
```

Add `from sqlalchemy import text` at the top if not present.

- [ ] **Step 3: Run tests**

```bash
PYTHONPATH=src pytest tests/test_pos_single_terminal_guard.py -v
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/datapulse/api/routes/pos.py \
        src/datapulse/pos/models.py \
        tests/test_pos_single_terminal_guard.py
git commit -m "feat(pos): add GET /terminals/active-for-me + 409 guard on terminal-open"
```

---

## Task 15: Atomic commit endpoint `POST /pos/transactions/commit`

**Files:**
- Create: `src/datapulse/pos/commit.py`
- Modify: `src/datapulse/pos/models.py`
- Modify: `src/datapulse/api/routes/pos.py`
- Create: `tests/test_pos_commit.py`

- [ ] **Step 1: Pydantic payload for atomic commit**

Append to `src/datapulse/pos/models.py`:

```python
class CommitRequest(BaseModel):
    """Atomic transaction commit payload — draft + items + checkout in one body."""
    model_config = ConfigDict(frozen=True)

    terminal_id:        int = Field(ge=1)
    shift_id:           int = Field(ge=1)
    staff_id:           str
    customer_id:        str | None = None
    site_code:          str
    items:              list[PosCartItem]
    subtotal:           JsonDecimal
    discount_total:     JsonDecimal = Decimal("0")
    tax_total:          JsonDecimal = Decimal("0")
    grand_total:        JsonDecimal
    payment_method:     PaymentMethod
    cash_tendered:      JsonDecimal | None = None


class CommitResponse(BaseModel):
    model_config = ConfigDict(frozen=True)
    transaction_id:       int
    receipt_number:       str
    commit_confirmed_at:  datetime
    change_due:           JsonDecimal = Decimal("0")
```

- [ ] **Step 2: Write a failing test**

Create `tests/test_pos_commit.py`:

```python
def test_commit_creates_transaction_atomically(api_client, registered_device):
    """One request creates transaction + items + marks commit_confirmed_at."""
    terminal_id = registered_device["terminal_id"]
    body = {
        "terminal_id": terminal_id,
        "shift_id": registered_device["shift_id"],
        "staff_id": "s-1",
        "site_code": "S1",
        "items": [{
            "drug_code": "DRUG-001",
            "drug_name": "Paracetamol",
            "quantity": "1",
            "unit_price": "12.00",
            "line_total": "12.00",
        }],
        "subtotal": "12.00",
        "grand_total": "12.00",
        "payment_method": "cash",
        "cash_tendered": "20.00",
    }
    headers = registered_device["signed_headers"]("POST", "/api/v1/pos/transactions/commit", "idem-c-1", body)
    r = api_client.post("/api/v1/pos/transactions/commit", json=body, headers=headers)
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["transaction_id"] >= 1
    assert b["receipt_number"]
    assert b["commit_confirmed_at"]
    assert float(b["change_due"]) == 8.0


def test_commit_idempotent_replay_returns_same_response(api_client, registered_device):
    terminal_id = registered_device["terminal_id"]
    body = {
        "terminal_id": terminal_id,
        "shift_id": registered_device["shift_id"],
        "staff_id": "s-1",
        "site_code": "S1",
        "items": [{
            "drug_code": "DRUG-001",
            "drug_name": "Paracetamol",
            "quantity": "1",
            "unit_price": "12.00",
            "line_total": "12.00",
        }],
        "subtotal": "12.00",
        "grand_total": "12.00",
        "payment_method": "cash",
        "cash_tendered": "20.00",
    }
    idem = "idem-c-replay"
    headers = registered_device["signed_headers"]("POST", "/api/v1/pos/transactions/commit", idem, body)

    r1 = api_client.post("/api/v1/pos/transactions/commit", json=body, headers=headers)
    r2 = api_client.post("/api/v1/pos/transactions/commit", json=body, headers=headers)
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["transaction_id"] == r2.json()["transaction_id"]
    # receipt_number must be identical — proving the same row was returned
    assert r1.json()["receipt_number"] == r2.json()["receipt_number"]
```

Add a `signed_headers` helper to the `registered_device` fixture that returns a callable producing the full header set (Authorization + Idempotency-Key + X-Terminal-Id + X-Device-Fingerprint + X-Signed-At + X-Terminal-Token).

- [ ] **Step 3: Implement `commit.py`**

Create `src/datapulse/pos/commit.py`:

```python
"""Atomic POS commit endpoint handler (§3 routes table).

Creates transaction header + line items + marks commit_confirmed_at all
in one SQL transaction. Designed for offline-queue replay.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from datapulse.pos.models import CommitRequest, CommitResponse


def _next_receipt_number(session: Session, tenant_id: int) -> str:
    """Generate a human-friendly receipt number. Format: R-YYYYMMDD-NNNNNN (per-tenant, per-day)."""
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%Y%m%d")
    seq = session.execute(
        text(
            """
            SELECT count(*) + 1
              FROM pos.transactions
             WHERE tenant_id = :tid
               AND created_at >= date_trunc('day', now())
            """
        ),
        {"tid": tenant_id},
    ).scalar() or 1
    return f"R-{date_str}-{seq:06d}"


def atomic_commit(
    session: Session,
    *,
    tenant_id: int,
    payload: CommitRequest,
) -> CommitResponse:
    """Insert transaction header + items + set commit_confirmed_at atomically."""
    if payload.payment_method.value == "cash":
        tendered = payload.cash_tendered or Decimal("0")
        if tendered < payload.grand_total:
            raise HTTPException(status_code=400, detail="cash_tendered < grand_total")
        change_due = tendered - payload.grand_total
    else:
        change_due = Decimal("0")

    receipt = _next_receipt_number(session, tenant_id)
    now = datetime.now(timezone.utc)

    txn_row = session.execute(
        text(
            """
            INSERT INTO pos.transactions
                (tenant_id, terminal_id, staff_id, customer_id, site_code,
                 subtotal, discount_total, tax_total, grand_total,
                 payment_method, status, receipt_number,
                 shift_id, created_at, commit_confirmed_at)
            VALUES
                (:tid, :term, :staff, :cust, :site,
                 :sub, :disc, :tax, :grand,
                 :pm, 'completed', :rec,
                 :shift, :now, :now)
            RETURNING id
            """
        ),
        {
            "tid": tenant_id, "term": payload.terminal_id, "staff": payload.staff_id,
            "cust": payload.customer_id, "site": payload.site_code,
            "sub": payload.subtotal, "disc": payload.discount_total,
            "tax": payload.tax_total, "grand": payload.grand_total,
            "pm": payload.payment_method.value,
            "rec": receipt, "shift": payload.shift_id, "now": now,
        },
    ).first()
    transaction_id = int(txn_row[0])

    for item in payload.items:
        session.execute(
            text(
                """
                INSERT INTO pos.transaction_items
                    (tenant_id, transaction_id, drug_code, drug_name,
                     batch_number, expiry_date, quantity, unit_price,
                     discount, line_total, is_controlled, pharmacist_id)
                VALUES
                    (:tid, :txn, :dc, :dn, :bn, :exp, :qty, :up, :disc, :lt, :ic, :ph)
                """
            ),
            {
                "tid": tenant_id, "txn": transaction_id,
                "dc": item.drug_code, "dn": item.drug_name,
                "bn": item.batch_number, "exp": item.expiry_date,
                "qty": item.quantity, "up": item.unit_price,
                "disc": item.discount, "lt": item.line_total,
                "ic": item.is_controlled, "ph": item.pharmacist_id,
            },
        )

    return CommitResponse(
        transaction_id=transaction_id,
        receipt_number=receipt,
        commit_confirmed_at=now,
        change_due=change_due,
    )
```

- [ ] **Step 4: Wire up the route**

In `src/datapulse/api/routes/pos.py`:

```python
from datapulse.pos.commit import atomic_commit
from datapulse.pos.idempotency import idempotency_dependency, record_response


@router.post(
    "/transactions/commit",
    response_model=CommitResponse,
    dependencies=[Depends(require_permission("pos:checkout"))],
)
@limiter.limit("30/minute")
async def commit_transaction(
    request: Request,
    payload: CommitRequest,
    user: CurrentUser,
    proof: DeviceProof = Depends(device_token_verifier),
    idem=Depends(idempotency_dependency("POST /pos/transactions/commit")),
    session=Depends(get_tenant_session),
):
    if idem.replay:
        return CommitResponse.model_validate(idem.cached_body)

    if payload.terminal_id != proof.terminal_id:
        raise HTTPException(status_code=400, detail="body/header terminal_id mismatch")

    tenant_id = _tenant_id_of(user)
    response = atomic_commit(session, tenant_id=tenant_id, payload=payload)

    record_response(session, idem.key, 200, response.model_dump(mode="json"))
    session.commit()
    return response
```

- [ ] **Step 5: Run tests**

```bash
PYTHONPATH=src DATAPULSE_DEBUG_ROUTES=true pytest tests/test_pos_commit.py -v
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/datapulse/pos/commit.py \
        src/datapulse/pos/models.py \
        src/datapulse/api/routes/pos.py \
        tests/test_pos_commit.py
git commit -m "feat(pos): add atomic POST /transactions/commit endpoint"
```

---

## Task 16: Offline grant issuance on shift-open

**Files:**
- Create: `src/datapulse/pos/grants.py`
- Modify: `src/datapulse/pos/models.py`
- Modify: `src/datapulse/pos/service.py` or the shift-open route
- Create: `tests/test_pos_grants.py`

- [ ] **Step 1: Pydantic models for grant payload + response**

Append to `src/datapulse/pos/models.py`:

```python
class OverrideCodeEntry(BaseModel):
    model_config = ConfigDict(frozen=True)
    code_id:            str
    salt:               str            # base64-url
    hash:               str            # scrypt output base64-url
    issued_to_staff_id: str | None = None


class RoleSnapshot(BaseModel):
    model_config = ConfigDict(frozen=True)
    can_checkout:            bool = True
    can_void:                bool = False
    can_override_price:      bool = False
    can_apply_discount:      bool = True
    max_discount_pct:        int  = 15
    can_process_returns:     bool = False
    can_open_drawer_no_sale: bool = False
    can_close_shift:         bool = True


class OfflineGrantPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    iss:                 str = "datapulse-pos"
    grant_id:            str
    terminal_id:         int
    tenant_id:           int
    device_fingerprint:  str
    staff_id:            str
    shift_id:            int
    issued_at:           datetime
    offline_expires_at:  datetime
    role_snapshot:       RoleSnapshot
    override_codes:      list[OverrideCodeEntry]
    capabilities_version: str = "v1"


class OfflineGrantEnvelope(BaseModel):
    model_config = ConfigDict(frozen=True)
    payload:             OfflineGrantPayload
    signature_ed25519:   str          # base64-url
    key_id:              str
```

- [ ] **Step 2: Write a failing test**

Create `tests/test_pos_grants.py`:

```python
import json
from base64 import urlsafe_b64decode
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from datapulse.pos.grants import issue_grant_for_shift
from datapulse.pos.tenant_keys import list_public_keys


def test_grant_is_signed_by_tenant_private_key_and_verifiable(session, registered_device):
    """Grant signature validates against the published tenant public key."""
    tenant_id = 1
    grant = issue_grant_for_shift(
        session,
        tenant_id=tenant_id,
        terminal_id=registered_device["terminal_id"],
        shift_id=registered_device["shift_id"],
        staff_id="s-1",
        device_fingerprint=registered_device["fingerprint"],
        role_snapshot_overrides={"can_void": True},
        offline_ttl_hours=12,
        override_code_count=3,
    )
    session.commit()

    # Signature verifies
    pub_list = list_public_keys(session, tenant_id)
    pk = next(k for k in pub_list if k.key_id == grant.key_id)
    sig = urlsafe_b64decode(grant.signature_ed25519 + "==")
    msg = grant.payload.model_dump_json(exclude_none=False).encode()
    Ed25519PublicKey.from_public_bytes(pk.public_key).verify(sig, msg)

    assert len(grant.payload.override_codes) == 3
    for c in grant.payload.override_codes:
        assert c.code_id and c.salt and c.hash


def test_grant_persisted_to_grants_issued(session, registered_device):
    from sqlalchemy import text
    grant = issue_grant_for_shift(
        session,
        tenant_id=1,
        terminal_id=registered_device["terminal_id"],
        shift_id=registered_device["shift_id"],
        staff_id="s-1",
        device_fingerprint=registered_device["fingerprint"],
    )
    session.commit()
    row = session.execute(
        text("SELECT code_ids, key_id FROM pos.grants_issued WHERE grant_id = :g"),
        {"g": grant.payload.grant_id},
    ).mappings().first()
    assert row is not None
    assert len(row["code_ids"]) == len(grant.payload.override_codes)
```

- [ ] **Step 3: Implement `grants.py`**

Create `src/datapulse/pos/grants.py`:

```python
"""Offline grant issuance (§8.8.2).

Grants are Ed25519-signed by the server's private key; clients verify
with the matching public key fetched from /pos/tenant-key. One-time
override codes are issued with per-code scrypt salt + hash — plaintext
stays server-side only (never written to the client).
"""

from __future__ import annotations

import hashlib
import json
import secrets
import uuid
from base64 import urlsafe_b64encode, urlsafe_b64decode
from datetime import datetime, timedelta, timezone

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from sqlalchemy import text
from sqlalchemy.orm import Session

from datapulse.pos.models import (
    OfflineGrantEnvelope,
    OfflineGrantPayload,
    OverrideCodeEntry,
    RoleSnapshot,
)
from datapulse.pos.tenant_keys import active_private_key


SCRYPT_N = 2 ** 14
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_LEN = 32


def _scrypt_hash(plaintext: str, salt: bytes) -> bytes:
    from hashlib import scrypt
    return scrypt(plaintext.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=SCRYPT_LEN)


def _generate_override_code() -> str:
    """8-char alphanumeric. Higher entropy than 6-digit numeric."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # exclude ambiguous chars
    return "".join(secrets.choice(alphabet) for _ in range(8))


def issue_grant_for_shift(
    session: Session,
    *,
    tenant_id: int,
    terminal_id: int,
    shift_id: int,
    staff_id: str,
    device_fingerprint: str,
    role_snapshot_overrides: dict | None = None,
    offline_ttl_hours: int = 12,
    override_code_count: int = 5,
) -> OfflineGrantEnvelope:
    """Mint a fresh grant, sign it, persist the registry row, return the envelope."""
    now = datetime.now(timezone.utc)
    grant_id = str(uuid.uuid4())

    role = RoleSnapshot(**(role_snapshot_overrides or {}))

    codes: list[OverrideCodeEntry] = []
    plaintexts: dict[str, str] = {}        # in-memory only; never returned to client
    for i in range(override_code_count):
        code_id = f"c-{i+1:02d}"
        plain = _generate_override_code()
        salt = secrets.token_bytes(16)
        h = _scrypt_hash(plain, salt)
        codes.append(OverrideCodeEntry(
            code_id=code_id,
            salt=urlsafe_b64encode(salt).decode().rstrip("="),
            hash=urlsafe_b64encode(h).decode().rstrip("="),
            issued_to_staff_id=None,
        ))
        plaintexts[code_id] = plain

    payload = OfflineGrantPayload(
        grant_id=grant_id,
        terminal_id=terminal_id,
        tenant_id=tenant_id,
        device_fingerprint=device_fingerprint,
        staff_id=staff_id,
        shift_id=shift_id,
        issued_at=now,
        offline_expires_at=now + timedelta(hours=offline_ttl_hours),
        role_snapshot=role,
        override_codes=codes,
    )

    tkey = active_private_key(session, tenant_id)
    sk = Ed25519PrivateKey.from_private_bytes(tkey.private_key)
    signature = sk.sign(payload.model_dump_json().encode())
    envelope = OfflineGrantEnvelope(
        payload=payload,
        signature_ed25519=urlsafe_b64encode(signature).decode().rstrip("="),
        key_id=tkey.key_id,
    )

    session.execute(
        text(
            """
            INSERT INTO pos.grants_issued
                (grant_id, tenant_id, terminal_id, shift_id, staff_id,
                 key_id, code_ids, issued_at, offline_expires_at)
            VALUES
                (:gid, :tid, :term, :shift, :staff, :kid, :codes, :iss, :exp)
            """
        ),
        {
            "gid": grant_id, "tid": tenant_id, "term": terminal_id, "shift": shift_id,
            "staff": staff_id, "kid": tkey.key_id,
            "codes": json.dumps([c.code_id for c in codes]),
            "iss": now, "exp": payload.offline_expires_at,
        },
    )

    # Plaintexts are NOT persisted server-side in M1. Distribution to supervisors is
    # handled out-of-band via the admin UI (separate endpoint, not in M1).
    # §14.2 hardening backlog will revisit if AEAD-sealed plaintext proof becomes needed.
    return envelope
```

- [ ] **Step 4: Wire grant into `POST /pos/shifts/open`**

Find the existing shift-open route/service (it's in `pos_service.start_shift` or `routes/pos.py::start_shift` — grep `start_shift`). After inserting the shift, call `issue_grant_for_shift` and include the envelope in the response body. Update the response model `ShiftSummaryResponse` (or a new `ShiftOpenResponse`) to carry `offline_grant: OfflineGrantEnvelope`.

- [ ] **Step 5: Run tests**

```bash
PYTHONPATH=src pytest tests/test_pos_grants.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/datapulse/pos/grants.py \
        src/datapulse/pos/models.py \
        src/datapulse/api/routes/pos.py \
        src/datapulse/pos/service.py \
        tests/test_pos_grants.py
git commit -m "feat(pos): issue Ed25519-signed offline grant on POST /shifts/open"
```

---

## Task 17: Override token verifier + ledger

**Files:**
- Create: `src/datapulse/pos/overrides.py`
- Modify: `src/datapulse/pos/models.py`
- Modify: `src/datapulse/api/routes/pos.py` (apply to `void`, `no-sale-drawer`, etc.)
- Create: `tests/test_pos_overrides.py`

- [ ] **Step 1: Pydantic models**

Append to `src/datapulse/pos/models.py`:

```python
class OverrideTokenClaim(BaseModel):
    model_config = ConfigDict(frozen=True)
    grant_id:          str
    code_id:           str
    tenant_id:         int
    terminal_id:       int
    shift_id:          int
    action:            Literal["retry_override","void","no_sale","price_override","discount_above_limit"]
    action_subject_id: str | None = None
    consumed_at:       datetime


class OverrideTokenEnvelope(BaseModel):
    model_config = ConfigDict(frozen=True)
    claim:     OverrideTokenClaim
    signature: str   # base64-url, signed by the device private key
```

- [ ] **Step 2: Failing tests**

Create `tests/test_pos_overrides.py`:

```python
def test_override_replay_returns_409(api_client, registered_device):
    """Same grant_id + code_id used twice → second call 409."""
    # Use the __debug/no_sale route (added below for testability) that requires an override token
    # Build signed override token and the request signature in one helper
    idem = "idem-ov-1"
    headers, token_env = registered_device["build_override_request"](
        idem=idem, action="no_sale", code_id="c-01",
    )
    r1 = api_client.post("/api/v1/pos/__debug/no_sale", json={}, headers=headers)
    assert r1.status_code == 200

    # Replay with fresh idempotency key but same override token
    idem2 = "idem-ov-2"
    headers2, _ = registered_device["build_override_request"](
        idem=idem2, action="no_sale", code_id="c-01", reuse_token=token_env,
    )
    r2 = api_client.post("/api/v1/pos/__debug/no_sale", json={}, headers=headers2)
    assert r2.status_code == 409


def test_override_action_mismatch_403(api_client, registered_device):
    idem = "idem-ov-mismatch"
    headers, _ = registered_device["build_override_request"](
        idem=idem, action="retry_override",   # token says retry_override
        code_id="c-02",
    )
    # But route expects action=no_sale
    r = api_client.post("/api/v1/pos/__debug/no_sale", json={}, headers=headers)
    assert r.status_code == 403
```

Extend `registered_device` fixture to include `build_override_request(idem, action, code_id, reuse_token=None)` returning `(headers, token_env)`.

- [ ] **Step 3: Implement `overrides.py`**

Create `src/datapulse/pos/overrides.py`:

```python
"""Server-side verification + ledger for one-time override tokens (§8.8.6)."""

from __future__ import annotations

import json
from base64 import urlsafe_b64decode
from datetime import datetime, timezone
from dataclasses import dataclass
from typing import Literal

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from datapulse.api.deps import get_tenant_session
from datapulse.pos.devices import DeviceProof, device_token_verifier, verify_signature
from datapulse.pos.models import OverrideTokenClaim, OverrideTokenEnvelope


ALLOWED_ACTIONS = {"retry_override","void","no_sale","price_override","discount_above_limit"}


def override_token_verifier(expected_action: str):
    async def _dep(
        request: Request,
        proof: DeviceProof = Depends(device_token_verifier),
        x_override_token: str = Header(..., alias="X-Override-Token"),
        session: Session = Depends(get_tenant_session),
    ) -> OverrideTokenEnvelope:
        try:
            env_dict = json.loads(urlsafe_b64decode(x_override_token + "==").decode())
            env = OverrideTokenEnvelope.model_validate(env_dict)
        except Exception as e:
            raise HTTPException(status_code=400, detail="invalid X-Override-Token") from e

        claim = env.claim
        if claim.action != expected_action:
            raise HTTPException(status_code=403, detail="override action mismatch")
        if claim.terminal_id != proof.terminal_id:
            raise HTTPException(status_code=401, detail="override terminal mismatch")

        # Verify device signature on the claim
        msg = claim.model_dump_json().encode()
        sig = urlsafe_b64decode(env.signature + "==")
        if not verify_signature(proof.device.public_key, msg, sig):
            raise HTTPException(status_code=401, detail="override signature invalid")

        # Grant + code_id must be registered
        row = session.execute(
            text("SELECT code_ids, offline_expires_at FROM pos.grants_issued WHERE grant_id = :g"),
            {"g": claim.grant_id},
        ).mappings().first()
        if not row:
            raise HTTPException(status_code=401, detail="invalid grant_id")
        if claim.code_id not in row["code_ids"]:
            raise HTTPException(status_code=401, detail="invalid code_id")
        if row["offline_expires_at"] < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="grant expired")

        # Atomic one-time-use insert
        try:
            session.execute(
                text(
                    """
                    INSERT INTO pos.override_consumptions
                        (grant_id, code_id, tenant_id, terminal_id, shift_id,
                         action, action_subject_id, consumed_at, request_idempotency_key)
                    VALUES (:g, :c, :tid, :term, :shift, :act, :sub, :cons, :idem)
                    """
                ),
                {
                    "g": claim.grant_id, "c": claim.code_id,
                    "tid": claim.tenant_id, "term": claim.terminal_id, "shift": claim.shift_id,
                    "act": claim.action, "sub": claim.action_subject_id,
                    "cons": claim.consumed_at, "idem": proof.idempotency_key,
                },
            )
        except IntegrityError:
            session.rollback()
            raise HTTPException(status_code=409, detail="override_already_consumed")

        return env

    return _dep
```

- [ ] **Step 4: Apply the verifier to existing override routes**

In `routes/pos.py`, add the dependency to the `void` and any "no-sale" routes:

```python
from datapulse.pos.overrides import override_token_verifier


# Existing void route:
@router.post("/transactions/{transaction_id}/void", ...)
async def void_transaction(
    ...
    override_env = Depends(override_token_verifier("void")),
    ...
):
    # no change to business logic needed
```

Also add a `__debug/no_sale` route for the test (wrapped by `DATAPULSE_DEBUG_ROUTES=true`) that uses `override_token_verifier("no_sale")`.

- [ ] **Step 5: Run tests**

```bash
PYTHONPATH=src DATAPULSE_DEBUG_ROUTES=true pytest tests/test_pos_overrides.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/datapulse/pos/overrides.py \
        src/datapulse/pos/models.py \
        src/datapulse/api/routes/pos.py \
        tests/test_pos_overrides.py
git commit -m "feat(pos): add override_token_verifier + one-time ledger"
```

---

## Task 18: Server-enforced shift-close guard

**Files:**
- Modify: `src/datapulse/api/routes/pos.py`
- Modify: `src/datapulse/pos/models.py`
- Modify: `src/datapulse/pos/service.py` (if close logic lives there)
- Create: `tests/test_pos_shift_close_guard.py`

- [ ] **Step 1: Extended close-request model**

In `src/datapulse/pos/models.py`, replace or extend the existing `CloseShiftRequest`:

```python
class LocalUnresolvedClaim(BaseModel):
    model_config = ConfigDict(frozen=True)
    count:   int = Field(ge=0)
    digest:  str = Field(min_length=10, max_length=200)


class CloseShiftRequestV2(BaseModel):
    model_config = ConfigDict(frozen=True)
    closing_cash:     JsonDecimal
    notes:            str | None = None
    local_unresolved: LocalUnresolvedClaim
```

- [ ] **Step 2: Failing tests**

Create `tests/test_pos_shift_close_guard.py`:

```python
def test_close_accepted_when_client_and_server_both_clean(api_client, registered_device):
    body = {"closing_cash": "100.00", "notes": None, "local_unresolved": {"count": 0, "digest": "sha256:empty-0"}}
    headers = registered_device["signed_headers"]("POST", f"/api/v1/pos/shifts/{registered_device['shift_id']}/close", "idem-close-1", body)
    r = api_client.post(
        f"/api/v1/pos/shifts/{registered_device['shift_id']}/close",
        json=body,
        headers=headers,
    )
    assert r.status_code == 200


def test_close_rejected_when_client_claims_nonzero(api_client, registered_device):
    body = {"closing_cash": "100.00", "notes": None, "local_unresolved": {"count": 3, "digest": "sha256:abc-3"}}
    headers = registered_device["signed_headers"]("POST", f"/api/v1/pos/shifts/{registered_device['shift_id']}/close", "idem-close-c", body)
    r = api_client.post(
        f"/api/v1/pos/shifts/{registered_device['shift_id']}/close",
        json=body,
        headers=headers,
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "provisional_work_pending"


def test_close_rejected_when_server_has_incomplete_transaction(api_client, session, registered_device):
    from sqlalchemy import text
    # Create a fake incomplete transaction
    session.execute(
        text(
            """
            INSERT INTO pos.transactions
              (tenant_id, terminal_id, staff_id, site_code, subtotal, grand_total,
               payment_method, status, shift_id, commit_confirmed_at)
            VALUES (:tid, :term, 's-1', 'S1', '12.00', '12.00', 'cash', 'draft', :shift, NULL)
            """
        ),
        {"tid": 1, "term": registered_device["terminal_id"], "shift": registered_device["shift_id"]},
    )
    session.commit()

    body = {"closing_cash": "100.00", "notes": None, "local_unresolved": {"count": 0, "digest": "sha256:empty-0"}}
    headers = registered_device["signed_headers"]("POST", f"/api/v1/pos/shifts/{registered_device['shift_id']}/close", "idem-close-s", body)
    r = api_client.post(
        f"/api/v1/pos/shifts/{registered_device['shift_id']}/close",
        json=body,
        headers=headers,
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "server_side_incomplete_transactions"
```

- [ ] **Step 3: Implement the guard**

Modify the close route (in `routes/pos.py` or `service.py`). Before any business write:

```python
from datapulse.pos.models import CloseShiftRequestV2


@router.post("/shifts/{shift_id}/close", response_model=ShiftSummaryResponse)
@limiter.limit("10/minute")
async def close_shift(
    request: Request,
    shift_id: int = Path(ge=1),
    payload: CloseShiftRequestV2 = ...,
    user: CurrentUser = ...,
    proof: DeviceProof = Depends(device_token_verifier),
    idem=Depends(idempotency_dependency("POST /pos/shifts/{id}/close")),
    session=Depends(get_tenant_session),
):
    tenant_id = _tenant_id_of(user)
    if idem.replay:
        return ShiftSummaryResponse.model_validate(idem.cached_body)

    # Client check
    if payload.local_unresolved.count > 0:
        session.execute(
            text("""INSERT INTO pos.shifts_close_attempts
                    (shift_id, tenant_id, terminal_id, outcome,
                     claimed_unresolved_count, claimed_unresolved_digest, rejection_reason)
                VALUES (:s, :t, :term, 'rejected_client', :c, :d, 'provisional_work_pending')"""),
            {"s": shift_id, "t": tenant_id, "term": proof.terminal_id,
             "c": payload.local_unresolved.count, "d": payload.local_unresolved.digest},
        )
        session.commit()
        raise HTTPException(status_code=409, detail="provisional_work_pending")

    # Server check
    incomplete = session.execute(
        text(
            """SELECT count(*) FROM pos.transactions
                WHERE shift_id = :s AND tenant_id = :t
                  AND terminal_id = :term AND commit_confirmed_at IS NULL"""
        ),
        {"s": shift_id, "t": tenant_id, "term": proof.terminal_id},
    ).scalar() or 0

    if incomplete > 0:
        session.execute(
            text("""INSERT INTO pos.shifts_close_attempts
                    (shift_id, tenant_id, terminal_id, outcome,
                     claimed_unresolved_count, claimed_unresolved_digest,
                     server_incomplete_count, rejection_reason)
                VALUES (:s, :t, :term, 'rejected_server', :c, :d, :inc, 'server_side_incomplete_transactions')"""),
            {"s": shift_id, "t": tenant_id, "term": proof.terminal_id,
             "c": payload.local_unresolved.count, "d": payload.local_unresolved.digest, "inc": incomplete},
        )
        session.commit()
        raise HTTPException(status_code=409, detail="server_side_incomplete_transactions")

    # … proceed with existing close logic …

    session.execute(
        text("""INSERT INTO pos.shifts_close_attempts
                (shift_id, tenant_id, terminal_id, outcome,
                 claimed_unresolved_count, claimed_unresolved_digest)
            VALUES (:s, :t, :term, 'accepted', :c, :d)"""),
        {"s": shift_id, "t": tenant_id, "term": proof.terminal_id,
         "c": payload.local_unresolved.count, "d": payload.local_unresolved.digest},
    )
    record_response(session, idem.key, 200, response.model_dump(mode="json"))
    session.commit()
    return response
```

- [ ] **Step 4: Run tests**

```bash
PYTHONPATH=src DATAPULSE_DEBUG_ROUTES=true pytest tests/test_pos_shift_close_guard.py -v
```

Expected: all three PASS.

- [ ] **Step 5: Commit**

```bash
git add src/datapulse/api/routes/pos.py \
        src/datapulse/pos/models.py \
        src/datapulse/pos/service.py \
        tests/test_pos_shift_close_guard.py
git commit -m "feat(pos): server-enforced shift-close guard with dual-side check"
```

---

## Task 19: Catalog streaming endpoints

**Files:**
- Create: `src/datapulse/pos/catalog_stream.py`
- Modify: `src/datapulse/pos/models.py`
- Modify: `src/datapulse/api/routes/pos.py`
- Create: `tests/test_pos_catalog_stream.py`

- [ ] **Step 1: Models + route**

Append to `src/datapulse/pos/models.py`:

```python
class CatalogProductRow(BaseModel):
    model_config = ConfigDict(frozen=True)
    drug_code:           str
    drug_name:           str
    drug_brand:          str | None = None
    drug_cluster:        str | None = None
    unit_price:          JsonDecimal
    is_controlled:       bool = False
    requires_pharmacist: bool = False
    updated_at:          datetime


class CatalogPage(BaseModel):
    model_config = ConfigDict(frozen=True)
    rows:        list[CatalogProductRow]
    next_cursor: str | None = None
    has_more:    bool = False


class CatalogStockRow(BaseModel):
    model_config = ConfigDict(frozen=True)
    drug_code:     str
    site_code:     str
    batch_number:  str
    quantity:      JsonDecimal
    expiry_date:   date | None = None
    updated_at:    datetime


class CatalogStockPage(BaseModel):
    model_config = ConfigDict(frozen=True)
    rows:        list[CatalogStockRow]
    next_cursor: str | None = None
    has_more:    bool = False
```

- [ ] **Step 2: Failing test**

Create `tests/test_pos_catalog_stream.py`:

```python
def test_catalog_products_returns_paginated_rows(api_client, seed_products):
    r = api_client.get(
        "/api/v1/pos/catalog/products?limit=50",
        headers={"Authorization": "Bearer dev-token-tenant-1"},
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["rows"]) <= 50
    for row in body["rows"]:
        assert "drug_code" in row and "unit_price" in row


def test_catalog_products_respects_since_cursor(api_client, seed_products):
    r1 = api_client.get("/api/v1/pos/catalog/products?limit=10", headers={"Authorization": "Bearer dev-token-tenant-1"})
    cur = r1.json()["next_cursor"]
    r2 = api_client.get(f"/api/v1/pos/catalog/products?limit=10&since={cur}", headers={"Authorization": "Bearer dev-token-tenant-1"})
    # rows must be disjoint
    ids1 = {r["drug_code"] for r in r1.json()["rows"]}
    ids2 = {r["drug_code"] for r in r2.json()["rows"]}
    assert not (ids1 & ids2)
```

Add a `seed_products` fixture that inserts ~30 rows into the underlying products/drugs table (search for existing POS tests that seed products; match that pattern).

- [ ] **Step 3: Implement `catalog_stream.py`**

```python
"""Cursor-paginated catalog + stock streams for POS desktop clients."""

from __future__ import annotations

from base64 import urlsafe_b64decode, urlsafe_b64encode
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from datapulse.pos.models import (
    CatalogPage, CatalogProductRow,
    CatalogStockPage, CatalogStockRow,
)


def _encode_cursor(ts: datetime, key: str) -> str:
    payload = f"{ts.isoformat()}|{key}".encode()
    return urlsafe_b64encode(payload).decode().rstrip("=")


def _decode_cursor(cur: str) -> tuple[datetime, str]:
    raw = urlsafe_b64decode(cur + "==").decode()
    ts_iso, key = raw.split("|", 1)
    return datetime.fromisoformat(ts_iso), key


def list_products(
    session: Session, tenant_id: int,
    since: str | None = None, limit: int = 100,
) -> CatalogPage:
    limit = max(1, min(500, limit))
    if since:
        ts, key = _decode_cursor(since)
        rows = session.execute(
            text(
                """
                SELECT drug_code, drug_name, drug_brand, drug_cluster,
                       unit_price, is_controlled, requires_pharmacist, updated_at
                  FROM pos.products_catalog
                 WHERE tenant_id = :tid
                   AND (updated_at, drug_code) > (:ts, :key)
              ORDER BY updated_at ASC, drug_code ASC
                 LIMIT :lim
                """
            ),
            {"tid": tenant_id, "ts": ts, "key": key, "lim": limit + 1},
        ).mappings().all()
    else:
        rows = session.execute(
            text(
                """
                SELECT drug_code, drug_name, drug_brand, drug_cluster,
                       unit_price, is_controlled, requires_pharmacist, updated_at
                  FROM pos.products_catalog
                 WHERE tenant_id = :tid
              ORDER BY updated_at ASC, drug_code ASC
                 LIMIT :lim
                """
            ),
            {"tid": tenant_id, "lim": limit + 1},
        ).mappings().all()

    has_more = len(rows) > limit
    page_rows = rows[:limit]
    next_cur = _encode_cursor(page_rows[-1]["updated_at"], page_rows[-1]["drug_code"]) if (has_more and page_rows) else None

    return CatalogPage(
        rows=[CatalogProductRow(**r) for r in page_rows],
        next_cursor=next_cur,
        has_more=has_more,
    )


def list_stock(
    session: Session, tenant_id: int, site_code: str | None = None,
    since: str | None = None, limit: int = 200,
) -> CatalogStockPage:
    limit = max(1, min(1000, limit))
    where = "tenant_id = :tid"
    params: dict = {"tid": tenant_id, "lim": limit + 1}
    if site_code:
        where += " AND site_code = :sc"
        params["sc"] = site_code
    if since:
        ts, key = _decode_cursor(since)
        where += " AND (updated_at, drug_code || '|' || site_code || '|' || batch_number) > (:ts, :key)"
        params.update(ts=ts, key=key)

    rows = session.execute(
        text(
            f"""
            SELECT drug_code, site_code, batch_number,
                   quantity, expiry_date, updated_at
              FROM pos.stock_snapshot
             WHERE {where}
          ORDER BY updated_at ASC,
                   drug_code || '|' || site_code || '|' || batch_number ASC
             LIMIT :lim
            """
        ),
        params,
    ).mappings().all()

    has_more = len(rows) > limit
    page_rows = rows[:limit]
    next_cur = _encode_cursor(
        page_rows[-1]["updated_at"],
        f"{page_rows[-1]['drug_code']}|{page_rows[-1]['site_code']}|{page_rows[-1]['batch_number']}",
    ) if (has_more and page_rows) else None

    return CatalogStockPage(
        rows=[CatalogStockRow(**r) for r in page_rows],
        next_cursor=next_cur,
        has_more=has_more,
    )
```

Note: this assumes view/tables `pos.products_catalog` and `pos.stock_snapshot` exist. If they do not (grep the migrations), add them as simple views over the bronze tables in a tiny prep migration before this task runs, or adapt the SQL to hit the right source tables.

- [ ] **Step 4: Add routes**

```python
from datapulse.pos.catalog_stream import list_products, list_stock


@router.get("/catalog/products", response_model=CatalogPage)
@limiter.limit("120/minute")
def catalog_products(
    request: Request,
    user: CurrentUser,
    since: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    session=Depends(get_tenant_session),
):
    return list_products(session, _tenant_id_of(user), since=since, limit=limit)


@router.get("/catalog/stock", response_model=CatalogStockPage)
@limiter.limit("120/minute")
def catalog_stock(
    request: Request,
    user: CurrentUser,
    site: str | None = Query(None),
    since: str | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    session=Depends(get_tenant_session),
):
    return list_stock(session, _tenant_id_of(user), site_code=site, since=since, limit=limit)
```

- [ ] **Step 5: Run tests**

```bash
PYTHONPATH=src pytest tests/test_pos_catalog_stream.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/datapulse/pos/catalog_stream.py \
        src/datapulse/pos/models.py \
        src/datapulse/api/routes/pos.py \
        tests/test_pos_catalog_stream.py
git commit -m "feat(pos): add GET /catalog/products + /catalog/stock cursor-paginated streams"
```

---

## Task 20: Apply idempotency + device verifier to existing mutating routes

**Files:**
- Modify: `src/datapulse/api/routes/pos.py`
- Modify: existing tests in `tests/` that hit the affected routes

The routes to retrofit:
- `POST /pos/transactions/{id}/void`
- `POST /pos/transactions/{id}/checkout` (legacy — still supported for interactive online flow)
- `POST /pos/returns`
- `POST /pos/terminals/{id}/close`

For each:

- [ ] **Step 1: Add `Depends(device_token_verifier)` + `Depends(idempotency_dependency("..."))`**

Example for `void`:

```python
@router.post(
    "/transactions/{transaction_id}/void",
    response_model=VoidResponse,
    dependencies=[Depends(require_permission("pos:void"))],
)
@limiter.limit("10/minute")
async def void_transaction(
    request: Request,
    transaction_id: int = Path(ge=1),
    payload: VoidRequest = ...,
    user: CurrentUser = ...,
    proof: DeviceProof = Depends(device_token_verifier),
    override = Depends(override_token_verifier("void")),
    idem = Depends(idempotency_dependency("POST /pos/transactions/{id}/void")),
    session = Depends(get_tenant_session),
):
    if idem.replay:
        return VoidResponse.model_validate(idem.cached_body)
    response = ...  # existing logic
    record_response(session, idem.key, 200, response.model_dump(mode="json"))
    session.commit()
    return response
```

- [ ] **Step 2: Update any tests that post to these routes to include the new headers (Idempotency-Key + device-sig headers). Ideally add a `posted` helper to the `registered_device` fixture.**

- [ ] **Step 3: Run the full POS test suite**

```bash
PYTHONPATH=src DATAPULSE_DEBUG_ROUTES=true pytest tests/ -k pos -v
```

Expected: all tests pass. If older tests fail because of the new headers, adapt them using the same helper pattern.

- [ ] **Step 4: Commit**

```bash
git add src/datapulse/api/routes/pos.py tests/
git commit -m "feat(pos): wire idempotency + device verifier to void/checkout/return/terminal-close"
```

---

## Task 21: Nightly cleanup task for expired idempotency keys

**Files:**
- Create: `src/datapulse/tasks/cleanup_pos_idempotency.py`
- Create: `tests/test_pos_cleanup_task.py`

- [ ] **Step 1: Write a failing test**

Create `tests/test_pos_cleanup_task.py`:

```python
from datetime import datetime, timedelta, timezone

from sqlalchemy import text


def test_cleanup_deletes_expired_keys(session):
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    session.execute(
        text(
            """INSERT INTO pos.idempotency_keys
                 (key, tenant_id, endpoint, request_hash, expires_at)
               VALUES ('old', 1, '/x', 'h', :past), ('fresh', 1, '/x', 'h', :future)"""
        ),
        {"past": past, "future": datetime.now(timezone.utc) + timedelta(hours=1)},
    )
    session.commit()

    from datapulse.tasks.cleanup_pos_idempotency import run
    deleted = run(session)
    session.commit()

    assert deleted == 1
    remaining = session.execute(text("SELECT key FROM pos.idempotency_keys WHERE key IN ('old', 'fresh')")).scalars().all()
    assert remaining == ["fresh"]
```

- [ ] **Step 2: Implement the task**

Create `src/datapulse/tasks/cleanup_pos_idempotency.py`:

```python
"""Nightly cleanup of expired POS idempotency keys."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session


def run(session: Session) -> int:
    result = session.execute(
        text("DELETE FROM pos.idempotency_keys WHERE expires_at < now()")
    )
    return result.rowcount or 0


if __name__ == "__main__":
    # CLI entrypoint; wire into the existing task scheduler in a subsequent ticket
    from datapulse.api.deps import get_db_session
    from datapulse.logging import get_logger

    log = get_logger(__name__)
    for session in get_db_session():
        deleted = run(session)
        session.commit()
        log.info("pos_idempotency_cleanup_complete", deleted=deleted)
        break
```

- [ ] **Step 3: Run the test**

```bash
PYTHONPATH=src pytest tests/test_pos_cleanup_task.py -v
```

Expected: PASS.

- [ ] **Step 4: Wire into the project's task scheduler**

Inspect `src/datapulse/tasks/` for the existing job registration pattern (cron-like, celery, APScheduler, or cron-driven shell script — project uses n8n for scheduled orchestration, check `n8n/workflows/`). Add an entry that calls this module nightly at 03:00 UTC. If no pattern exists, document a TODO comment pointing to the DevOps runbook and ship the CLI entrypoint alone.

- [ ] **Step 5: Commit**

```bash
git add src/datapulse/tasks/cleanup_pos_idempotency.py tests/test_pos_cleanup_task.py
git commit -m "feat(pos): nightly cleanup task for expired idempotency keys"
```

---

## Task 22: Final integration — run the full POS test suite, smoke-test capabilities contract

**Files:** read-only — this task is a gate.

- [ ] **Step 1: Run every test file touched in M1**

```bash
PYTHONPATH=src DATAPULSE_DEBUG_ROUTES=true pytest \
  tests/test_pos_idempotency.py \
  tests/test_pos_capabilities.py \
  tests/test_pos_tenant_keys.py \
  tests/test_pos_devices.py \
  tests/test_pos_grants.py \
  tests/test_pos_overrides.py \
  tests/test_pos_commit.py \
  tests/test_pos_catalog_stream.py \
  tests/test_pos_shift_close_guard.py \
  tests/test_pos_single_terminal_guard.py \
  tests/test_pos_cleanup_task.py \
  -v
```

Expected: **all PASS**. Any failure blocks the milestone.

- [ ] **Step 2: Run the full POS-tagged subset**

```bash
PYTHONPATH=src DATAPULSE_DEBUG_ROUTES=true pytest tests/ -k pos -v
```

Expected: **all PASS**. If older tests broke from added headers, trace and fix with the pattern from Task 20.

- [ ] **Step 3: Run coverage on the new modules**

```bash
PYTHONPATH=src pytest tests/ -k pos \
  --cov=src/datapulse/pos \
  --cov-report=term-missing \
  --cov-fail-under=85
```

Expected: coverage ≥ 85% on each new module (idempotency, tenant_keys, devices, grants, overrides, commit, catalog_stream). If a module is under the threshold, add missing-case tests before claiming the milestone complete.

- [ ] **Step 4: Run Ruff + mypy**

```bash
ruff check src/datapulse/pos/ src/datapulse/api/routes/pos.py
# if mypy is configured for the project:
mypy src/datapulse/pos/
```

Expected: clean. Fix any flagged issues.

- [ ] **Step 5: Smoke-test the capabilities endpoint manually**

```bash
curl -s http://localhost:8000/api/v1/pos/capabilities | jq .
```

Expected output contains:
- `"idempotency": "v1"`
- `"capabilities.idempotency_key_header": true`
- `"capabilities.pos_commit_endpoint": true`
- `"capabilities.multi_terminal_supported": false`

- [ ] **Step 6: Tag the milestone**

```bash
git tag -a pos-m1-backend-complete -m "M1: backend foundations for POS desktop complete"
git push origin feat/pos-electron-desktop pos-m1-backend-complete
```

---

## Self-Review Checklist

Before declaring M1 complete, verify that every major spec section has a corresponding task:

| Spec section | Implemented by |
|---|---|
| §1.4 Single-terminal enforcement (3 server layers) | Tasks 8, 14 |
| §3.6 Server-enforced shift close + `commit_confirmed_at` | Tasks 4, 18 |
| §4.2 Local schema (not this milestone — deferred to M2) | — |
| §6.1 Queue state machine (client-side — M2) | — |
| §6.4 Idempotency with TTL > provisional | Tasks 1, 2, 3, 21 |
| §6.6 Capability negotiation + tenant-state endpoint | Tasks 11, 14 |
| §8.8 Ed25519 grant issuance + tenant keypairs | Tasks 6, 9, 10, 16 |
| §8.8.6 Override token verifier + one-time ledger | Tasks 7, 17 |
| §8.9 Device-bound terminal credential | Tasks 5, 12, 13 |
| §3 new endpoints (commit, capabilities, tenant-key, register-device, active-for-me, catalog/*) | Tasks 10, 11, 12, 14, 15, 19 |

If any row is empty for M1-relevant content, add a task before shipping.

**Milestone deliverable:** a feat/pos-electron-desktop branch where every new/modified file has tests, every migration is applied cleanly, every new endpoint is rate-limited + RLS-scoped + idempotent where mutating, and the full POS test suite is green. The web frontend and dashboards remain unaffected — everything in M1 is additive.

---

**End of M1 plan.**
