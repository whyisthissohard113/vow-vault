# ADR-006 — Media Storage Pipeline

## Status
Accepted

## Date
2026-09-11

## Context
The Wedding Memory Vault must accept guest and staff uploads of photos (all packages) and videos (Gold/Platinum), process them asynchronously, and serve them back through expiry-governed, tenant-scoped signed URLs — without ever exposing storage credentials or internal object keys to guests.

## Decision
- Use an S3-compatible object storage abstraction (`StorageClient`) implemented with **fetch + hand-rolled AWS Signature V4** (no AWS SDK dependency). Works with AWS S3, Cloudflare R2, and MinIO; path-style (`S3_FORCE_PATH_STYLE=true`) and virtual-hosted modes supported.
- **Presigned URLs** everywhere: short-TTL presigned `PUT` for uploads (15 min) and `GET` for downloads (15 min). The server never proxies media bytes through the API.
- **Server-authoritative upload init**: MIME allowlist, magic-byte signature sniffing, per-package size limits (photo ≤ 25 MB all packages; video ≤ 250 MB Gold/Platinum), entitlement + upload-window checks, tenant scoping — all enforced BEFORE any URL is issued. `completeUpload` re-checks the real stored object size and magic bytes.
- **Safe object keys**: `{organizationId}/{weddingId}/{mediaId}.{ext}`, generated server-side from UUIDs. Extension derived from validated MIME, never from the user's filename. `assertKeyInNamespace` is defense-in-depth on every download.
- **Async processing jobs** (`media_processing_jobs`): `content_hash` (server-side SHA-256 + duplicate audit), `thumbnail` (320px JPEG via sharp), `optimize` (`preview` 1280px + `full` 2560px WebP via sharp), `video_transcode` (metadata probe — ISO-BMFF `mvhd` duration parser; real HLS transcode requires ffmpeg, documented gap). Idempotent keys `media:{mediaId}:{jobType}`, max 3 attempts, stale-job recovery, media status converges to `processed`/`failed`.
- **Duplicate detection**: optional client SHA-256 hint matched at init (staff get `duplicateOf`; guests only get `duplicate: true`, never internal IDs). Server re-derives the authoritative hash in the `content_hash` job and audits duplicates within the same wedding.
- **Download expiry**: the download window is re-checked from entitlements BEFORE signing; guests are re-scoped through their guest session → vault → wedding.
- **Guest privacy**: guests never receive storage keys, internal UUIDs, or duplicate-of details.

## Consequences

### Positive
- Entire pipeline is testable offline via a dependency-injected in-memory storage client.
- No heavyweight AWS SDK; SigV4 signing is covered by known-answer tests.
- Storage credentials never leave the server; keys are opaque to guests.
- Entitlements are the single source of truth for upload/download windows and per-package limits.

### Trade-offs
- No real HLS video transcoding yet (requires ffmpeg or a managed media service); `video_transcode` records duration metadata only.
- Video thumbnails are a documented no-op.
- Hand-rolled SigV4 must be maintained; the AWS SDK would reduce vaulting surface but adds a dependency.
- Polling worker (5s) instead of a push queue (BullMQ/Redis) — same trade-off accepted for the build worker.
- MinIO/S3 E2E is not exercised in automated tests (no endpoint in CI); covered via in-memory client + signature KATs.

## Files
- `src/server/services/storage/` — config, signature (SigV4), client (StorageClient + S3 + memory), keys, mime, limits
- `src/server/services/media-service.ts` — upload init / complete / download / processing orchestration
- `src/server/services/media-worker.ts` — polling processing worker
- `src/server/services/video-metadata.ts` — ISO-BMFF duration parser
- `src/app/api/media/...` — 5 API routes (init, guest init, media, download, retry)
- `src/server/services/__tests__/media-service.test.ts` and `storage/__tests__/` — integration + unit tests