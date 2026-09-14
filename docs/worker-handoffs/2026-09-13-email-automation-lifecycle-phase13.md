# Worker Handoff — Email/Automation: Phase 13 Lifecycle State Machine Refactor

- **Worker**: Email/Automation
- **Task**: Refactor the lifecycle automation sweep (`src/server/email/lifecycle.ts`) onto the shared Phase 13 lifecycle engine (`src/server/lifecycle/engine.ts`) and update the email-worker integration test to the new machine
- **Status**: COMPLETE — email suite `15/15`, `npx tsc --noEmit` 0, `npm run lint` 0
- **Date**: 2026-09-13

## What changed

### `src/server/email/lifecycle.ts` — sweep → emails pipeline

`scanLifecycleAutomation(now?)` keeps its public signature (`LifecycleScanResult
{ weddingsScanned, statusTransitions, emailsEnqueued }`) so the email worker
(`src/server/services/email-worker.ts`) needs no change — confirmed, it still
imports and logs the same three counters.

New flow:

1. **Sweep first** — `const sweep = await runLifecycleSweep(now)`.
   `runLifecycleSweep` is the SINGLE mutation point for wedding status
   transitions (DRAFT → BUILDING → ACTIVE → UPLOAD_CLOSED → DOWNLOAD_ONLY →
   EXPIRED → ARCHIVED → DELETION_PENDING → DELETED), CAS-guarded, append-only
   events/audit, and revokes guest sessions at download_only (never duplicated
   here) and purges at the deletion tail.
2. **Transition emails** — for each `statusTransitions` entry:
   - `toStatus === "upload_closed"` → enqueue `upload_closed` email with key
     `upload_closed_${weddingId}_${uploadDeadline}` (deadline from the sweep
     transition — identical to the old `rule.uploadDeadline.toISOString()` key).
   - `toStatus === "download_only"` → enqueue `download_closed` email with key
     `download_closed_${weddingId}_${downloadDeadline}`.
   - The rest of the tail (expired/archived/deletion_pending/deleted) is silent
     for customers. Each email reloads the wedding + live vault + customer
     contact and reuses the existing `getWeddingContact`, `baseEmailData` and
     `queueTransitionEmail` helpers.
3. **Lead-based reminders** — after the sweep, re-query weddings whose CURRENT
   status is `active` or `upload_closed` (the sweep may have advanced others to
   download_only/expired/…, which are then excluded). The four reminder emails
   (`reminder_upload`, `download_expiry_warning`, `download_reminder`,
   `upload_expiry_warning`) keep their exact idempotency keys and
   `EMAIL_LIFECYCLE_LEAD_DAYS` windows:
   - `reminder_upload`: requires `status === "active"` + wedding date reached.
   - `download_expiry_warning`: requires `status === "active"` (uploads open).
   - `download_reminder`: now requires `status === "upload_closed"` (uploads
     closed) instead of relying only on `now >= uploadDeadline`.
   - `upload_expiry_warning`: unchanged time window; the reminder query already
     restricts to active/upload_closed so it can never fire for download_only.
4. **Return** — `weddingsScanned` and `statusTransitions` come from the sweep
   (`sweep.weddingsScanned`, `sweep.statusTransitions.length`); `emailsEnqueued`
   counts only newly created jobs (existing idempotency behavior).

Deleted: the inline `transitionWedding` CAS helper and the inline
`active → upload_closed → expired` mutation logic inside `processWedding`
(which became `enqueueReminderEmails`). Lifecycle events + audit rows for
status changes are now written exclusively by
`transitionWeddingStatus`/`runLifecycleSweep` in the engine.

### `src/server/services/__tests__/email-worker.test.ts` — new machine

The lifecycle sweep test pinned the OLD `upload_closed → expired` behavior.
Changes:

- Phase C comment + assertion: download deadline reached now lands
  `download_only` (not `expired`): `expect(wedding.status).toBe("download_only")`.
- Lifecycle-event assertion:
  `download_deadline_reached` with `fromStatus === "upload_closed"` and
  `toStatus === "download_only"`.
- The `download_closed` email count assertion (`countEmailJobs(...,"download_closed") === 1`)
  is unchanged — the email still fires at the download deadline, just to the
  new state.
- All other phase assertions (Phase A 1/1, Phase B 0/2, Phase B repeat 0,
  Phase C 1/1, upload_closed/download_reminder/upload_expiry_warning counts,
  2 lifecycle events, 2 audit rows, customer email) pass unchanged.

Fixture helpers in the email suite (family `33333333-…`) were intentionally
left as-is; the `opts.status: "active" | "upload_closed"` helper still matches
the reminder query surface.

### `src/server/lifecycle/engine.ts` — lint cleanup only

The new shared engine compiles. Removed one unused private interface
(`WeddingWithRuleAndVault`) and the now-unused `type Vault` import so `npm run
lint` reports 0 problems. No behavior change.

## Tests / results

- `npx vitest run src/server/services/__tests__/email-worker.test.ts` — **15/15 passed** (lifecycle sweep included, ~8.4s).
- `npx tsc --noEmit` — **0 errors**.
- `npm run lint` — **0 errors, 0 warnings**.
- Full suite NOT run per task instructions. `build-engine.ts` was already dirty
  in the working tree before this task (engine integration work by the previous
  worker) and was left untouched.
- Dev DB left clean by the suite's own cleanup (email/33333333 org family).

## Contract / docs

- `docs/decisions/ADR-011-lifecycle-engine.md` (new) — records that
  `transitionWeddingStatus`/`runLifecycleSweep` are the single mutation point
  and that `scanLifecycleAutomation` only mirrors transitions into emails.
- `docs/decisions/ADR-009-email-worker-and-lifecycle-automation.md` — decision
  bullet cross-references ADR-011 (the inline `active → upload_closed →
  expired` sweep description is superseded).
- `docs/DECISIONS.md` — ADR-011 added to the index.
- `docs/WORKER_STATUS.md` — Email/Automation row updated to Phase 13.

## Risks / notes

- **Crash window**: a sweep transition and its mirror email are not
  transactional — if the worker crashes after `runLifecycleSweep` commits
  `upload_closed`/`download_only` but before the enqueue, that email is not
  replayed (the next sweep sees the already-advanced status). The same non-
  atomicity existed in the old inline code; idempotency keys prevent duplicates
  but not this narrow loss. A follow-up could reconcile from `lifecycle_events`
  if ops wants exactly-once mail.
- **One step per sweep**: the engine advances a wedding at most one status per
  run, so a wedding whose upload AND download deadlines both elapsed in a long
  worker outage needs two poll cycles to reach download_only (then the
  grace-driven tail). Real-time polling (~1 min cadence) makes this invisible;
  tests use simulated clocks and assert each step.
- **Wider sweep surface**: the engine sweep scans active/upload_closed/
  download_only/expired/archived (previous code scanned only active/
  upload_closed). Cross-suite fixtures remain inert (admin suite uses 2029
  deadlines; build-engine suite uses +1-year future dates; no other suite
  creates sweepable-status weddings with 2026 deadlines).
- **`download_reminder` now status-gated**: it fires only for
  `upload_closed`, which narrows the old time-only condition — safer, matches
  the phase semantics, and required by the task.