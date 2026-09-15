# Worker Handoff — 2026-09-14

## Worker
QA / Security Worker (big-pickle)

## Task
Phase 14 full-system integration/QA/security audit of the shipping flow (register → login → create wedding → package → checkout/payment [owned by Payments worker] → entitlement → build → vault → QR → email → guest upload → media processing → gallery → expiry → download → archive). Fix clear, small, low-risk defects directly; report structural findings. Payments worker paths (`src/server/services/payments/`, `src/app/api/checkout/`, `src/app/api/webhooks/payments/`, UUID family `77777777`) NOT touched. No edits to `build-engine.ts`, `lifecycle/engine.ts`, `lib/entitlements/expiry.ts`, or `drizzle/*`.

## Status
COMPLETE

## Completed
- Audited 9 areas: imports/compile (tsc clean), contracts, authorization/tenant isolation, entitlements, expiry enforcement, internal-ID exposure, error handling, races/duplicates, retry/failed-job paths.
- Fixed 6 small, test-backed defects:
  1. **Guest upload/download status gates missing on media-service guest paths** (`initiateGuestUpload`, `getSignedDownloadUrlForGuest`) — public-vault already enforced `GUEST_UPLOAD_ALLOWED_WEDDING_STATUSES` / `GUEST_DOWNLOAD_ALLOWED_WEDDING_STATUSES`; the direct media guest routes bypassed them. Now `loadGuestScope` joins the wedding and returns `weddingStatus`; both guest entry points enforce the policy lists (belt-and-braces on top of deadline-derived `uploadOpen`/`downloadOpen`).
  2. **Guest fair-use count race + budget burn on failed completion** — `incrementUploadCount` was read-modify-write (concurrent completes could lose updates / exceed `maxUploads`); increment happened BEFORE object validation (failed PUT burned budget). Now atomic SQL compare-and-swap (`upload_count = upload_count + 1` guarded by `uploadCount < maxUploads`), and the increment runs only AFTER the object is verified and media moved to `processing`.
  3. **Duplicate complete not idempotent** — `completeGuestUploadByPublicId` now returns success immediately when the row already left `uploaded`, so a re-post never double-increments or re-validates (test 8b).
  4. **QR design card not entitlement-gated** — `POST /api/qr/[id]/card` required only `MANAGE_WEDDING`; now resolves wedding entitlements and asserts Platinum `qr_design_card` (silver/gold → 403).
  5. **`cleanupExpiredSessions` predicate inverted** — `gte(expiresAt, now)` marked *still-valid* sessions as expired; corrected to `lt(expiresAt, now)`. (Latent: no current caller; exposed to the next worker to wire into a cron/worker if desired.)
  6. **Guest upload routes rendered new status errors as 500** — added `ForbiddenError` → 403 (both init/complete) and `GuestUploadLimitError` → 401 (complete) mappings.
- Added 3 focused integration tests in `media-service.test.ts` (8b idempotent double-complete; 8c upload status-gate; 13 download status-gate).

## Files changed
- `src/server/services/media-service.ts` — guest status gates, wedding join in `loadGuestScope`, idempotent guest complete, fair-use increment moved post-validation.
- `src/server/services/guest-sessions.ts` — atomic `incrementUploadCount` (CAS), `cleanupExpiredSessions` `gte`→`lt` bug fix.
- `src/app/api/qr/[id]/card/route.ts` — `resolveWeddingEntitlements` + `assertFeature("qr_design_card")`.
- `src/app/api/media/guest/upload/init/route.ts` — `ForbiddenError` → 403.
- `src/app/api/media/guest/upload/[publicId]/complete/route.ts` — `ForbiddenError` → 403, `GuestUploadLimitError` → 401.
- `src/server/services/__tests__/media-service.test.ts` — 3 new tests; imported `getSignedDownloadUrlForGuest`, `validateGuestSession`.

## Database changes
- None (no schema/migration changes).

## API/contracts changed
- No endpoint/request/response shape changed. Behavior changes:
  - Guest upload init now returns 403 when the wedding is not `active` (was: allowed until deadline).
  - Guest direct download now returns 403 when the wedding is not `active`/`upload_closed` (mirrors public-vault route).
  - `POST /api/qr/[id]/card` now returns 403 for non-Platinum packages (was: generated for any `MANAGE_WEDDING`).
  - Duplicate guest upload complete is idempotent (no double count increment).
  - `incrementUploadCount` now throws `GuestUploadLimitError` at the exact boundary (no overshoot).
- Internal: `loadGuestScope` return type grows `weddingStatus` (additive, private).

## Tests
- `npx tsc --noEmit` — clean (0 errors).
- `npm run lint` — clean (0 warnings).
- `npx vitest run src/server/services/__tests__/media-service.test.ts` — **18 passed** (includes 3 new).
- `npx vitest run src/server/services/__tests__/guest-sessions.test.ts src/server/services/__tests__/public-vault.test.ts` — **30 passed** (16 + 14).
- Full suite intentionally NOT run (Payments worker is active on the same dev DB). Do not run `db:migrate` concurrently.

## Environment changes
- None.

## Known issues (report-only; NOT fixed — see notes)
- **Build enqueue race** (`build-engine.ts` enqueueBuild): select-then-insert on `idempotency_key`/`(wedding_id, version)` unique indexes → concurrent double-post can raise a unique violation (500). File is off-limits to this worker; recommend `onConflictDoNothing` + row return.
- **Guest upload init row-spam**: no idempotency key on init; every `initiateGuestUpload` creates a media row even if the PUT never happens (count only moves on complete → DB/object-handle garbage vector; no rate limit at init). Recommend an idempotency key or init → pending-cleanup.
- **`POST /api/auth/register` race**: select-then-insert; concurrent duplicate email → DB unique violation → 500 instead of 409.
- **Guest download addressing uses internal UUIDs** on `GET /api/media/[id]/download` (guest path accepts `id`, internal UUID; public routes use `publicId`). Low risk (media is re-scoped to the guest's wedding and UUIDs aren't exposed), but a guest-surface contract inconsistency — flag if strict "internal IDs never reach guest surfaces" is intended to include URL params.
- **Presigned URL render-window nuance**: public vault page signs URLs at render time (15-min TTL); a render just before `downloadDeadline` can serve URLs briefly after it. Client-clock-free but not zero-window; acceptable per design.
- **Brazilian/`expired` return value**: `getLifecycleStatusFromDeadlines` union includes `"expired"` but never returns it (post-`download_only` retention only) — intentional per Phase 13; do not "fix".
- `checkUploadRateLimit` is a documented approximation (always allows); `rate_limit`/Redis out of scope.

## Next worker
- Payments: continue PayFast + webhook idempotency (untouched here).
- Orchestrator/CTO: decide on the report-only items above (build-enqueue race, guest init idempotency, register 409, guest download publicId addressing).
- Candidate cron wiring: `cleanupExpiredSessions()` now correct; hook into a scheduler if needed.

## Decision required
- Review report-only findings above; approve/reject deferring each. No contract changes were made silently — all behavior changes above are documented in this handoff (and are consistency fixes with existing Phase 8/13 policy).