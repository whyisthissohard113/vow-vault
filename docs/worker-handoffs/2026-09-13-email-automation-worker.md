# Worker Handoff — Email/Automation (Phase 11)

- **Worker**: Email/Automation
- **Task**: Transactional email queue + worker + delivery webhook + lifecycle automation + build-engine email hooks + support notifications
- **Status**: COMPLETE — `tsc --noEmit` 0 errors, `npm run lint` 0 errors, full suite `381/381` tests green (17 files incl. `build-engine.test.ts`)
- **Date**: 2026-09-13

## Completed

1. **Email core** (`src/server/email/`)
   - `provider.ts` — `EmailProvider` interface, `ConsoleEmailProvider`, `SmtpEmailProvider` (nodemailer), `createEmailProvider()` factory (console when `EMAIL_SMTP_HOST` unset), `DEFAULT_FROM_EMAIL`.
   - `templates.ts` — 13 rendered template keys; `renderEmail(key, data)` throws on unknown keys; every user-provided value HTML-escaped; canonical app URL embedded; `DEFAULT_SUPPORT_EMAIL` fallback.
   - `queue.ts` — `enqueueEmail()` renders via the 13-key registry when subject/body absent, inserts with `onConflictDoNothing({ target: emailJobs.idempotencyKey })`, returns `{ jobId, created }` (re-selects existing job on conflict).
   - `support.ts` — `notifySupport(orgId, subject, body)` targets `organizations.billing_email` with digest idempotency key `support_notification_${orgId}_${sha1(subject\0body).slice(0,16)}`; skips with warning when org/billing email missing.
   - `delivery.ts` — `recordEmailDeliveryEvent()` idempotent by provider event id (partial unique index via Drizzle `where` predicate); normalized message-id lookup; bounce/complaint/failed → job `failed` + audit `email_bounced`/`email_failed`.
   - `constants.ts` — `EMAIL_LIFECYCLE_LEAD_DAYS = { REMINDER_DOWNLOAD_LEAD_DAYS: 7, UPLOAD_EXPIRY_WARNING_LEAD_DAYS: 7, DOWNLOAD_EXPIRY_WARNING_LEAD_DAYS: 3 }`, `MS_PER_DAY`.
   - `lifecycle.ts` — `scanLifecycleAutomation(now?)`: JNB business-date helpers (`Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" })`, `jnbDayStart`, exported `BUSINESS_TIMEZONE`), CAS `active→upload_closed→expired` transitions, enqueues 6 lifecycle email types under per-wedding deadline idempotency keys, only to vaults with a customer contact.
2. **Worker** (`src/server/services/email-worker.ts` + `email-worker.entry.ts`)
   - CAS claim `pending→sending` (never double-send), select provider **after** claim so retries work, transient retry `attempts+1` / permanent fail at `maxAttempts`, `email_sent` audit + `email_events` "sent" row (`provider_event_id = NULL`, `provider_message_id` in metadata).
   - `recoverStaleEmailJobs()` (5-min threshold), `processPendingEmailJobs(provider?, options?: { organizationId? })` (org-scope added for tests/tenant drains), `start/stop/isEmailWorkerRunning`, SIGINT/SIGTERM hooks, lifecycle sweep every 12 polls (~1 min at 5s poll).
   - `npm run email:dev` entrypoint added to `package.json`.
3. **Delivery webhook** (`src/app/api/webhooks/email/route.ts`)
   - POST, zod `.strict()` schema `{ provider, messageId, eventType, providerEventId, timestamp?, metadata? }`; `x-webhook-secret` verified with `timingSafeEqual` when `EMAIL_WEBHOOK_SECRET` set (else warn); 200 `{received:true}` / 404 `{received:false, reason:"email_job_not_found"}`.
4. **Build-engine hooks** (`src/server/services/build-engine.ts`)
   - `executeBuild` claims via CAS `pending→processing` with `attempts: sql`${buildJobs.attempts} + 1`` and enqueues `build_started`.
   - `handleBuildError` permanent branch enqueues `build_failure` + `notifySupport` (skipped when org has no billing email — build-engine failure tests still green).
   - `stepQueueEmail` now uses real customer email via `resolveCustomerEmail(wedding.id)`; `vault_ready_${wedding.id}_${ctx.version}` and `qr_card_${wedding.id}_${ctx.version}` idempotency keys preserved.
5. **Database** — migration `drizzle/0002_numerous_fantastic_four.sql` (8 `ALTER TYPE email_job_type ADD VALUE` → 14 values), generated + applied; snapshot `drizzle/meta/0002_snapshot.json`; enum extended in `src/lib/db/schema/enums.ts`.

## Type → Template → Trigger matrix

