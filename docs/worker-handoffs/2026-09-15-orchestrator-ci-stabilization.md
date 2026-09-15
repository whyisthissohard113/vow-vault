# Handoff — CI Stabilization (deterministic test gate)

- **Date:** 2026-09-15
- **Agent:** Orchestrator (CTO)
- **Phase:** Between Phase 15 (DevOps packaging) and the release/deploy workflow phase
- **Commit:** `ef909d4` — `fix(tests): deterministic CI test gate - unique platform template code, serialized per-file test processes`
- **Status:** DONE — CI run `34978793341` on `main` is **all green** (Checks, Tests, Production build).

## Context

Phase 15 landed the first CI workflow. The initial run on `main`
(`34962835005`) failed the **Tests** job with 8 flaky failures while Checks and
Production build passed. This handoff records the root causes, the fixes, and
the verification evidence.

## Root causes (in order of discovery)

1. **`templates_platform_code_unique_idx` collision (the actual CI failure).**
   `templates` has a *partial unique index* allowing at most one platform
   (`organization_id IS NULL`) template per `code` DB-wide. Both
   `build-engine.test.ts` and `phase14-e2e.test.ts` inserted a platform
   template with `code = 'classic'`. Under parallel file execution the second
   insert's `onConflictDoNothing()` in `build-engine.test.ts` silently no-op'd,
   so the following `template_versions` insert failed its FK to the missing
   parent — 8 failures.
2. **Parallel files against ONE shared database.** Independent of (1), running
   all 21 DB-backed files in parallel workers makes any partial-unique /
   cross-family contention intermittent.
3. **Shared postgres.js pool carried across all files.** With one reused
   worker, the module-level singleton pool lived for the whole ~21-file run and
   degraded (queued/slow queries) toward the tail of the heaviest suite.
4. **Vitest default `hookTimeout` (10s).** The admin suite's `afterEach`
   cleanup cascades many FK deletes and exceeded 10s under serial execution.
5. **Local-only: Docker Desktop port-forward stalls.** On the Windows dev box,
   sustained burst load from the admin suite occasionally stalled/reset TCP
   connects to `localhost:5432` (`write CONNECT_TIMEOUT`, `read ECONNRESET`).
   This is an environment class that does **not** exist on Linux CI runners
   (Postgres runs as a native service container, no Docker Desktop proxy).

## Changes

| File | Change |
|---|---|
| `src/server/services/__tests__/build-engine.test.ts` | Platform template code `classic` → `e2e-build-engine-test`; comment explains the partial-unique hazard |
| `docs/DECISIONS.md` | New section: **CI fixture convention: platform-code uniqueness** |
| `vitest.config.ts` | `fileParallelism: false` (serial files) · `pool: "forks"` + `singleFork: false` (fresh process, hence fresh DB pool, per file) · `testTimeout` 45s · `hookTimeout` 45s · `DATABASE_URL` fallback so an explicit shell/CI value wins over the dev default |
| `src/lib/db/index.ts` | `connect_timeout: 120` (postgres.js default is 30s) |
| `.github/workflows/ci.yml` | Tests job `timeout-minutes: 15` → `30` (serial suite) |

## Verification

- Reproduced the template collision locally against a purpose-built fresh DB
  (`wmv_ci_repro`, migrated `0000`–`0003`); confirmed `build-engine` alone
  18/18 and `build-engine` + `payments` 33/33, proving cross-file contention.
- After the fixes: **537/537** on a fresh DB **four times**, including a clean
  drop → create → `drizzle-kit migrate` → `npx vitest run` cycle matching CI.
- `npx tsc --noEmit` → 0; `npm run lint` → 0 (run with no competing process).
- Pushed `ef909d4`; CI run `34978793341`: **success** on all three jobs.

## Notes / follow-ups

- **Do not run two vitest invocations concurrently.** Locally they contend for
  the same DB/Docker stack and produce false failures — always wait for a run
  to finish before starting another (or a typecheck/lint run).
- The remaining "flaky" failures observed locally were 100% Docker-networking
  errors (`CONNECT_TIMEOUT` / `ECONNRESET`), never assertion failures, and did
  not reproduce on CI. If they recur, consider lightening the fixture storm in
  the `getPlatformHealth` describe block (it does not need the full
  `beforeEachBase` fixture set for the connectivity/worker-status cases).
- CI annotations warn that `actions/checkout@v4` and `actions/setup-node@v4`
  are forced onto Node 24 (Node 20 deprecation). Non-blocking; bump to v5 in a
  future chores pass.
- `wmv_ci_repro` is a local throwaway DB used for fresh-DB verification; it is
  not referenced by any committed config.

## Next phase

Release/deploy workflow (per the orchestrator plan): container image → registry
push → `db:migrate` + rolling restart, building on the Phase 15 packaging.
