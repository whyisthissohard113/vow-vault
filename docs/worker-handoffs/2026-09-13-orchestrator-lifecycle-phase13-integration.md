# Worker Handoff — 2026-09-13

## Worker
Orchestrator / CTO

## Task
Phase 13 (Wedding Lifecycle + Expiry) integration: consolidate the lifecycle state machine (DRAFT → BUILDING → ACTIVE → UPLOAD_CLOSED → DOWNLOAD_ONLY → EXPIRED → ARCHIVED → DELETION_PENDING → DELETED) from the Database / Builder / Email worker deliverables, add the wedding status PATCH route and guest upload/download enforcement, and prove the mandated test scenarios in an integration suite against the real Postgres DB.

## Status
COMPLETE

## Completed
- Got the dev stack running locally: Docker Desktop, then `docker compose up -d postgres minio redis` (wmv-postgres / wmv-minio / wmv-redis healthy). `npm run db:migrate` applied migrations `0000`–`0003` (`NOTICE: relation "drizzle" already exists` is benign).
- Wrote `src/server/lifecycle/__tests__/lifecycle-engine.test.ts` — **33 integration tests, all passing** against the real dev Postgres.
- Fixed engine/test fallout found during verification:
  - Org-scoped sweep API: `runLifecycleSweep(now?, options?: { organizationId?: string })` so the suite (and per-tenant operators) sweep only its own org. Backward compatible; the email worker's no-arg global sweep is unchanged.
  - Strict-idempotency guard in `transitionWeddingStatus`: `fromStatus === toStatus` → `{ changed: false, reason: "noop" }`, no write.
  - Re-running a transition when the wedding is already at target returns `"noop"` (was asserted wrong as `"unexpected_status"`).
  - Cleanup logic scoped by org for tables with `organizationId`; tables without it (`mediaVariants`, `slideshowItems`, `flipbookPages`) cleaned via FK scoping with `inArray`.
  - Test seed now uses an ORG-scoped `gold` product (dev DB has a platform `gold` product with referencing `order_items`, which would break org-scoped FK cleanup deletes).
  - `countEvents` typed with `LifecycleEventType`; null-guards on `recalculateWeddingDeadlines` returns.
- Verified the API route and guest gates:
  - `src/app/api/weddings/[id]/route.ts` + `schema.ts`: PATCH supports status transitions through `transitionWeddingStatus` only (CAS), disallowed transitions → 409 with `allowedTransitions` whitelist, date/package changes recalc deadlines.
  - `src/server/services/public-vault.ts` download gate now uses `GUEST_DOWNLOAD_ALLOWED_WEDDING_STATUSES` (`active`, `upload_closed`); upload gate already keyed on `active`.
- **Full suite green: 19 files, 518 tests, all passing.** `tsc --noEmit` clean, `npm run lint` clean (after fixes).
- Docs: `docs/DECISIONS.md` appended "Phase 13 contract refinements"; `docs/decisions/ADR-011-lifecycle-engine.md` appended "Refinements"; `docs/WORKER_STATUS.md` orchestrator row updated.

## Files changed
- `src/server/lifecycle/__tests__/lifecycle-engine.test.ts` (new — main deliverable)
- `src/server/lifecycle/engine.ts` — `runLifecycleSweep(now?, { organizationId? })`, `transitionWeddingStatus` noop short-circuit, recalc idempotency
- `src/server/lifecycle/policy.ts` — `SWEEPABLE_WEDDING_STATUSES` includes `deletion_pending`; guest gate lists
- `src/app/api/weddings/[id]/route.ts`, `src/app/api/weddings/[id]/schema.ts` — PATCH status route (no route-level tests; covered via engine + manual audit)
- `src/server/services/public-vault.ts` — download status gate via policy list
- Docs: `docs/DECISIONS.md`, `docs/decisions/ADR-011-lifecycle-engine.md`, `docs/WORKER_STATUS.md`, this handoff

Deliverables from workers (already in working tree, verified by the full suite):
- Database: `drizzle/0003_hot_butterfly.sql` + snapshot, `src/lib/db/schema/vaults.ts` status column
- Builder: `src/server/services/build-engine.ts` via `transitionWeddingStatus`
- Email: `src/server/email/lifecycle.ts` refactored onto engine (ADR-011)

## Database changes
- None from this session beyond what Database worker shipped (`0003`). Migrations `0000`–`0003` applied to local dev DB.

## API/contracts changed
- `runLifecycleSweep(now?, options?: { organizationId?: string })` — additive org scope. NO-arg call stays global (email worker unchanged).
- `transitionWeddingStatus` — self-transition returns `{ changed: false, reason: "noop" }`, writes nothing. Re-run at target returns `"noop"`, not `"unexpected_status"`.
- Deadline instants pinned at UTC EOD `T23:59:59.999Z` (not JNB `21:59:59.999Z`); see DECISIONS.md. Callers must not rely on a JNB wall-clock deadline instant.
- Guest download gate: `active` + `upload_closed` only (server-side).

## Tests
- `npm run test` — **19 files / 518 tests, all passing** (includes lifecycle 33, email 47, build-engine 18, admin 104, public-vault 14, entitlements 36, qr 33, media 15, guest-sessions 16, auth 99).
- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- Dev DB must be running for the suite: `docker compose up -d postgres minio redis`, then `npm run db:migrate`.

## Environment changes
- Dev stack (Postgres/MinIO/Redis) via Docker Desktop + `docker-compose.yml`.
- `.env` / `vitest.config.ts` already point at `postgresql://wmv:wmv@localhost:5432/wedding_memory_vault`.

## Known issues
- Dev DB currently holds a foreign leftover `deletion_pending` wedding (deadlines 2026-11-18 / 2026-12-11) from another suite. It is lifecycle-inert and org-isolated using org-scoped sweeps. Don't delete; not owned by Phase 13 tests.
- Email worker left a referenced `runLifecycleSweep(now)` — global sweep can touch the leftover wedding if ever run full-global in dev. Acceptable.

## Next worker
- Payments: implement PayFast + webhook idempotency (tables already exist).
- Builder: extend `PATCH /api/weddings/[id]` route coverage (route-level API tests) if needed.
- DevOps: CI/CD + deploy-time migrations + backups.

## Decision required
- None. Contract refinements already recorded in `docs/DECISIONS.md` + ADR-011.