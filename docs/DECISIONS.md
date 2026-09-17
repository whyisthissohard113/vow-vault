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

## Phase 14 payments contract refinements (2026-09-14, payments worker)

- `PaymentProviderAdapter` surface is `name`, `createCheckout`, `handleWebhook`
  only. MASTER_SPEC's `verifyPayment` / `refundPayment` / `getPayment`
  "equivalents" are DB-level functions in the billing service, not network stubs
  on every adapter. Adapters stay side-effect-free singletons; simulating payment
  providers does not fake authorization.
- PayFast signature algorithm is fixed: exclude `signature`, sort keys
  case-insensitively (byte-level tiebreak), safe-URL-decode each value, join with
  `&`, append `&passphrase=<passphrase>` only when configured, MD5 hex, verify
  with constant-time compare. Simulated mode skips PayFast's server-side validate
  GET but ALWAYS verifies the MD5 signature — there is no unsigned trust path.
- Checkout idempotency: a second checkout for the same wedding/org/customer/
  product reuses the existing pending order+payment (looked up via
  `orders.metadata->>'weddingId'`) instead of failing; crash recovery attaches a
  fresh payment to a payment-less pending order.
- Webhook amount rule: PayFast-sent `amount_gross` (cents) must equal the payment
  `amountCents`, unless an explicit server-side `simulateAmountOverride` is given
  (simulator only). Signature + merchant affinity checks always run; PENDING /
  PROCESSING events are informational only and never activate.
- Payment activation contract: activate only from a verified terminal webhook
  (never from a browser redirect); activation is a CAS claim on the
  `payment_events` anchor inside a transaction;
  `enqueueEmail("payment_success", key "payment_success_<paymentId>")` and
  `enqueueBuild(key "by_payment_<paymentId>")` run after commit with unique
  idempotency keys. Known crash window between commit and enqueue (no
  transactional email/build); reconcile later if ops requires.
- Billing writes the `payment_verified` lifecycle event directly (deduped on
  `metadata->>'paymentId'`), mirroring the build engine's event pattern.
  `wedding.status` is intentionally never changed by payments — the lifecycle
  engine (ADR-011) remains the sole owner of status transitions.
- `payment_events.organizationId` is NOT NULL (schema `0002`); a webhook whose
  payment and order are both unresolvable returns a retryable 500 and writes no
  events row. Accepted trade-off: PayFast retries; traceability via the unique
  `provider_event_id` anchor on success.
- `PAYFAST_MODE` accepts `live | test | simulated` (default `simulated`; unknown
  values warn and fall back to `simulated`). Production builds hard-disable the
  simulator route (404) even in test mode.

## Phase 14 QA/security audit adjudication (2026-09-14, orchestrator)

Adjudicating the QA worker's report-only findings on top of the payments
contract refinements above:

- **Build enqueue race — FIXED.** `enqueueBuild` now inserts with
  `onConflictDoNothing({ target: build_jobs.idempotency_key })` inside its
  transaction; on conflict it re-reads and returns the winning job
  (`isNew: false`) instead of surfacing a unique-violation 500. Verified in
  tree + covered by the build-engine suite.
- **`POST /api/auth/register` race — FIXED.** The select-then-insert duplicate
  email now maps DB error `23505` to a 409 response instead of a 500.
- **Guest upload init row-spam — DEFERRED.** Every `initiateGuestUpload` creates
  a media row even if the PUT never completes (fair-use count only moves on
  complete, so no entitlement burn). Accepted for now: the rows are tenant-scoped
  and the complete path validates existence, but an init→pending cleanup or an
  init idempotency key is tracked for a later media/storage phase.
- **Guest download internal-UUID addressing — DEFERRED.** `GET /api/media/[id]/
  download` guest path accepts the internal media UUID while public vault routes
  use `publicId`. Low risk (existence re-scoped to the guest's wedding; UUIDs
  are never rendered) but a contract inconsistency; consolidate on `publicId`
  when the guest media surface is next touched.
- **Presigned URL render-window nuance — ACCEPTED, no action.** A public page
  render just before `downloadDeadline` can serve a 15-min signed URL briefly
  after it; client-clock-free and within fair-use policy.
- **`getLifecycleStatusFromDeadlines` `"expired"` union — INTENTIONAL, no fix.**
  Post-`download_only` retention is represented by the `expired` status even
  though the deadline union never returns it.
