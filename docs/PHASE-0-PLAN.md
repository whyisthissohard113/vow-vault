# Phase 0 — Foundation Implementation Plan

**Status:** PLANNED — Awaiting Approval  
**Estimated Effort:** 5-7 worker-days  
**Critical Path:** Infrastructure → Database → Auth/Tenancy → Tests

---

## Executive Summary

Phase 0 establishes the production foundation for Wedding Memory Vault: project scaffolding, database schema, authentication with multi-tenant isolation, background job infrastructure, storage abstraction, and comprehensive testing. Every subsequent phase depends on this work.

**Non-negotiable gates:** All test gates must pass before Phase 0 is complete. No shortcuts on tenant isolation, TypeScript strict, or idempotent job patterns.

---

## Scope

### In Scope
1. Next.js App Router project with TypeScript strict
2. PostgreSQL schema (Drizzle) — all core tables
3. Redis + BullMQ job infrastructure
4. S3/R2 storage abstraction
5. Authentication (NextAuth.js v5)
6. Multi-tenant authorization & RBAC
7. Testing infrastructure (Vitest + Playwright)
8. Docker development environment
9. CI/CD pipeline skeleton

### Out of Scope
- UI components beyond auth pages
- Payment integration (Phase 2)
- Build Engine (Phase 3)
- Guest upload flow (Phase 4)
- Marketing pages (Phase 5)

---

## Task Breakdown

### Wave 1: Project Infrastructure (DevOps + Orchestrator)

#### Task 1.1: Project Scaffolding
**Worker:** DevOps  
**Dependencies:** None  
**Estimated:** 2-3 hours

**Deliverables:**
- Next.js 14+ App Router project
- TypeScript strict mode (`tsconfig.json` with `strict: true`)
- Tailwind CSS + shadcn/ui installed
- ESLint + Prettier configured
- `src/` directory structure:
  ```
  src/
  ├── app/              # App Router pages
  ├── lib/              # Shared utilities
  │   ├── db/           # Drizzle schema & client
  │   ├── auth/         # Auth configuration
  │   ├── jobs/         # BullMQ job definitions
  │   ├── storage/      # S3/R2 abstraction
  │   ├── mail/         # Email abstraction
  │   └── utils/        # Shared helpers
  ├── server/           # Server-only code
  │   ├── services/     # Application services
  │   └── middleware/   # Auth/tenant middleware
  ├── components/       # React components
  └── types/            # Shared TypeScript types
  ```
- `.env.example` with all required variables
- `docker-compose.yml` (PostgreSQL, Redis, MinIO for dev)
- `Dockerfile` for production

**Test Gate:**
- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run lint` passes
- [ ] TypeScript strict mode enforced
- [ ] Docker compose starts all services

---

#### Task 1.2: CI/CD Pipeline
**Worker:** DevOps  
**Dependencies:** Task 1.1  
**Estimated:** 2 hours

**Deliverables:**
- GitHub Actions workflow (`.github/workflows/ci.yml`):
  - Lint → TypeCheck → Unit Tests → Integration Tests
  - Docker build verification
- Branch protection rules (documented)
- Environment variable documentation

**Test Gate:**
- [ ] CI pipeline runs on PR
- [ ] All checks must pass before merge

---

### Wave 2: Database Foundation (Database + Auth Workers)

#### Task 2.1: Drizzle Setup & Core Schema
**Worker:** Database  
**Dependencies:** Task 1.1  
**Estimated:** 4-6 hours

**Deliverables:**
- Drizzle ORM configured with PostgreSQL
- Schema files in `src/lib/db/schema/`:
  - `auth.schema.ts` — users, sessions, accounts
  - `organizations.schema.ts` — organizations, members, roles
  - `products.schema.ts` — products, features, feature_values
  - `weddings.schema.ts` — weddings, settings, vaults
  - `media.schema.ts` — memories, media, variants, processing_jobs
  - `payments.schema.ts` — orders, order_items, payments, events
  - `build.schema.ts` — build_jobs, steps
  - `expiry.schema.ts` — expiry_rules, lifecycle_events
  - `qr.schema.ts` — qr_codes, designs
  - `templates.schema.ts` — templates, fields, versions
  - `email.schema.ts` — email_jobs, events
  - `audit.schema.ts` — audit_logs
- Migration system configured (`drizzle.config.ts`)
- Initial migration generated
- Database client singleton (`src/lib/db/index.ts`)

**Key Schema Decisions:**
- All timestamps stored as UTC (`timestamp with time zone`)
- UUID primary keys for all tables
- Tenant ID (`organization_id`) on all tenant-scoped tables
- Composite unique constraints where needed
- Proper indexes for common queries

**Test Gate:**
- [ ] `drizzle-kit generate` produces valid migrations
- [ ] `drizzle-kit push` applies to dev database
- [ ] Schema matches spec requirements (all 36+ tables)
- [ ] No TypeScript errors in schema files

---

#### Task 2.2: Authentication Setup
**Worker:** Auth  
**Dependencies:** Task 2.1  
**Estimated:** 3-4 hours

**Deliverables:**
- NextAuth.js v5 configured (`src/lib/auth/config.ts`):
  - Credentials provider (email/password)
  - Session strategy: JWT with database fallback
  - Custom session callback with user ID + tenant context
- Auth API routes:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/session`
- Password hashing (bcrypt, 12 rounds)
- Session management with secure, httpOnly cookies
- CSRF protection enabled

