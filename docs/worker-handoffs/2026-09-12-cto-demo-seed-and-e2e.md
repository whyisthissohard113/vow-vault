# Worker Handoff — 2026-09-12
## Worker
Orchestrator / CTO
## Task
Create a demo account for human testing (frontend, dashboard, uploads, downloads) and prove the guest-upload → build-worker → media-worker → gallery e2e path.
## Status
COMPLETE
## Completed
- `scripts/seed-demo.ts` — idempotent demo seed (`npm run seed:demo`):
  - Org `demo-weddings` (Demo Weddings Co.), user `demo@weddingmemoryvault.app` / `DemoPass123!`, membership `wedding_company_owner`
  - Platform products Silver (R599) / Gold (R799) / Platinum (R1099)
  - Customer, template `classic-elegance` + published v1, Gold wedding "Thandi & Daniel" (weddingDate 2026-11-11, JNB), settings row, paid order `ORD-DEMO-0001` + completed payment, then `enqueueBuild` → the running build worker published the vault
  - Re-run verified idempotent (all rows reused, job deduped, vault slug stable)
- `src/server/services/media-worker.entry.ts` + `npm run media:dev` script so the media processing worker can run alongside the build worker
- MinIO dev storage brought up:
  - Fixed `docker-compose.yml`: `minio/minio:latest` no longer pullable from Docker Hub → `quay.io/minio/minio:latest`
  - `wmv-dev` bucket created via `mc`; `.env` S3 vars already pointed at localhost:9000
- E2E proven end-to-end (all against the live dev server + worker):
  - Login: credentials flow → session `{user, role: wedding_company_owner, organizationId}`; `/dashboard` 200
  - Public vault `/w/thandi-daniel-20261111-vc3y6p` 200, renders QR + gallery
  - Guest: `POST /api/vault/{slug}/guest-session` → token; `POST /api/media/guest/upload/init` (with sha256) → presigned PUT; real `GET`-style PUT of a 15 KB JPEG to MinIO → 200; `POST …/complete` → `processing`
  - Media worker: content_hash, thumbnail, optimize all completed; media status `processed`; 3 variants in storage (thumb 2407 B, preview/full webp)
  - Guest session `upload_count` incremented to 1
  - Gallery HTML contains the media publicId + `<img alt="demo-photo.jpg">`
  - Downloads: owner (session) and guest (x-guest-token) both return presigned MinIO URLs; owner fetch of `full.webp` → 200, 6744 bytes
- `build-engine.test.ts` fixture hardened: test product is now org-scoped + `onConflictDoNothing` (it inserted org-null rows with bare `silver/gold/platinum` codes that collided with the seeded platform catalog)
- Removed unused `or` import in `seed-demo.ts`
- Gate green: `tsc` 0, `eslint` 0 problems, `vitest` 15 files / 334 tests pass
## Files changed
- `scripts/seed-demo.ts` (new)
- `src/server/services/media-worker.entry.ts` (new)
- `package.json` (`seed:demo`, `media:dev`)
- `docker-compose.yml` (minio image → `quay.io/minio/minio:latest`)
- `src/server/services/__tests__/build-engine.test.ts` (fixture scoping fix)
## Database changes
- No migration changes. Demo rows created in the dev DB: organizations, users, organization_members, products (3 platform), customers, templates+versions, weddings, wedding_settings, orders+items, payments, build_jobs(+steps), vaults, guest_sessions, media+variants, media_processing_jobs.
## API/contracts changed
- None.
## Tests
- `npx tsc --noEmit` exit 0 · `npm run lint` 0 problems · `npm test` 15 files / 334 tests pass
## Environment changes
- MinIO running (`wmv-minio`, quay.io image) on :9000/:9001; bucket `wmv-dev`
- Media worker running (PID 16448, `npm run media:dev`), build worker running (PID 13796)
- Demo account: `demo@weddingmemoryvault.app` / `DemoPass123!`
- Golden path to re-prove: `npm run seed:demo` then open `/login` and `/w/thandi-daniel-20261111-vc3y6p`
## Known issues
- Guest uploads need MinIO up; if the media worker is stopped, uploads stay in `uploaded`/jobs `pending` until it resumes (jobs are retryable/idempotent).
- Gallery renders the filename as alt text; the `memoryTitle` ("First dance") is stored but not displayed on the public vault card (frontend enhancement for a later worker).
- Dev DB now contains a permanent platform catalog (Silver/Gold/Platinum); new tests must never insert org-null products with bare package codes (see fixture fix).
## Next worker
- Frontend: browser QA of dashboard + public vault; surface `memoryTitle`; polish guest upload UX.
- Payments/Email workers: PayFast webhooks + email queuing remain unimplemented.
## Decision required
- None.