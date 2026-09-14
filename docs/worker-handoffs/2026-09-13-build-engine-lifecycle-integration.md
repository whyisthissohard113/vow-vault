# Worker Handoff — Build Engine / Lifecycle Engine Integration (Phase 13)

- **Worker**: Build Engine
- **Task**: Route all `weddings.status` writes in the build engine through the Phase 13 lifecycle engine primitive `transitionWeddingStatus`
- **Status**: COMPLETE — `npx tsc --noEmit` 0 errors, `npm run lint` 0 errors, build-engine suite **18/18 green**
- **Date**: 2026-09-13

## Completed

`src/server/services/build-engine.ts` (the only file touched) now treats
`transitionWeddingStatus` as the sole mutation primitive for `weddings.status`.
No raw `db.update(weddings).set({status})` remains anywhere in the build engine.

1. **`stepValidateWedding`** — `draft → building`
   - Wired `transitionWeddingStatus({ fromStatus: "draft", toStatus: "building", reason, actorUserId })`.
   - On rebuild/idempotent retry the helper returns `changed:false` (wedding already `building`/`active`) → skipped silently, never an error, never a regression.

2. **`stepCreateVault`** — `building → active`
   - Wired `transitionWeddingStatus({ fromStatus: "building", toStatus: "active", reason, actorUserId })` with **no eventType override** — the engine's default mapping for `building → active` is `build_completed`, so this call writes the ONE `build_completed` lifecycle event on a fresh build.
   - Result (`TransitionResult`) is carried on the build context as `createVaultTransition` for the audit step.

3. **`stepPublishVault`** — `building → active` (authoritative)
   - Wired `transitionWeddingStatus({ fromStatus: "building", toStatus: "active", eventType: "build_completed", ... })`.
   - On a fresh build `create_vault` already landed the identical CAS, so publish returns `changed:false` (noop) — expected, treated as OK. If the wedding is already `active` or further (`upload_closed`/`download_only`/`expired`/`archived`), the CAS fails and we move on — **never regressing a wedding**. Result carried as `publishTransition`.

4. **`stepAuditEvent`** — manual `lifecycle_events` insert removed
   - The previous manual `build_completed` `lifecycle_events` insert was deleted (the engine already writes it — keeping it would duplicate the pinned event).
   - Now writes a single `audit_logs` row `action: "build_completed"` (resourceType `wedding`), carrying the old build metadata (`buildJobId`, `vaultId`, `vaultSlug`, `packageCode`, `featuresEnabled`, `version`).
   - When neither CAS landed (`transitionLanded === false`, i.e. rebuild/idempotent re-run of an already-active or past-active wedding), writes a warning-ish audit row with metadata `{ skippedActiveTransition: true, currentStatus: <weddings.status> }` plus `buildJobId`/`version`.

5. **`stepConfigureExpiry`** — untouched (still the `expiry_rules` deadline source of truth).

## Transition calls wired (before → after)

| Step | Before | After |
|---|---|---|
| `validate_wedding` | raw `UPDATE weddings SET status='building'` | `draft → building` via `transitionWeddingStatus` (no-op tolerated) |
| `create_vault` | raw `UPDATE weddings SET status='active'` | `building → active` via `transitionWeddingStatus` (default event type → `build_completed`) |
| `publish_vault` | raw `UPDATE weddings SET status='active'` | `building → active` via `transitionWeddingStatus` with `eventType: "build_completed"` (CAS no-op tolerated) |
| `audit_event` | manual `lifecycle_events` `build_completed` insert | `audit_logs` `build_completed` row only; warning metadata variant when skipped |

## Double-transition idempotency (create_vault + publish_vault both target `building → active`)

Properly idempotent. Verified empirically with a temporary integration test (created, run, deleted):
- **Fresh build**: `create_vault` lands the CAS → exactly ONE `build_completed` event (`fromStatus building → toStatus active`) + one normal audit row. `publish_vault` then returns `changed:false` (noop) and writes nothing.
- **Rebuild (v2) on an already-active wedding**: neither CAS lands → wedding stays `active` (never regressed, never re-flipped), still exactly ONE `build_completed` event (no duplicate), and `audit_event` records the `skippedActiveTransition: true, currentStatus: "active"` row.
- **Retry after earlier failure (wedding stuck `building`)**: `create_vault` lands the transition on the retry → one `build_completed` event.

## Tests / results

- `npx vitest run src/server/services/__tests__/build-engine.test.ts` — **18/18 green**. The pinned test "creates build_completed lifecycle event" asserts exactly ONE `build_completed` event, `fromStatus building → toStatus active`, metadata defined — verified as-is.
- `npx tsc --noEmit` — **0 errors**.
- `npm run lint` — **0 errors** (1 pre-existing warning in `src/server/lifecycle/engine.ts` — `WeddingWithRuleAndVault` unused — in the untracked Phase 13 engine file, owned by the lifecycle worker, not touched here).
- Temporary verification test + temp scripts removed afterwards; working tree contains no leftovers from verification.

## Files changed

- `src/server/services/build-engine.ts` — status writes delegated to lifecycle engine; `stepAuditEvent` audit-log rewrite; imports (`auditLogs`, `transitionWeddingStatus`, `TransitionResult`) adjusted; `lifecycleEvents` import removed.
- `docs/decisions/ADR-005-build-engine.md` — added "Status writes superseded by ADR-011" section.
- `docs/worker-handoffs/2026-09-13-build-engine-lifecycle-integration.md` — this handoff.
- `docs/WORKER_STATUS.md` — Builder row updated.

## API/contracts changed

- None. Build job / build job step state machine, retry semantics, validation order, and pinned error strings (`No paid order found`, `Wedding date is required`, etc.) are unchanged.
- `build_jobs.result` now additionally carries `createVaultTransition`/`publishTransition` objects (observability bonus; no consumer depends on the old shape).

## Database changes

- None (no schema/migration changes).

## Environment changes

- None.

## Risks / notes for the next worker

- The Phase 13 lifecycle engine itself (`src/server/lifecycle/`, ADR-011) is untracked and owned by the lifecycle worker; the shared `docs/DECISIONS.md`, `docs/decisions/ADR-009` supersession note, `src/server/email/lifecycle.ts`, and `email-worker.test.ts` modifications in the tree belong to that worker and were deliberately not touched.
- The old Phase 11 sweep in `src/server/email/lifecycle.ts` (still in the tree, mid-refactor per ADR-011) performs raw CAS status transitions outside the engine; it is outside this task's scope but should land in the lifecycle worker's final Phase 13 sweep.
- Audit-log rows written by the build engine are cascade-deleted when the build-engine suite's teardown deletes the fixture organization — expected in tests; production rows persist.

## Next worker

- Lifecycle (Phase 13) can now rely on the build engine to never violate the machine (no regressions from `upload_closed`/`download_only`/`expired`/`archived` back to `active`/`building`).
- Payments / media workers that previously wrote `weddings.status` directly should migrate to `transitionWeddingStatus` following this same pattern.