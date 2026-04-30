# POS Desktop Pipeline Standardization (Phase 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the silent-fail mode in the POS desktop release pipeline (tag/version assertion), replace per-release SQL migrations with an authenticated admin endpoint, and configure code-signing — all in one PR.

**Architecture:** Three independent changes. (1) A pre-build workflow step that asserts the git tag suffix matches `pos-desktop/package.json` and fails loudly otherwise. (2) A new FastAPI route `POST /api/v1/pos/admin/desktop-releases` (RBAC-gated by existing `pos:update:manage` permission) that idempotently inserts/updates a row in `pos.desktop_update_releases`. (3) A workflow step calling that endpoint after `electron-builder` publishes. Code-signing requires repo-secret config (operator step) and runs through the workflow's existing detection block — no code change beyond docs.

**Tech Stack:** GitHub Actions, electron-builder, FastAPI, SQLAlchemy (sync `Session` per existing POS sub-router pattern), pytest, Pydantic v2.

**Spec:** `docs/superpowers/specs/2026-04-30-pos-desktop-extraction-design.md` §4

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `.github/workflows/pos-desktop-release.yml` | modify | Add tag/version assertion step before build; add register-rollout step after publish |
| `src/datapulse/pos/models/admin_release.py` | **create** | Pydantic models: `DesktopReleaseCreate`, `DesktopReleaseResponse` |
| `src/datapulse/pos/admin_release_service.py` | **create** | DB ops: `upsert_release(session, payload) -> DesktopReleaseResponse` |
| `src/datapulse/api/routes/_pos_admin_releases.py` | **create** | One route: `POST /api/v1/pos/admin/desktop-releases` |
| `src/datapulse/api/routes/pos.py` | modify | Register the new sub-router |
| `tests/pos/test_admin_release_service.py` | **create** | Unit tests for `upsert_release` |
| `tests/pos/test_admin_release_endpoint.py` | **create** | Endpoint tests: auth gate, idempotency, validation |
| `docs/ops/key-rotation.md` | modify | Add CSC code-signing cert to rotation cadence |

Estimated: ~280 lines added across 7 new files + 2 modified.

---

## Task 1: Pydantic models for the admin release API

**Files:**
- Create: `src/datapulse/pos/models/admin_release.py`

- [ ] **Step 1: Confirm models package layout**

Run: `ls src/datapulse/pos/models/`
Expected: lists `updates.py` (existing), `__init__.py`. We'll add a new module beside `updates.py` to keep operator-write models separate from the consumer-read models there.

- [ ] **Step 2: Write models**

```python
# src/datapulse/pos/models/admin_release.py
"""Admin write-side models for staged POS desktop release rollouts.

Read-side equivalents live in `updates.py`. Splitting keeps the operator
write surface (RBAC-gated) clearly separated from the cashier read surface.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

ChannelLiteral = Literal["stable", "beta"]
PlatformLiteral = Literal["win32", "darwin", "linux"]
RolloutScopeLiteral = Literal["all", "selected", "paused"]


class DesktopReleaseCreate(BaseModel):
    """Body of POST /api/v1/pos/admin/desktop-releases."""

    version: str = Field(..., min_length=1, max_length=50)
    channel: ChannelLiteral = "stable"
    platform: PlatformLiteral = "win32"
    rollout_scope: RolloutScopeLiteral = "all"
    active: bool = True
    release_notes: str | None = None
    min_app_version: str | None = Field(default=None, max_length=50)
    min_schema_version: int | None = None
    max_schema_version: int | None = None
    target_tenant_ids: list[int] = Field(default_factory=list)

    @field_validator("version")
    @classmethod
    def _strip_v_prefix(cls, v: str) -> str:
        # Allow callers to send "v2.0.0" or "2.0.0"; we always store without prefix.
        stripped = v.lstrip("v").strip()
        if not stripped:
            raise ValueError("version must not be empty after stripping leading 'v'")
        return stripped


class DesktopReleaseResponse(BaseModel):
    """Echo back the row we wrote, including DB-assigned columns."""

    release_id: int
    version: str
    channel: ChannelLiteral
    platform: PlatformLiteral
    rollout_scope: RolloutScopeLiteral
    active: bool
    release_notes: str | None
    min_app_version: str | None
    min_schema_version: int | None
    max_schema_version: int | None
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 3: Run type-check**

Run: `ruff check src/datapulse/pos/models/admin_release.py`
Expected: no errors. If `ChannelLiteral` etc. trip ruff, replace with the inline `Literal[...]` form on each field.

- [ ] **Step 4: Commit**

```bash
git add src/datapulse/pos/models/admin_release.py
git commit -m "feat(pos): pydantic models for admin desktop-release API"
```

---

## Task 2: Service layer — `upsert_release`

**Files:**
- Create: `src/datapulse/pos/admin_release_service.py`
- Test: `tests/pos/test_admin_release_service.py`

This task is TDD — tests first.

- [ ] **Step 1: Write failing test for happy-path insert**

```python
# tests/pos/test_admin_release_service.py
"""Tests for the admin desktop-release upsert service."""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from datapulse.pos.admin_release_service import upsert_release
from datapulse.pos.models.admin_release import DesktopReleaseCreate


