# ADR-007 — QR Codes & Generated Assets

## Status
Accepted

## Date
2026-09-11

## Context
Each wedding vault needs a scannable QR code (posters, save-the-dates, invitations) plus premium downloadable assets — a flat QR "design card" for Platinum, and eventually slideshow/flipbook exports. Scans must be safe for guests: the QR payload must never leak internal database IDs, storage credentials, or tenant identifiers, and QR codes must be revocable/expirable and stable across design changes.

## Decision
- **QR payload is a public URL only**: the encoded value is always `{NEXT_PUBLIC_APP_URL}/w/{vault.slug}` (or a `pending-{weddingId}` fallback before the vault exists). Internal UUIDs never enter the QR matrix.
- **Opaque public identifiers**: each `qr_codes` row gets an unattributable `publicId` (32 hex chars from `crypto.getRandomValues`). The publicId identifies the code to the world and never changes, even when the design or target URL changes. Internal UUIDs are never shared with guests.
- **QR service layer** (`qr-service.ts`): `createQrCode`, `getQrCode`, `getQrByPublicId`, `resolveQrDestination`, `revokeQrCode`, `listQrCodes`, `getDefaultDesign`/`getQrDesign`/`listQrDesigns`, plus PNG/DataURL/SVG raster helpers via the `qrcode` library. All org-scoped reads go through `organizationId` for tenant isolation.
- **Resolution semantics**: `resolveQrDestination` returns `{ redirectTo }` for active codes, throws `QrCodeRevokedError` for revoked codes, `QrCodeExpiredError` for expired codes, and `QrCodeNotFoundError` otherwise. The public route responds with JSON for API consumers and an HTTP 302 redirect for browsers.
- **Designs**: colors are looked up from `qr_designs` when `designId` is provided; a platform-owned default design is used otherwise. Design changes are metadata-only and never alter `publicId`.
- **Build engine integration** (steps 11/12): step 11 keeps its idempotency check (reuse existing `active` QR for the wedding) and uses `createQrCode` when absent; step 12 stays behind the `qr_design_card` entitlement and is **non-fatal** — card generation failure is logged and returns `qrCardGenerated: false` without failing the build.
- **QR card generator** (`qr-card-generator.ts`): server-side PNG composition with **sharp** + an SVG text overlay (couple names, wedding date in `Africa/Johannesburg`, default 1080×1620 poster canvas). `generateQrCardPdf` is a documented stub that returns the PNG buffer for now.
- **Generated-assets service** (`asset-generation.ts`): slideshow/flipbook "publish" stubs — a deliberate placeholder for future workers; they mark records `published` without real rendering.

## Consequences

### Positive
- Guests can scan a QR knowing it only leads to the public vault; nothing sensitive is encoded.
- `publicId` decouples the printed QR from its internals: designs can be re-themed and target URLs re-pointed without invalidating printed material.
- Revocation/expiry are server-enforced at the API layer and in the build engine's idempotency logic.
- Only two new deps (`qrcode`, `sharp`) were needed; both were already installed for the media pipeline.

### Trade-offs
- QR card PDF export is stubbed (returns PNG bytes); real vector PDF needs a PDF renderer (e.g., pdfkit/playwright) in a later phase.
- `logoKey` is accepted by the card API but not yet rendered on the card — the spec reserves space for a venue/studio logo.
- The generated-assets service only publishes records; actual slideshow/flipbook media rendering is future work.

## Files
- `src/server/services/qr-service.ts` — QR lifecycle + raster helpers
- `src/server/services/qr-card-generator.ts` — sharp + SVG card composition
- `src/server/services/asset-generation.ts` — publish stubs
- `src/app/api/qr/...` — 5 routes: `generate`, `[id]`, `[id]/card`, `resolve/[publicId]`, `designs`
- `src/server/services/__tests__/qr-service.test.ts` — integration tests (33)
- `src/server/services/build-engine.ts` — steps `generate_qr` / `generate_qr_card` wired to the new services
- `src/lib/auth/errors.ts` — QR/generated-assets error classes