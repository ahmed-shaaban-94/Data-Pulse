# POS Desktop Extraction (Phase 1) — Implementation Plan (Outline)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. **Do NOT execute this plan yet — Phase 2 must land and operate healthily for ≥1 release cycle first.** See "When to start" below. Once started, the recon stage (Task 1) updates this document with concrete keep/drop lists; the move tasks (Task 2-4) are then filled in with file-level detail before they execute.

**Goal:** Extract POS code into a focused module under `pos-desktop/src/`, drop the embedded Next.js standalone, unify the cart store, and introduce a typed API client — without breaking anything users rely on.

**Architecture:** Three sequential sub-PRs after a parallel-recon gate. (1) Recon: 4 parallel `Explore` agents map the dependency graph and produce keep/drop/merge lists. User reviews the lists. (2) Mechanical move: `git mv` everything on the keep list to new locations under `pos-desktop/src/`, fix imports, drop the drop list. (3) Vite migration: replace the embedded Next.js standalone with a static React build loaded directly by Electron. (4) Cart-store unification: collapse the two client-side stores into one Zustand store with snapshot-tested parity.

**Tech Stack:** Vite (replaces Next.js for the renderer), Zustand (single cart store), React Router (replaces Next.js page conventions), TypeScript, electron-builder, Electron, openapi-typescript (for the typed API client).

**Spec:** `docs/superpowers/specs/2026-04-30-pos-desktop-extraction-design.md` §5

---

## When to start

Phase 1 starts only after **all** of these are true:

- [ ] Phase 2 PR is merged to `main`.
- [ ] At least one `pos-desktop-v*` release has gone through the new pipeline successfully (tag → assert → build → publish → auto-register → DB row exists, all without manual intervention).
- [ ] No regressions reported against the new pipeline for ≥48 hours after that release.
- [ ] The user has explicitly said "go" on Phase 1.

If any of those are false, the plan stays on the shelf. Don't start it just because Phase 2 looks healthy at hour zero.

---

## Why this plan is an outline, not a full task list

A full task list right now would lock in a directory layout, an import-rewrite codemod, and a list of "files to drop" — all of which depend on a dependency-graph snapshot that doesn't exist yet. Writing those tasks against assumptions, then re-writing them when recon disagrees, is the kind of waste this whole spec is trying to stop.

So:

- **Task 1 (recon)** is fully specified — it produces the artifact the rest of the plan depends on.
- **Tasks 2-4 (move, Vite migration, cart unification)** are scoped at the goal level, with clear acceptance criteria, but the per-step bite-sized breakdown gets written **at the start of each task**, after the prior task's output is in. This is the agentic equivalent of "write the test, watch it fail, then write the code" — write the per-step plan against ground truth, not against guesses.

**The recon agent updates this very file** with the keep/drop/merge lists in Task 1 step 5. Subsequent tasks reference those lists by line number.

---

## File Structure (target after all 4 tasks)

The full target layout is in the spec at §3 ("After Phase 1"). Summary:

```
pos-desktop/
├── src/
│   ├── pages/         # was frontend/src/app/(pos)/  (8 files)
│   ├── components/    # was frontend/src/components/pos/  (~25 files, drop list TBD)
│   ├── hooks/         # was frontend/src/hooks/use-pos-*  (~15 files)
│   ├── store/         # ONE Zustand cart store
│   ├── api/           # NEW typed REST client
│   ├── electron/      # unchanged — main, preload, IPC, updater, sync
│   └── styles/        # POS tokens only (extracted from frontend/src/app/globals.css)
├── vite.config.ts     # NEW — replaces Next.js for the renderer
├── index.html         # NEW
├── electron-builder.yml  # extraResources block dropped
└── package.json       # version bumped to 3.0.0 (clean-break signal)
```

---

## Task 1: Recon (parallel subagents) — REQUIRED FIRST

**Goal:** Produce a concrete keep/drop/merge list for every POS-related file in `frontend/src/`.