- **`checkUploadRateLimit` approximation — OUT OF SCOPE.** Always-allows; a real
  rate limiter belongs to the Redis/ops workstream.

Verification of the entire phase: `npx vitest run` → 537/537 (21 files,
including the new `phase14-e2e.test.ts` full-flow proof), `tsc --noEmit` → 0,
`eslint` → 0.

## Phase 15 production packaging / CI-CD (2026-09-15, devops worker)

- **Standalone output**: `next.config.ts` now sets `output: "standalone"`. The
  production Docker image runs the app via `.next/standalone/server.js` and the
  workers via `tsx` entrypoints from the same image; `docker-compose.prod.yml`
  wires app + 3 workers + one-shot `migrate` + `minio-init`. No shared backend
  contract changed.
- **Build-time `DATABASE_URL` is REQUIRED by `next build`** (verified in
  Docker): Next.js 16 / Turbopack evaluates module-level imports of every route
  during page-data collection, and `src/lib/db` throws at import when the env
  var is missing (`/api/auth/register` is the first casualty). CI's `build` job
  and the Docker `builder` stage supply a throwaway, never-connected
  `DATABASE_URL` (postgres-js constructs the client lazily; no query is run at
  build time). No real or secret credential is used or baked in.
- **Runtime tooling moved to `dependencies`**: `tsx` (workers), `dotenv`
  (worker/`drizzle.config.ts` env loading), `drizzle-kit` (one-shot `db:migrate`)
  are production-required by the image's runtime roles, so they moved from
  `devDependencies`. Infra-level only; no app runtime import surface changed.
- **`.env` is excluded from every artifact**: `.dockerignore` ignores `.env*`
  so no local secrets can be traced or baked into the image. Note that a
  *local* `next build` (with `.env` present) traces `.env*` into
  `.next/standalone` — deploy only via the Docker image (Linux builder, no
  `.env` context) or sanitize a locally-zipped standalone before shipping it.
- **Windows-built standalone warning**: the standalone folder is always produced
  inside the Linux Docker builder. Windows output tracing can embed
  drive-letter paths that break Linux bundles — never copy a Windows
  `.next/standalone`/`node_modules` into a Linux image.
- **New env contract**: `NEXT_PUBLIC_APP_URL` added to `.env.example`. Server
  modules (`build-engine.ts`, `public-url.ts`, `qr-service.ts`,
  `public-vault.ts`, email templates) read it to construct public URLs; it was
  already referenced by code while `.env.example` only documented `APP_URL`.
  In production set both to the public origin.
- **Simulator disable rule**: `PAYFAST_MODE=simulated` is a local-only flow;
  the production compose/anchor sets `NODE_ENV=production` (which 404s the
  simulate route) and the deploy checklist requires `PAYFAST_MODE=test|live`.
  Documented in `docs/operations/DEPLOYMENT.md` §6.

## CI fixture convention: platform-code uniqueness (2026-09-15, orchestrator)

The `templates` table has a **partial unique index** (`templates_platform_code_unique_idx`)
enforcing at most one `organization_id IS NULL` template per `code` across the
entire shared DB. When multiple test suites insert a platform template with the
same code — even if they use different primary keys — only the first insert
succeeds; subsequent ones hit `onConflictDoNothing` and silently no-op, then
their `template_versions` FK insert fails because the expected parent row is
absent. This caused the first CI failure (8 tests in `build-engine.test.ts`).

**Convention (applies to all DB-backed integration suites sharing a database):**
Every suite that inserts platform-level (org NULL) rows subject to a partial
unique index must use a globally unique value for the indexed column(s)
(e.g. a distinct template `code`). Each UUID family is already unique per suite,
but partial-unique indexes ignore primary keys. Check partial-unique indexes in
`schema/` before naming platform fixtures.

## Phase 16 release/deploy pipeline (2026-09-15, devops worker)

- **`docker-compose.prod.yml` image override**: replaced `build: { context: . }`
  with `image: ${WMV_IMAGE:-wmv:latest}` on all application services (app,
  workers, migrate). The compose file is now a pure deployment manifest — it
  never builds; it always pulls a pre-tagged image. `WMV_IMAGE` defaults to
  `wmv:latest` for local smoke tests (`docker build -t wmv:latest .` first) and
  is overridden to a GHCR tag by `remote-deploy.sh` in production. No other
  compose contract or secret handling changed.
