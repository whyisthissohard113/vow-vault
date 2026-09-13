# ADR-010 — Platform Admin Console (Backend)

- Status: Accepted
- Date: 2026-09-13
- Workers: Admin (Platform Admin Worker) · Orchestrator (review/fixes)

## Context

Phase 12 adds a platform admin surface so that platform staff can inspect the
entire multi-tenant estate (organizations, users, customers, weddings, vaults,
media, orders, payments, queue jobs, audit trail) and perform a small, safe set
of lifecycle write actions (retry failed jobs, suspend/restore organizations,
suspend users, revoke guest sessions). The surface must be server-authoritative,
tenant-unaware by design (platform scope is intentional), auditable, and must
never leak secrets or private IDs to guests. This ADR records the backend
contract; the admin console UI is a separate follow-up phase.

## Decision

- **Dedicated server-only service layer** (`src/server/services/admin-service.ts`)
  plus thin route helpers (`src/server/admin/route-helpers.ts`). Every API route
  under `src/app/api/admin/**` is wrapped by `withAuth → withTenant →
  withPermission`; **read** endpoints require `VIEW_PLATFORM_ANALYTICS`
  (`platform_admin`, `platform_support`) and **write** endpoints require
  `MANAGE_PLATFORM` (`platform_admin` only). Authorization is never decided
  inside the service.
- **Mutation protocol = validate → CAS-style update → audit, or safe no-op.**
  Every write action first loads the target row, computes `before`, rejects
  non-safe transitions by returning `{ changed: false, reason }` WITHOUT writing
  an audit row (console-warned), then updates and records an immutable
  `audit_logs` row (`action`, `resource_type`, `resource_id`, `before`, `after`,
  actor `user_id`, `ip_address`, `user_agent`). No audit row is written for a
  no-op, so the audit trail only ever shows real changes.
- **Retry actions preserve idempotency anchors.** `adminRetryBuildJob`,
  `adminRetryEmailJob` and `adminRetryMediaProcessing` delegate to the canonical
  engine paths (`build-engine`, `email-worker`, `media-service`) and never change
  `idempotency_key`. They only touch `failed` jobs and refuse jobs whose attempts
  have reached `max_attempts`; pending/processing/completed jobs are never
  mutated.
- **Guard rails on destructive writes:** the self-suspend of your own account,
  suspension of `platform_admin` members, suspension of `platform`-type orgs and
  closed orgs are all hard no-ops. Every mutation accepts an explicit
  `confirm: true` body plus an optional `reason` (double-confirm gate).
- **Admin lists share one pagination/filter contract** (`page`, `pageSize`,
  `search`, `organizationId`, `status`) with page > 0 and pageSize clamp 1..100.
  Count and data queries must carry the **same joins** when the search WHERE
  references joined tables (bug found + fixed during review — see "Review
  findings" below).
- **Sensitive material stays server-side.** Password hashes, raw guest tokens,
  storage credentials and private internal IDs are never returned; the admin
  surface exposes internal UUIDs by design (this surface is the explicit
  exception in the "never expose private/internal IDs to guests" rule).
- **Platform health & storage overview** are derived from the live database
  (ping, queue counts by status, stale job detection, drizzle journal vs
  `__drizzle_migrations` hash comparison) and in-process worker status — a
  cheap, zero-extra-dependency observability surface for the console.
- **Test isolation rule for shared dev-DB suites:** the admin suite uses its own
  UUID family (`55555555-…`) and its wedding/expiry fixtures are deliberately
  **lifecycle-inert** (far-future wedding date and deadlines) because
  `scanLifecycleAutomation` is a *global* sweep that the email-worker suite
  drives with simulated clocks. Any future suite that creates `active` weddings
  with expiry rules and customer contacts must keep them inert or scope them.

## Consequences

- Read APIs are safe to expose to `platform_support`; all writes remain
  `platform_admin`-only and are fully auditable, so support teams can diagnose
  without granting write access.
- Write actions are idempotent and race-tolerant: mutually-exclusive target
  states mean concurrent admin actions converge (e.g., two suspend calls both
  end suspended; a retry + webhook delivery cannot double-send because the
  idempotency key is untouched).
- The platform admin UI (Phase 12b) can be built purely against these
  contracts; no route can be called without a platform session and permission.
- Minor semantic quirks remain intentionally documented: `listBuildJobs` /
  `listEmailJobs` accept but ignore `search`; `listLifecycleEvents` maps the
  `status` query param to `eventType`; `getWeddingDetail`/`getMediaDetail` do
  not filter `deletedAt` (admin forensic reads may want to see deleted rows).

## Review findings (fixed in this phase)

- **4 crash bugs fixed:** `listOrders`, `listPayments`, `listVaults`,
  `listMedia` threw `missing FROM-clause entry` when `search` was supplied
  because the count query applied the join-referencing WHERE without the joins.
  All four count queries now carry the same LEFT JOINs as the data queries
  (left joins cannot over-count: `ilike(NULL) = NULL`).
- `listOrganizations` now honors the `organizationId` filter instead of
  silently ignoring it.
- `getCustomerDetail.orderCount` now counts ALL orders (parity with
  `listCustomers`); `totalSpentCents` remains paid-only. Previously
  `orderCount` was paid-only, disagreeing with the list view.