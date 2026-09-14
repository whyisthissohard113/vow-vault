# ADR-009 — Email Worker & Lifecycle Automation

- Status: Accepted
- Date: 2026-09-13
- Workers: Email/Automation

## Context

Phase 11 requires a production-grade transactional email subsystem: a queue for
sending emails (vault ready, build notifications, reminders, expiry warnings,
support alerts), a worker that is retryable and idempotent, a webhook for
provider delivery events, and a lifecycle sweep that enforces the
`upload_closed` → `expired` state machine using `Africa/Johannesburg` business
dates. Emails must never leak tenant data, render from strict templates, and be
enqueueable idempotently from payment flows and the build engine.

## Decision

- **Single table queue** (`email_jobs`) with `idempotency_key` unique and
  `onConflictDoNothing`, replacing ad-hoc `emailJobs` inserts in the build
  engine. Jobs are claimed with a compare-and-set update
  (`pending` → `sending`) so concurrent workers can never double-send.
- **Provider abstraction** (`EmailProvider`): console provider when
  `EMAIL_SMTP_HOST` is unset, SMTP provider otherwise. The provider is only
  selected**after** the claim, so failures can be retried (a provider exception
  does not destroy the claim).
- **Rendered templates** are the single source of body content; `renderEmail`
  throws for unknown template keys. The generic enum value `expiry_warning` has
  **no** renderer (each warning has its own template). All user-provided values
  are HTML-escaped at render time.
- **Delivery events** are idempotent by `provider_event_id` through a partial
  unique index (`providerEventId IS NOT NULL`); "sent" rows store
  `provider_event_id = NULL` with `provider_message_id` in metadata so internal
  sends never collide with provider events. Message-id matching is normalized
  (lowercase, strip angle brackets, strip `provider:` prefix) to tolerate
  SES/other formats.
- **Support notifications** go to `organizations.billing_email` with a digest
  idempotency key. If the org has no billing email the notification is skipped
  with a console warning (never blocks the calling pipeline).
- **Lifecycle sweep** computes business dates via
  `Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" })`, performs
  CAS status transitions (`active` → `upload_closed` → `expired`), and enqueues
  each notification type under per-wedding deadline idempotency keys so replays
  are no-ops. Emails are only sent to vaults that still have a customer contact.
  Superseded by ADR-011: transitions now belong to the shared lifecycle engine
  (`runLifecycleSweep`), and the sweep's `download_closed` email fires at
  `upload_closed → download_only`.
- **Worker entrypoint** `npm run email:dev` runs `email-worker.entry.ts`;
  lifecycle scanning runs every 12 polls inside the same loop.

## Consequences

- Build-engine tests remain green: the `vault_ready_${weddingId}_${version}`
  and `qr_card_${weddingId}_${version}` idempotency keys are unchanged, and
  failure-mode tests still log the same "failed permanently" path (permanent
  failures now also notify).
- `processPendingEmailJobs(provider, options?)` gained an optional
  `{ organizationId }` scope so tests/tenant drains can claim a single tenant's
  jobs instead of racing other suites that share the dev database.
- New environment variables: `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`,
  `EMAIL_SMTP_PASS`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_WEBHOOK_SECRET`.