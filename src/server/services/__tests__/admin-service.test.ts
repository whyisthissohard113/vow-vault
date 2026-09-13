/**
 * Integration tests for the Platform Admin service (`admin-service.ts`):
 * read/list/detail queries plus the lifecycle write actions (retry build/email/
 * media, suspend/unsuspend organization, suspend user, revoke guest session).
 *
 * Runs against the real dev Postgres like the other server suites. This suite
 * owns the `55555555-…` UUID family exclusively; every test inserts fixtures
 * with `onConflictDoNothing()` and cleans up exactly the rows it creates via
 * `cleanup()`, so the prefix must be zero-row in every table after the run.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq, or, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  organizations,
  users,
  organizationMembers,
  customers,
  products,
  weddings,
  vaults,
  guestSessions,
  expiryRules,
  lifecycleEvents,
  orders,
  orderItems,
  payments,
  media,
  mediaVariants,
  mediaProcessingJobs,
  buildJobs,
  buildJobSteps,
  emailJobs,
  auditLogs,
} from "@/lib/db/schema";
import { NotFoundError } from "@/lib/auth/errors";
import {
  listOrganizations,
  getOrganizationDetail,
  getUserDetail,
  listCustomers,
  getCustomerDetail,
  listWeddings,
  getWeddingDetail,
  listOrders,
  getOrderDetail,
  listPayments,
  getPaymentDetail,
  listVaults,
  getVaultDetail,
  listMedia,
  getMediaDetail,
  listBuildJobs,
  getBuildJobDetail,
  listEmailJobs,
  getEmailJobDetail,
  listLifecycleEvents,
  listAuditLogs,
  getPlatformHealth,
  getStorageOverview,
  adminRetryBuildJob,
  adminRetryEmailJob,
  adminRetryMediaProcessing,
  adminSuspendOrganization,
  adminUnsuspendOrganization,
  adminSuspendUser,
  adminRevokeGuestSession,
} from "@/server/services/admin-service";
import type { AdminContext, AdminRequestMeta } from "@/server/services/admin-service";

// ── Test identity (55555555-… family; no other suite uses this prefix) ────────

const ORG_A = "55555555-5555-5555-5555-555555555501";
const ORG_B = "55555555-5555-5555-5555-555555555502";
const ORG_PLATFORM = "55555555-5555-5555-5555-555555555503";
const ORG_CLOSED = "55555555-5555-5555-5555-555555555504";
const ORG_SUSPENDED = "55555555-5555-5555-5555-555555555505";

const USER_ADMIN = "55555555-5555-5555-5555-555555555601";
const USER_OWNER = "55555555-5555-5555-5555-555555555602";
const USER_STAFF = "55555555-5555-5555-5555-555555555603";
const USER_PLATFORM_MEMBER = "55555555-5555-5555-5555-555555555604";
const USER_SUSPENDED = "55555555-5555-5555-5555-555555555605";

const MEMBER_OWNER = "55555555-5555-5555-5555-555555555611";
const MEMBER_STAFF = "55555555-5555-5555-5555-555555555612";
const MEMBER_PLATFORM_HQ = "55555555-5555-5555-5555-555555555613";
const MEMBER_PLATFORM_USER = "55555555-5555-5555-5555-555555555614";

const CUST_A = "55555555-5555-5555-5555-555555555701";
const CUST_B = "55555555-5555-5555-5555-555555555702";

const PRODUCT_A = "55555555-5555-5555-5555-555555555721";
const PRODUCT_B = "55555555-5555-5555-5555-555555555722";

const WED_A = "55555555-5555-5555-5555-555555555731";
const WED_B = "55555555-5555-5555-5555-555555555732";

const VAULT_MAIN = "55555555-5555-5555-5555-555555555741";
const EXPIRY_MAIN = "55555555-5555-5555-5555-555555555751";

const ORDER_A = "55555555-5555-5555-5555-555555555761";
const ORDER_B = "55555555-5555-5555-5555-555555555762";
const ORDER_ITEM_A = "55555555-5555-5555-5555-555555555771";

const PAYMENT_A = "55555555-5555-5555-5555-555555555781";
const PAYMENT_B = "55555555-5555-5555-5555-555555555782";

const MEDIA_A = "55555555-5555-5555-5555-555555555791";
const MEDIA_B = "55555555-5555-5555-5555-555555555792";
const MEDIA_RETRY = "55555555-5555-5555-5555-555555555793";
const VARIANT_A = "55555555-5555-5555-5555-555555555794";
const MPJ_COMPLETED = "55555555-5555-5555-5555-555555555795";
const MPJ_RETRY_1 = "55555555-5555-5555-5555-555555555796";
const MPJ_RETRY_2 = "55555555-5555-5555-5555-555555555797";

const BUILD_FAILED = "55555555-5555-5555-5555-555555555810";
const BUILD_PENDING = "55555555-5555-5555-5555-555555555811";
const BUILD_COMPLETED = "55555555-5555-5555-5555-555555555812";
const BUILD_EXHAUSTED = "55555555-5555-5555-5555-555555555813";
const STEP_BUILD_FAILED = "55555555-5555-5555-5555-555555555820";

const EMAIL_FAILED = "55555555-5555-5555-5555-555555555830";
const EMAIL_SENT = "55555555-5555-5555-5555-555555555831";
const EMAIL_EXHAUSTED = "55555555-5555-5555-5555-555555555832";
const EMAIL_PENDING = "55555555-5555-5555-5555-555555555833";

const SESSION_ACTIVE = "55555555-5555-5555-5555-555555555840";
const SESSION_REVOKED = "55555555-5555-5555-5555-555555555841";
const SESSION_EXPIRED = "55555555-5555-5555-5555-555555555842";

const LIFECYCLE_UPLOAD = "55555555-5555-5555-5555-555555555850";
const LIFECYCLE_BUILD = "55555555-5555-5555-5555-555555555851";
const LIFECYCLE_ACTOR = "55555555-5555-5555-5555-555555555852";

const AUDIT_PAG_1 = "55555555-5555-5555-5555-555555555860";
const AUDIT_PAG_2 = "55555555-5555-5555-5555-555555555861";
const AUDIT_PAG_3 = "55555555-5555-5555-5555-555555555862";

const ALL_ORG_IDS = [ORG_A, ORG_B, ORG_PLATFORM, ORG_CLOSED, ORG_SUSPENDED];
const ALL_USER_IDS = [USER_ADMIN, USER_OWNER, USER_STAFF, USER_PLATFORM_MEMBER, USER_SUSPENDED];
const ALL_MEMBER_IDS = [MEMBER_OWNER, MEMBER_STAFF, MEMBER_PLATFORM_HQ, MEMBER_PLATFORM_USER];
const ALL_CUST_IDS = [CUST_A, CUST_B];
const ALL_PRODUCT_IDS = [PRODUCT_A, PRODUCT_B];
const ALL_WEDDING_IDS = [WED_A, WED_B];
const ALL_VAULT_IDS = [VAULT_MAIN];
const ALL_EXPIRY_IDS = [EXPIRY_MAIN];
const ALL_ORDER_IDS = [ORDER_A, ORDER_B];
const ALL_PAYMENT_IDS = [PAYMENT_A, PAYMENT_B];
const ALL_MEDIA_IDS = [MEDIA_A, MEDIA_B, MEDIA_RETRY];
const ALL_BUILD_JOB_IDS = [BUILD_FAILED, BUILD_PENDING, BUILD_COMPLETED, BUILD_EXHAUSTED];
const ALL_EMAIL_JOB_IDS = [EMAIL_FAILED, EMAIL_SENT, EMAIL_EXHAUSTED, EMAIL_PENDING];
const ALL_SESSION_IDS = [SESSION_ACTIVE, SESSION_REVOKED, SESSION_EXPIRED];
const ALL_LIFECYCLE_IDS = [LIFECYCLE_UPLOAD, LIFECYCLE_BUILD, LIFECYCLE_ACTOR];

// ── Shared admin request context ──────────────────────────────────────────────

const ADMIN_CTX: AdminContext = {
  userId: USER_ADMIN,
  role: "platform_admin",
  isPlatformUser: true,
};

const META: AdminRequestMeta = {
  ipAddress: "203.0.113.1",
  userAgent: "admin-service.test",
};

function ctxFor(userId: string): AdminContext {
  return { userId, role: "platform_admin", isPlatformUser: true };
}

// ── Fixture helpers (onConflictDoNothing → safe against leftovers) ────────────

type OrgMemberRole = (typeof organizationMembers.$inferInsert)["role"];

async function createOrg(
  id: string,
  overrides: Partial<typeof organizations.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(organizations)
    .values({
      id,
      publicId: `pub-org-${id.slice(-6)}`,
      name: `Org ${id.slice(-4)}`,
      slug: `org-${id.slice(-4)}`,
      type: "wedding_company",
      status: "active",
      timezone: "Africa/Johannesburg",
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createUser(
  id: string,
  overrides: Partial<typeof users.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(users)
    .values({
      id,
      email: `user+${id.slice(-4)}@example.com`,
      fullName: `User ${id.slice(-4)}`,
      status: "active",
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createMembership(
  id: string,
  organizationId: string,
  userId: string,
  role: OrgMemberRole,
  sortOrder: number,
  overrides: Partial<typeof organizationMembers.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(organizationMembers)
    .values({
      id,
      organizationId,
      userId,
      role,
      status: "active",
      sortOrder,
      joinedAt: new Date(),
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createCustomer(
  id: string,
  organizationId: string,
  overrides: Partial<typeof customers.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(customers)
    .values({
      id,
      organizationId,
      publicId: `pub-cust-${id.slice(-6)}`,
      fullName: `Customer ${id.slice(-4)}`,
      email: `customer+${id.slice(-4)}@example.com`,
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createProduct(
  id: string,
  organizationId: string,
  overrides: Partial<typeof products.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(products)
    .values({
      id,
      organizationId,
      code: `code-${id.slice(-4)}`,
      name: `Product ${id.slice(-4)}`,
      type: "one_time",
      priceCents: 49900,
      currency: "ZAR",
      status: "active",
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createWedding(
  id: string,
  organizationId: string,
  customerId: string,
  overrides: Partial<typeof weddings.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(weddings)
    .values({
      id,
      organizationId,
      customerId,
      publicId: `pub-wed-${id.slice(-6)}`,
      code: `WED-${id.slice(-4)}`,
      name: `Wedding ${id.slice(-4)}`,
      partnerOneName: "Partner One",
      partnerTwoName: "Partner Two",
      status: "active",
      // Far-future dates keep these fixtures inert to the GLOBAL lifecycle
      // sweep (scanLifecycleAutomation), which the email-worker suite drives
      // with simulated 2026 clocks. A reached weddingDate + 2026 deadlines
      // would enqueue reminder/warning emails during parallel runs.
      weddingDate: new Date("2029-06-01T00:00:00.000Z"),
      timezone: "Africa/Johannesburg",
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createVault(
  id: string,
  weddingId: string,
  organizationId: string,
  overrides: Partial<typeof vaults.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(vaults)
    .values({
      id,
      weddingId,
      organizationId,
      publicId: `pub-vault-${id.slice(-6)}`,
      slug: `vault-${id.slice(-4)}`,
      title: null,
      status: "published",
      isPublic: true,
      noIndex: true,
      publishedAt: new Date(),
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createExpiryRule(
  id: string,
  weddingId: string,
  organizationId: string,
  overrides: Partial<typeof expiryRules.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(expiryRules)
    .values({
      id,
      weddingId,
      organizationId,
      uploadDeadline: new Date("2029-07-01T10:00:00.000Z"),
      downloadDeadline: new Date("2029-08-01T10:00:00.000Z"),
      uploadWindowDays: 30,
      downloadWindowDays: 30,
      timezone: "Africa/Johannesburg",
      weddingDateAtCalculation: new Date("2029-06-01T00:00:00.000Z"),
      ...overrides,
    })
    .onConflictDoNothing({ target: expiryRules.weddingId });
}

async function createOrder(
  id: string,
  organizationId: string,
  customerId: string,
  productId: string,
  overrides: Partial<typeof orders.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(orders)
    .values({
      id,
      organizationId,
      customerId,
      productId,
      orderNumber: `ORD-${id.slice(-4)}`,
      status: "pending",
      subtotalCents: 0,
      discountCents: 0,
      totalCents: 0,
      currency: "ZAR",
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createOrderItem(
  id: string,
  orderId: string,
  productId: string,
  overrides: Partial<typeof orderItems.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(orderItems)
    .values({
      id,
      orderId,
      productId,
      productName: "Product",
      unitPriceCents: 0,
      quantity: 1,
      lineTotalCents: 0,
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createPayment(
  id: string,
  organizationId: string,
  orderId: string,
  overrides: Partial<typeof payments.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(payments)
    .values({
      id,
      organizationId,
      orderId,
      provider: "payfast",
      providerReference: id,
      status: "pending",
      amountCents: 100,
      currency: "ZAR",
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createMedia(
  id: string,
  weddingId: string,
  organizationId: string,
  overrides: Partial<typeof media.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(media)
    .values({
      id,
      weddingId,
      organizationId,
      publicId: `pub-media-${id.slice(-6)}`,
      storageKey: `media/${organizationId}/${id}/original.jpg`,
      filename: `media-${id.slice(-4)}.jpg`,
      contentType: "image/jpeg",
      sizeBytes: 1000,
      status: "uploaded",
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createMediaVariant(
  id: string,
  mediaId: string,
  overrides: Partial<typeof mediaVariants.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(mediaVariants)
    .values({
      id,
      mediaId,
      variantType: "thumbnail",
      storageKey: `media/${id}/variant.jpg`,
      filename: `variant-${id.slice(-4)}.jpg`,
      contentType: "image/jpeg",
      sizeBytes: 500,
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createMediaProcessingJob(
  id: string,
  mediaId: string,
  organizationId: string,
  overrides: Partial<typeof mediaProcessingJobs.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(mediaProcessingJobs)
    .values({
      id,
      mediaId,
      organizationId,
      jobType: "thumbnail",
      status: "pending",
      idempotencyKey: id,
      attempts: 0,
      maxAttempts: 3,
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createBuildJob(
  id: string,
  weddingId: string,
  organizationId: string,
  overrides: Partial<typeof buildJobs.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(buildJobs)
    .values({
      id,
      weddingId,
      organizationId,
      buildType: "vault",
      idempotencyKey: id,
      version: 1,
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      input: {},
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createBuildJobStep(
  id: string,
  buildJobId: string,
  overrides: Partial<typeof buildJobSteps.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(buildJobSteps)
    .values({
      id,
      buildJobId,
      stepKey: `step-${id.slice(-4)}`,
      stepOrder: 1,
      status: "pending",
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createEmailJob(
  id: string,
  organizationId: string,
  weddingId: string | null,
  overrides: Partial<typeof emailJobs.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(emailJobs)
    .values({
      id,
      organizationId,
      weddingId,
      emailType: "vault_ready",
      toEmail: `recipient+${id.slice(-4)}@example.com`,
      subject: "Subject",
      status: "pending",
      idempotencyKey: id,
      attempts: 0,
      maxAttempts: 3,
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createGuestSession(
  id: string,
  vaultId: string,
  organizationId: string,
  overrides: Partial<typeof guestSessions.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(guestSessions)
    .values({
      id,
      vaultId,
      organizationId,
      token: `token-${id.slice(-4)}`,
      displayName: null,
      status: "active",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      uploadCount: 0,
      maxUploads: 100,
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createLifecycleEvent(
  id: string,
  weddingId: string,
  organizationId: string,
  overrides: Partial<typeof lifecycleEvents.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(lifecycleEvents)
    .values({
      id,
      weddingId,
      organizationId,
      eventType: "created",
      fromStatus: null,
      toStatus: null,
      reason: null,
      actorUserId: null,
      occurredAt: new Date(),
      ...overrides,
    })
    .onConflictDoNothing();
}

async function createAuditLog(
  id: string,
  organizationId: string,
  actorUserId: string,
  overrides: Partial<typeof auditLogs.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(auditLogs)
    .values({
      id,
      organizationId,
      actorUserId,
      action: "manual_action",
      resourceType: "organization",
      resourceId: organizationId,
      before: null,
      after: null,
      ipAddress: null,
      userAgent: null,
      ...overrides,
    })
    .onConflictDoNothing();
}

// ── Baseline fixture set (created fresh after every cleanup) ──────────────────

async function createBaseFixtures(): Promise<void> {
  await createOrg(ORG_A, {
    name: "Wedding Company Alpha",
    slug: "wedding-alpha-5555",
    billingEmail: "billing@alpha.example",
  });
  await createOrg(ORG_B, { name: "Beta Weddings", slug: "beta-weddings-5555" });
  await createOrg(ORG_PLATFORM, {
    name: "Wedding Memory Vault Platform",
    slug: "wmv-platform-5555",
    type: "platform",
  });
  await createOrg(ORG_CLOSED, { name: "Closed Weddings", slug: "closed-weddings-5555", status: "closed" });
  await createOrg(ORG_SUSPENDED, {
    name: "Suspended Wedding Company Alpha",
    slug: "suspended-alpha-5555",
    status: "suspended",
  });

  await createUser(USER_ADMIN, { email: "admin@wmv.example", fullName: "Admin User" });
  await createUser(USER_OWNER, { email: "owner.alpha@example.com", fullName: "Owner Alpha" });
  await createUser(USER_STAFF, { email: "staff.alpha@example.com", fullName: "Staff Alpha" });
  await createUser(USER_PLATFORM_MEMBER, { email: "platform@wmv.example", fullName: "Platform Member" });
  await createUser(USER_SUSPENDED, {
    email: "suspended@alpha.example",
    fullName: "Suspended User",
    status: "suspended",
  });

  await createMembership(MEMBER_OWNER, ORG_A, USER_OWNER, "wedding_company_owner", 1);
  await createMembership(MEMBER_STAFF, ORG_A, USER_STAFF, "wedding_company_staff", 2);
  await createMembership(MEMBER_PLATFORM_HQ, ORG_PLATFORM, USER_ADMIN, "platform_admin", 1);
  await createMembership(MEMBER_PLATFORM_USER, ORG_PLATFORM, USER_PLATFORM_MEMBER, "platform_admin", 2);

  await createCustomer(CUST_A, ORG_A, { fullName: "Alice Alpha", email: "alice.alpha@example.com" });
  await createCustomer(CUST_B, ORG_B, { fullName: "Bob Beta", email: "bob.beta@example.com" });

  await createProduct(PRODUCT_A, ORG_A, { code: "silver-5555", name: "Silver Package", priceCents: 49900 });
  await createProduct(PRODUCT_B, ORG_B, { code: "gold-5555", name: "Gold Package", priceCents: 79900 });

  await createWedding(WED_A, ORG_A, CUST_A, {
    code: "WED-5555-A",
    name: "Alpha & Bob Wedding",
    partnerOneName: "Alpha",
    partnerTwoName: "Bob",
    productId: PRODUCT_A,
  });
  await createWedding(WED_B, ORG_B, CUST_B, {
    code: "WED-5555-B",
    name: "Beta & Alice Wedding",
    partnerOneName: "Beta",
    partnerTwoName: "Alice",
    productId: PRODUCT_B,
    weddingDate: new Date("2026-12-01T00:00:00.000Z"),
  });

  await createVault(VAULT_MAIN, WED_A, ORG_A, {
    slug: "vault-alpha-5555",
    title: "Alpha & Bob Memories",
  });

  await createExpiryRule(EXPIRY_MAIN, WED_A, ORG_A);

  await createOrder(ORDER_A, ORG_A, CUST_A, PRODUCT_A, {
    orderNumber: "ORD-5555-0001",
    status: "paid",
    subtotalCents: 49900,
    totalCents: 49900,
    placedAt: new Date("2026-06-10T09:00:00.000Z"),
    paidAt: new Date("2026-06-10T10:00:00.000Z"),
  });
  await createOrder(ORDER_B, ORG_A, CUST_A, PRODUCT_B, {
    orderNumber: "ORD-5555-0002",
    status: "pending",
    subtotalCents: 79900,
    totalCents: 79900,
    placedAt: new Date("2026-06-11T09:00:00.000Z"),
  });

  await createOrderItem(ORDER_ITEM_A, ORDER_A, PRODUCT_A, {
    productName: "Silver Package",
    unitPriceCents: 49900,
    lineTotalCents: 49900,
  });

  await createPayment(PAYMENT_A, ORG_A, ORDER_A, {
    provider: "payfast",
    providerReference: "pf-5555-0001",
    status: "completed",
    amountCents: 49900,
    paidAt: new Date("2026-06-10T10:05:00.000Z"),
  });
  await createPayment(PAYMENT_B, ORG_A, ORDER_B, {
    provider: "paystack",
    providerReference: "pf-5555-0002",
    status: "pending",
    amountCents: 79900,
  });

  await createMedia(MEDIA_A, WED_A, ORG_A, {
    storageKey: `media/${ORG_A}/${MEDIA_A}/original.jpg`,
    filename: "ceremony-5555.jpg",
    contentType: "image/jpeg",
    sizeBytes: 123456,
    status: "processed",
    width: 1200,
    height: 800,
  });
  await createMedia(MEDIA_B, WED_A, ORG_A, {
    storageKey: `media/${ORG_A}/${MEDIA_B}/original.mp4`,
    filename: "reception-5555.mp4",
    contentType: "video/mp4",
    sizeBytes: 654321,
    status: "processing",
    durationMs: 9000,
  });
  await createMedia(MEDIA_RETRY, WED_A, ORG_A, {
    storageKey: `media/${ORG_A}/${MEDIA_RETRY}/original.mp4`,
    filename: "speeches-5555.mp4",
    contentType: "video/mp4",
    sizeBytes: 999999,
    status: "failed",
    durationMs: 5000,
  });

  await createMediaVariant(VARIANT_A, MEDIA_A, {
    variantType: "thumbnail",
    storageKey: `media/${MEDIA_A}/variant-thumb.jpg`,
    filename: "thumb-ceremony-5555.jpg",
    contentType: "image/jpeg",
    sizeBytes: 2048,
    width: 320,
    height: 213,
  });

  await createMediaProcessingJob(MPJ_COMPLETED, MEDIA_A, ORG_A, {
    jobType: "thumbnail",
    status: "completed",
    idempotencyKey: "mpj-completed-5555",
    attempts: 1,
    completedAt: new Date(),
  });
  await createMediaProcessingJob(MPJ_RETRY_1, MEDIA_RETRY, ORG_A, {
    jobType: "thumbnail",
    status: "failed",
    idempotencyKey: "mpj-retry-1-5555",
    attempts: 2,
    maxAttempts: 3,
    errorMessage: "transcode timeout",
  });
  await createMediaProcessingJob(MPJ_RETRY_2, MEDIA_RETRY, ORG_A, {
    jobType: "optimize",
    status: "failed",
    idempotencyKey: "mpj-retry-2-5555",
    attempts: 3,
    maxAttempts: 3,
    errorMessage: "disk full",
  });

  await createBuildJob(BUILD_FAILED, WED_A, ORG_A, {
    idempotencyKey: "build-failed-5555",
    version: 1,
    status: "failed",
    attempts: 2,
    maxAttempts: 3,
    errorMessage: "Timeout while rendering slides",
    startedAt: new Date("2026-07-01T08:00:00.000Z"),
    completedAt: new Date("2026-07-01T08:05:00.000Z"),
  });
  await createBuildJob(BUILD_PENDING, WED_A, ORG_A, {
    idempotencyKey: "build-pending-5555",
    version: 2,
    status: "pending",
  });
  await createBuildJob(BUILD_COMPLETED, WED_A, ORG_A, {
    idempotencyKey: "build-completed-5555",
    version: 3,
    status: "completed",
    attempts: 1,
    completedAt: new Date(),
    result: { vaultId: VAULT_MAIN },
  });
  await createBuildJob(BUILD_EXHAUSTED, WED_A, ORG_A, {
    idempotencyKey: "build-exhausted-5555",
    version: 4,
    status: "failed",
    attempts: 3,
    maxAttempts: 3,
    errorMessage: "Permanent failure",
  });

  await createBuildJobStep(STEP_BUILD_FAILED, BUILD_FAILED, {
    stepKey: "render",
    stepOrder: 1,
    status: "failed",
    errorMessage: "Timeout",
  });

  await createEmailJob(EMAIL_FAILED, ORG_A, WED_A, {
    emailType: "build_failure",
    toEmail: "owner.alpha@example.com",
    toName: "Owner Alpha",
    subject: "Build failed",
    status: "failed",
    idempotencyKey: "email-failed-5555",
    attempts: 2,
    maxAttempts: 3,
    errorMessage: "SMTP relay denied",
  });
  await createEmailJob(EMAIL_SENT, ORG_A, WED_A, {
    emailType: "vault_ready",
    toEmail: "owner.alpha@example.com",
    subject: "Vault ready",
    status: "sent",
    idempotencyKey: "email-sent-5555",
    attempts: 1,
    sentAt: new Date("2026-06-10T10:10:00.000Z"),
    providerMessageId: "pf-5555-msg",
  });
  await createEmailJob(EMAIL_EXHAUSTED, ORG_A, WED_A, {
    emailType: "build_failure",
    toEmail: "owner.alpha@example.com",
    subject: "Build failed",
    status: "failed",
    idempotencyKey: "email-exhausted-5555",
    attempts: 3,
    maxAttempts: 3,
    errorMessage: "Permanent failure",
  });
  await createEmailJob(EMAIL_PENDING, ORG_A, WED_A, {
    emailType: "reminder_upload",
    toEmail: "owner.alpha@example.com",
    subject: "Upload reminder",
    status: "pending",
    idempotencyKey: "email-pending-5555",
  });

  await createGuestSession(SESSION_ACTIVE, VAULT_MAIN, ORG_A, {
    token: "tok-active-5555",
    displayName: "Auntie Grace",
    status: "active",
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    lastUsedAt: new Date(),
    uploadCount: 2,
    maxUploads: 100,
    ipAddress: "192.0.2.10",
  });
  await createGuestSession(SESSION_REVOKED, VAULT_MAIN, ORG_A, {
    token: "tok-revoked-5555",
    displayName: "Uncle Joe",
    status: "revoked",
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    uploadCount: 1,
  });
  await createGuestSession(SESSION_EXPIRED, VAULT_MAIN, ORG_A, {
    token: "tok-expired-5555",
    status: "expired",
    expiresAt: new Date("2026-01-01T00:00:00.000Z"),
  });

  await createLifecycleEvent(LIFECYCLE_UPLOAD, WED_A, ORG_A, {
    eventType: "upload_deadline_reached",
    fromStatus: "active",
    toStatus: "upload_closed",
    occurredAt: new Date("2026-07-01T10:00:00.000Z"),
  });
  await createLifecycleEvent(LIFECYCLE_BUILD, WED_A, ORG_A, {
    eventType: "build_completed",
    occurredAt: new Date("2026-07-02T10:00:00.000Z"),
  });
  await createLifecycleEvent(LIFECYCLE_ACTOR, WED_A, ORG_A, {
    eventType: "payment_verified",
    actorUserId: USER_OWNER,
    occurredAt: new Date("2026-07-03T10:00:00.000Z"),
  });
}

async function createAuditFixtures(): Promise<void> {
  await createAuditLog(AUDIT_PAG_1, ORG_B, USER_ADMIN, {
    action: "manual_bulk_update",
    resourceType: "customer",
    resourceId: CUST_B,
    createdAt: new Date("2026-06-01T10:00:00.000Z"),
  });
  await createAuditLog(AUDIT_PAG_2, ORG_B, USER_ADMIN, {
    action: "manual_bulk_update",
    resourceType: "customer",
    resourceId: CUST_B,
    createdAt: new Date("2026-06-02T10:00:00.000Z"),
  });
  await createAuditLog(AUDIT_PAG_3, ORG_B, USER_ADMIN, {
    action: "organization_edited",
    resourceType: "organization",
    resourceId: ORG_B,
    ipAddress: "203.0.113.9",
    userAgent: "test-agent",
    createdAt: new Date("2026-06-03T10:00:00.000Z"),
  });
}

// ── Cleanup: delete exactly the rows this suite may create ───────────────────

async function cleanup(): Promise<void> {
  await db
    .delete(auditLogs)
    .where(
      or(
        eq(auditLogs.actorUserId, USER_ADMIN),
        inArray(auditLogs.organizationId, ALL_ORG_IDS),
      ),
    );
  await db.delete(emailJobs).where(inArray(emailJobs.id, ALL_EMAIL_JOB_IDS));
  await db.delete(buildJobSteps).where(inArray(buildJobSteps.buildJobId, ALL_BUILD_JOB_IDS));
  await db.delete(buildJobs).where(inArray(buildJobs.id, ALL_BUILD_JOB_IDS));
  await db.delete(mediaVariants).where(inArray(mediaVariants.mediaId, ALL_MEDIA_IDS));
  await db.delete(mediaProcessingJobs).where(inArray(mediaProcessingJobs.mediaId, ALL_MEDIA_IDS));
  await db.delete(media).where(inArray(media.id, ALL_MEDIA_IDS));
  await db.delete(guestSessions).where(inArray(guestSessions.id, ALL_SESSION_IDS));
  await db.delete(vaults).where(inArray(vaults.id, ALL_VAULT_IDS));
  await db.delete(expiryRules).where(inArray(expiryRules.id, ALL_EXPIRY_IDS));
  await db.delete(lifecycleEvents).where(inArray(lifecycleEvents.id, ALL_LIFECYCLE_IDS));
  await db.delete(orderItems).where(inArray(orderItems.orderId, ALL_ORDER_IDS));
  await db.delete(payments).where(inArray(payments.id, ALL_PAYMENT_IDS));
  await db.delete(orders).where(inArray(orders.id, ALL_ORDER_IDS));
  await db.delete(products).where(inArray(products.id, ALL_PRODUCT_IDS));
  await db.delete(weddings).where(inArray(weddings.id, ALL_WEDDING_IDS));
  await db.delete(customers).where(inArray(customers.id, ALL_CUST_IDS));
  await db.delete(organizationMembers).where(inArray(organizationMembers.id, ALL_MEMBER_IDS));
  await db.delete(users).where(inArray(users.id, ALL_USER_IDS));
  await db.delete(organizations).where(inArray(organizations.id, ALL_ORG_IDS));
}

// ── Small helpers ────────────────────────────────────────────────────────────

async function countAuditRows(action: string): Promise<number> {
  const rows = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, action),
        or(
          eq(auditLogs.actorUserId, USER_ADMIN),
          inArray(auditLogs.organizationId, ALL_ORG_IDS),
        ),
      ),
    );
  return rows.length;
}

async function getAuditRowsFor(action: string, resourceId: string) {
  return db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.action, action), eq(auditLogs.resourceId, resourceId)));
}

function beforeEachBase(): void {
  beforeEach(async () => {
    await cleanup();
    await createBaseFixtures();
  });
  afterEach(cleanup);
}

// ── Reads: Organizations ──────────────────────────────────────────────────────

describe("admin service: listOrganizations", () => {
  beforeEachBase();

  it("filters by search (name/slug/billing email/public id) case-insensitively", async () => {
    const res = await listOrganizations({ search: "Wedding Company Alpha" });
    expect(res.total).toBe(2);
    const ids = res.items.map((o) => o.id).sort();
    expect(ids).toEqual([ORG_A, ORG_SUSPENDED].sort());

    const lower = await listOrganizations({ search: "wedding company alpha" });
    expect(lower.total).toBe(2);
  });

  it("combines search with a status filter", async () => {
    const res = await listOrganizations({ search: "Wedding Company Alpha", status: "active" });
    expect(res.total).toBe(1);
    expect(res.items[0]?.id).toBe(ORG_A);

    const closed = await listOrganizations({ status: "closed" });
    expect(closed.total).toBe(1);
    expect(closed.items[0]?.id).toBe(ORG_CLOSED);
  });

  it("matches on slug and billing email", async () => {
    const bySlug = await listOrganizations({ search: "wedding-alpha-5555" });
    expect(bySlug.total).toBe(1);
    expect(bySlug.items[0]?.id).toBe(ORG_A);

    const byBilling = await listOrganizations({ search: "billing@alpha.example" });
    expect(byBilling.total).toBe(1);
    expect(byBilling.items[0]?.id).toBe(ORG_A);
  });

  it("paginates and clamps page/pageSize", async () => {
    const page2 = await listOrganizations({
      page: 2,
      pageSize: 1,
      search: "Wedding Company Alpha",
    });
    expect(page2.total).toBe(2);
    expect(page2.page).toBe(2);
    expect(page2.pageSize).toBe(1);
    expect(page2.items).toHaveLength(1);

    const clamped = await listOrganizations({
      page: -1,
      pageSize: 500,
      search: "Wedding Company Alpha",
    });
    expect(clamped.page).toBe(1);
    expect(clamped.pageSize).toBe(100);
    expect(clamped.items).toHaveLength(2);
  });

  it("derives memberCount and weddingCount per tenant", async () => {
    const res = await listOrganizations({ search: "Wedding Company Alpha", status: "active" });
    const orgA = res.items.find((o) => o.id === ORG_A);
    expect(orgA).toBeDefined();
    expect(orgA?.memberCount).toBe(2);
    expect(orgA?.weddingCount).toBe(1);
    expect(orgA?.billingEmail).toBe("billing@alpha.example");
    expect(orgA?.timezone).toBe("Africa/Johannesburg");
    expect(orgA?.type).toBe("wedding_company");
  });

  it("returns timestamps as ISO strings", async () => {
    const res = await listOrganizations({ search: "Wedding Company Alpha", status: "active" });
    expect(res.items[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.items[0]?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("admin service: getOrganizationDetail", () => {
  beforeEachBase();

  it("returns org fields with members sorted by sortOrder", async () => {
    const detail = await getOrganizationDetail(ORG_A);
    expect(detail.name).toBe("Wedding Company Alpha");
    expect(detail.slug).toBe("wedding-alpha-5555");
    expect(detail.status).toBe("active");
    expect(detail.billingEmail).toBe("billing@alpha.example");
    expect(detail.memberCount).toBe(2);
    expect(detail.weddingCount).toBe(1);

    const memberIds = detail.members.map((m) => m.userId);
    expect(memberIds).toEqual([USER_OWNER, USER_STAFF]);
    expect(detail.members[0]).toMatchObject({
      role: "wedding_company_owner",
      status: "active",
      userEmail: "owner.alpha@example.com",
      userName: "Owner Alpha",
    });
  });

  it("computes orderCount/paidRevenueCents from completed payments only", async () => {
    const detail = await getOrganizationDetail(ORG_A);
    expect(detail.orderCount).toBe(1);
    expect(detail.paidRevenueCents).toBe(49900);

    // ORG_B has a customer/product/wedding but no payments yet.
    const beta = await getOrganizationDetail(ORG_B);
    expect(beta.orderCount).toBe(0);
    expect(beta.paidRevenueCents).toBe(0);
    expect(beta.memberCount).toBe(0);
    expect(beta.weddingCount).toBe(1);
  });

  it("throws NotFoundError for unknown or malformed ids", async () => {
    await expect(getOrganizationDetail(randomUUID())).rejects.toThrow(NotFoundError);
    await expect(getOrganizationDetail("not-a-uuid")).rejects.toThrow(NotFoundError);
  });
});

// ── Reads: Users ──────────────────────────────────────────────────────────────

describe("admin service: getUserDetail", () => {
  beforeEachBase();

  it("returns the user with their active memberships and org names", async () => {
    const detail = await getUserDetail(USER_ADMIN);
    expect(detail.email).toBe("admin@wmv.example");
    expect(detail.fullName).toBe("Admin User");
    expect(detail.status).toBe("active");
    expect(detail.memberships).toHaveLength(1);
    expect(detail.memberships[0]).toMatchObject({
      organizationId: ORG_PLATFORM,
      organizationName: "Wedding Memory Vault Platform",
      role: "platform_admin",
      membershipStatus: "active",
    });
  });

  it("lists a tenant owner with their wedding-company membership", async () => {
    const detail = await getUserDetail(USER_OWNER);
    expect(detail.email).toBe("owner.alpha@example.com");
    expect(detail.memberships).toHaveLength(1);
    expect(detail.memberships[0]).toMatchObject({
      organizationId: ORG_A,
      organizationName: "Wedding Company Alpha",
      role: "wedding_company_owner",
    });
  });

  it("throws NotFoundError for unknown or malformed ids", async () => {
    await expect(getUserDetail(randomUUID())).rejects.toThrow(NotFoundError);
    await expect(getUserDetail("nope")).rejects.toThrow(NotFoundError);
  });
});

// ── Reads: Customers ──────────────────────────────────────────────────────────

describe("admin service: listCustomers", () => {
  beforeEachBase();

  it("filters by organization", async () => {
    const res = await listCustomers({ organizationId: ORG_A });
    expect(res.total).toBe(1);
    expect(res.items[0]?.id).toBe(CUST_A);
    expect(res.items[0]?.organizationName).toBe("Wedding Company Alpha");
    expect(res.items[0]?.fullName).toBe("Alice Alpha");
  });

  it("searches by full name, email and public id", async () => {
    const byName = await listCustomers({ search: "Alice Alpha" });
    expect(byName.total).toBe(1);
    expect(byName.items[0]?.id).toBe(CUST_A);

    const byEmail = await listCustomers({ search: "bob.beta@example.com" });
    expect(byEmail.total).toBe(1);
    expect(byEmail.items[0]?.id).toBe(CUST_B);

    const byPublicId = await listCustomers({ search: "pub-cust-555701" });
    expect(byPublicId.total).toBe(1);
    expect(byPublicId.items[0]?.id).toBe(CUST_A);
  });

  it("counts every order for the customer (regardless of status)", async () => {
    const res = await listCustomers({ organizationId: ORG_A });
    expect(res.items[0]?.orderCount).toBe(2);
  });

  it("returns an empty list for an org without customers", async () => {
    const res = await listCustomers({ organizationId: ORG_PLATFORM });
    expect(res.total).toBe(0);
    expect(res.items).toHaveLength(0);
  });
});

describe("admin service: getCustomerDetail", () => {
  beforeEachBase();

  it("returns all-order orderCount, paid-only totalSpent and the order list", async () => {
    const detail = await getCustomerDetail(CUST_A);
    expect(detail.fullName).toBe("Alice Alpha");
    expect(detail.organizationName).toBe("Wedding Company Alpha");
    // Parity with listCustomers: orderCount counts ALL orders (paid + unpaid);
    // totalSpentCents stays paid-only.
    expect(detail.orderCount).toBe(2);
    expect(detail.totalSpentCents).toBe(49900);
    expect(detail.orders).toHaveLength(2);

    const paid = detail.orders.find((o) => o.id === ORDER_A);
    expect(paid).toMatchObject({
      orderNumber: "ORD-5555-0001",
      status: "paid",
      totalCents: 49900,
      productName: "Silver Package",
    });
    expect(paid?.placedAt).not.toBeNull();

    const pending = detail.orders.find((o) => o.id === ORDER_B);
    expect(pending?.status).toBe("pending");
    expect(pending?.productName).toBe("Gold Package");
  });

  it("reports zero totals for a customer without paid orders", async () => {
    const detail = await getCustomerDetail(CUST_B);
    expect(detail.orders).toHaveLength(0);
    expect(detail.orderCount).toBe(0);
    expect(detail.totalSpentCents).toBe(0);
  });

  it("throws NotFoundError for unknown or malformed ids", async () => {
    await expect(getCustomerDetail(randomUUID())).rejects.toThrow(NotFoundError);
    await expect(getCustomerDetail("bogus")).rejects.toThrow(NotFoundError);
  });
});

// ── Reads: Weddings ───────────────────────────────────────────────────────────

describe("admin service: listWeddings", () => {
  beforeEachBase();

  it("filters by organization including joined org/customer/product names", async () => {
    const res = await listWeddings({ organizationId: ORG_A });
    expect(res.total).toBe(1);
    const row = res.items[0];
    expect(row).toBeDefined();
    expect(row?.id).toBe(WED_A);
    expect(row?.organizationName).toBe("Wedding Company Alpha");
    expect(row?.customerName).toBe("Alice Alpha");
    expect(row?.productName).toBe("Silver Package");
    expect(row?.weddingDate).toBe("2029-06-01");
  });

  it("supports status and search filters", async () => {
    const byStatus = await listWeddings({ organizationId: ORG_A, status: "active" });
    expect(byStatus.total).toBe(1);

    const bySearch = await listWeddings({ search: "Beta & Alice" });
    expect(bySearch.total).toBe(1);
    expect(bySearch.items[0]?.id).toBe(WED_B);
  });

  it("respects an empty tenant scope", async () => {
    const res = await listWeddings({ organizationId: ORG_PLATFORM });
    expect(res.total).toBe(0);
  });

  it("returns ISO timestamps", async () => {
    const res = await listWeddings({ organizationId: ORG_A });
    expect(res.items[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("admin service: getWeddingDetail", () => {
  beforeEachBase();

  it("shows the full wedding dossier with linked counts", async () => {
    const detail = await getWeddingDetail(WED_A);
    expect(detail.organizationName).toBe("Wedding Company Alpha");
    expect(detail.customerName).toBe("Alice Alpha");
    expect(detail.productName).toBe("Silver Package");
    expect(detail.status).toBe("active");
    expect(detail.weddingDate).toBe("2029-06-01");
    expect(detail.timezone).toBe("Africa/Johannesburg");

    expect(detail.vaults).toHaveLength(1);
    expect(detail.vaults[0]).toMatchObject({ id: VAULT_MAIN, slug: "vault-alpha-5555", status: "published", isPublic: true });

    expect(detail.expiryRules).toHaveLength(1);
    expect(detail.expiryRules[0]?.uploadWindowDays).toBe(30);
    expect(detail.expiryRules[0]?.downloadWindowDays).toBe(30);
    expect(detail.expiryRules[0]?.uploadDeadline).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(detail.mediaCount).toBe(3);
    expect(detail.guestSessionCount).toBe(3);
    expect(detail.buildJobCount).toBe(4);
  });

  it("throws NotFoundError for unknown or malformed ids", async () => {
    await expect(getWeddingDetail(randomUUID())).rejects.toThrow(NotFoundError);
    await expect(getWeddingDetail("nope")).rejects.toThrow(NotFoundError);
  });
});

// ── Reads: Orders ─────────────────────────────────────────────────────────────

describe("admin service: listOrders", () => {
  beforeEachBase();

  it("filters by organization with joined names", async () => {
    const res = await listOrders({ organizationId: ORG_A });
    expect(res.total).toBe(2);
    const ids = res.items.map((o) => o.id).sort();
    expect(ids).toEqual([ORDER_A, ORDER_B].sort());
    expect(res.items[0]?.organizationName).toBe("Wedding Company Alpha");
    expect(res.items[0]?.customerName).toBe("Alice Alpha");
  });

  it("filters by status", async () => {
    const paid = await listOrders({ organizationId: ORG_A, status: "paid" });
    expect(paid.total).toBe(1);
    expect(paid.items[0]?.id).toBe(ORDER_A);

    const pending = await listOrders({ organizationId: ORG_A, status: "pending" });
    expect(pending.total).toBe(1);
    expect(pending.items[0]?.id).toBe(ORDER_B);
  });

  it("searches by order number and customer email", async () => {
    const byNumber = await listOrders({ organizationId: ORG_A, search: "ORD-5555-0001" });
    expect(byNumber.total).toBe(1);
    expect(byNumber.items[0]?.id).toBe(ORDER_A);

    const byEmail = await listOrders({ organizationId: ORG_A, search: "alice.alpha" });
    expect(byEmail.total).toBe(2);
  });

  it("returns an empty result for an org with no orders", async () => {
    const res = await listOrders({ organizationId: ORG_B });
    expect(res.total).toBe(0);
  });
});

describe("admin service: getOrderDetail", () => {
  beforeEachBase();

  it("returns order with items and payments", async () => {
    const detail = await getOrderDetail(ORDER_A);
    expect(detail.orderNumber).toBe("ORD-5555-0001");
    expect(detail.status).toBe("paid");
    expect(detail.totalCents).toBe(49900);
    expect(detail.currency).toBe("ZAR");
    expect(detail.customerName).toBe("Alice Alpha");
    expect(detail.customerEmail).toBe("alice.alpha@example.com");

    expect(detail.items).toHaveLength(1);
    expect(detail.items[0]).toMatchObject({
      productName: "Silver Package",
      unitPriceCents: 49900,
      quantity: 1,
      lineTotalCents: 49900,
    });

    expect(detail.payments).toHaveLength(1);
    expect(detail.payments[0]).toMatchObject({
      id: PAYMENT_A,
      status: "completed",
      amountCents: 49900,
    });
    expect(detail.payments[0]?.paidAt).not.toBeNull();
  });

  it("returns empty items for a pending order with its payment", async () => {
    const detail = await getOrderDetail(ORDER_B);
    expect(detail.status).toBe("pending");
    expect(detail.items).toHaveLength(0);
    expect(detail.payments).toHaveLength(1);
    expect(detail.payments[0]?.status).toBe("pending");
    expect(detail.paidAt).toBeNull();
  });

  it("throws NotFoundError for unknown or malformed ids", async () => {
    await expect(getOrderDetail(randomUUID())).rejects.toThrow(NotFoundError);
    await expect(getOrderDetail("x")).rejects.toThrow(NotFoundError);
  });
});

// ── Reads: Payments ───────────────────────────────────────────────────────────

describe("admin service: listPayments", () => {
  beforeEachBase();

  it("filters by organization with joined order/customer info", async () => {
    const res = await listPayments({ organizationId: ORG_A });
    expect(res.total).toBe(2);
    const ids = res.items.map((p) => p.id).sort();
    expect(ids).toEqual([PAYMENT_A, PAYMENT_B].sort());
    expect(res.items[0]?.orderNumber).toMatch(/^ORD-5555-/);
    expect(res.items[0]?.customerEmail).toBe("alice.alpha@example.com");
  });

  it("filters by status", async () => {
    const completed = await listPayments({ organizationId: ORG_A, status: "completed" });
    expect(completed.total).toBe(1);
    expect(completed.items[0]?.id).toBe(PAYMENT_A);

    const pending = await listPayments({ organizationId: ORG_A, status: "pending" });
    expect(pending.total).toBe(1);
    expect(pending.items[0]?.id).toBe(PAYMENT_B);
  });

  it("searches by provider reference, order number and customer email", async () => {
    const byRef = await listPayments({ organizationId: ORG_A, search: "pf-5555-0002" });
    expect(byRef.total).toBe(1);
    expect(byRef.items[0]?.id).toBe(PAYMENT_B);

    const byOrder = await listPayments({ organizationId: ORG_A, search: "ORD-5555-0001" });
    expect(byOrder.total).toBe(1);
    expect(byOrder.items[0]?.id).toBe(PAYMENT_A);

    const byEmail = await listPayments({ organizationId: ORG_A, search: "alice.alpha" });
    expect(byEmail.total).toBe(2);
  });

  it("returns an empty result for an org with no payments", async () => {
    const res = await listPayments({ organizationId: ORG_B });
    expect(res.total).toBe(0);
  });
});

describe("admin service: getPaymentDetail", () => {
  beforeEachBase();

  it("returns full payment detail for a completed payment", async () => {
    const detail = await getPaymentDetail(PAYMENT_A);
    expect(detail.provider).toBe("payfast");
    expect(detail.providerReference).toBe("pf-5555-0001");
    expect(detail.status).toBe("completed");
    expect(detail.amountCents).toBe(49900);
    expect(detail.currency).toBe("ZAR");
    expect(detail.orderNumber).toBe("ORD-5555-0001");
    expect(detail.customerEmail).toBe("alice.alpha@example.com");
    expect(detail.paidAt).not.toBeNull();
    expect(detail.failureReason).toBeNull();
    expect(detail.refundAmountCents).toBeNull();
    expect(detail.refundReason).toBeNull();
  });

  it("returns a pending payment without paidAt", async () => {
    const detail = await getPaymentDetail(PAYMENT_B);
    expect(detail.status).toBe("pending");
    expect(detail.paidAt).toBeNull();
    expect(detail.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("throws NotFoundError for unknown or malformed ids", async () => {
    await expect(getPaymentDetail(randomUUID())).rejects.toThrow(NotFoundError);
    await expect(getPaymentDetail("bad")).rejects.toThrow(NotFoundError);
  });
});

// ── Reads: Vaults ─────────────────────────────────────────────────────────────

describe("admin service: listVaults", () => {
  beforeEachBase();

  it("lists vaults with joined wedding/org info", async () => {
    const res = await listVaults({ organizationId: ORG_A });
    expect(res.total).toBe(1);
    const row = res.items[0];
    expect(row?.id).toBe(VAULT_MAIN);
    expect(row?.weddingCode).toBe("WED-5555-A");
    expect(row?.weddingName).toBe("Alpha & Bob Wedding");
    expect(row?.organizationName).toBe("Wedding Company Alpha");
    expect(row?.title).toBe("Alpha & Bob Memories");
    expect(row?.status).toBe("published");
    expect(row?.isPublic).toBe(true);
    expect(row?.noIndex).toBe(true);
  });

  it("filters by status", async () => {
    const published = await listVaults({ organizationId: ORG_A, status: "published" });
    expect(published.total).toBe(1);
    const draft = await listVaults({ organizationId: ORG_A, status: "draft" });
    expect(draft.total).toBe(0);
  });

  it("paginates and clamps page/pageSize", async () => {
    const res = await listVaults({ organizationId: ORG_A, page: 1, pageSize: 1 });
    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);

    const clamped = await listVaults({ organizationId: ORG_A, page: -5, pageSize: 999 });
    expect(clamped.page).toBe(1);
    expect(clamped.pageSize).toBe(100);
  });

  it("searches by slug, title, wedding code and wedding name", async () => {
    const bySlug = await listVaults({ organizationId: ORG_A, search: "vault-alpha" });
    expect(bySlug.total).toBe(1);
    expect(bySlug.items[0]?.id).toBe(VAULT_MAIN);

    const byWeddingCode = await listVaults({ organizationId: ORG_A, search: "WED-5555-A" });
    expect(byWeddingCode.total).toBe(1);
    expect(byWeddingCode.items[0]?.id).toBe(VAULT_MAIN);
  });
});

describe("admin service: getVaultDetail", () => {
  beforeEachBase();

  it("returns vault detail with media count and guest sessions", async () => {
    const detail = await getVaultDetail(VAULT_MAIN);
    expect(detail.slug).toBe("vault-alpha-5555");
    expect(detail.weddingCode).toBe("WED-5555-A");
    expect(detail.status).toBe("published");
    // mediaCount counts every media row for the underlying wedding.
    expect(detail.mediaCount).toBe(3);
    expect(detail.guestSessionCount).toBe(3);
    expect(detail.guestSessions).toHaveLength(3);

    const ids = detail.guestSessions.map((s) => s.id).sort();
    expect(ids).toEqual([SESSION_ACTIVE, SESSION_REVOKED, SESSION_EXPIRED].sort());

    const active = detail.guestSessions.find((s) => s.id === SESSION_ACTIVE);
    expect(active).toMatchObject({
      displayName: "Auntie Grace",
      status: "active",
      uploadCount: 2,
      maxUploads: 100,
      ipAddress: "192.0.2.10",
    });
    expect(active?.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("throws NotFoundError for unknown or malformed ids", async () => {
    await expect(getVaultDetail(randomUUID())).rejects.toThrow(NotFoundError);
    await expect(getVaultDetail("vault?")).rejects.toThrow(NotFoundError);
  });
});

// ── Reads: Media ──────────────────────────────────────────────────────────────

describe("admin service: listMedia", () => {
  beforeEachBase();

  it("lists media for an organization", async () => {
    const res = await listMedia({ organizationId: ORG_A });
    expect(res.total).toBe(3);
    const ids = res.items.map((m) => m.id).sort();
    expect(ids).toEqual([MEDIA_A, MEDIA_B, MEDIA_RETRY].sort());
    const processed = res.items.find((m) => m.id === MEDIA_A);
    expect(processed).toMatchObject({
      filename: "ceremony-5555.jpg",
      contentType: "image/jpeg",
      sizeBytes: 123456,
      status: "processed",
      weddingCode: "WED-5555-A",
    });
  });

  it("filters by status", async () => {
    const failed = await listMedia({ organizationId: ORG_A, status: "failed" });
    expect(failed.total).toBe(1);
    expect(failed.items[0]?.id).toBe(MEDIA_RETRY);

    const processed = await listMedia({ organizationId: ORG_A, status: "processed" });
    expect(processed.total).toBe(1);
    expect(processed.items[0]?.id).toBe(MEDIA_A);
  });

  it("searches by filename, publicId and wedding code", async () => {
    const byFilename = await listMedia({ organizationId: ORG_A, search: "ceremony-5555" });
    expect(byFilename.total).toBe(1);
    expect(byFilename.items[0]?.id).toBe(MEDIA_A);

    const byWeddingCode = await listMedia({ organizationId: ORG_A, search: "WED-5555-A" });
    expect(byWeddingCode.total).toBe(3);
  });

  it("returns an empty result for an org with no media", async () => {
    const res = await listMedia({ organizationId: ORG_B });
    expect(res.total).toBe(0);
  });
});

describe("admin service: getMediaDetail", () => {
  beforeEachBase();

  it("returns processed media with its variants and processing jobs", async () => {
    const detail = await getMediaDetail(MEDIA_A);
    expect(detail.filename).toBe("ceremony-5555.jpg");
    expect(detail.storageKey).toBe(`media/${ORG_A}/${MEDIA_A}/original.jpg`);
    expect(detail.status).toBe("processed");
    expect(detail.width).toBe(1200);
    expect(detail.height).toBe(800);

    expect(detail.variants).toHaveLength(1);
    expect(detail.variants[0]).toMatchObject({
      id: VARIANT_A,
      variantType: "thumbnail",
      sizeBytes: 2048,
    });

    expect(detail.processingJobs).toHaveLength(1);
    expect(detail.processingJobs[0]).toMatchObject({
      id: MPJ_COMPLETED,
      status: "completed",
      attempts: 1,
      maxAttempts: 3,
    });
  });

  it("returns failed media with two failed processing jobs", async () => {
    const detail = await getMediaDetail(MEDIA_RETRY);
    expect(detail.status).toBe("failed");
    expect(detail.variants).toHaveLength(0);
    expect(detail.processingJobs).toHaveLength(2);
    const jobs = detail.processingJobs.map((j) => j.id).sort();
    expect(jobs).toEqual([MPJ_RETRY_1, MPJ_RETRY_2].sort());
  });

  it("throws NotFoundError for unknown or malformed ids", async () => {
    await expect(getMediaDetail(randomUUID())).rejects.toThrow(NotFoundError);
    await expect(getMediaDetail("m")).rejects.toThrow(NotFoundError);
  });
});

// ── Reads: Build jobs ─────────────────────────────────────────────────────────

describe("admin service: listBuildJobs", () => {
  beforeEachBase();

  it("lists build jobs with joined wedding info", async () => {
    const res = await listBuildJobs({ organizationId: ORG_A });
    expect(res.total).toBe(4);
    const failed = res.items.filter((j) => j.status === "failed");
    expect(failed).toHaveLength(2);
    const row = res.items.find((j) => j.id === BUILD_FAILED);
    expect(row).toBeDefined();
    expect(row?.weddingCode).toBe("WED-5555-A");
    expect(row?.buildType).toBe("vault");
    expect(row?.maxAttempts).toBe(3);
  });

  it("filters by status", async () => {
    const failed = await listBuildJobs({ organizationId: ORG_A, status: "failed" });
    expect(failed.total).toBe(2);
    const ids = failed.items.map((j) => j.id).sort();
    expect(ids).toEqual([BUILD_FAILED, BUILD_EXHAUSTED].sort());

    const completed = await listBuildJobs({ organizationId: ORG_A, status: "completed" });
    expect(completed.total).toBe(1);
    expect(completed.items[0]?.id).toBe(BUILD_COMPLETED);
  });

  it("returns an empty result for an org with no build jobs", async () => {
    const res = await listBuildJobs({ organizationId: ORG_B });
    expect(res.total).toBe(0);
  });
});

describe("admin service: getBuildJobDetail", () => {
  beforeEachBase();

  it("returns a failed build job with its steps and error details", async () => {
    const detail = await getBuildJobDetail(BUILD_FAILED);
    expect(detail.status).toBe("failed");
    expect(detail.attempts).toBe(2);
    expect(detail.maxAttempts).toBe(3);
    expect(detail.errorMessage).toBe("Timeout while rendering slides");
    expect(detail.idempotencyKey).toBe("build-failed-5555");
    expect(detail.version).toBe(1);
    expect(detail.weddingCode).toBe("WED-5555-A");

    expect(detail.steps).toHaveLength(1);
    expect(detail.steps[0]).toMatchObject({
      stepKey: "render",
      stepOrder: 1,
      status: "failed",
      errorMessage: "Timeout",
    });
  });

  it("exposes the completed result for a successful build", async () => {
    const detail = await getBuildJobDetail(BUILD_COMPLETED);
    expect(detail.status).toBe("completed");
    expect(detail.result).toEqual({ vaultId: VAULT_MAIN });
    expect(detail.steps).toHaveLength(0);
  });

  it("throws NotFoundError for unknown or malformed ids", async () => {
    await expect(getBuildJobDetail(randomUUID())).rejects.toThrow(NotFoundError);
    await expect(getBuildJobDetail("j")).rejects.toThrow(NotFoundError);
  });
});

// ── Reads: Email jobs ─────────────────────────────────────────────────────────

describe("admin service: listEmailJobs", () => {
  beforeEachBase();

  it("lists email jobs with joined wedding info", async () => {
    const res = await listEmailJobs({ organizationId: ORG_A });
    expect(res.total).toBe(4);
    const row = res.items.find((j) => j.id === EMAIL_SENT);
    expect(row).toBeDefined();
    expect(row?.emailType).toBe("vault_ready");
    expect(row?.toEmail).toBe("owner.alpha@example.com");
    expect(row?.status).toBe("sent");
    expect(row?.weddingCode).toBe("WED-5555-A");
    expect(row?.idempotencyKey).toBe("email-sent-5555");
  });

  it("filters by status and search", async () => {
    const failed = await listEmailJobs({ organizationId: ORG_A, status: "failed" });
    expect(failed.total).toBe(2);
    const ids = failed.items.map((j) => j.id).sort();
    expect(ids).toEqual([EMAIL_FAILED, EMAIL_EXHAUSTED].sort());

    const byKey = await listEmailJobs({ organizationId: ORG_A, search: "email-pending-5555" });
    expect(byKey.total).toBe(1);
    expect(byKey.items[0]?.id).toBe(EMAIL_PENDING);
  });

  it("returns an empty result for an org with no email jobs", async () => {
    const res = await listEmailJobs({ organizationId: ORG_B });
    expect(res.total).toBe(0);
  });
});

describe("admin service: getEmailJobDetail", () => {
  beforeEachBase();

  it("returns a sent job with provider metadata", async () => {
    const detail = await getEmailJobDetail(EMAIL_SENT);
    expect(detail.status).toBe("sent");
    expect(detail.subject).toBe("Vault ready");
    expect(detail.toEmail).toBe("owner.alpha@example.com");
    expect(detail.providerMessageId).toBe("pf-5555-msg");
    expect(detail.sentAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(detail.weddingCode).toBe("WED-5555-A");
  });

  it("returns a pending job without sentAt", async () => {
    const detail = await getEmailJobDetail(EMAIL_PENDING);
    expect(detail.status).toBe("pending");
    expect(detail.sentAt).toBeNull();
    expect(detail.providerMessageId).toBeNull();
    expect(detail.attempts).toBe(0);
  });

  it("throws NotFoundError for unknown or malformed ids", async () => {
    await expect(getEmailJobDetail(randomUUID())).rejects.toThrow(NotFoundError);
    await expect(getEmailJobDetail("e")).rejects.toThrow(NotFoundError);
  });
});

// ── Reads: Lifecycle events ───────────────────────────────────────────────────

describe("admin service: listLifecycleEvents", () => {
  beforeEachBase();

  it("lists lifecycle events with actor emails, newest first", async () => {
    const res = await listLifecycleEvents({ organizationId: ORG_A });
    expect(res.total).toBe(3);
    expect(res.items.map((e) => e.id)).toEqual([LIFECYCLE_ACTOR, LIFECYCLE_BUILD, LIFECYCLE_UPLOAD]);

    const actorEvent = res.items[0];
    expect(actorEvent?.eventType).toBe("payment_verified");
    expect(actorEvent?.actorUserId).toBe(USER_OWNER);
    expect(actorEvent?.actorEmail).toBe("owner.alpha@example.com");

    const uploadEvent = res.items[2];
    expect(uploadEvent?.eventType).toBe("upload_deadline_reached");
    expect(uploadEvent?.fromStatus).toBe("active");
    expect(uploadEvent?.toStatus).toBe("upload_closed");
  });

  it("maps the status query param onto eventType", async () => {
    const res = await listLifecycleEvents({ organizationId: ORG_A, status: "build_completed" });
    expect(res.total).toBe(1);
    expect(res.items[0]?.id).toBe(LIFECYCLE_BUILD);
  });

  it("returns an empty result for an org with no events", async () => {
    const res = await listLifecycleEvents({ organizationId: ORG_B });
    expect(res.total).toBe(0);
  });
});

// ── Reads: Audit logs ─────────────────────────────────────────────────────────

describe("admin service: listAuditLogs", () => {
  beforeEach(async () => {
    await cleanup();
    await createBaseFixtures();
    await createAuditFixtures();
  });
  afterEach(cleanup);

  it("lists audit rows for an organization, newest first, with actor emails", async () => {
    const res = await listAuditLogs({ organizationId: ORG_B });
    expect(res.total).toBe(3);
    expect(res.items.map((l) => l.id)).toEqual([AUDIT_PAG_3, AUDIT_PAG_2, AUDIT_PAG_1]);
    expect(res.items[0]?.actorEmail).toBe("admin@wmv.example");
    expect(res.items[0]?.actorName).toBe("Admin User");
    expect(res.items[0]?.action).toBe("organization_edited");
  });

  it("paginates audit rows", async () => {
    const page1 = await listAuditLogs({ organizationId: ORG_B, page: 1, pageSize: 2 });
    expect(page1.total).toBe(3);
    expect(page1.items.map((l) => l.id)).toEqual([AUDIT_PAG_3, AUDIT_PAG_2]);

    const page2 = await listAuditLogs({ organizationId: ORG_B, page: 2, pageSize: 2 });
    expect(page2.items.map((l) => l.id)).toEqual([AUDIT_PAG_1]);
  });

  it("filters by action and resource type", async () => {
    const byAction = await listAuditLogs({ organizationId: ORG_B, action: "manual_bulk_update" });
    expect(byAction.total).toBe(2);

    const byType = await listAuditLogs({ organizationId: ORG_B, resourceType: "customer" });
    expect(byType.total).toBe(2);
    const ids = byType.items.map((l) => l.id).sort();
    expect(ids).toEqual([AUDIT_PAG_1, AUDIT_PAG_2].sort());
  });

  it("filters by resource id and preserves ip/user-agent metadata", async () => {
    const byResource = await listAuditLogs({ resourceId: CUST_B });
    expect(byResource.total).toBe(2);

    const [edited] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, AUDIT_PAG_3))
      .limit(1);
    expect(edited?.ipAddress).toBe("203.0.113.9");
    expect(edited?.userAgent).toBe("test-agent");

    const res = await listAuditLogs({ organizationId: ORG_B, action: "organization_edited" });
    expect(res.items[0]?.ipAddress).toBe("203.0.113.9");
    expect(res.items[0]?.userAgent).toBe("test-agent");
  });
});

// ── Platform health + storage overview ────────────────────────────────────────

describe("admin service: getPlatformHealth", () => {
  beforeEachBase();

  it("reports database connectivity", async () => {
    const health = await getPlatformHealth();
    expect(health.database.ok).toBe(true);
    expect(health.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.database.error).toBeUndefined();
  });

  it("reports worker status and build concurrency", async () => {
    const health = await getPlatformHealth();
    expect(health.workers.build.isRunning).toBe(false);
    expect(health.workers.build.activeJobs).toBe(0);
    expect(health.workers.build.maxConcurrent).toBe(3);
    expect(health.workers.media.isRunning).toBe(false);
    expect(health.workers.email.isRunning).toBe(false);
  });

  it("reflects this suite's queue fixtures (at least)", async () => {
    const health = await getPlatformHealth();
    expect(health.queues.build.failed).toBeGreaterThanOrEqual(2);
    expect(health.queues.build.pending).toBeGreaterThanOrEqual(1);
    expect(health.queues.build.completed).toBeGreaterThanOrEqual(1);
    expect(health.queues.media.failed).toBeGreaterThanOrEqual(2);
    expect(health.queues.media.completed).toBeGreaterThanOrEqual(1);
    expect(health.queues.email.failed).toBeGreaterThanOrEqual(2);
    expect(health.queues.email.sent).toBeGreaterThanOrEqual(1);
    expect(health.queues.email.pending).toBeGreaterThanOrEqual(1);
    expect(health.queues.stale.build).toBeGreaterThanOrEqual(0);
    expect(health.queues.stale.media).toBeGreaterThanOrEqual(0);
    expect(health.queues.stale.email).toBeGreaterThanOrEqual(0);
  });

  it("reports timestamps in UTC and Johannesburg plus migration state", async () => {
    const health = await getPlatformHealth();
    expect(health.time.timezone).toBe("Africa/Johannesburg");
    expect(health.time.utc).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(health.time.johannesburg.length).toBeGreaterThan(0);
    expect(health.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(typeof health.migrations.trackingTable).toBe("boolean");
    expect(Array.isArray(health.migrations.declaredTags)).toBe(true);
    expect(health.migrations.declaredTags.length).toBeGreaterThan(0);
    expect(typeof health.migrations.upToDate).toBe("boolean");
  });
});

describe("admin service: getStorageOverview", () => {
  beforeEachBase();

  it("reports aggregate storage figures across non-deleted media", async () => {
    const overview = await getStorageOverview();
    expect(typeof overview.configured).toBe("boolean");
    expect(overview.mediaCount).toBeGreaterThanOrEqual(3);
    expect(overview.variantCount).toBeGreaterThanOrEqual(1);
    expect(overview.totalBytes).toBeGreaterThanOrEqual(123456 + 654321 + 999999);
    expect(typeof overview.lastMediaActivityAt).toBe("string");
    expect(overview.lastMediaActivityAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("exposes configuration fields or a configuration note", async () => {
    const overview = await getStorageOverview();
    expect(typeof overview.configured).toBe("boolean");
    if (overview.configured) {
      expect(typeof overview.endpoint).toBe("string");
      expect(typeof overview.bucket).toBe("string");
    }
    if (typeof overview.note === "string") {
      expect(overview.note.length).toBeGreaterThan(0);
    } else {
      // When storage is configured the note is optional; otherwise the service
      // must explain why storage is unavailable.
      expect(overview.configured).toBe(true);
    }
  });
});

// ── Write actions: retry build job ────────────────────────────────────────────

describe("admin service: adminRetryBuildJob", () => {
  beforeEachBase();

  it("retries a failed build job, resetting job and steps to pending", async () => {
    const result = await adminRetryBuildJob(BUILD_FAILED, ADMIN_CTX, META);
    expect(result.changed).toBe(true);
    expect(result.before).toEqual({
      status: "failed",
      attempts: 2,
      maxAttempts: 3,
      errorMessage: "Timeout while rendering slides",
      idempotencyKey: "build-failed-5555",
    });
    expect(result.after).toEqual({
      status: "pending",
      attempts: 2,
      maxAttempts: 3,
      errorMessage: null,
      idempotencyKey: "build-failed-5555",
    });
    expect(result.auditId).toBeTruthy();

    const [job] = await db.select().from(buildJobs).where(eq(buildJobs.id, BUILD_FAILED)).limit(1);
    expect(job?.status).toBe("pending");
    expect(job?.errorMessage).toBeNull();
    expect(job?.startedAt).toBeNull();
    expect(job?.completedAt).toBeNull();

    const [step] = await db
      .select()
      .from(buildJobSteps)
      .where(eq(buildJobSteps.id, STEP_BUILD_FAILED))
      .limit(1);
    expect(step?.status).toBe("pending");
    expect(step?.errorMessage).toBeNull();

    const [audit] = await getAuditRowsFor("admin_retry_build_job", BUILD_FAILED);
    expect(audit).toBeDefined();
    expect(audit?.organizationId).toBe(ORG_A);
    expect(audit?.actorUserId).toBe(USER_ADMIN);
    expect(audit?.ipAddress).toBe("203.0.113.1");
    expect(audit?.userAgent).toBe("admin-service.test");
    expect(audit?.metadata).toEqual({ retryReason: "admin" });
  });

  it("refuses non-failed jobs with a reason and writes no audit row", async () => {
    const pending = await adminRetryBuildJob(BUILD_PENDING, ADMIN_CTX);
    expect(pending.changed).toBe(false);
    expect(pending.reason).toContain("only failed jobs can be retried");

    const completed = await adminRetryBuildJob(BUILD_COMPLETED, ADMIN_CTX);
    expect(completed.changed).toBe(false);
    expect(completed.reason).toContain("'completed'");

    const [job] = await db.select().from(buildJobs).where(eq(buildJobs.id, BUILD_PENDING)).limit(1);
    expect(job?.status).toBe("pending");
    expect(await countAuditRows("admin_retry_build_job")).toBe(0);
  });

  it("refuses exhausted retry budgets", async () => {
    const result = await adminRetryBuildJob(BUILD_EXHAUSTED, ADMIN_CTX);
    expect(result.changed).toBe(false);
    expect(result.reason).toContain("exhausted its retry budget");

    const [job] = await db.select().from(buildJobs).where(eq(buildJobs.id, BUILD_EXHAUSTED)).limit(1);
    expect(job?.status).toBe("failed");
    expect(await countAuditRows("admin_retry_build_job")).toBe(0);
  });

  it("throws NotFoundError for unknown or malformed ids", async () => {
    await expect(adminRetryBuildJob(randomUUID(), ADMIN_CTX)).rejects.toThrow(NotFoundError);
    await expect(adminRetryBuildJob("build", ADMIN_CTX)).rejects.toThrow(NotFoundError);
  });
});

// ── Write actions: retry email job ────────────────────────────────────────────

describe("admin service: adminRetryEmailJob", () => {
  beforeEachBase();

  it("resets a failed email job to pending, preserving the idempotency key", async () => {
    const result = await adminRetryEmailJob(EMAIL_FAILED, ADMIN_CTX, META);
    expect(result.changed).toBe(true);
    expect(result.before).toEqual({
      status: "failed",
      attempts: 2,
      maxAttempts: 3,
      errorMessage: "SMTP relay denied",
      idempotencyKey: "email-failed-5555",
      sentAt: null,
    });
    expect(result.after).toEqual({
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      errorMessage: null,
      idempotencyKey: "email-failed-5555",
      sentAt: null,
    });

    const [job] = await db.select().from(emailJobs).where(eq(emailJobs.id, EMAIL_FAILED)).limit(1);
    expect(job?.status).toBe("pending");
    expect(job?.attempts).toBe(0);
    expect(job?.sentAt).toBeNull();
    expect(job?.idempotencyKey).toBe("email-failed-5555");

    const [audit] = await getAuditRowsFor("admin_retry_email_job", EMAIL_FAILED);
    expect(audit).toBeDefined();
    expect(audit?.organizationId).toBe(ORG_A);
    expect(audit?.ipAddress).toBe("203.0.113.1");
    expect(audit?.userAgent).toBe("admin-service.test");
  });

  it("refuses non-failed jobs with a reason and writes no audit row", async () => {
    const sent = await adminRetryEmailJob(EMAIL_SENT, ADMIN_CTX);
    expect(sent.changed).toBe(false);
    expect(sent.reason).toContain("'sent'; only failed jobs can be retried");

    const pending = await adminRetryEmailJob(EMAIL_PENDING, ADMIN_CTX);
    expect(pending.changed).toBe(false);
    expect(pending.reason).toContain("'pending'");

    expect(await countAuditRows("admin_retry_email_job")).toBe(0);
  });

  it("refuses exhausted retry budgets", async () => {
    const result = await adminRetryEmailJob(EMAIL_EXHAUSTED, ADMIN_CTX);
    expect(result.changed).toBe(false);
    expect(result.reason).toContain("exhausted its retry budget");

    const [job] = await db.select().from(emailJobs).where(eq(emailJobs.id, EMAIL_EXHAUSTED)).limit(1);
    expect(job?.status).toBe("failed");
    expect(await countAuditRows("admin_retry_email_job")).toBe(0);
  });

  it("throws NotFoundError for unknown or malformed ids", async () => {
    await expect(adminRetryEmailJob(randomUUID(), ADMIN_CTX)).rejects.toThrow(NotFoundError);
    await expect(adminRetryEmailJob("email", ADMIN_CTX)).rejects.toThrow(NotFoundError);
  });
});

// ── Write actions: retry media processing ─────────────────────────────────────

describe("admin service: adminRetryMediaProcessing", () => {
  beforeEachBase();

  it("resets failed processing jobs and moves the media back to processing", async () => {
    const result = await adminRetryMediaProcessing(MEDIA_RETRY, ADMIN_CTX, META);
    expect(result.changed).toBe(true);
    expect(result.before).toEqual({ mediaStatus: "failed", failedJobCount: 2 });
    expect(result.after).toEqual({ mediaStatus: "processing", failedJobCount: 0, reset: 2 });
    expect(result.auditId).toBeTruthy();

    const [mediaRow] = await db.select().from(media).where(eq(media.id, MEDIA_RETRY)).limit(1);
    expect(mediaRow?.status).toBe("processing");

    const jobs = await db
      .select()
      .from(mediaProcessingJobs)
      .where(
        and(
          eq(mediaProcessingJobs.mediaId, MEDIA_RETRY),
          eq(mediaProcessingJobs.status, "failed"),
        ),
      );
    expect(jobs).toHaveLength(0);

    const pending = await db
      .select()
      .from(mediaProcessingJobs)
      .where(
        and(
          eq(mediaProcessingJobs.mediaId, MEDIA_RETRY),
          eq(mediaProcessingJobs.status, "pending"),
        ),
      );
    expect(pending).toHaveLength(2);
    for (const job of pending) {
      expect(job.attempts).toBe(0);
      expect(job.errorMessage).toBeNull();
    }

    const [audit] = await getAuditRowsFor("admin_retry_media_processing", MEDIA_RETRY);
    expect(audit).toBeDefined();
    expect(audit?.organizationId).toBe(ORG_A);
    expect(audit?.metadata).toEqual({ reset: 2 });
  });

  it("no-ops when there are no failed processing jobs", async () => {
    const result = await adminRetryMediaProcessing(MEDIA_A, ADMIN_CTX);
    expect(result.changed).toBe(false);
    expect(result.reason).toContain("no failed processing jobs");
    expect(result.before).toEqual({ mediaStatus: "processed", failedJobCount: 0 });

    const [mediaRow] = await db.select().from(media).where(eq(media.id, MEDIA_A)).limit(1);
    expect(mediaRow?.status).toBe("processed");
    expect(await countAuditRows("admin_retry_media_processing")).toBe(0);
  });

  it("throws NotFoundError for unknown or malformed ids", async () => {
    await expect(adminRetryMediaProcessing(randomUUID(), ADMIN_CTX)).rejects.toThrow(NotFoundError);
    await expect(adminRetryMediaProcessing("media", ADMIN_CTX)).rejects.toThrow(NotFoundError);
  });
});

// ── Write actions: suspend / unsuspend organization ───────────────────────────

describe("admin service: adminSuspendOrganization", () => {
  beforeEachBase();

  it("suspends an active wedding-company organization and audits it", async () => {
    const result = await adminSuspendOrganization(ORG_B, ADMIN_CTX, META);
    expect(result.changed).toBe(true);
    expect(result.before).toEqual({ status: "active", type: "wedding_company" });
    expect(result.after).toEqual({ status: "suspended", type: "wedding_company" });

    const [org] = await db.select().from(organizations).where(eq(organizations.id, ORG_B)).limit(1);
    expect(org?.status).toBe("suspended");

    const [audit] = await getAuditRowsFor("admin_suspend_organization", ORG_B);
    expect(audit).toBeDefined();
    expect(audit?.organizationId).toBe(ORG_B);
    expect(audit?.actorUserId).toBe(USER_ADMIN);
    expect(audit?.before).toEqual({ status: "active", type: "wedding_company" });
    expect(audit?.after).toEqual({ status: "suspended", type: "wedding_company" });
    expect(audit?.ipAddress).toBe("203.0.113.1");
    expect(audit?.userAgent).toBe("admin-service.test");
  });

  it("refuses to suspend platform organizations", async () => {
    const result = await adminSuspendOrganization(ORG_PLATFORM, ADMIN_CTX);
    expect(result.changed).toBe(false);
    expect(result.reason).toBe("Platform organizations cannot be suspended");
    expect(await countAuditRows("admin_suspend_organization")).toBe(0);
  });

  it("refuses to suspend closed organizations", async () => {
    const result = await adminSuspendOrganization(ORG_CLOSED, ADMIN_CTX);
    expect(result.changed).toBe(false);
    expect(result.reason).toBe("Closed organizations cannot be suspended");
    expect(await countAuditRows("admin_suspend_organization")).toBe(0);
  });

  it("no-ops on an already-suspended organization", async () => {
    const result = await adminSuspendOrganization(ORG_SUSPENDED, ADMIN_CTX);
    expect(result.changed).toBe(false);
    expect(result.reason).toBe("Organization is already suspended");
    expect(await countAuditRows("admin_suspend_organization")).toBe(0);
  });

  it("throws NotFoundError for unknown or malformed ids", async () => {
    await expect(adminSuspendOrganization(randomUUID(), ADMIN_CTX)).rejects.toThrow(NotFoundError);
    await expect(adminSuspendOrganization("org", ADMIN_CTX)).rejects.toThrow(NotFoundError);
  });
});

describe("admin service: adminUnsuspendOrganization", () => {
  beforeEachBase();

  it("restores a suspended organization to active and audits it", async () => {
    const result = await adminUnsuspendOrganization(ORG_SUSPENDED, ADMIN_CTX, META);
    expect(result.changed).toBe(true);
    expect(result.before).toEqual({ status: "suspended", type: "wedding_company" });
    expect(result.after).toEqual({ status: "active", type: "wedding_company" });

    const [org] = await db.select().from(organizations).where(eq(organizations.id, ORG_SUSPENDED)).limit(1);
    expect(org?.status).toBe("active");

    const [audit] = await getAuditRowsFor("admin_unsuspend_organization", ORG_SUSPENDED);
    expect(audit).toBeDefined();
    expect(audit?.organizationId).toBe(ORG_SUSPENDED);
    expect(audit?.ipAddress).toBe("203.0.113.1");
  });

  it("no-ops on an active organization", async () => {
    const result = await adminUnsuspendOrganization(ORG_A, ADMIN_CTX);
    expect(result.changed).toBe(false);
    expect(result.reason).toContain("only suspended organizations can be restored");

    const [org] = await db.select().from(organizations).where(eq(organizations.id, ORG_A)).limit(1);
    expect(org?.status).toBe("active");
    expect(await countAuditRows("admin_unsuspend_organization")).toBe(0);
  });
});

// ── Write actions: suspend user ───────────────────────────────────────────────

describe("admin service: adminSuspendUser", () => {
  beforeEachBase();

  it("suspends an active tenant user and audits with a null organization", async () => {
    const result = await adminSuspendUser(USER_OWNER, ADMIN_CTX, META);
    expect(result.changed).toBe(true);
    expect(result.before).toEqual({
      status: "active",
      activeMembershipRoles: ["wedding_company_owner"],
    });
    expect(result.after).toEqual({
      status: "suspended",
      activeMembershipRoles: ["wedding_company_owner"],
    });

    const [user] = await db.select().from(users).where(eq(users.id, USER_OWNER)).limit(1);
    expect(user?.status).toBe("suspended");

    const [audit] = await getAuditRowsFor("admin_suspend_user", USER_OWNER);
    expect(audit).toBeDefined();
    expect(audit?.organizationId).toBeNull();
    expect(audit?.actorUserId).toBe(USER_ADMIN);
    expect(audit?.resourceType).toBe("user");
    expect(audit?.ipAddress).toBe("203.0.113.1");
    expect(audit?.userAgent).toBe("admin-service.test");
  });

  it("refuses to suspend the actor's own account", async () => {
    const result = await adminSuspendUser(USER_OWNER, ctxFor(USER_OWNER));
    expect(result.changed).toBe(false);
    expect(result.reason).toBe("Admins cannot suspend their own account");

    const [user] = await db.select().from(users).where(eq(users.id, USER_OWNER)).limit(1);
    expect(user?.status).toBe("active");
    expect(await countAuditRows("admin_suspend_user")).toBe(0);
  });

  it("refuses to suspend platform administrators", async () => {
    const result = await adminSuspendUser(USER_PLATFORM_MEMBER, ADMIN_CTX);
    expect(result.changed).toBe(false);
    expect(result.reason).toBe("Platform administrators cannot be suspended");
    expect(await countAuditRows("admin_suspend_user")).toBe(0);
  });

  it("refuses to suspend users that are not active", async () => {
    const result = await adminSuspendUser(USER_SUSPENDED, ADMIN_CTX);
    expect(result.changed).toBe(false);
    expect(result.reason).toContain("only active users can be suspended");
    expect(await countAuditRows("admin_suspend_user")).toBe(0);
  });

  it("throws NotFoundError for unknown or malformed ids", async () => {
    await expect(adminSuspendUser(randomUUID(), ADMIN_CTX)).rejects.toThrow(NotFoundError);
    await expect(adminSuspendUser("user", ADMIN_CTX)).rejects.toThrow(NotFoundError);
  });
});

// ── Write actions: revoke guest session ───────────────────────────────────────

describe("admin service: adminRevokeGuestSession", () => {
  beforeEachBase();

  it("revokes an active guest session and audits it", async () => {
    const result = await adminRevokeGuestSession(SESSION_ACTIVE, ADMIN_CTX, META);
    expect(result.changed).toBe(true);
    expect(result.before).toMatchObject({ status: "active", displayName: "Auntie Grace", uploadCount: 2 });
    expect(result.after).toMatchObject({ status: "revoked", displayName: "Auntie Grace", uploadCount: 2 });

    const [session] = await db
      .select()
      .from(guestSessions)
      .where(eq(guestSessions.id, SESSION_ACTIVE))
      .limit(1);
    expect(session?.status).toBe("revoked");
    expect(session?.uploadCount).toBe(2);

    const [audit] = await getAuditRowsFor("admin_revoke_guest_session", SESSION_ACTIVE);
    expect(audit).toBeDefined();
    expect(audit?.organizationId).toBe(ORG_A);
    expect(audit?.resourceType).toBe("guest_session");
    expect(audit?.ipAddress).toBe("203.0.113.1");
  });

  it("no-ops on already-revoked sessions", async () => {
    const result = await adminRevokeGuestSession(SESSION_REVOKED, ADMIN_CTX);
    expect(result.changed).toBe(false);
    expect(result.reason).toContain("'revoked'; only active sessions can be revoked");
    expect(await countAuditRows("admin_revoke_guest_session")).toBe(0);
  });

  it("no-ops on expired sessions", async () => {
    const result = await adminRevokeGuestSession(SESSION_EXPIRED, ADMIN_CTX);
    expect(result.changed).toBe(false);
    expect(result.reason).toContain("'expired'; only active sessions can be revoked");
    expect(await countAuditRows("admin_revoke_guest_session")).toBe(0);
  });

  it("throws NotFoundError for unknown or malformed ids", async () => {
    await expect(adminRevokeGuestSession(randomUUID(), ADMIN_CTX)).rejects.toThrow(NotFoundError);
    await expect(adminRevokeGuestSession("session", ADMIN_CTX)).rejects.toThrow(NotFoundError);
  });
});