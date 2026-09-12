# Worker Handoff — 2026-09-11

## Worker
qr-generated-assets

## Task
Implement production-grade Phase 7 QR Codes & Generated Assets: QR lifetime service (generate/styled/revoke/expire/resolve) where payloads encode only public URLs, a Platinum QR design-card generator (sharp + SVG), generated-assets stubs, 5 API routes, integration with build-engine steps 11+12, 5 QR error classes, tests, and API docs handoff.

## Status
COMPLETE

## Completed
- `qr-service.ts`: QR lifecycle + raster helpers — `generateQrPng`, `generateQrDataUrl`, `generateQrSvg`, `createQrCode`, `getQrCode`, `getQrByPublicId`, `resolveQrDestination`, `revokeQrCode`, `listQrCodes`, `getDefaultDesign`, `getQrDesign`, `listQrDesigns`.
- Security invariants: QR payload encodes ONLY `{NEXT_PUBLIC_APP_URL}/w/{vault.slug}` (fallback `pending-{weddingId}` when no vault yet) — internal UUIDs never enter the QR matrix; `publicId` is a 32-hex opaque identifier stable across design/target changes; revoke = soft-delete (`revokedAt`), expire checked at resolution; all org-scoped reads filter by `organizationId`.
- `qr-card-generator.ts`: `generateQrCardPng` (sharp + SVG text overlay; 1080×1620 canvas, 512px QR, couple names Georgia 56px bold, wedding date 36px, bottom tagline; XML escaping) and `generateQrCardPdf` stub (returns the PNG buffer, documented).
- `asset-generation.ts`: `generateSlideshowAssets` / `generateFlipbookAssets` stubs that mark records `published`.
- 5 API routes (see Files changed): generate / get-or-delete / card / public resolve / designs list.
- Errors added to `src/lib/auth/errors.ts`: `QrGenerationError`, `QrCardGenerationError`, `QrCodeNotFoundError`, `QrCodeRevokedError`, `QrCodeExpiredError`.
- Build engine steps 11 (`generate_qr`) and 12 (`generate_qr_card`) wired to the new services: step 11 keeps idempotency (reuse existing active QR) and delegates creation to `createQrCode`; step 12 stays behind `qr_design_card` entitlement, renders the card PNG via `generateQrCardPng` (couple names + JNB-formatted date), and remains **non-fatal** on error.
- 33 new DB-backed integration tests; `qr-test-` fixture prefix; tenant-isolation, revocation, expiry, and PNG-payload-safety coverage.

## Files changed
- Created: `src/server/services/qr-service.ts`, `src/server/services/qr-card-generator.ts`, `src/server/services/asset-generation.ts`, `src/app/api/qr/generate/route.ts`, `src/app/api/qr/[id]/route.ts`, `src/app/api/qr/[id]/card/route.ts`, `src/app/api/qr/resolve/[publicId]/route.ts`, `src/app/api/qr/designs/route.ts`, `src/server/services/__tests__/qr-service.test.ts`
- Modified: `src/lib/auth/errors.ts` (appended QR errors), `src/server/services/build-engine.ts` (steps 11+12)
- Docs: `docs/decisions/ADR-007-qr-generated-assets.md`, `docs/DECISIONS.md`, `docs/WORKER_STATUS.md`
- NOTE: `qrcode`/`@types/qrcode`/`sharp` were already present in `package.json` (added by previous phases); no new dependencies were introduced by this worker.

## Database changes
- No schema/migration changes: `qr_codes` and `qr_designs` already existed in the database worker's migration. Tests hit the real local PostgreSQL and clean up their `qr-test-*` fixtures.

## API/contracts changed
- New routes:
  - `POST /api/qr/generate` — `withAuth + withTenant + withPermission(MANAGE_WEDDING)`; body `{ weddingId, vaultId?, designId? }` (zod strict); verifies the wedding belongs to the tenant; 201 `{ qrCodeId, publicId, targetUrl }`.
  - `GET /api/qr/[id]` — `MANAGE_WEDDING` (read); returns QR details; 404 for cross-tenant IDs.
  - `DELETE /api/qr/[id]` — `MANAGE_WEDDING`; revokes (soft-delete), returns `{ success: true }`.
  - `POST /api/qr/[id]/card` — `MANAGE_WEDDING`; body `{ coupleName, weddingDate?, backgroundColor?, foregroundColor? }` (hex-color validated); returns `{ cardBase64, contentType, width, height }`; `QrCardGenerationError` → 422.
  - `GET /api/qr/resolve/[publicId]` — **public, no auth**; `{ targetUrl, valid, reason? }` JSON, or HTTP 302 redirect when the client accepts `text/html`/`*/*`; revoked/expired/not-found codes return `valid: false` with a reason (never a redirect).
  - `GET /api/qr/designs` — `withAuth + withTenant`; sanitized public design list (id, name, colors) — org-scoped rows plus platform defaults.
- No shared contracts changed; the new service/route surface is additive. `generateQrCardPdf` is a documented stub (returns PNG bytes).

## Tests
- `npx vitest run src/server/services/__tests__/qr-service.test.ts` — **33 passed** (33 tests, ~14 s).
- `npx tsc --noEmit` — **0 errors**.
- `npx eslint` on all new QR files + `errors.ts` — **0 problems**.
- Build engine suite: `npx vitest run src/server/services/__tests__/build-engine.test.ts` — Gold/slideshow + all other scenarios pass; the "creates flipbook for Platinum package" test reports `pending` instead of `completed` intermittently. This is a pre-existing race in the shared test setup: multiple build runs share the same `TEST_WEDDING_ID`, and an earlier run's retry/`afterEach` cleanup can leave a second job row for that wedding while the suite's cleanup of `build_job_steps` is a no-op (`inArray(..., [])`), so the new job can be observed in `pending` during the 100 ms wait. The QR steps themselves are covered and green in the "creates QR code for all packages" test.

## Environment changes
- None (reuses existing `qrcode`, `sharp`, `NEXT_PUBLIC_APP_URL`; test DB `postgresql://wmv:wmv@localhost:5432/wedding_memory_vault`).

## Known issues
- `generateQrCardPdf` returns the PNG buffer (no real vector PDF yet).
- `logoKey` accepted by the card API but not rendered — space reserved per spec.
- Slideshow/flipbook generated assets are record-publish stubs only (no real rendering).
- The `qrcode` package is ESM-only at runtime but vitest/TypeScript resolve it fine with the existing config; verify `next build` if the card/svg helpers are later imported from client bundles (they are server-only today).
- Build-engine Platinum flipbook test flake (pre-existing, described above) — not caused by the QR changes.

## Next worker
- Frontend: QR management UI (list/generate/revoke/design picker) + card download; print-friendly card styles.
- PDF rendering: upgrade `generateQrCardPdf` to a real PDF (pdfkit or playwright) and add `fonts`/`logoKey` rendering.
- Generated-assets pipeline: implement real slideshow (stitched media) and flipbook (page images) generation as idempotent async jobs.
- QR analytics: scan-count tracking keyed by `publicId` (audit_logs-friendly), respecting the no-internal-ID-in-payload rule.
- Wire build/media workers at runtime (shared with other phases); consider scoping build-engine test suite fixtures to unique wedding IDs to remove the flipbook flake.

## Decision required
- None blocking. Recorded in `docs/decisions/ADR-007-qr-generated-assets.md`: (1) QR payloads are public URLs only; (2) `publicId` is opaque and stable across design/target changes; (3) card generation is non-fatal in the build engine; (4) generated-assets service is a publish stub until a rendering worker exists.