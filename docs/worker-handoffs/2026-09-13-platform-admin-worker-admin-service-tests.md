# Worker Handoff — Platform Admin Backend (Phase 12a)

- **Worker**: Admin (Platform Admin Worker) · reviewed/patched by Orchestrator
- **Task**: Platform Admin console backend — admin service + guarded API routes + integration test suite + lifecycle write actions
- **Status**: COMPLETE — `tsc --noEmit` 0 errors, `npm run lint` 0 errors, full suite **485/485 tests green (18 files)** incl. **104 admin tests**
- **Date**: 2026-09-13

## Completed

1. **Service layer** (`src/server/services/admin-service.ts`, 2625 lines)
   - Read surface: `getPlatformHealth`, `getStorageOverview`, `listAuditLogs`,
     `listOrganizations`/`getOrganizationDetail`, `getUserDetail`,
     `listCustomers`/`getCustomerDetail`, `listWeddings`/`getWeddingDetail`,
     `listOrders`/`getOrderDetail`, `listPayments`/`getPaymentDetail`,
     `listVaults`/`getVaultDetail`, `listMedia`/`getMediaDetail`,
     `listBuildJobs`/`getBuildJobDetail`, `listEmailJobs`/`getEmailJobDetail`,
     `listLifecycleEvents`. Shared contract: `{ items, total, page, pageSize }`;
     page clamped ≥1, pageSize clamped 1..100; optional `search`,
     `organizationId`, `status` filters.
   - Write surface (all validate → CAS-style update → audit; safe no-op on
     non-target states): `adminRetryBuildJob`, `adminRetryEmailJob`,
     `adminRetryMediaProcessing`, `adminSuspendOrganization`,
     `adminUnsuspendOrganization`, `adminSuspendUser`,
     `adminRevokeGuestSession`.
   - Invariants: no audit row on no-op; idempotency keys never changed by
     retries; password hashes / raw guest tokens / storage credentials never
     returned; internal UUIDs exposed only inside this admin surface.
2. **Route layer** (`src/app/api/admin/**`, 27 route files) + `src/server/admin/route-helpers.ts`
   - Every route wrapped `withAuth → withTenant → withPermission`. Reads =
     `VIEW_PLATFORM_ANALYTICS`; writes = `MANAGE_PLATFORM`.
   - `parseAdminListQuery`/`parseAuditListQuery`/`parseAdminConfirmBody`
     (zod `.strict()`, explicit `confirm: true` on every mutation),
     `getClientMeta` (ip/UA → audit), `toErrorResponse`
     (400/403/404/500 mapping).
3. **Tests** (`src/server/services/__tests__/admin-service.test.ts`, 104 tests / 31 describes)
   - Dedicated UUID family `55555555-5555-5555-5555-555555555XXX` (all other
     suites use 0000/1111/2222/3333/4444). Real dev Postgres, full per-test
     cleanup, `onConflictDoNothing` fixtures.
   - **Fixtures are deliberately lifecycle-inert** (far-future wedding date +
     expiry deadlines, see comment in `createWedding`): `scanLifecycleAutomation`
     is a global sweep that the email-worker suite drives with simulated 2026
     clocks; any `active` wedding with a reached wedding date and a 2026
     deadline would have enqueued reminder/warning emails during parallel runs
     (this exact collision was reproduced and fixed).
4. **Bug fixes applied during review** (all in `admin-service.ts`)
   - `listOrders` / `listPayments` / `listVaults` / `listMedia` crashed with
     `missing FROM-clause entry` when `search` was supplied — the count query
     ran the join-referencing WHERE without the joins. Count queries now carry
     the same LEFT JOINs (left joins cannot over-count: `ilike(NULL)=NULL`).
   - `listOrganizations` now honors the `organizationId` filter.
   - `getCustomerDetail.orderCount` now counts ALL orders (parity with
     `listCustomers`); `totalSpentCents` stays paid-only.

## API/contracts changed

- New surface `src/app/api/admin/**` — list/detail/health/storage endpoints
  (`VIEW_PLATFORM_ANALYTICS`) and retry/suspend/restore/revoke endpoints
  (`MANAGE_PLATFORM`, `confirm: true` required).
- `admin-service.ts` and `route-helpers.ts` are new server-only modules; no
  existing contract was altered. All write actions return
  `{ changed: boolean, reason?, before?, after?, auditId? }`; invalid
  (non-UUID) ids map to `NotFoundError` → 404.

## Tests/results

- `npm test` — **485/485 green across 18 files** (was 381/381 across 17 before
  this phase; +104 new admin tests).
- `npx tsc --noEmit` 0 errors; `npm run lint` 0 errors.
- Cross-suite parallel proof: `email-worker.test.ts` + `admin-service.test.ts`
  run together = 119/119 green (collision fixed).
- Dev DB clean after runs: zero `55555555-%` leftovers; only persistent
  non-fixture rows are the demo-seed wedding (future deadlines — lifecycle
  inert by design).

## Database changes

- None (admin is query/write-on-existing-tables only).

## Environment changes

- None.

## Known issues / intentional quirks (documented in ADR-010)

- `listBuildJobs` / `listEmailJobs` accept but ignore `search`.
- `listLifecycleEvents` maps the `status` query param onto `eventType`.
- `getWeddingDetail` / `getMediaDetail` do not filter `deletedAt` (deliberate:
  forensic reads may want soft-deleted rows).
- `getOrganizationDetail.orderCount` counts payment rows, not order rows
  (pre-existing semantics, unchanged).

## Next worker

- **Frontend / Admin UI (Phase 12b):** platform admin console pages built
  against these routes (`/dashboard/admin/*`), gated by
  `VIEW_PLATFORM_ANALYTICS` / `MANAGE_PLATFORM` server-side.
- QA/Security: webhook/secret hardening review of the health surface; confirm
  no admin route leaks PII into logs.
- Payments: can reuse the same confirm-gate + audit pattern for refund/void
  writes once PayFast webhooks land.

## Decisions required

- None blocking. Recorded: ADR-010 (platform admin console backend).