**Test Gate:**
- [ ] User registration creates user in database
- [ ] Login returns valid session token
- [ ] Session contains user ID and organization context
- [ ] Logout invalidates session
- [ ] CSRF protection active

---

#### Task 2.3: Multi-Tenant Authorization
**Worker:** Auth  
**Dependencies:** Task 2.2  
**Estimated:** 4-5 hours

**Deliverables:**
- Tenant middleware (`src/server/middleware/tenant.ts`):
  - Extracts organization from session/request
  - Validates user belongs to organization
  - Sets tenant context for downstream
- RBAC system (`src/server/middleware/rbac.ts`):
  - Role hierarchy: PLATFORM_ADMIN > PLATFORM_SUPPORT > ORG_OWNER > ORG_ADMIN > STAFF
  - Permission matrix defined in `src/lib/auth/permissions.ts`
  - `requireRole()` middleware factory
  - `requirePermission()` middleware factory
- API route wrappers:
  - `withAuth(handler)` — requires valid session
  - `withTenant(handler)` — requires tenant context
  - `withRole(roles)(handler)` — requires specific role
  - `withPermission(perm)(handler)` — requires specific permission

**Test Gate:**
- [ ] Unauthenticated requests return 401
- [ ] Cross-tenant access returns 403
- [ ] Role hierarchy enforced correctly
- [ ] Platform admins can access any tenant
- [ ] Tenant isolation middleware blocks data leakage

---

### Wave 3: Core Services (Auth + Entitlements Workers)

#### Task 3.1: Product & Entitlement Model
**Worker:** Entitlements  
**Dependencies:** Task 2.1  
**Estimated:** 3-4 hours

**Deliverables:**
- Product seed data:
  - Silver (R599): 100 photos, no video, no slideshow, no flipbook
  - Gold (R799): unlimited photos, video, slideshow, no flipbook
  - Platinum (R1099): unlimited photos, video, slideshow, flipbook, QR cards
- Entitlement resolver (`src/server/services/entitlements.ts`):
  - `getEntitlements(productId)` — returns feature set
  - `hasFeature(entitlements, feature)` — checks if feature enabled
  - `getUploadLimit(productId)` — returns photo limit (unlimited = fair-use cap)
- Expiry calculator (`src/server/services/expiry.ts`):
  - `calculateUploadDeadline(weddingDate, productId)` — Africa/Johannesburg timezone
  - `calculateDownloadDeadline(weddingDate, productId)`
  - All deadlines exclusive end, UTC persisted
- Lifecycle state machine (`src/server/services/lifecycle.ts`):
  - States: DRAFT → BUILDING → ACTIVE → UPLOAD_CLOSED → DOWNLOAD_ONLY → EXPIRED → ARCHIVED → DELETION_PENDING → DELETED
  - `canTransition(from, to)` — validates transition
  - `getNextStates(current)` — returns allowed transitions

**Test Gate:**
- [ ] All 3 products seeded correctly
- [ ] Entitlements resolve correctly per product
- [ ] Expiry calculations use Africa/Johannesburg timezone
- [ ] Lifecycle transitions validated correctly
- [ ] Timezone edge cases handled (DST, midnight boundaries)

---

#### Task 3.2: Storage Abstraction
**Worker:** Media  
**Dependencies:** Task 1.1  
**Estimated:** 2-3 hours

**Deliverables:**
- Storage client (`src/lib/storage/index.ts`):
  - Provider-agnostic interface (S3/R2/MinIO)
  - `upload(key, body, options)` — returns object key
  - `getSignedUrl(key, expiresIn)` — returns temporary URL
  - `delete(key)` — removes object
  - `getContentType(key)` — returns MIME type
- Dev fallback to local filesystem (`src/lib/storage/local.ts`)
- Upload validation:
  - File size limits (configurable per product)
  - MIME type whitelist
  - File signature validation (not just extension)
- Safe object key generation:
  - Pattern: `{tenantId}/{weddingId}/{category}/{uuid}.{ext}`
  - No user-controlled directory traversal

