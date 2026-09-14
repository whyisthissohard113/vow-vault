# ADR-011 — Lifecycle Engine (Phase 13) Owns Wedding Status Transitions

## Status
Accepted

## Date
2026-09-13

## Context

Phase 11 (ADR-009) put the status machine inline in the email automation sweep:
`scanLifecycleAutomation` performed CAS `active → upload_closed → expired`
transitions itself. Phase 13 introduces the full lifecycle state machine
(DRAFT → BUILDING → ACTIVE → UPLOAD_CLOSED → DOWNLOAD_ONLY → EXPIRED →
ARCHIVED → DELETION_PENDING → DELETED) as a shared engine in
`src/server/lifecycle/engine.ts`. Wedding status mutations must live in exactly
one place so the build engine, the admin console, retention/purge jobs and the
email sweep can never step on each other.

## Decision

- **`transitionWeddingStatus` is the ONLY mutation primitive for wedding
  status.** It is CAS-guarded, append-only (`lifecycle_events` + `audit_logs`),
  and reports no-ops so every caller is idempotent.
- **`runLifecycleSweep` is the single automated mutation point.** It advances
  every sweepable wedding at most one step against `now`, revokes guest
  sessions at DOWNLOAD_ONLY, archives vaults at ARCHIVED, and purges content at
  the DELETION_PENDING → DELETED tail. Re-running it is safe.
- **`scanLifecycleAutomation` no longer mutates status.** It calls
  `runLifecycleSweep(now)` first, mirrors guest-facing transitions into
  `upload_closed` / `download_closed` emails under the same per-wedding
  deadline idempotency keys as before, and only then evaluates the four
  lead-based reminder emails for weddings whose CURRENT status is still
  `active` / `upload_closed`. Reminders never fire for download_only or the
  retention tail.
- **Guest sessions are revoked by the engine** at DOWNLOAD_ONLY; the email
  sweep never duplicates that.
- **Exclusive-end semantics stay**: `now >= deadline` is closed; the instant
  of the deadline IS closed (never `>`).

## Consequences

- The old `upload_closed → expired` transition at the download deadline becomes
  `upload_closed → download_only`; the `expired` state is reached only after
  the download + expiry retention grace (`downloadDeadline +
  EXPIRY_RETENTION_GRACE_DAYS`), so guest sessions are revoked immediately at
  the download deadline instead of lingering until expiry.
- Email idempotency keys are unchanged (`upload_closed_${weddingId}_${dl}`,
  `download_closed_${weddingId}_${dl}`, the four reminder keys), so no
  duplicate mail can result from the refactor: a transition email is only
  produced for a transition the sweep actually landed.
- ADR-009's inline `active → upload_closed → expired` sweep description is
  superseded by this ADR.

## Refinements (2026-09-13, orchestrator integration)

- `runLifecycleSweep(now?, options?: { organizationId?: string })` — optional
  org scope for tenant-scoped sweeps (tests, per-tenant operators); the no-arg
  call stays global. Additive.
- `transitionWeddingStatus` short-circuits self-transitions
  (`fromStatus === toStatus`) with `{ changed: false, reason: "noop" }` and writes
  nothing (strict idempotency). Re-running a transition already at target also
  yields `"noop"`, never `"unexpected_status"`.
- `SWEEPABLE_WEDDING_STATUSES` includes `deletion_pending`, so the retention tail
  is reachable by the sweep.