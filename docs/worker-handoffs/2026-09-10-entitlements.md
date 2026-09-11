# Worker Handoff — 2026-09-10

## Worker
Product / Entitlements

## Task
Implement the central entitlement system for Silver/Gold/Platinum packages with feature definitions, server-side entitlement checks, and expiry calculation using Africa/Johannesburg timezone.

## Status
COMPLETE

## Completed

### Feature Definitions (`src/lib/entitlements/features.ts`)
- 21 feature definitions across 6 categories: core, media, display, customization, expiry, entitlement
- Type-safe feature codes with validation helpers
- Feature metadata: label, description, dataType, defaultValue, sortOrder

### Package Definitions (`src/lib/entitlements/packages.ts`)
- Three packages: Silver (R599), Gold (R799), Platinum (R1099)
- Complete feature matrices per package matching MASTER_SPEC:
  - **Silver**: photos, guest_uploads, custom_qr, optional_colours, names_date, max_photos=500, upload_days=2, download_days=7
  - **Gold**: Silver + video, max_videos=10, banner, slideshow, unlimited_photos entitlement, upload_days=7, download_days=30
  - **Platinum**: Gold + intro, flipbook, qr_design_card, unlimited_videos entitlement, download_days=90
- Helper functions: packageHasFeature, getPackageIntegerFeature, packageHasUnlimited, getPackageFairUseLimit, getPackageExpiryWindows, isPackageUpgrade, getUpgradePath

### Expiry Calculation (`src/lib/entitlements/expiry.ts`)
- Business timezone: `Africa/Johannesburg` (per MASTER_SPEC)
- Wedding date treated as business date in JNB timezone
- Deadlines calculated as exclusive-end UTC timestamps
- `calculateExpiryDeadlines(weddingDate, packageCode)` returns upload/download deadlines
- Window status checks: `isUploadOpen`, `isDownloadOpen`, `getLifecycleStatusFromDeadlines`
- Deadline recalculation for wedding date changes
- Proper DST handling via Intl API

### Central Entitlement Service (`src/lib/entitlements/index.ts`)
- `resolveEntitlements()` - single entry point combining package features, wedding date, and optional overrides
- Feature check helpers: `entitlementHasFeature`, `getEntitlementIntegerFeature`, `hasFeature`
- Upload limit checks: `canUploadPhoto`, `canUploadVideo` (respects limits, entitlements, and upload window)
- Vault rendering helpers: `shouldRenderFeature`, `getExpiryDisplay`
- Admin UI helper: `getPackageFeatureSummary`

### Server-Side Entitlement Guards (`src/server/middleware/entitlements.ts`)
- `withWeddingEntitlements` / `withVaultEntitlements` - resolve entitlements from DB (joins weddings→products for package code)
- Feature guards: `withFeature`, `withUploadOpen`, `withDownloadOpen`, `withLifecycleStatus`
- Composite guards: `createUploadGuard`, `createDownloadGuard`, `createVaultRenderGuard`
- Standalone helpers: `getWeddingEntitlements`, `getVaultEntitlements`, `assertFeature`, `assertUploadOpen`, `assertDownloadOpen`
- All checks server-side; no client-side feature flag trust

### Tests (222 total, all passing)
- `packages.test.ts`: 38 tests - feature definitions, package metadata, feature matrices, upgrade logic
- `expiry.test.ts`: 36 tests - expiry calculation, timezone handling, edge cases, window status, recalculation
- `index.test.ts`: 49 tests - entitlement resolution, feature checks, upload limits, vault rendering, lifecycle transitions
- Plus existing 99 auth/tenant tests

## Files Changed

### New Files
- `src/lib/entitlements/features.ts` — Feature definitions (21 features, 6 categories)
- `src/lib/entitlements/packages.ts` — Package definitions (Silver/Gold/Platinum)
- `src/lib/entitlements/expiry.ts` — Expiry calculation with Africa/Johannesburg timezone
- `src/lib/entitlements/index.ts` — Central entitlement service
- `src/server/middleware/entitlements.ts` — Server-side entitlement guards
- `src/lib/entitlements/__tests__/packages.test.ts` — 38 tests
- `src/lib/entitlements/__tests__/expiry.test.ts` — 36 tests
- `src/lib/entitlements/__tests__/index.test.ts` — 49 tests

### Modified Files
- `src/lib/auth/errors.ts` — Added NotFoundError
- `package.json` — No new dependencies (uses existing date-fns via Intl API)

## Database Changes
None. Existing schema (`products`, `product_features`, `product_feature_values`, `expiry_rules`, `weddings`, `wedding_settings`) is used as-is. Future: add `featuresOverrides` column to `wedding_settings` for per-wedding feature customization.

## API/Contracts Changed
No HTTP API contracts changed. New internal service functions for:
- Builder: `resolveEntitlements()` to determine what to build
- Vault: `shouldRenderFeature()` for conditional UI rendering
- Media upload: `canUploadPhoto()`, `canUploadVideo()` for limit enforcement
- API routes: `withWeddingEntitlements()`, `withFeature()`, `withUploadOpen()` guards
- Lifecycle jobs: `calculateExpiryDeadlines()`, `getLifecycleStatusFromDeadlines()`

## Tests
- `npx vitest run` → 222 passed, 0 failed
- `npx tsc --noEmit` → 0 errors
- `npx eslint src/` → 0 errors, 0 warnings

## Environment Changes
None.

## Known Issues
- `wedding_settings.featuresOverrides` column not yet in schema (planned for future customization)
- Expiry calculation uses Intl API for DST handling; could be optimized with a timezone library for high-volume scenarios
- Feature overrides from wedding_settings not yet implemented (schema column pending)

## Next Worker
- **Builder**: Use `resolveEntitlements()` to determine entitled features during vault build
- **Public Vault**: Use `shouldRenderFeature()` for conditional component rendering
- **Media/Storage**: Use `canUploadPhoto()/canUploadVideo()` for upload limit enforcement
- **Payments**: Package codes (silver/gold/platinum) match product codes in DB
- **Admin**: `getPackageFeatureSummary()` for package management UI

## Decisions Required
- When to add `featuresOverrides` JSONB column to `wedding_settings` table
- Whether to cache resolved entitlements for performance (currently computed per-request)