- **Release workflow** (`.github/workflows/release.yml`): gate (typecheck +
  lint + full test suite against Postgres 16) → build-and-push to GHCR
  (`ghcr.io/whyisthissohard113/vow-vault`, `v`-prefixed semver + sha-<short> +
  latest-on-tag, `linux/amd64`, GHA layer cache) → deploy job (manual-approval
  gated via GitHub `production` environment, SSH + `remote-deploy.sh` with host
  key pinning, post-deploy health check). `workflow_dispatch` requires an
  existing `v*` tag input. Deploy skips cleanly when
  `DEPLOY_HOST`/`DEPLOY_USER`/`DEPLOY_SSH_KEY`/`DEPLOY_KNOWN_HOSTS`/`DEPLOY_PATH`
  secrets are absent.
- **GHCR registry target**: `ghcr.io/whyisthissohard113/vow-vault`. Uses the
  built-in `GITHUB_TOKEN` with `packages: write`; no extra credentials needed for
  the build/push path.

## Phase 17 marketing redesign (2026-09-15, frontend worker)

- **Marketing site is branded "Vow Vault"** and completely rebuilt as a premium
  wedding-editorial system. The dashboard, auth flows and public vault
  (`w/[slug]`) are intentionally untouched — they still read the legacy CSS
  tokens (`--rose-brand`, `--rose-soft`, `--gold`, `--sand`, `--background`,
  `--surface`) which are preserved as aliases in `src/styles/tokens.css`.
- **New design tokens** live in `src/styles/tokens.css`: warm ivory page,
  deep charcoal brand (`--brand`), muted champagne gold accent (`--accent`),
  soft blush secondary, plus motion/elevation/radius scales. `globals.css`
  maps them into Tailwind v4 `@theme inline` utilities (`bg-brand`,
  `text-accent-deep`, `border-line`, …). The CSS `@import` of tokens.css uses a
  **relative path** (`../styles/tokens.css`) because Turbopack cannot resolve
  the `@/` TS path alias inside CSS files (build error resolved 2026-09-15).
- **Canonical pricing stays single-source**: marketing prices/limits/expiry
  windows come from `src/content/packages.ts` / `src/content/faqs.ts`, which
  import the canonical `src/lib/entitlements/packages.ts` and `src/lib/format.ts`.
  Marketers only edit content files; product facts cannot diverge.
- **Removed marketing-only CSS utility classes** `.btn-primary`, `.btn-secondary`
  and `.polaroid*` from `globals.css` (all marketing call sites rewritten to use
  the tokenized `Button` primitive or inline classes). Grep-verified: no
  remaining references in `src/`. Dashboard/auth/public-vault styles were not
  touched.
- **Demo content is explicitly flagged**: all testimonials (`src/content/
  testimonials.ts`) are `demo: true` with a visible "Demo — fictional" label;
  trust-bar numbers are `isDevelopmentPlaceholder: true` with an on-page note;
  example weddings are fictional couples rendered entirely from local SVG
  artwork (`<DemoArtwork/>`) — no real photos, no storage access.
- **FAQ/package copy uses exact product facts**: Silver 2/7 days, Gold 7/30,
  Platinum 7/90 upload/download windows (Africa/Johannesburg-derived deadlines,
  UTC-stored) are authored in `src/content/faqs.ts` from
  `getPackageExpiryWindows()`.
- **Legacy `/pricing` redirects** (307 via `redirect("/packages")`) because
  every marketing nav/footer/sitemap now points at `/packages`; the old route
  kept a stale design and duplicated content.
- **Private/public surface separation in robots/sitemap**: `robots.ts` disallows
  `/w/`, `/api/`, `/dashboard`, `/admin`, auth routes; `sitemap.ts` lists only
  marketing routes + the six fictional example themes (`/examples/[themeId]`,
  SSG via `generateStaticParams`) + the three tier showcases.
- **Frontend-only phase, no server changes**: no API, DB, entitlement or
  lifecycle contract changed. Verification: `tsc --noEmit` 0 · `eslint` 0 ·
  `next build` ✓ (69 static/dynamic pages including preserved auth, dashboard,
  api and public-vault routes).