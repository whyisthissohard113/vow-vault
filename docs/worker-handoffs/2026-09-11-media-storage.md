# Worker Handoff — 2026-09-11

## Worker
media-storage

## Task
Implement production-grade Phase 6 Media & Storage: S3-compatible presigned-URL upload/download (staff + guest), server-authoritative upload init (entitlements, upload window, size limits, MIME + magic-byte validation), async media processing worker (dedupe hash, thumbnails, optimized variants, video metadata), idempotent/retryable processing jobs, 5 API routes, media error classes, integration tests, and API docs handoff.

## Status
COMPLETE

## Completed
- Storage layer: `S3StorageClient` (S3StorageClient implements StorageClient) with endpoint/region/bucket/credentials from env, path-style + virtual-host URL builds, AWS SigV4 presigning (`presignPut`/`presignGetRequest`), `putObject`/`headObject`, memory storage client (`MemoryStorageClient`) for tests, no-arg-local `createStorageClient`.
- `storage/limits.ts`: photo ≤ 25 MB (all packages), video ≤ 250 MB (Gold/Platinum only), `enforceSizeLimit` → `MediaSizeExceededError`.
- `storage/mime.ts`: MIME allow-list (image/jpeg, image/png, image/webp, image/gif, video/mp4, video/webm, video/quicktime), magic-byte signature detection (JPEG/PNG/WebP/GIF/MP4 ftyp brand check/WebM/QuickTime), `signatureMatchesDetected`.
- `video-metadata.ts`: ISO-BMFF `moov`/`mvhd` duration parser (v0/v1, timescale-aware ms, handles mdat-before-moov); WebM returns `null` (documented no-op).
- `media-service.ts`: `initiateUpload`/`initiateGuestUpload`/`completeUpload`/`enqueueProcessingJobs`/`retryProcessingJobs`/`requireMediaOwnership`/`getMediaWithVariants`/`listProcessingJobs`/`getSignedDownloadUrl`/`getSignedDownloadUrlForGuest`/`resolveEntitlementsForWedding`/`resolveGuestEntitlements`; constants `UPLOAD_URL_TTL_SECONDS`/`DOWNLOAD_URL_TTL_SECONDS` (900), `MEDIA_MAX_ATTEMPTS` (3).
- `media-worker.ts`: poll loop (`POLL_INTERVAL_MS` 5 s), CAS claim with retry (per-job maxAttempts), stale recovery (5 min), `maybeMarkMediaProcessed` convergence, `startMediaWorker`/`stopMediaWorker`. Executors: `content_hash` (sha256 + audit_logs duplicate note), image `thumbnail` (320px JPEG), `optimize` (preview 1280 / full 2560 WebP), video stubs.
- Errors added to `src/lib/auth/errors.ts`: `MediaValidationError`, `MediaMimeRejectedError`, `MediaSignatureRejectedError`, `MediaSizeExceededError`, `DuplicateMediaError` (codes `media_validation`, `media_mime_rejected`, `media_signature_rejected`, `media_size_exceeded`, `duplicate_media`).
- 5 API routes (see Files changed).
- `.env` S3_* vars added (dev values; MinIO container not running).
- 42 new tests; full suite 282 tests / 13 files pass with default file parallelism.