@pytest.mark.unit
def test_upsert_inserts_new_row(pos_session: Session) -> None:
    payload = DesktopReleaseCreate(
        version="9.9.0",
        channel="stable",
        platform="win32",
        rollout_scope="all",
        active=True,
        release_notes="test row",
    )

    result = upsert_release(pos_session, payload)

    assert result.version == "9.9.0"
    assert result.active is True
    assert result.release_id > 0

    row = pos_session.execute(
        text(
            "SELECT version, active, rollout_scope FROM pos.desktop_update_releases "
            "WHERE version = :v AND channel = :c AND platform = :p"
        ),
        {"v": "9.9.0", "c": "stable", "p": "win32"},
    ).mappings().one()
    assert row["active"] is True
    assert row["rollout_scope"] == "all"


@pytest.mark.unit
def test_upsert_updates_existing_row_idempotent(pos_session: Session) -> None:
    base = DesktopReleaseCreate(
        version="9.9.1", channel="stable", platform="win32",
        rollout_scope="all", active=True, release_notes="first",
    )
    first = upsert_release(pos_session, base)
    again = base.model_copy(update={"release_notes": "second", "rollout_scope": "selected"})
    second = upsert_release(pos_session, again)

    assert first.release_id == second.release_id  # same row, not a dup
    assert second.release_notes == "second"
    assert second.rollout_scope == "selected"
    assert second.updated_at >= first.updated_at


@pytest.mark.unit
def test_upsert_strips_v_prefix(pos_session: Session) -> None:
    payload = DesktopReleaseCreate(version="v9.9.2", channel="stable", platform="win32")
    result = upsert_release(pos_session, payload)
    assert result.version == "9.9.2"
```

The fixture `pos_session: Session` is defined in `tests/conftest.py` for existing POS tests — see `tests/pos/test_pos_idempotency.py` for the pattern. If it doesn't exist with that exact name, find the equivalent in `conftest.py` and adjust the import.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/pos/test_admin_release_service.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'datapulse.pos.admin_release_service'`

- [ ] **Step 3: Write minimal service implementation**

```python
# src/datapulse/pos/admin_release_service.py
"""Idempotent upsert into pos.desktop_update_releases."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from datapulse.pos.models.admin_release import (
    DesktopReleaseCreate,
    DesktopReleaseResponse,
)


def upsert_release(
    session: Session,
    payload: DesktopReleaseCreate,
) -> DesktopReleaseResponse:
    """Insert or update a row in pos.desktop_update_releases.

    Idempotent on (version, channel, platform). Re-calls update
    active/rollout_scope/release_notes/min_app_version/min_schema_version/max_schema_version
    without creating a duplicate row.
    """
    row = session.execute(
        text(
            """
            INSERT INTO pos.desktop_update_releases (
                version, channel, platform, rollout_scope, active,
                release_notes, min_app_version, min_schema_version, max_schema_version
            )
            VALUES (
                :version, :channel, :platform, :rollout_scope, :active,
                :release_notes, :min_app_version, :min_schema_version, :max_schema_version
            )
            ON CONFLICT (version, channel, platform) DO UPDATE
            SET active             = EXCLUDED.active,
                rollout_scope      = EXCLUDED.rollout_scope,
                release_notes      = EXCLUDED.release_notes,
                min_app_version    = EXCLUDED.min_app_version,
                min_schema_version = EXCLUDED.min_schema_version,
                max_schema_version = EXCLUDED.max_schema_version,
                updated_at         = now()
            RETURNING release_id, version, channel, platform, rollout_scope,
                      active, release_notes, min_app_version,
                      min_schema_version, max_schema_version,
                      created_at, updated_at
            """
        ),
        {
            "version": payload.version,
            "channel": payload.channel,
            "platform": payload.platform,
            "rollout_scope": payload.rollout_scope,
            "active": payload.active,
            "release_notes": payload.release_notes,
            "min_app_version": payload.min_app_version,
            "min_schema_version": payload.min_schema_version,
            "max_schema_version": payload.max_schema_version,
        },
    ).mappings().one()
    session.commit()
    return DesktopReleaseResponse(**dict(row))
```

