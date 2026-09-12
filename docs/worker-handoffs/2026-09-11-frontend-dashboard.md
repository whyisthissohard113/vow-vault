# Frontend Dashboard Handoff — 2026-09-11

Worker: frontend (SaaS UI) · Next.js 16.3.4 App Router · Strict TS · Tailwind v4 · Drizzle/Postgres · NextAuth v5

## Scope delivered

### Auth (`src/app/(auth)`)
- `/login` — server action `login/actions.ts` (`signIn("credentials")` → `/dashboard`) + `useActionState` form. Handles `?registered=1` and `?error=no-organization` (no tenant yet). Signed-in users redirect to `/dashboard`.
- `/register` — client form POSTs `/api/auth/register` (unchanged contract), then redirects to `/login?registered=1`.
- Shared `(auth)/layout.tsx` brand shell.

### Dashboard shell (`src/app/(dashboard)/layout.tsx` + `src/components/dashboard/dashboard-shell.tsx`)
- Server layout: `auth()` → `requireTenant()` → permission-filtered nav (`buildNav`) → passes plain nav data to the client shell. Client never decides RBAC.
- Shell: desktop sidebar + mobile sidebar, user menu with sign-out (`callbackUrl: /login`), star-badge for the active section.
- Route group wrappers: `loading.tsx`, `error.tsx`, `not-found.tsx`.

### Pages (all server components behind `guardPage(permission?)`)
- **Overview** `/dashboard` — stat cards (weddings/active/building/draft, guest uploads, guests), expiring-soon list (30-day download window, JNB deadlines via `formatDeadline`).
- **Weddings** list + detail `[id]` (couple, customer, package, settings, expiry deadlines, media, QR codes, build jobs + steps; client `BuildWeddingButton` enqueues via POST `/api/build` and polls GET `/api/build/[id]`).
- **Customers** list + detail `[id]` (weddings, orders).
- **Packages** — standalone static page using `PACKAGE_METADATA` + entitlement features/expiry windows (no DB reads).
- **Orders**, **Payments**, **Media** tables; **QR** list with generate / download-card (Platinum-gated) / revoke actions in client `qr-actions.tsx`; **Templates** and **Settings** documented stubs; **Support** stub (empty list, honestly labeled); **Account** (profile, orgs/memberships).
- **Wedding wizard** `/dashboard/weddings/new` + client `wedding-wizard.tsx` — 9 steps: intro → couple → details (POST `/api/weddings`) → package (PATCH) → customize (PATCH settings) → payment (UI demo) → build (POST `/api/build` + 2s poll; shows step badges) → preview → share (QR generate + client `qrcode` render + download). `sessionStorage` resume (`wmv:wizard:draft`). Staff (no MANAGE_WEDDING) can create the draft and are redirected to the wedding page with an explanation.

### API routes (new)
- `POST /api/weddings` — CREATE_WEDDING-gated (deviation from literal spec, recorded in ADR-008). Strict zod. Transaction inserts wedding + settings. **Guarantees a customer row** (`weddings.customer_id NOT NULL`): find-or-create by `customerEmail`, else created as `wedding-customer-{publicId}@wedding-vault.local` with name `Wedding customer` (clearly internal, never a real mailbox). `WED-{year}-{seq}` code, random `publicId`.
- `PATCH /api/weddings/[id]` — MANAGE_WEDDING-gated; updates names/date/status/settings and resolves `packageCode` → `productId`.
- `GET /api/build/[id]` — recreated (was deleted earlier); authenticated, tenant-scoped, returns `{ job, steps }` for polling. Uses the proven `TenantContext` + `RouteParams` handler pattern.

### Components / primitives
- `src/components/icons.tsx` (27 inline SVG icons), `ui/` set: button, badge, card, input, label, textarea, select, spinner, empty-state, error-state, confirm-dialog, status-badge, skeleton, page-header, stat-card, table. `cn()` in `src/lib/utils.ts` (no clsx/tailwind-merge in deps). `SessionProvider` wrapper.
- Helpers: `src/lib/format.ts`, `src/server/page-guard.ts`, `src/server/public-url.ts` (serverUrl).

### Landing
- `src/app/page.tsx` replaced with branded landing (hero, features, packages from `PACKAGE_METADATA` with R pricing, footer). Root metadata template `%s | Wedding Memory Vault`.

## Verification
- `npx tsc --noEmit` — pass.
- ESLint (`src/app`, `src/components`, `src/server/services/dashboard-service.ts`, helpers) — 0 errors, 0 warnings.
- `npm run build` — pass (28 static/dynamic routes, incl. `/login`, `/register`, `/dashboard/**`, `/api/weddings`, `/api/weddings/[id]`, `/api/build/[id]`).
- `vitest run` (DATABASE_URL local) — 316/316 pass outside build-engine; **2 pre-existing failures** in `src/server/services/__tests__/build-engine.test.ts`:
  - `enqueueBuild > creates a new build job with all steps` (beforeEach hook timeout)
  - `Pipeline Steps … > creates flipbook for Platinum package` (job stuck `pending` after `executeBuild`)
  - Proven NOT caused by this frontend work: stashing only the uncommitted `src/server/services/build-engine.ts` (QR/Generated-Assets worker) and rerunning makes both pass; HEAD version passes. The working-tree build-engine changes (synchronous `generateQrCardPng` inside `stepGenerateQRCard`, plus `ctx.result` containing a large `qrCardPngBase64`) interact badly with the test DB timing. **Owned by the QR/Generated-Assets worker — do not mark Builder green until fixed.**

## Notable fixes during this pass
- `dashboard-service.ts`: settings query filtered by `weddingId` only (schema has no org column); guest-upload count `isNotNull(media.guestSessionId)`; `BUSINESS_TIMEZONE` import restored; Promise.all count arrays indexed `[0]`; `pickBestPaymentStatus` now accepts `string[]` with a reduce seed; `listQrCodes` joins products for `packageCode`; expiring-soon rows filter on missing deadlines; settings/expiry row destructuring (arrays → `[0]`).
- `POST /api/weddings` never inserts `null` into `customerId` (schema NOT NULL).

## Decisions / deviations (see ADR-008)
- `(dashboard)` route group so URLs are `/dashboard/...` while Next allows a path segment also named `dashboard`.
- `POST /api/weddings` gated **CREATE_WEDDING** instead of MANAGE_WEDDING (wizard creates the dossier; build/manage stay MANAGE_WEDDING).
- Payment step is UI-only (no order/payment row). Real builds without a paid order fail at `verify_payment` — surfaced to the user in the wizard and build row.
- Support/templates/settings are honest stubs to keep tenant-isolated backend modules as the single source of truth.

## Suggested next steps (out of scope here)
- Media worker: media detail/preview UI when staff media management routes ship.
- Payments worker: Orders/Payments pages will light up once real PayFast order + payment rows exist.
- Admin: tenant/plan management UI in `/dashboard/settings`.