**Test Gate:**
- [ ] Upload succeeds and returns valid key
- [ ] Signed URL generates and works
- [ ] File validation rejects invalid types
- [ ] Object keys prevent directory traversal
- [ ] Local dev mode works without S3

---

#### Task 3.3: Background Job Infrastructure
**Worker:** DevOps  
**Dependencies:** Task 1.1  
**Estimated:** 2-3 hours

**Deliverables:**
- Redis connection manager (`src/lib/redis.ts`)
- BullMQ queue setup (`src/lib/jobs/queues.ts`):
  - `buildQueue` — wedding builds
  - `mediaQueue` — media processing
  - `emailQueue` — transactional email
  - `expiryQueue` — lifecycle transitions
- Job base class/pattern (`src/lib/jobs/base.ts`):
  - Idempotency key support
  - Retry configuration (exponential backoff)
  - Observable state (pending, active, completed, failed)
  - Audit logging hook
- Health check endpoint (`/api/health/jobs`)

**Test Gate:**
- [ ] Queues create successfully
- [ ] Job enqueues and processes
- [ ] Idempotency prevents duplicate processing
- [ ] Failed jobs retry with backoff
- [ ] Health check returns queue status

---

### Wave 4: Integration & Testing (QA/Security + All Workers)

#### Task 4.1: Testing Infrastructure
**Worker:** QA/Security  
**Dependencies:** Tasks 1.1, 2.1  
**Estimated:** 3-4 hours

**Deliverables:**
- Vitest configuration (`vitest.config.ts`):
  - Unit test setup
  - Integration test setup (test database)
  - Coverage thresholds
- Test utilities (`src/__tests__/helpers/`):
  - `db.ts` — test database setup/teardown
  - `auth.ts` — mock sessions, test users
  - `fixtures.ts` — seed data factories
  - `assertions.ts` — custom matchers
- E2E setup (Playwright):
  - `playwright.config.ts`
  - Browser configurations
  - Test helpers
- Docker test environment (`docker-compose.test.yml`)

**Test Gate:**
- [ ] Unit tests run in <30 seconds
- [ ] Integration tests isolated per test run
- [ ] E2E tests run against local dev
- [ ] Coverage reporting works

---

#### Task 4.2: Integration Test Suite
**Worker:** QA/Security  
**Dependencies:** Tasks 2.2, 2.3, 3.1  
**Estimated:** 4-5 hours

**Deliverables:**
- Unit tests:
  - `src/__tests__/unit/entitlements.test.ts` — feature resolution
  - `src/__tests__/unit/expiry.test.ts` — deadline calculations
  - `src/__tests__/unit/lifecycle.test.ts` — state machine
  - `src/__tests__/unit/rbac.test.ts` — permission checks
- Integration tests:
  - `src/__tests__/integration/auth.test.ts` — registration, login, session
  - `src/__tests__/integration/tenant.test.ts` — isolation verification
  - `src/__tests__/integration/jobs.test.ts` — job processing
- Security tests:
  - `src/__tests__/security/idor.test.ts` — cross-tenant access attempts
  - `src/__tests__/security/privilege.test.ts` — escalation attempts
  - `src/__tests__/security/upload.test.ts` — malicious file rejection

**Test Gate:**
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Security tests pass (no vulnerabilities)
- [ ] Coverage meets thresholds (≥80% for critical paths)

---

## Dependency Graph

```
Wave 1 (Parallel)
├── Task 1.1: Project Scaffolding [DevOps]
└── Task 1.2: CI/CD [DevOps] ← depends on 1.1

Wave 2 (Parallel after Wave 1)
├── Task 2.1: Database Schema [Database] ← depends on 1.1
├── Task 2.2: Authentication [Auth] ← depends on 2.1
├── Task 2.3: Authorization [Auth] ← depends on 2.2
├── Task 3.1: Entitlements [Entitlements] ← depends on 2.1
├── Task 3.2: Storage [Media] ← depends on 1.1
└── Task 3.3: Jobs [DevOps] ← depends on 1.1

Wave 3 (After Wave 2)
├── Task 4.1: Test Infrastructure [QA] ← depends on 1.1, 2.1
└── Task 4.2: Test Suite [QA] ← depends on 2.2, 2.3, 3.1
```

---

## Inter-Worker Contracts

### Contract 1: Database Schema Export
**Provider:** Database  
**Consumers:** All  

```typescript
// src/lib/db/index.ts
export { db } from './client';
export * from './schema';
export type { User, Organization, Wedding, ... } from './schema';
```

### Contract 2: Auth Session
**Provider:** Auth  
**Consumers:** All  

```typescript
// src/lib/auth/index.ts
export interface Session {
  user: {
    id: string;
    email: string;
    name: string;
  };
  organization?: {
    id: string;
    role: OrganizationRole;
  };
}

export async function getServerSession(): Promise<Session | null>;
```