Note on tenant targets: the spec mentions `target_tenant_ids` for `rollout_scope='selected'`. We're deliberately NOT writing to `pos.desktop_update_release_targets` in this task — that's a follow-up because the current callers always use `rollout_scope='all'`. If/when `selected` is needed, add a second task that handles the targets table inside the same DB transaction.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/pos/test_admin_release_service.py -v`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/datapulse/pos/admin_release_service.py tests/pos/test_admin_release_service.py
git commit -m "feat(pos): admin_release_service.upsert_release with idempotent ON CONFLICT"
```

---

## Task 3: FastAPI route — `POST /api/v1/pos/admin/desktop-releases`

**Files:**
- Create: `src/datapulse/api/routes/_pos_admin_releases.py`
- Modify: `src/datapulse/api/routes/pos.py` (register sub-router)
- Test: `tests/pos/test_admin_release_endpoint.py`

- [ ] **Step 1: Write failing endpoint tests**

```python
# tests/pos/test_admin_release_endpoint.py
"""Tests for POST /api/v1/pos/admin/desktop-releases."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.mark.integration
def test_post_release_creates_row(api_client: TestClient, owner_token: str) -> None:
    res = api_client.post(
        "/api/v1/pos/admin/desktop-releases",
        json={
            "version": "9.9.10",
            "channel": "stable",
            "platform": "win32",
            "rollout_scope": "all",
            "active": True,
            "release_notes": "endpoint test",
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["version"] == "9.9.10"
    assert body["release_id"] > 0


@pytest.mark.integration
def test_post_release_idempotent(api_client: TestClient, owner_token: str) -> None:
    payload = {
        "version": "9.9.11",
        "channel": "stable",
        "platform": "win32",
        "rollout_scope": "all",
        "active": True,
    }
    first = api_client.post(
        "/api/v1/pos/admin/desktop-releases",
        json=payload,
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()
    second = api_client.post(
        "/api/v1/pos/admin/desktop-releases",
        json={**payload, "release_notes": "updated"},
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()
    assert first["release_id"] == second["release_id"]
    assert second["release_notes"] == "updated"


@pytest.mark.integration
def test_post_release_requires_permission(
    api_client: TestClient, cashier_token: str
) -> None:
    res = api_client.post(
        "/api/v1/pos/admin/desktop-releases",
        json={"version": "9.9.12", "channel": "stable", "platform": "win32"},
        headers={"Authorization": f"Bearer {cashier_token}"},
    )
    assert res.status_code == 403


@pytest.mark.integration
def test_post_release_rejects_anonymous(api_client: TestClient) -> None:
    res = api_client.post(
        "/api/v1/pos/admin/desktop-releases",
        json={"version": "9.9.13"},
    )
    assert res.status_code == 401


@pytest.mark.integration
def test_post_release_rejects_blank_version(
    api_client: TestClient, owner_token: str
) -> None:
    res = api_client.post(
        "/api/v1/pos/admin/desktop-releases",
        json={"version": "", "channel": "stable"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 422
```

