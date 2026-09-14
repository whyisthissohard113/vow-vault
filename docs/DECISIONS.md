# Architecture Decisions
See `docs/decisions/` for material decisions.

- ADR-001 — Expiry from wedding date (`docs/decisions/ADR-001-expiry-from-wedding-date.md`)
- ADR-002 — Database schema implementation (Drizzle ORM) (`docs/decisions/ADR-002-database-schema-implementation.md`)
- ADR-003 — Auth, RBAC, and multi-tenant isolation (`docs/decisions/ADR-003-auth-rbac-tenancy.md`)
- ADR-004 — Product catalog and entitlement engine (`docs/decisions/ADR-004-entitlements.md`)
- ADR-005 — Wedding Build Engine (`docs/decisions/ADR-005-build-engine.md`)
- ADR-006 — Media Storage Pipeline (`docs/decisions/ADR-006-media-storage.md`)
- ADR-007 — QR Codes & Generated Assets (`docs/decisions/ADR-007-qr-generated-assets.md`)
- ADR-008 — Dashboard route group + POST /api/weddings CREATE_WEDDING gate (`docs/decisions/ADR-008-dashboard-route-group-and-create-wedding-gate.md`)
- ADR-009 — Email Worker & Lifecycle Automation (`docs/decisions/ADR-009-email-worker-and-lifecycle-automation.md`)
- ADR-010 — Platform Admin Console (Backend) (`docs/decisions/ADR-010-platform-admin-console-backend.md`)
- ADR-011 — Lifecycle Engine (Phase 13) owns wedding status transitions (`docs/decisions/ADR-011-lifecycle-engine.md`)

## Index changes

- `guest_sessions` — removed redundant `guest_sessions_vault_idx (vault_id)`; added composite `guest_sessions_vault_status_idx (vault_id, status)` for the Phase 13 lifecycle engine's guest-session revocation and purge paths. Migration `0003_hot_butterfly.sql` (2026-09-13). No columns/contracts changed.

## Phase 13 contract refinements (2026-09-13, orchestrator integration)

- `runLifecycleSweep(now?, options?: { organizationId?: string })` — added optional
  org scope. Callers needing a tenant-scoped sweep (integration tests, per-tenant
  operators) pass `{ organizationId }`; the sweep and every transition it lands are
  restricted to that org. The no-arg call (email worker `scanLifecycleAutomation`)
  stays global. Additive and backward compatible — no callers were broken.
- `transitionWeddingStatus` — strict-idempotency short-circuit: `fromStatus ===
  toStatus` returns `{ changed: false, reason: "noop" }` and writes nothing (no
  lifecycle_event / audit row). Re-running a transition for a wedding already at
  the target status also yields `reason: "noop"` (via CAS failure with current ===
  target), never `"unexpected_status"`.
- Deadline instants are pinned to UTC end-of-day `T23:59:59.999Z` (not Johannesburg
  `21:59:59.999Z`). The JNB offset math in `addBusinessDays` is used only for
  calendar-day arithmetic and is overwritten by `setUTCHours(23,59,59,999)`. Tests
  pin exact instants; callers must not rely on a JNB wall-clock instant.
- `SWEEPABLE_WEDDING_STATUSES` includes `deletion_pending` (retention tail is
  sweep-reachable), consistent with ADR-011.