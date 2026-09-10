# Worker Handoff — 2026-09-10
## Worker
Database

## Task
Implement production PostgreSQL schema (37 tables + enums/indexes/FKs) with Drizzle ORM, generate and apply the initial migration, and verify constraint behavior.

## Status
COMPLETE

## Completed
- Bootstrapped Next.js 16 + TypeScript strict workspace (create-next-app scaffold copied in, eslint flat config added because scaffold omitted it).
- Installed drizzle-orm@0.38.4, drizzle-kit@0.30.6 (dev), @neondatabase/serverless@0.10.4, postgres@3.4.9, dotenv@16.6.1.
- Authored full Drizzle schema in `src/lib/db/schema/` (entry: `src/lib/db/schema/index.ts`): enums, users, organizations, organization_members, customers, products, product_features, product_feature_values, templates, template_versions, template_fields, orders, order_items, payments, payment_events, weddings, wedding_settings, vaults, guest_sessions, vault_access, build_jobs, build_job_steps, media, media_variants, media_processing_jobs, memories, slideshows, slideshow_items, flipbooks, flipbook_pages, qr_codes, qr_designs, expiry_rules, lifecycle_events, email_jobs, email_events, notifications, audit_logs. Relations metadata in `relations.ts`.
- Created `src/lib/db/index.ts` Drizzle client singleton (postgres-js, `prepare: false`), verified against live DB (returns UTC `now()`).
- Created `drizzle.config.ts` (postgres dialect, out `./drizzle`), `docker-compose.yml` (postgres:16-alpine + minio + redis), `.env` / `.env.example` (DATABASE_URL).
- Generated initial migration `drizzle/0000_shiny_the_santerians.sql` and applied it via `npx drizzle-kit migrate`.
- Ran constraint smoke tests inside a rolled-back transaction; all passed (see Tests).
- Fixed scaffold gap: `eslint.config.mjs` (Next 16 flat config) so `npm run lint` passes.
- Recorded material decisions in `docs/decisions/ADR-002-database-schema-implementation.md`; updated `docs/DECISIONS.md`, `docs/WORKER_STATUS.md`, `FILE-MANIFEST.txt`.

## Files changed
- Added: `src/lib/db/index.ts`, `src/lib/db/schema/*.ts` (24 files), `drizzle.config.ts`, `docker-compose.yml`, `.env`, `.env.example`, `eslint.config.mjs`, `drizzle/0000_shiny_the_santerians.sql`, `drizzle/meta/0000_snapshot.json`, `drizzle/meta/_journal.json`, `docs/decisions/ADR-002-database-schema-implementation.md`, `docs/worker-handoffs/2026-09-10-database-schema.md`.
- Modified: `package.json` (+db scripts, deps), `package-lock.json`, `tsconfig.json` (strict already on; added `**/*.mts` include), `src/app/layout.tsx` (fixed `LayoutProps` type), `docs/DECISIONS.md`, `docs/WORKER_STATUS.md`, `FILE-MANIFEST.txt`, `src/lib/db/schema/build.ts` (removed unused `sql` import).

## Database changes
- Schema version 0000 applied: 37 tables, 30+ native pgEnum types, all FKs, partial unique indexes (soft-delete + NULL-scoped platform rows), CHECK constraints on non-negative money.
- Migration deliberately named `0000_shiny_the_santerians.sql`; earlier bad migration was reset before this run (pending files must never be regenerated casually — run `npm run db:generate` only after real schema edits).
- `drizzle-kit generate` re-checked after final edits: “No schema changes, nothing to migrate” — schema and applied migration are in sync.

## API/contracts changed
- New DB-only layer; no HTTP/API contracts changed. Clients should use exported Drizzle tables from `src/lib/db` (`db`, `schema`, `DB` type).
- Contract notes for downstream workers:
  - `payment_events.provider_event_id` and `payments.provider_reference` are UNIQUE — webhook handling must rely on INSERT and catch unique violations for idempotency.
  - `build_jobs.idempotency_key` and `(wedding_id, version)` are UNIQUE — builders must pass a deterministic idempotency key.
  - `wedding_settings.banner_media_id`/`intro_media_id` are plain uuids (no DB FK) — service layer must validate media ownership.
  - `guest_sessions.token` must store a one-way hash of the opaque guest token, not the raw value.
  - Platform-scoped catalog tables (products/templates/qr_designs) use `organization_id NULL` with two partial unique indexes — do not replace with a plain unique index.

## Tests
- `npm run typecheck` (tsc --noEmit): PASS (0 errors).
- `npm run lint` (eslint 9 flat config): PASS (0 warnings/errors).
- `npx drizzle-kit migrate`: PASS — “migrations applied successfully”.
- Live DB constraint smoke tests (psql, rolled back): PASS for enum rejection, duplicate organization_members rejection, duplicate provider_event_id (webhook replay) rejection, duplicate provider_reference rejection, one wedding_settings per wedding, build idempotency_key uniqueness, (wedding_id, version) uniqueness, tenant-scoped media insert, negative money CHECK rejection.
- `npx tsx --env-file=.env` Drizzle client round-trip: PASS — connected, DB timezone is UTC.

## Environment changes
- Docker Desktop started; container `wmv-postgres` (postgres:16-alpine) on localhost:5432, DB `wedding_memory_vault`, user/pass `wmv/wmv`.
- Node v24.20.0, npm 11.19.0.

## Known issues
- `wedding_settings` banner/intro media ids have no DB-level FK (intentional; see ADR-002 #6).
- No RLS policies yet — tenant isolation this phase is structural (org_id FKs). Auth/RBAC worker should add RLS or service-layer scoping before public access exists.
- `tsconfig.tsbuildinfo` is committed; recommend adding it to `.gitignore` when the repo becomes a git repo.

## Next worker
- Auth/RBAC/Tenancy — build on `users`/`organizations`/`organization_members`; implement server-side auth + RLS/tenant scoping.
- Payments — use `payments`/`payment_events` idempotency anchors for PayFast webhooks.
- Builder / Media / Email / Entitlements — tables are ready; implement domain logic.

## Decision required
- None blocking. ADR-002 records all interpretation decisions (uuid public ids, INTEGER cents, NULL-scoped platform rows, no circular FK, token hashing, UTC timestamps + Johannesburg deadline math).