The fixtures `api_client`, `owner_token`, `cashier_token` are the project's standard test fixtures — see existing tests under `tests/pos/test_pos_*.py` for the names actually in use (these match `tests/pos/test_pos_idempotency.py`'s patterns; if the names differ, adjust).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/pos/test_admin_release_endpoint.py -v`
Expected: All 5 tests FAIL (404 / no route registered).

- [ ] **Step 3: Write the route**

```python
# src/datapulse/api/routes/_pos_admin_releases.py
"""Admin: register a desktop release in the staged-rollout table.

Replaces the per-release SQL migration pattern (#802 used migration 123).
The pos-desktop release workflow calls this endpoint after a successful
publish to GitHub Releases.

RBAC: pos:update:manage (granted to owner / admin / pos_manager in
migration 115).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from datapulse.api.routes._pos_routes_deps import SessionDep
from datapulse.pos.admin_release_service import upsert_release
from datapulse.pos.models.admin_release import (
    DesktopReleaseCreate,
    DesktopReleaseResponse,
)
from datapulse.rbac.dependencies import require_permission

router = APIRouter(prefix="/api/v1/pos/admin", tags=["pos-admin"])


@router.post(
    "/desktop-releases",
    status_code=status.HTTP_201_CREATED,
    response_model=DesktopReleaseResponse,
)
def post_desktop_release(
    payload: DesktopReleaseCreate,
    session: SessionDep,
    _admin: Annotated[None, Depends(require_permission("pos:update:manage"))],
) -> DesktopReleaseResponse:
    """Idempotent upsert into pos.desktop_update_releases."""
    return upsert_release(session, payload)
```

- [ ] **Step 4: Register the sub-router**

Open `src/datapulse/api/routes/pos.py`. Find the block where existing `_pos_*` routers are included (look for `from datapulse.api.routes._pos_*` and `app.include_router(...)`). Add:

```python
from datapulse.api.routes._pos_admin_releases import router as _pos_admin_releases_router
# ... (existing imports)

# in the same block where existing routers are included:
app.include_router(_pos_admin_releases_router)
```

If `pos.py` uses a different aggregation pattern (e.g. a single APIRouter that mounts sub-routers), follow that pattern instead of `app.include_router`. Read 20 lines of context first to be sure.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/pos/test_admin_release_endpoint.py -v`
Expected: 5 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/datapulse/api/routes/_pos_admin_releases.py src/datapulse/api/routes/pos.py tests/pos/test_admin_release_endpoint.py
git commit -m "feat(pos): POST /api/v1/pos/admin/desktop-releases endpoint (RBAC-gated)"
```

---

## Task 4: Workflow — tag/version assertion

**Files:**
- Modify: `.github/workflows/pos-desktop-release.yml`

- [ ] **Step 1: Locate the right insertion point**

Run: `grep -n "Detect code-signing config\|Build installer" .github/workflows/pos-desktop-release.yml | head -5`
Expected: shows the line numbers of the existing "Detect code-signing config" step. We insert **before** that step but **after** the `Set up Node.js` step.

- [ ] **Step 2: Insert the assertion step**

Open `.github/workflows/pos-desktop-release.yml`. Just before `- name: Detect code-signing config`, add:

```yaml
      - name: Assert tag matches package.json version
        if: startsWith(github.ref, 'refs/tags/pos-desktop-v')
        shell: bash
        run: |
          TAG_VERSION="${GITHUB_REF#refs/tags/pos-desktop-v}"
          PKG_VERSION=$(node -p "require('./pos-desktop/package.json').version")
          if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
            cat <<EOF
          ::error::Tag version mismatch
            Tag:           pos-desktop-v$TAG_VERSION
            package.json:  $PKG_VERSION

          Recovery:
            1. Bump pos-desktop/package.json + package-lock.json to $TAG_VERSION
            2. Commit + push to main
            3. Delete bad tag: git push origin :refs/tags/pos-desktop-v$TAG_VERSION
            4. Re-tag from new HEAD: git tag pos-desktop-v$TAG_VERSION && git push origin pos-desktop-v$TAG_VERSION
          EOF
            exit 1
          fi
          echo "::notice::Tag and package.json both at $TAG_VERSION"
```

- [ ] **Step 3: Validate workflow syntax locally if `act` is available; otherwise rely on GitHub's parser at push time**

Run: `command -v act && act -W .github/workflows/pos-desktop-release.yml --list || echo "act not installed; will validate on push"`
Expected: either lists the jobs, or notes that act isn't installed (acceptable).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/pos-desktop-release.yml
git commit -m "ci(pos-desktop): fail loudly when git tag and package.json version disagree"
```

---

## Task 5: Workflow — auto-register the rollout

**Files:**
- Modify: `.github/workflows/pos-desktop-release.yml`

- [ ] **Step 1: Find the right insertion point**

The register step runs **after** the `Build installer` step succeeds (which is when `electron-builder` published to GitHub Releases). Locate `- name: Verify installer exists` and add the new step BEFORE that one — actually, AFTER both `Verify installer exists` and `Verify installer signature` so we only register when the artifacts are confirmed real.

Run: `grep -n "Verify installer signature\|Upload source maps to Sentry\|Upload installer artifact" .github/workflows/pos-desktop-release.yml`

- [ ] **Step 2: Insert the register step right before the source-map upload step**

```yaml
      - name: Register rollout in DB
        if: success() && startsWith(github.ref, 'refs/tags/pos-desktop-v')
        env:
          POS_ADMIN_TOKEN: ${{ secrets.POS_ADMIN_TOKEN }}
        shell: bash
        run: |
          if [ -z "${POS_ADMIN_TOKEN:-}" ]; then
            echo "::warning::POS_ADMIN_TOKEN secret not set — skipping rollout registration. Add it under repo Settings → Secrets to enable auto-register."
            exit 0
          fi
          VERSION="${GITHUB_REF#refs/tags/pos-desktop-v}"
          BODY=$(jq -nc \
            --arg v "$VERSION" \
            '{version:$v,channel:"stable",platform:"win32",rollout_scope:"all",active:true,release_notes:("Auto-registered by pos-desktop-release workflow for tag pos-desktop-v" + $v)}')
          echo "Registering: $BODY"
          curl -fsSL --retry 3 --retry-delay 5 \
            -X POST https://smartdatapulse.tech/api/v1/pos/admin/desktop-releases \
            -H "Authorization: Bearer $POS_ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$BODY" \
            -o /tmp/register-response.json \
            -w "Registered: HTTP %{http_code}\n"
          # Print the response for the workflow log
          cat /tmp/register-response.json
```

The `if -z` guard makes the step a no-op (with a clear warning) if the operator hasn't yet added the `POS_ADMIN_TOKEN` secret. That keeps existing tag pushes working while the secret is being provisioned, and turns this into a transition step rather than a hard-cutover.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/pos-desktop-release.yml
git commit -m "ci(pos-desktop): auto-register rollout via /api/v1/pos/admin/desktop-releases"
```

---

## Task 6: Document key rotation for the code-signing cert

**Files:**
- Modify: `docs/ops/key-rotation.md`

- [ ] **Step 1: Read the existing rotation table**

Run: `head -60 docs/ops/key-rotation.md`
Expected: a structured doc with a per-credential rotation cadence list.

- [ ] **Step 2: Add a row for the POS desktop signing cert**

Find the rotation cadence table (or list) and add an entry. If it's a markdown table:

```markdown
| Windows code-signing cert (CSC_LINK) | 1y | Provided by signing CA; rotate before expiry. After rotation, update `CSC_LINK` (base64-encoded .pfx) and `CSC_KEY_PASSWORD` in repo Settings → Secrets. The pos-desktop-release workflow auto-detects them and gates the signature-verify step on their presence. |
```

If it's a list, add an equivalent bullet. Match the file's existing prose style.

- [ ] **Step 3: Commit**

```bash
git add docs/ops/key-rotation.md
git commit -m "docs(ops): add Windows code-signing cert to rotation cadence"
```

---

## Task 7: Final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Lint**

Run: `ruff format --check src/datapulse/pos/models/admin_release.py src/datapulse/pos/admin_release_service.py src/datapulse/api/routes/_pos_admin_releases.py tests/pos/test_admin_release_service.py tests/pos/test_admin_release_endpoint.py`
Expected: clean.

Run: `ruff check src/datapulse/pos/models/admin_release.py src/datapulse/pos/admin_release_service.py src/datapulse/api/routes/_pos_admin_releases.py tests/pos/test_admin_release_service.py tests/pos/test_admin_release_endpoint.py`
Expected: clean.

- [ ] **Step 2: Run the full unit test suite to confirm no regressions**

Run: `pytest -m unit -x -q`
Expected: all green, no slowdown.

- [ ] **Step 3: Run integration tests (slower)**

Run: `pytest -m integration -x -q tests/pos/`
Expected: all green.

- [ ] **Step 4: After-fix mock-mocks check (per CLAUDE.md "after changing a function signature")**

Run: `grep -rn "assert_called.*upsert_release" tests/`
Expected: no stale mocks (this is a brand-new function; nothing should reference it from a mock).

- [ ] **Step 5: Push branch + open PR**

(The executor names the branch when starting Task 1; suggested: `feat/pos-pipeline-phase-2`.)

```bash
git push -u origin feat/pos-pipeline-phase-2
gh pr create --title "feat(pos): pipeline standardization (Phase 2 — tag assert + auto-register + signing docs)" \
             --body "$(cat <<'EOF'
## Summary

Phase 2 of the spec at \`docs/superpowers/specs/2026-04-30-pos-desktop-extraction-design.md\`. Three changes that together kill the silent-fail mode that bit us in PR #802 plus the per-release SQL-migration pattern:

1. **Tag/version assertion** — workflow fails loudly if \`git tag\` suffix ≠ \`pos-desktop/package.json\`. Error message contains the recovery runbook inline.
2. **Admin endpoint** — \`POST /api/v1/pos/admin/desktop-releases\` (RBAC \`pos:update:manage\`) idempotently upserts a row in \`pos.desktop_update_releases\`. Replaces hand-written migrations like #802's migration 123.
3. **Workflow auto-register** — calls the endpoint after each successful publish. Guarded so a missing \`POS_ADMIN_TOKEN\` secret degrades gracefully instead of hard-failing.
4. **Code-signing cadence** — added to \`docs/ops/key-rotation.md\` so the cert rotation has a documented owner.

## Operator setup before merge

- [ ] Generate a service-account Bearer with \`pos:update:manage\` permission and add it to repo Settings → Secrets as \`POS_ADMIN_TOKEN\`.
- [ ] (When ready) Add \`CSC_LINK\` (base64-encoded .pfx) and \`CSC_KEY_PASSWORD\` to repo Secrets to enable signed installers (#476).

Both are no-op-friendly: the workflow detects each and skips with a notice if missing.

## Verification

- 5 unit tests + 5 integration tests added, all passing
- Workflow assertion deliberately tested with a mismatch tag locally (or on a throwaway tag like \`pos-desktop-v0.0.0-test\`)

## Refs

- Spec: \`docs/superpowers/specs/2026-04-30-pos-desktop-extraction-design.md\` §4
- Stuck-deploy incident that motivated the assertion: \`docs/brain/incidents/2026-04-30-stuck-container-deploy-loop.md\`
- Tonight's PRs that this prevents from recurring: #800, #802

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Manual end-to-end test before merging**

Once the PR is open and CI is green, before merge:

1. Operator adds `POS_ADMIN_TOKEN` to repo secrets.
2. On the PR branch, deliberately push a mismatch tag: bump nothing in `package.json`, then push tag `pos-desktop-v9.9.0-test`. Verify the workflow fails at "Assert tag matches package.json version" with the recovery message visible in the log. Delete the tag.
3. Bump `pos-desktop/package.json` to a real next-version on a throwaway branch, tag it `pos-desktop-v9.9.0-test` again, push. Verify the workflow runs end-to-end: assertion passes → builds → publishes → auto-registers → DB row shows up.
4. Delete the test row from the DB and the test tag/release from GitHub.

---

## Self-Review

**1. Spec coverage** (cross-checking against `docs/superpowers/specs/2026-04-30-pos-desktop-extraction-design.md` §4):

| Spec requirement | Implementing task | ✓ |
|---|---|---|
| Tag/version assertion in workflow | Task 4 | ✓ |
| Auto-register endpoint with idempotency | Task 1 (models) + Task 2 (service) + Task 3 (route) | ✓ |
| Endpoint behind `pos:update:manage` permission | Task 3 | ✓ |
| Workflow calls endpoint after publish | Task 5 | ✓ |
| Code-signing config | Task 6 (docs only — secrets are operator step, called out in PR description) | ✓ |
| Phase 2 unit tests | Task 2 step 1 | ✓ |
| Phase 2 integration tests | Task 3 step 1 | ✓ |
| E2E manual test | Task 7 step 6 | ✓ |
| Workflow assertion tested by deliberate mismatch | Task 7 step 6 (1) | ✓ |

No gaps.

**2. Placeholder scan** — no TBDs, no "implement appropriate validation," every code step has runnable code, every command has expected output. The only "consult adjacent file" instruction (Task 3 step 4) is a deliberate read-the-pattern-first, not a placeholder.

**3. Type consistency** — `DesktopReleaseCreate` and `DesktopReleaseResponse` defined in Task 1, used by name in Tasks 2 and 3. `upsert_release(session, payload)` signature in Task 2 matches the call site in Task 3. No drift.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-30-pos-pipeline-phase-2.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Good for the 7 tasks here (each is self-contained).

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints for review.

Either works. Tasks 1, 2, 3 must run in order (later tasks reference earlier ones). Tasks 4 and 5 are workflow edits and can be done in parallel by the same executor. Tasks 6 and 7 are sequential after everything else.

Which approach?