**Files this task PRODUCES:**
- Modify: this plan file — replaces "Task 2 (TBD)" placeholder block with the real per-step task list
- Create: `docs/superpowers/plans/2026-04-30-pos-extraction-phase-1-recon.md` — the recon agents' raw output, kept for audit

**Files this task TOUCHES:** none in source code (read-only).

- [ ] **Step 1: Dispatch four parallel `Explore` subagents**

In a single message with four `Agent` tool calls (so they run concurrently). Use the prompt patterns below — each is self-contained because the agent has no conversation context.

**Subagent A — recon-imports:**

> You are doing read-only dependency analysis. Find every import statement that crosses the POS / non-POS boundary in this Next.js + Electron monorepo at `Data-Pulse/`.
>
> Specifically:
>
> 1. List every import in `frontend/src/components/pos/**`, `frontend/src/app/(pos)/**`, `frontend/src/hooks/use-pos-*`, `frontend/src/contexts/pos-cart-context*`, `frontend/src/store/pos-cart-store.ts` whose target lives OUTSIDE those directories (i.e., the POS code depends on it). Group by target file.
> 2. List every import elsewhere in `frontend/src/**` whose target lives INSIDE the POS directories above (i.e., dashboard code depends on POS). Group by source file.
> 3. List every export from POS files that has zero importers anywhere — these are dead-code candidates.
>
> Output a markdown report with three sections matching the three lists. Under 800 words. No code changes, read-only.

**Subagent B — recon-tests:**

> You are doing read-only test-coverage analysis on a Next.js + Electron monorepo at `Data-Pulse/`. Find every test file that exercises POS code.
>
> Specifically:
>
> 1. List every test in `frontend/src/__tests__/**` that imports from `frontend/src/components/pos/`, `frontend/src/app/(pos)/`, `frontend/src/hooks/use-pos-*`, `frontend/src/contexts/pos-cart-context*`, `frontend/src/store/pos-cart-store.ts`. Group as: terminal-flow / receipts / shift / cart-store / utility.
> 2. List any e2e tests under `frontend/e2e/` that hit POS routes (search for `/terminal`, `/checkout`, `/(pos)`).
> 3. List any unit tests in `pos-desktop/electron/__tests__/` and what they cover.
>
> Output a markdown report with three sections. Note explicitly which tests would need to move with the code, vs. which test the dashboard side and stay put. Under 600 words.

**Subagent C — recon-assets:**

> You are doing read-only static-asset analysis on a Next.js + Electron monorepo at `Data-Pulse/`. Find every static asset (image, font, JSON, public file) referenced by POS code.
>
> Specifically:
>
> 1. Search POS code (paths in subagent A above) for: `.png`, `.svg`, `.jpg`, `.webp`, `.woff`, `.woff2`, `.json`, `next/image src=`, `import(...).default`, `/public/...` references.
> 2. For each match, list the asset path and which POS file references it.
> 3. Note which of those assets live in `frontend/public/` vs. elsewhere.
>
> Output a markdown report with two sections: assets-to-move (POS-only) and assets-shared-with-dashboard (need to be vendored or referenced via a shared path). Under 500 words.

**Subagent D — recon-styles:**

> You are doing read-only CSS analysis on a Next.js project at `Data-Pulse/frontend/`. Find every CSS class, custom property, or Tailwind utility used ONLY by POS code.
>
> Specifically:
>
> 1. Read `frontend/src/app/globals.css`. List every selector under `.pos-root`, every `--pos-*` custom property, and the `.pos-glow-halo` utility from PR #797.
> 2. Search POS code (paths in subagent A above) for usages of those selectors / properties — confirm they're POS-only.
> 3. Search non-POS code (everything else under `frontend/src/`) for any usage of those same selectors / properties — list any leakage.
>
> Output a markdown report with two sections: pos-only-styles (safe to extract to pos-desktop/src/styles/) and shared-styles (need duplication or a shared CSS module). Under 400 words.

