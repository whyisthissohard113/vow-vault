# Worker Handoff — 2026-09-10

## Worker
Auth/RBAC/Tenancy

## Task
Implement authentication (NextAuth.js v5), role-based access control (8 roles, 15 permissions), multi-tenant isolation middleware, guest session management, and server-side authorization guards.

## Status
COMPLETE

## Completed
- Installed next-auth@5.0.0-beta.32, bcryptjs, vitest
- Created NextAuth.js v5 configuration with Credentials provider + JWT sessions
- Implemented 8-role permission matrix with hierarchy validation
- Created tenant context extraction and validation middleware
- Built tenant-scoped query builder for all tenant-scoped tables
- Implemented guest session management with SHA-256 hashed tokens
- Created auth guard HOFs: withAuth, withTenant, withRole, withPermission
- Created 4 API route handlers: register, login (via NextAuth), logout, session
- Created type augmentation for NextAuth session/JWT
- Set up vitest with path aliases
- Wrote 99 tests across 5 test files (all passing)
- All typecheck, lint, and test validations pass

## Files Changed

### New Files
- `src/auth.ts` — NextAuth v5 configuration (Credentials provider, JWT strategy, callbacks)
- `src/types/next-auth.d.ts` — Session and JWT type augmentation
- `src/lib/auth/roles.ts` — OrganizationRole enum, hierarchy levels, scope classification, privilege escalation guards
- `src/lib/auth/permissions.ts` — 15-permission matrix, hasPermission, hasAllPermissions, hasAnyPermission
- `src/lib/auth/errors.ts` — 11 auth error classes extending AuthError/CredentialsSignin
- `src/lib/auth/constants.ts` — Auth constants (cookie options, password policy, guest defaults)
- `src/lib/auth/token-utils.ts` — Cryptographic token generation (32 bytes) and SHA-256 hashing
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth catch-all route handler
- `src/app/api/auth/register/route.ts` — POST /api/auth/register with Zod validation
- `src/app/api/auth/logout/route.ts` — POST /api/auth/logout
- `src/app/api/auth/session/route.ts` — GET /api/auth/session
- `src/server/middleware/auth.ts` — Auth guard HOFs (withAuth, withTenant, withRole, withPermission, getTenantContext)
- `src/server/middleware/tenant.ts` — TenantContext type, requireTenant(), optionalTenant(), validateTenantAccess()
- `src/server/services/guest-sessions.ts` — createGuestSession, validateGuestSession, revokeGuestSession, incrementUploadCount, checkUploadRateLimit, cleanupExpiredSessions
- `src/server/queries/tenant.ts` — tenantQuery() builder for 12 entity types, standalone findByIdAndOrg helpers
- `vitest.config.ts` — Vitest configuration with path aliases
- `src/lib/auth/__tests__/roles.test.ts` — 24 tests (hierarchy, scope classification, escalation guards)
- `src/lib/auth/__tests__/permissions.test.ts` — 27 tests (matrix completeness, role permissions, hierarchy integrity)
- `src/server/services/__tests__/guest-sessions.test.ts` — 16 tests (token generation, hashing, security properties)
- `src/server/middleware/__tests__/auth-guards.test.ts` — 23 tests (IDOR prevention, privilege escalation, cross-tenant)
- `src/server/queries/__tests__\tenant-isolation.test.ts` — 9 tests (TenantContext shape, isolation rules)

### Modified Files
- `.env` — Added NEXTAUTH_URL and NEXTAUTH_SECRET
- `package.json` — Added next-auth, bcryptjs, @types/bcryptjs, vitest; added test scripts

## Database Changes
None. Existing schema (users, organization_members, guest_sessions, vaults, vault_access) was used as-is.

## API/Contracts Changed
- `POST /api/auth/register` — Creates user account (email, password, fullName)
- `POST /api/auth/login` — Handled by NextAuth Credentials provider
- `POST /api/auth/logout` — Invalidates session cookie
- `GET /api/auth/session` — Returns current session or null
- All `/api/auth/*` routes handled by NextAuth catch-all

## Tests
- `npx vitest run` → 99 passed, 0 failed (5 test files)
- `npx tsc --noEmit` → 0 errors
- `npx eslint src/` → 0 errors, 0 warnings

## Environment Changes
- Added NEXTAUTH_URL=http://localhost:3000 to .env
- Added NEXTAUTH_SECRET (dev placeholder) to .env

## Known Issues
- JWT sessions mean role changes don't take effect until next login (acceptable for MVP; consider session refresh for production)
- Guest rate limiting uses timestamp approximation; production should use Redis sliding window
- Registration endpoint does not auto-assign users to organizations (requires separate invite flow)

## Next Worker
- Frontend: Login/register pages can now consume /api/auth/* endpoints
- Entitlements: Product/feature checks build on the RBAC permission system
- Public Vault: Guest session management is ready for vault upload flow
- Payments: Payment webhook handlers can use tenant-scoped queries

## Decisions Required
- ADR-003 documented: Auth, RBAC, and multi-tenant isolation decisions
- `platform_support` is intentionally a read-only cross-tenant role (no `CREATE_WEDDING`)
- Permission matrix is a design decision, not a strict superset hierarchy