| email_job_type (enum) | template key (rendered) | Trigger |
|---|---|---|
| `build_started` | `build_started` | build job CAS claim |
| `build_failure` | `build_failure` | permanent build failure |
| `vault_ready` | `vault_ready` | build `queue_email` step |
| `qr_card` | `qr_card` | build `queue_email` step (Platinum only) |
| `qr_ready` | `qr_ready` | QR generation completes |
| `payment_success` | `payment_success` | payment webhook verified |
| `reminder_upload` | `reminder_upload` | lifecycle: ≤7d before upload deadline |
| `download_reminder` | `download_reminder` | lifecycle: ≤7d before download deadline |
| `upload_expiry_warning` | `upload_expiry_warning` | lifecycle: ≤7d before download deadline |
| `download_expiry_warning` | `download_expiry_warning` | lifecycle: ≤3d before upload deadline |
| `upload_closed` | `upload_closed` | lifecycle: upload deadline crossed |
| `download_closed` | `download_closed` | lifecycle: download deadline crossed |
| `support_notification` | `support_notification` | build failure / operator alert |
| `expiry_warning` | *(none — no renderer)* | legacy generic value; intentionally unrenderable |

## Files changed

- Added: `src/server/email/{provider,templates,queue,support,delivery,constants,lifecycle}.ts`, `src/server/services/email-worker.ts`, `src/server/services/email-worker.entry.ts`, `src/app/api/webhooks/email/route.ts`, `src/server/email/__tests__/email.test.ts`, `src/server/services/__tests__/email-worker.test.ts`, `drizzle/0002_numerous_fantastic_four.sql`, `drizzle/meta/0002_snapshot.json`
- Modified: `src/server/services/build-engine.ts`, `src/lib/db/schema/enums.ts`, `drizzle/meta/_journal.json`, `package.json`, `package-lock.json`, `.env.example` (gitignored), `docs/DECISIONS.md`, `docs/WORKER_STATUS.md`, `docs/decisions/ADR-009-email-worker-and-lifecycle-automation.md` (new)

## Database changes

- `email_job_type` extended to 14 values via 0002 (applied to local dev DB; enum verified via pg_enum).
- No new tables (email_jobs/email_events existed from ADR-002); lifecycle events/audit reused existing tables.

## API/contracts changed

- New webhook endpoint `POST /api/webhooks/email` (secret = `EMAIL_WEBHOOK_SECRET`).
- `processPendingEmailJobs(provider?, options?: { organizationId? })` — backwards-compatible optional 2nd arg.
- Build-engine `stepQueueEmail` return contract unchanged (`{ emailQueued: true }` / `{ emailQueued: false, reason }`).

## Tests/results

- `npx vitest run src/server/email/__tests__/email.test.ts src/server/services/__tests__/email-worker.test.ts` — 47/47 green (32 template render/XSS + 15 worker/queue/delivery/support/lifecycle integration).
- Full `npm test` — **381/381 green across 17 files** (incl. `build-engine.test.ts` 18/18; `entitlements` 123; `auth` 51; dashboard/middleware/storage/guest-session suites).
- `npx tsc --noEmit` 0 errors; `npm run lint` 0 errors.
- Dev DB verified clean after runs (0 leftover `fake-%` jobs, 0 leftover `evt-%` events).

## Environment changes

- `.env.example` (gitignored): Email/SMTP block — `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT=587`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASS`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_WEBHOOK_SECRET`.
- `package.json`: `"email:dev": "tsx src/server/services/email-worker.entry.ts"`.

## Known issues

- No SMTP credentials in local dev → emails log to console via `ConsoleEmailProvider`; configure `EMAIL_SMTP_*` for real sending.
- `EMAIL_WEBHOOK_SECRET` unset → webhook warns and accepts unauthenticated requests; production must set it.
- Support notifications silently skip (warn only) when `organizations.billing_email` is null — acceptable per ADR-009, revisit if ops wants a dead-letter queue.
- Account/organization-scoped quirks: lifecycle sweep is global by design (runs across all tenants); `processPendingEmailJobs` default is global (org scope optional for tests/drains).

## Next worker

- Payments (PayFast webhooks → `enqueueEmail("payment_success")` — queue API is ready and idempotent).
- Public vault / media workers can now call `enqueueEmail` for guest-facing lifecycle messages.
- QA/Security: rotation of `EMAIL_WEBHOOK_SECRET`, webhook signature hardening if a second provider is added.

## Decisions required

- None blocking. Recorded: ADR-009 (email worker + lifecycle automation). Deviations noted in ADR-009: skipped support notification without billing email (warn-only), optional org scope on `processPendingEmailJobs`.