# ADR-005 — Wedding Build Engine

## Status
Accepted

## Date
2026-09-11

## Context
The Wedding Memory Vault needs a build engine that transforms a wedding dossier (wedding data, template, entitlements) into a production-ready public vault. The build process must be:
- Asynchronous (long-running, >30s)
- Retryable with exponential backoff
- Idempotent (safe to re-enqueue)
- Observable (step-by-step progress)
- Non-duplicating (rebuilds update, don't duplicate)

## Decision

### 15-Step Pipeline
1. **validate_wedding** — Check required fields (names, date, template)
2. **verify_payment** — Confirm completed payment for the wedding's order
3. **verify_entitlement** — Confirm package matches product, check entitlements
4. **create_vault** — Create vault row, generate slug/publicId
5. **apply_template** — Record template version used (frontend renders at view time)
6. **configure_public_url** — Record `/w/{slug}` public URL
7. **configure_expiry** — Calculate upload/download deadlines from wedding date (Africa/Johannesburg)
8. **create_gallery** — Mark gallery feature as enabled
9. **create_slideshow** — Create slideshow row (Gold/Platinum only)
10. **create_flipbook** — Create flipbook row (Platinum only)
11. **generate_qr** — Create QR code pointing to vault public URL
12. **generate_qr_card** — Queue QR design card generation (Platinum only)
13. **publish_vault** — Set vault status to published, wedding status to active
14. **queue_email** — Queue vault_ready email (and qr_card for Platinum)
15. **audit_event** — Record build_completed lifecycle event

### Idempotency Strategy
Two uniqueness constraints on `build_jobs`:
- `idempotency_key` (UNIQUE) — Client provides; re-enqueueing same build does nothing
- `(wedding_id, version)` (UNIQUE) — Repeated builds bump version; cannot duplicate production vaults

### Retry Logic
- Max 3 attempts, exponential backoff (1s, 2s, 4s)
- **Non-retryable errors** (fail immediately):
  - Validation errors (missing names, date, template)
  - No paid order / no completed payment
  - Missing product/template
- **Retryable errors**: Transient DB errors, timeout, etc.

### Entitlement-Driven Features
- Slideshow: Gold + Platinum
- Flipbook: Platinum only
- QR Design Card: Platinum only
- Base features (gallery, QR, upload): All packages

### Concurrency
- Background worker polls every 5s, max 3 concurrent jobs
- Stale job recovery on startup (jobs stuck >5min in "processing")
- Graceful shutdown (SIGTERM/SIGINT waits for active jobs)

### Observability
- `build_jobs` tracks: status, attempts, timestamps, input, result, error
- `build_job_steps` tracks each step: status, timing, error message, metadata
- API provides `GET /api/build/[id]` with full step details

## Consequences

### Positive
- Full pipeline is testable and observable
- Idempotency prevents duplicate vaults even under retry storms
- Non-retryable errors prevent infinite retry loops on config errors
- Entitlement-driven pipeline respects package boundaries
- Rebuilds (version increment) safely update existing vault

### Trade-offs
- Simple polling worker (5s interval) — production should use BullMQ/Redis
- Template application deferred to frontend render time
- QR card generation is a placeholder (needs async PDF generation job)
- Email queueing only — actual sending needs email worker

## Files
- `src/server/services/build-engine.ts` — Core pipeline
- `src/server/services/build-worker.ts` — Background worker
- `src/app/api/build/route.ts` — Enqueue endpoint
- `src/app/api/build/[id]/route.ts` — Status endpoint
- `src/app/api/build/[id]/retry/route.ts` — Retry endpoint
- `src/server/services/__tests__/build-engine.test.ts` — 18 tests