- [ ] **Step 2: Each subagent returns a markdown report**

Save each report to `docs/superpowers/plans/2026-04-30-pos-extraction-phase-1-recon.md` as separate sections (A, B, C, D). The agents themselves don't write the file; the orchestrator (this session) collates their outputs.

- [ ] **Step 3: Cross-reference and produce keep/drop/merge lists**

Synthesize the four reports into three lists in the same recon file:

- **Keep list** — every file that is imported by an active `(pos)` route (transitively). These move to `pos-desktop/src/`.
- **Drop list** — every file in POS directories that has no importers from any active route (subagent A's section 3 minus anything caught by subagent B's tests). These get deleted.
- **Merge list** — duplicate stores (`pos-cart-context.tsx` vs. `pos-cart-store.ts`), duplicate hooks, duplicate utility helpers. Each entry says which one survives and why.

- [ ] **Step 4: User review gate**

Stop. Show the keep/drop/merge lists to the user. They must explicitly approve before any code moves. The user may flag a "drop" item that's actually in use elsewhere (subagent A's grep is not perfect — dynamic imports, string-templated imports, etc. can slip through).

- [ ] **Step 5: Update this plan file**

After approval, replace the "Task 2 (TBD until recon completes)" block below with a real per-step task list referencing the keep/drop lists by line number from the recon report. Same for Tasks 3 and 4 — flesh them out at this point with file-level detail.

- [ ] **Step 6: Commit the recon report and the updated plan**

```bash
git add docs/superpowers/plans/2026-04-30-pos-extraction-phase-1-recon.md docs/superpowers/plans/2026-04-30-pos-extraction-phase-1.md
git commit -m "docs(plan): POS extraction Phase 1 — recon output + concrete tasks"
```

---

## Task 2: Mechanical move (sub-PR 1) — TBD until Task 1 completes

**Goal:** `git mv` every keep-list file to its new location under `pos-desktop/src/`, fix all imports via codemod, drop every drop-list file. After this sub-PR, the Electron app still uses the embedded Next.js standalone — only file paths changed. Existing tests pass unchanged.

**Acceptance criteria** (these are firm; the per-step task list filled in by Task 1 step 5 must satisfy them):

- [ ] Every file on the keep list moved to its mapped location under `pos-desktop/src/`.
- [ ] Every import in the rest of the codebase that pointed at the old POS paths now points at the new ones (codemod or `tsc` errors guide the rewrites).
- [ ] Every file on the drop list is deleted.
- [ ] All existing POS tests pass without changes.
- [ ] `pos-desktop/scripts/build.sh --dev` still produces a runnable Electron app (smoke test: app launches, terminal page loads).
- [ ] Single PR, green CI, no behavioural changes.

**Subagent dispatch:** single-executor session — moves are mechanical and sequential, parallelism would just create coordination overhead. `code-reviewer` agent reviews the PR before merge.

**Detailed task list:** filled in at end of Task 1.

---

## Task 3: Replace embedded Next.js with Vite (sub-PR 2) — TBD until Task 2 lands

**Goal:** Drop the embedded Next.js standalone server. The Electron renderer loads a static React build (Vite) directly via `loadFile()`. Bundled installer becomes ~30% smaller (no embedded Node runtime).

**Acceptance criteria:**

- [ ] `pos-desktop/vite.config.ts` and `pos-desktop/index.html` exist; Vite builds the renderer to `pos-desktop/dist/renderer/`.
- [ ] Each `pages/*.tsx` is reachable via React Router (or whatever routing the recon stage decides on — likely `react-router-dom`'s `createHashRouter` because Electron `loadFile` doesn't support browser-history-style routing).
- [ ] `pos-desktop/electron/main.ts` loads `dist/renderer/index.html` via `BrowserWindow.loadFile()`. The `spawn(node, [server.js])` block is deleted.
- [ ] `pos-desktop/resources/nextjs/` no longer exists.
- [ ] `pos-desktop/electron-builder.yml`'s `extraResources` block referencing `resources/nextjs` is gone.
- [ ] Manual smoke test: app launches → loads UI → IPC handlers respond → backend API calls succeed → all 8 POS routes navigable.
- [ ] Bundled installer size dropped by ≥20 MB (was ~108 MB, target ≤90 MB).