### Contract 3: Tenant Context
**Provider:** Auth  
**Consumers:** All  

```typescript
// src/server/middleware/tenant.ts
export interface TenantContext {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
}

export async function requireTenant(): Promise<TenantContext>;
```

### Contract 4: Entitlements
**Provider:** Entitlements  
**Consumers:** Builder, Vault, Frontend  

```typescript
// src/server/services/entitlements.ts
export interface Entitlements {
  maxPhotos: number | 'unlimited';
  video: boolean;
  slideshow: boolean;
  flipbook: boolean;
  qrCards: boolean;
  uploadDays: number;
  downloadDays: number;
}

export function getEntitlements(productId: string): Entitlements;
export function hasFeature(entitlements: Entitlements, feature: string): boolean;
```

### Contract 5: Expiry Service
**Provider:** Entitlements  
**Consumers:** Builder, Lifecycle  

```typescript
// src/server/services/expiry.ts
export function calculateUploadDeadline(
  weddingDate: Date, 
  productId: string
): Date; // UTC

export function calculateDownloadDeadline(
  weddingDate: Date, 
  productId: string
): Date; // UTC
```

### Contract 6: Storage
**Provider:** Media  
**Consumers:** Builder, Guest Upload  

```typescript
// src/lib/storage/index.ts
export interface StorageClient {
  upload(key: string, body: Buffer, options?: UploadOptions): Promise<string>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export function getStorageClient(): StorageClient;
```

### Contract 7: Job Queue
**Provider:** DevOps  
**Consumers:** All  

```typescript
// src/lib/jobs/queues.ts
export interface JobPayload {
  idempotencyKey: string;
  tenantId: string;
  [key: string]: unknown;
}

export async function enqueueJob(queue: string, payload: JobPayload): Promise<string>;
```

---

## Test Gates Summary

| Gate | Type | Pass Criteria |
|------|------|---------------|
| G1 | Build | `npm run build` succeeds |
| G2 | Lint | `npm run lint` passes |
| G3 | TypeCheck | `tsc --noEmit` passes |
| G4 | Docker | All services start |
| G5 | CI | Pipeline runs on PR |
| G6 | Schema | Migrations apply cleanly |
| G7 | Auth | Registration/login/session work |
| G8 | Tenant | Cross-tenant access blocked |
| G9 | RBAC | Role hierarchy enforced |
| G10 | Entitlements | All products resolve correctly |
| G11 | Expiry | Timezone calculations correct |
| G12 | Storage | Upload/validate works |
| G13 | Jobs | Idempotent processing works |
| G14 | Unit Tests | ≥80% coverage |
| G15 | Integration | All tests pass |
| G16 | Security | No vulnerabilities |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Schema changes mid-implementation | High | Lock schema after Task 2.1 review |
| Auth library version issues | Medium | Pin versions, test thoroughly |
| Timezone edge cases | High | Comprehensive expiry tests |
| Tenant isolation bugs | Critical | Security test suite mandatory |
| Job idempotency failures | High | Integration tests with duplicate submissions |

---

## Worker Assignments

| Worker | Tasks | Estimated Hours |
|--------|-------|-----------------|
| DevOps | 1.1, 1.2, 3.3 | 6-8 |
| Database | 2.1 | 4-6 |
| Auth | 2.2, 2.3 | 7-9 |
| Entitlements | 3.1 | 3-4 |
| Media | 3.2 | 2-3 |
| QA/Security | 4.1, 4.2 | 7-9 |
| **Total** | | **29-39 hours** |

---

## Definition of Done

Phase 0 is complete when:

1. ✅ All 16 test gates pass
2. ✅ All inter-worker contracts documented and implemented
3. ✅ Test coverage meets thresholds
4. ✅ Security tests pass (no critical/high vulnerabilities)
5. ✅ CI pipeline runs successfully
6. ✅ Docker development environment works
7. ✅ Handoff documents created for each worker
8. ✅ WORKER_STATUS.md updated

---

## Handoff Protocol

Each worker creates `docs/worker-handoffs/YYYY-MM-DD-<worker>-<task>.md` upon completion containing:
- Worker name
- Task description
- Status (COMPLETE/BLOCKED/PARTIAL)
- Files changed
- Database migrations run
- API/contract changes
- Test results
- Known issues
- Next worker to engage
- Decisions required

---

## Next Phase Preview

**Phase 1: Wedding Lifecycle** depends on Phase 0:
- Wedding CRUD (Builder worker)
- Wedding settings (Frontend worker)
- Wedding state machine (Entitlements worker)
- Build Engine core (Builder worker)

Phase 1 cannot begin until all Phase 0 gates pass.

---

*Plan created by Orchestrator | 2026-09-10*
