# ADR-002 — Database Schema Implementation (Drizzle ORM)

- Status: Accepted
- Date: 2026-09-10
- Domain: Database

## Context
A greenfield PostgreSQL schema for 37 tables plus supporting enums/indexes
was required by the master specification and architecture. The database
worker implemented it with Drizzle ORM under TypeScript strict mode and
generated the initial migration. Most table shapes are dictated directly by
`docs/MASTER_SPEC.md` / `docs/ARCHITECTURE.md`; this ADR records the material
interpretations and adaptations.

## Decisions

### 1. Surrogate UUID primary keys + opaque public IDs
All tables use `uuid` PKs with `gen_random_uuid()` defaults via
`defaultRandom()`. Externally-facing rows (organizations, customers, weddings,
vaults, products, templates, QR codes, media) also carry a `public_id`
`varchar(32)` that is opaque and unique. Guests and frontend code only ever
see `public_id`; internal UUIDs never leave the server (per AGENTS.md).

### 2. Tenant isolation is structural
Every tenant-scoped table has a non-null `organization_id` FK to
`organizations.id` with `onDelete: cascade`. Platform/business-owner rows
(products, templates, qr_designs) use a *nullable* `organization_id`:
- NULL = platform-level catalog row,
- set = venue/B2B tenant row.
Because PostgreSQL treats NULLs as distinct in unique indexes, each such table
uses **two partial unique indexes** to keep `code`/`slug` unique within each
scope (one `WHERE organization_id IS NULL`, one for non-null).

### 3. Idempotent payment webhooks and jobs
- `payments.provider_reference` UNIQUE (per tenant) — a provider attempt is
  processed at most once.
- `payment_events.provider_event_id` UNIQUE (per tenant) + `processed_at`
  timestamp — webhook replays are deduplicated, never double-applied.
- `build_jobs.idempotency_key` UNIQUE and `(wedding_id, version)` UNIQUE —
  builds are re-enqueue-safe and version-pinned.
- `media_processing_jobs.idempotency_key` UNIQUE and
  `email_jobs.idempotency_key` UNIQUE similarly.

### 4. Money is integer cents (ZAR)
`*_cents` integer columns with NOT NULL CHECKs (`>= 0`) on order/payment
amounts; no floating point anywhere. All business prices/totals formatted at
the display layer.

### 5. `wedding_settings` is one-per-wedding
Unique index on `wedding_id` (Drizzle `uniqueIndex`, not `index`) so exactly
one settings row exists per wedding.

### 6. No circular FK between `wedding_settings` and `media`
`banner_media_id` / `intro_media_id` are plain `uuid` columns with no DB-level
FK to `media` (media would otherwise need a back-reference to
wedding_settings). Reference integrity is enforced at the application/service
layer; this is documented in the schema comments.

### 7. Timestamps are UTC, wedding-date is a plain date
All timestamps use `timestamp with time zone, mode: 'date'` with
`defaultNow()` (DB default = UTC) and `$onUpdate` on `updated_at`.
`weddings.wedding_date` is a `date` type (no time component). Business
deadlines live in `expiry_rules` as UTC timestamps
(`upload_deadline`/`download_deadline`) plus `wedding_date_at_calculation` so
the calculation inputs are auditable after the fact.

### 8. Guest session tokens stored as hashes
`guest_sessions.token` is UNIQUE but the comment mandates storing a one-way
hash (e.g. SHA-256) of the opaque token, never the raw invite token; expiry is
NOT NULL and enforced server-side for upload/download.

### 9. Soft delete + partial unique indexes
Rows use `deleted_at timestamptz NULL`; unique business keys are enforced with
partial unique indexes `WHERE deleted_at IS NULL` so soft-deleted rows never
collide with live ones.

### 10. Enums are PostgreSQL native
All 30+ status enums are real `pgEnum` types (e.g. `wedding_status`,
`payment_status`, `build_job_status`, `lifecycle_event_type`), giving type
safety in TS and integrity in the DB.

### 11. `guest_sessions.upload_count` / `max_uploads` for fair use
Rate-limiting columns exist so "unlimited" plans still have technical/safe
guards (AGENTS.md: “Unlimited” means entitlement, not removal of safeguards).
Enforcement happens server-side, not in schema.

## Consequences
- Initial migration `drizzle/0000_shiny_the_santerians.sql` contains 37 tables
  and all enums/indexes/FKs; generated from `src/lib/db/schema/`.
- `wedding_settings.banner_media_id`/`intro_media_id` have no FK — service
  layer must validate media ownership.
- NULL-scoped platform rows require two partial unique indexes per table;
  workers must not "simplify" these to a plain unique index.
- Date deadline calculations must be performed in `Africa/Johannesburg`
  (per AGENTS.md), then stored as UTC in expiry_rules.