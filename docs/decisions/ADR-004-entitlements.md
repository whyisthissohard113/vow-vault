# ADR-004 — Product Catalog and Entitlement Engine

## Status
Accepted

## Date
2026-09-10

## Context
The Wedding Memory Vault sells three packages (Silver/Gold/Platinum) with different feature entitlements. We need a central, reusable entitlement system that:
- Defines all features and packages in one place
- Calculates upload/download expiry from wedding date in Africa/Johannesburg timezone
- Provides server-side guards for API routes
- Supports feature checks for Builder, Vault, Media upload, and Admin UI
- Never relies on client-side feature flags

## Decision

### Feature Definitions as Source of Truth
- 21 features defined in `src/lib/entitlements/features.ts` with codes, labels, data types, defaults
- Categories: core (photos, guest_uploads), media (video, banner, intro), display (slideshow, flipbook), customization (custom_qr, qr_design_card, optional_colours, names_date), expiry (upload_days, download_days), entitlement (unlimited_photos, unlimited_videos)
- Each feature has a data type (boolean/integer/string/json) for validation

### Package Definitions
- Three packages matching MASTER_SPEC pricing: Silver R599, Gold R799, Platinum R1099
- Feature values stored in `product_feature_values` table (via DB)
- Gold/Platinum are supersets of Silver/Gold — implemented via JS spread operator
- "Unlimited" = commercial entitlement (fair-use limits still apply technically)

### Expiry Calculation
- Business timezone: `Africa/Johannesburg` (per MASTER_SPEC)
- Wedding date is a calendar DATE (no time) in JNB timezone
- Deadlines = wedding date + N days (exclusive end), persisted as UTC timestamps
- Silver: upload +2 days (48h), download +7 days
- Gold: upload +7 days, download +30 days
- Platinum: upload +7 days, download +90 days
- Uses Intl API for accurate DST handling

### Central Entitlement Service
- `resolveEntitlements({ packageCode, weddingDate, featureOverrides?, now? })` — single entry point
- Returns: packageCode, features, expiry deadlines, lifecycle status, uploadOpen, downloadOpen
- Feature checks: `canUploadPhoto()`, `canUploadVideo()` (enforce limits + window)
- Vault rendering: `shouldRenderFeature()` for conditional UI
- Admin: `getPackageFeatureSummary()` for package management UI

### Server-Side Guards
- `withWeddingEntitlements` / `withVaultEntitlements` — resolve from DB (join weddings→products)
- Feature guards: `withFeature()`, `withUploadOpen()`, `withDownloadOpen()`, `withLifecycleStatus()`
- Composite: `createUploadGuard()`, `createDownloadGuard()`, `createVaultRenderGuard()`
- All authorization decisions server-side; no client trust

### Testing
- 123 new tests (38 packages + 36 expiry + 49 entitlements)
- All 222 total tests passing
- TypeScript strict, ESLint clean

## Consequences

### Positive
- Single source of truth for all feature/package definitions
- Reusable across Builder, Vault, Media, API, Admin
- Server-side enforcement prevents IDOR/privilege escalation
- Timezone-correct expiry calculation with audit trail
- Extensible for future packages/features

### Trade-offs
- Entitlements resolved per-request (no caching yet)
- `featuresOverrides` column not yet in `wedding_settings` schema
- Intl API for timezone math adds small overhead

## Files
- `src/lib/entitlements/features.ts`
- `src/lib/entitlements/packages.ts`
- `src/lib/entitlements/expiry.ts`
- `src/lib/entitlements/index.ts`
- `src/server/middleware/entitlements.ts`
- `src/lib/entitlements/__tests__/*.test.ts`