**Subagent dispatch:** single-executor session. `tdd-guide` agent for the Electron load-flow tests if any are added. `code-reviewer` agent for the PR.

**Detailed task list:** filled in at end of Task 2 (when the actual Vite-vs-Next.js call sites are visible in the new layout).

**Risk:** Next.js features that depend on the dev/SSR server (e.g., `next/image`, `next/font`, route handlers) won't work under Vite. Recon stage's subagent A flags any usage of these; if found, the migration must replace them with vanilla equivalents (`<img>` + manually pre-resolved URLs, font import in CSS, etc.) before this sub-PR can land.

---

## Task 4: Unify cart store (sub-PR 3) — TBD until Task 3 lands

**Goal:** Collapse the two client-side cart stores (`pos-cart-store.ts` Zustand + `pos-cart-context.tsx` React context) into one Zustand store at `pos-desktop/src/store/cart-store.ts`. Every existing call-site uses the new store; no behavior changes.

**Acceptance criteria:**

- [ ] `pos-desktop/src/store/cart-store.ts` is the only place cart state lives client-side.
- [ ] `pos-desktop/src/contexts/pos-cart-context.tsx` (or wherever the duplicate ended up after Task 2) is deleted.
- [ ] Every recon-list call-site of the old context (subagent A's output) now reads from the new store.
- [ ] Snapshot tests assert behavior parity with the pre-merge stores across every documented use case (the recon stage's subagent B identified the existing tests; new tests cover any gaps).
- [ ] All existing POS tests pass.
- [ ] Manual checkout walkthrough on staging passes.

**Subagent dispatch:** single-executor session, `tdd-guide` agent for the parity tests. **This is the riskiest sub-PR**; if snapshot tests reveal subtle behavior differences between the two stores, escalate to Opus for the design call (not Sonnet).

**Detailed task list:** filled in at end of Task 3.

---

## Task 5: Web POS redirect (small follow-up PR) — optional

**Goal:** The web app's POS routes (now empty after the move) redirect users to "open the desktop app" instead of 404. This protects users who bookmarked `/terminal` in their browser during the transition.

**Files:**
- Create: `frontend/src/app/(pos)/[[...slug]]/page.tsx` — a single catch-all route that renders a "POS now lives in the desktop app — download here" notice with a link to GitHub Releases.

This is a 30-line task. Skipped if the spec's §11 decision lands on "drop browser POS access entirely."

---

## Self-Review (run after Tasks 2-4 are filled in)

A self-review pass at this stage is premature — there's nothing concrete to review against beyond the recon plan in Task 1, which IS reviewable now. Once Task 1 completes and Tasks 2-4 are filled in with per-step detail, run the same checklist as Phase 2's plan:

1. **Spec coverage** — every spec §5 requirement mapped to a task.
2. **Placeholder scan** — no TBDs, no "implement appropriate X."
3. **Type consistency** — names match across tasks.

---

## Execution handoff

This plan is not executable yet. Phase 2 ships first.

When Phase 2 has been live and healthy for ≥48h after its first real release, and the user says "go on Phase 1," the executor:

1. Starts at Task 1 (recon).
2. After Task 1 step 4 (user review gate), the user-facing question is: "Recon complete. Lists committed to `…-recon.md`. Are the keep/drop/merge lists right? Any items I marked as 'drop' that I shouldn't?"
3. After approval, Task 1 step 5 fills in Tasks 2-4 with concrete per-step detail.
4. From there, the same execution choice as Phase 2 — Subagent-Driven (recommended for the 3 sub-PRs) or Inline (acceptable for Task 4 alone, since the cart unification benefits from one focused session).