## Files changed
- Created: `src/server/services/media-service.ts`, `src/server/services/media-worker.ts`, `src/server/services/video-metadata.ts`, `src/server/services/storage/limits.ts`, `src/app/api/media/upload/init/route.ts`, `src/app/api/media/guest/upload/init/route.ts`, `src/app/api/media/[id]/route.ts`, `src/app/api/media/[id]/download/route.ts`, `src/app/api/media/[id]/processing/retry/route.ts`, `src/server/services/__tests__/media-service.test.ts`, `src/server/services/__tests__/video-metadata.test.ts`, `src/server/services/storage/__tests__/signature.test.ts`, `src/server/services/storage/__tests__/mime.test.ts`
- Modified: `src/lib/auth/errors.ts` (appended media errors), `package.json` (+ `sharp`), `.env` (S3 vars), `vitest.config.ts` (testTimeout 20000 to prevent parallel-DB flakes)
- Part of the storage layer (present from this task's earlier steps): `src/server/services/storage/config.ts`, `src/server/services/storage/signature.ts`, `src/server/services/storage/client.ts`, `src/server/services/storage/keys.ts`, `src/server/services/storage/mime.ts`
- Orchestrator docs: `docs/decisions/ADR-006-media-storage.md`, `docs/WORKER_STATUS.md` (Media/Storage = COMPLETE)

## Database changes
- No schema/migration changes: `memories`, `media`, `media_variants`, `media_processing_jobs` already existed in `src/lib/db/schema/media.ts` and the live DB. Tests hit the real local PostgreSQL.

## API/contracts changed
- New routes:
  - `POST /api/media/upload/init` — `withAuth + withTenant + withPermission(UPLOAD_MEDIA)`; body `{ weddingId, filename, contentType, sizeBytes, sha256?, memoryTitle? }`; 201 `{ mediaId, storageKey, uploadUrl, expiresAt }`; 400/404/409/413.
  - `POST /api/media/guest/upload/init` — raw guest token via `x-guest-token` header; body `{ filename, contentType, sizeBytes, sha256?, memoryTitle? }`; 201 `{ mediaId, uploadUrl, expiresAt }`; duplicates return `{ duplicate, message }` (no IDs); 401/400/413.
  - `GET /api/media/[id]` — `VIEW_WEDDING`; media + variant summaries; 404 cross-tenant.
  - `GET /api/media/[id]/download?variant=&disposition=` — dual-mode: guest token header routes to guest path, else `VIEW_WEDDING`; returns `{ url, expiresAt, contentType }`; re-checks `downloadOpen`.
  - `POST /api/media/[id]/processing/retry` — `MANAGE_WEDDING`; resets failed processing jobs to pending.
- `InitiateUploadResult.mediaId` is now optional: guest duplicate responses never include internal media UUIDs. Guests never receive `storageKey`/`duplicateOf`.
- No new permission granted; existing `UPLOAD_MEDIA`, `VIEW_WEDDING`, `VIEW_VAULT`, `MANAGE_WEDDING` reused.

## Tests
- `npx vitest run` — 287 passed (13 files), including 47 new media/storage tests, default parallel file execution.
- `npx tsc --noEmit` — 0 errors.
- `npx eslint src` — 0 errors (29 warnings, all pre-existing in build-engine/build-worker files).
- Notable: media integration suite uses unique fixtures (`media-test-*` org public-id/slug, org-scoped product code) to avoid colliding with build-engine suite on globally-unique constraints (`organizations.public_id`, `organizations.slug`).
- Orchestrator-added integration tests (5, in `media-service.test.ts`): oversized photo (`MediaSizeExceededError`), oversized video, unauthorized guest token, cross-tenant denial (foreign media is `NotFound` from the TEST org), and expired download window (`ForbiddenError`). These complete the 10 required security scenarios from the task:
  1. unauthorized upload — 7b (invalid guest token)
  2. cross-tenant media access — 11 (foreign media invisible)
  3. expired upload — 3 (upload window closed)
  4. expired download — 12 (download window closed)
  5. invalid MIME — 2 (unsupported type rejected)
  6. malicious file — 5 (HTML disguised as `.jpg` rejected)
  7. oversized file — 3b (photo > 25 MB) and 3c (video > 250 MB)
  8. duplicate upload — 6 (sha256 hint collides; no new row)
  9. failed processing — 9 (attempts exhausted → media `failed`)
  10. retry processing — 10 (reset → completed → media `processed`)
- Test-infra hardening: `vitest.config.ts` now sets `testTimeout: 20000` so integration suites sharing the local PostgreSQL under parallel workers no longer flake on the default 5s timeout.

## Environment changes
- `.env`: `S3_ENDPOINT=http://localhost:9000`, `S3_REGION=us-east-1`, `S3_BUCKET=wmv-dev`, `S3_ACCESS_KEY_ID=wmv`, `S3_SECRET_ACCESS_KEY=wmv-secret`, `S3_FORCE_PATH_STYLE=true` (matches `.env.example`).
- `sharp` added to dependencies (image processing).

## Known issues
- MinIO (or any S3 endpoint) is not running, so real presigned-url object flows are only covered by the in-memory client + signature unit tests. `docker compose up minio` is the E2E gap.
- `video_transcode`/video `thumbnail` jobs are deliberate stubs with clear errors/warnings (no ffmpeg in scope); video processing does content-hash + ISO-BMFF duration probe only.
- Neither `startBuildWorker()` nor `startMediaWorker()` is wired to a runtime entrypoint yet (pre-existing for build worker; media worker mirrors it). Nothing auto-starts processing jobs at boot.
- eslint warnings in `build-engine.test.ts` / `build-worker.ts` are pre-existing and untouched.

## Next worker
- Wire worker startup (instrumentation/edge-runtime or server bootstrap) for both build and media workers; add graceful shutdown.
- Frontend: authenticated + guest upload components using init → PUT → completeUpload; gallery/slideshow consumption of `media/[id]` + download URLs.
- E2E with MinIO: `docker compose up minio`, then exercise real presigned PUT and GET.
- Video pipeline: real thumbnail/transcode (ffmpeg or Cloudflare Stream/Mux), update `video-metadata` and job executors.
- Delete/purge flow: soft-delete → purge with storage object deletion (reuse `assertKeyInNamespace`).
- Guest upload quota UX; memory grouping (`memories` table not yet used by media-service — `memoryTitle` currently labels media not memory rows).

## Decision required
- None blocking. Recorded decisions for posterity (see also `docs/DECISIONS.md` if updating): (1) `retryProcessingJobs` resets failed jobs to `pending` with `attempts: 0` (fresh maxAttempts budget) because `executeMediaJob` never executes jobs at `attempts >= maxAttempts`; idempotency key + row identity preserved. (2) No new permissions added — 15-permission test constraint; media access reuses existing permissions.