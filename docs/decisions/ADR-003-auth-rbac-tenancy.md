# ADR-003 — Auth, RBAC, and Multi-Tenant Isolation

## Status
Accepted

## Date
2026-09-10

## Context
The Wedding Memory Vault is a multi-tenant B2B2C SaaS. It needs:
- User authentication (email/password)
- Role-based access control with 8 distinct roles across 4 scopes
- Server-side tenant isolation for all database queries
- Guest access via temporary tokens for vault uploads
- IDOR prevention and privilege escalation guards

## Decision

### Authentication — NextAuth.js v5
- **Provider**: Credentials (email + bcrypt-hashed password)
- **Session strategy**: JWT (not database sessions)
  - Rationale: Credentials provider requires JWT; avoids extra session table queries
  - JWT carries user ID, role, organization ID, and isPlatformUser flag
  - 7-day expiry for regular users; 24-hour for guest tokens (separate system)
- **Cookie security**: httpOnly, SameSite=strict, secure in production
- **CSRF**: Built-in NextAuth double-submit cookie protection

### RBAC — Permission Matrix
- 8 roles across 4 scopes (platform, organization, couple, guest)
- 15 permissions defined in a single `PERMISSION_MATRIX` constant
- Role hierarchy uses numeric levels (10–100) for precedence checks
- `canAssignRole()` prevents privilege escalation: users can only assign roles with lower hierarchy levels
- `platform_admin` cannot be assigned through normal flows (superadmin bootstrap only)

### Tenant Isolation — Server-Side Middleware
- Every tenant-scoped query includes `organization_id` filter (enforced by `tenantQuery()` builder)
- `requireTenant()` extracts and validates TenantContext from the NextAuth session
- Platform users (`platform_admin`, `platform_support`) can access any tenant
- Org users can only access their own tenant
- Couple/guest roles are scoped to specific weddings/vaults
- IDOR prevention: single-record lookups always include both `id` AND `organization_id`

### Guest Sessions — Token-Based Access
- Cryptographically secure random tokens (32 bytes / 256 bits of entropy)
- Tokens are SHA-256 hashed before storage (one-way; raw tokens never retrievable)
- Default: 24-hour expiry, 100 upload limit
- Rate limiting: 10 uploads per minute per guest (approximate; Redis for production)
- Guest sessions are scoped to vault + organization

### Authorization Guards — HOF Pattern
- `withAuth()` — Requires valid NextAuth session
- `withTenant()` — Extracts and validates tenant context
- `withRole()` — Restricts to specific roles
- `withPermission()` — Gates on specific permission
- Guards compose: `withAuth(withTenant(withRole(["couple_owner"])(handler)))`

## Consequences
- **Positive**: All authorization decisions are server-side; UI hiding is never authorization
- **Positive**: Single source of truth for permissions (`PERMISSION_MATRIX`)
- **Positive**: Guest tokens are never stored in plaintext
- **Trade-off**: JWT sessions mean session invalidation on role changes requires token refresh
- **Trade-off**: Guest rate limiting is approximate without Redis (sufficient for MVP)
- **Risk**: `platform_support` is intentionally a read-only cross-tenant role (does NOT have `CREATE_WEDDING`); this is a design decision, not a hierarchy violation

## Files
- `src/auth.ts` — NextAuth v5 configuration
- `src/lib/auth/roles.ts` — Role definitions and hierarchy
- `src/lib/auth/permissions.ts` — Permission matrix
- `src/lib/auth/errors.ts` — Auth error classes
- `src/lib/auth/constants.ts` — Auth constants
- `src/lib/auth/token-utils.ts` — Cryptographic token utilities
- `src/server/middleware/auth.ts` — Auth guard HOFs
- `src/server/middleware/tenant.ts` — Tenant context extraction
- `src/server/services/guest-sessions.ts` — Guest session management
- `src/server/queries/tenant.ts` — Tenant-scoped query helpers
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth catch-all
- `src/app/api/auth/register/route.ts` — Registration endpoint
- `src/app/api/auth/logout/route.ts` — Logout endpoint
- `src/app/api/auth/session/route.ts` — Session endpoint
