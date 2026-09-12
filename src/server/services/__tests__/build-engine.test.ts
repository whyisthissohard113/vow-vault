/**
 * Tests for the Wedding Build Engine.
 *
 * Tests cover:
 * - Idempotency key handling
 * - Build job creation and status tracking
 * - Pipeline step execution order
 * - Entitlement-based feature creation (slideshow, flipbook, QR card)
 * - Retry logic
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq, and, isNull, inArray, or } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  buildJobs,
  buildJobSteps,
  weddings,
  vaults,
  qrCodes,
  slideshows,
  flipbooks,
  expiryRules,
  lifecycleEvents,
  emailJobs,
  products,
  orders,
  payments,
  organizations,
  customers,
  templates,
  templateVersions,
} from "@/lib/db/schema";
import {
  enqueueBuild,
  executeBuild,
  getBuildStatus,
  retryBuild,
  BUILD_STEPS,
  MAX_ATTEMPTS,
} from "@/server/services/build-engine";

// ── Test Helpers ───────────────────────────────────────────────────────────────

const TEST_ORG_ID = "00000000-0000-0000-0000-000000000001";
const TEST_CUSTOMER_ID = "00000000-0000-0000-0000-000000000002";
const TEST_WEDDING_ID = "00000000-0000-0000-0000-000000000003";
const TEST_PRODUCT_ID = "00000000-0000-0000-0000-000000000004";
const TEST_TEMPLATE_ID = "00000000-0000-0000-0000-000000000005";

async function setupTestData(packageCode: "silver" | "gold" | "platinum" = "gold") {
  // Clean up any existing test data
  await cleanupTestData();

  // Create organization
  await db.insert(organizations).values({
    id: TEST_ORG_ID,
    publicId: "test-org-public-id",
    name: "Test Wedding Company",
    slug: "test-wedding-company",
    type: "wedding_company",
    status: "active",
  }).onConflictDoNothing();

  // Create customer
  await db.insert(customers).values({
    id: TEST_CUSTOMER_ID,
    organizationId: TEST_ORG_ID,
    publicId: "test-customer-public-id",
    fullName: "Alice Smith",
    email: "test@example.com",
  }).onConflictDoNothing();

  // Create product (scoped to the test org so it never collides with a
  // platform-wide catalog row for the same package code).
  await db.insert(products).values({
    id: TEST_PRODUCT_ID,
    code: packageCode,
    name: packageCode.charAt(0).toUpperCase() + packageCode.slice(1),
    priceCents: packageCode === "silver" ? 59900 : packageCode === "gold" ? 79900 : 109900,
    status: "active",
    organizationId: TEST_ORG_ID,
  }).onConflictDoNothing();

  // Create template
  await db.insert(templates).values({
    id: TEST_TEMPLATE_ID,
    code: "classic",
    name: "Classic Template",
    status: "active",
    organizationId: null,
  }).onConflictDoNothing();

  // Create template version
  await db.insert(templateVersions).values({
    id: "00000000-0000-0000-0000-000000000006",
    templateId: TEST_TEMPLATE_ID,
    version: 1,
    content: { fields: {} },
    isLatest: true,
  }).onConflictDoNothing();

  // Create wedding with future date (1 year from now)
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);
  futureDate.setMonth(11); // December
  futureDate.setDate(15);
  futureDate.setHours(0, 0, 0, 0);

  await db.insert(weddings).values({
    id: TEST_WEDDING_ID,
    organizationId: TEST_ORG_ID,
    customerId: TEST_CUSTOMER_ID,
    productId: TEST_PRODUCT_ID,
    publicId: "test-wedding-public-id",
    code: "WED-TEST-001",
    name: "Test Wedding",
    partnerOneName: "Alice",
    partnerTwoName: "Bob",
    weddingDate: futureDate,
    templateId: TEST_TEMPLATE_ID,
    status: "draft",
  });

  // Create paid order
  const [order] = await db.insert(orders).values({
    id: "00000000-0000-0000-0000-000000000007",
    organizationId: TEST_ORG_ID,
    customerId: TEST_CUSTOMER_ID,
    productId: TEST_PRODUCT_ID,
    orderNumber: "ORD-TEST-001",
    status: "paid",
    totalCents: packageCode === "silver" ? 59900 : packageCode === "gold" ? 79900 : 109900,
    placedAt: new Date(),
    paidAt: new Date(),
  }).returning().onConflictDoNothing();

  // Create completed payment
  await db.insert(payments).values({
    id: "00000000-0000-0000-0000-000000000008",
    organizationId: TEST_ORG_ID,
    orderId: order?.id ?? "00000000-0000-0000-0000-000000000007",
    provider: "payfast",
    providerReference: "TEST-PAY-REF-001",
    status: "completed",
    amountCents: packageCode === "silver" ? 59900 : packageCode === "gold" ? 79900 : 109900,
    paidAt: new Date(),
  }).onConflictDoNothing();
}

async function cleanupTestData() {
  // Delete in reverse dependency order - use weddingId as the anchor since most tables cascade from weddings
  await db.delete(buildJobSteps).where(inArray(buildJobSteps.buildJobId, []));
  await db.delete(buildJobs).where(eq(buildJobs.weddingId, TEST_WEDDING_ID));
  await db.delete(vaults).where(eq(vaults.weddingId, TEST_WEDDING_ID));
  await db.delete(qrCodes).where(eq(qrCodes.weddingId, TEST_WEDDING_ID));
  await db.delete(slideshows).where(eq(slideshows.weddingId, TEST_WEDDING_ID));
  await db.delete(flipbooks).where(eq(flipbooks.weddingId, TEST_WEDDING_ID));
  await db.delete(expiryRules).where(eq(expiryRules.weddingId, TEST_WEDDING_ID));
  await db.delete(lifecycleEvents).where(eq(lifecycleEvents.weddingId, TEST_WEDDING_ID));
  await db.delete(emailJobs).where(eq(emailJobs.weddingId, TEST_WEDDING_ID));
  
  // Delete orders and payments for this organization. Target the order FK by
  // BOTH organizationId and productId: under parallel suites sharing the DB,
  // an order row could be inserted between iterations of this cleanup, and
  // deleting by productId (the FK target of products in this suite) closes
  // that window before the products delete below.
  await db.delete(payments).where(
    and(eq(payments.organizationId, TEST_ORG_ID)),
  );
  await db.delete(orders).where(
    or(
      eq(orders.organizationId, TEST_ORG_ID),
      eq(orders.productId, TEST_PRODUCT_ID),
    ),
  );
  
  // Delete wedding
  await db.delete(weddings).where(eq(weddings.id, TEST_WEDDING_ID));
  
  // Delete products (after orders are gone)
  await db.delete(products).where(inArray(products.id, [TEST_PRODUCT_ID, TEST_TEMPLATE_ID]));
  
  // Delete template version
  await db.delete(templateVersions).where(eq(templateVersions.templateId, TEST_TEMPLATE_ID));
  
  // Delete template
  await db.delete(templates).where(eq(templates.id, TEST_TEMPLATE_ID));
  
  // Delete customer and organization
  await db.delete(customers).where(eq(customers.id, TEST_CUSTOMER_ID));
  await db.delete(organizations).where(eq(organizations.id, TEST_ORG_ID));
}

describe("Wedding Build Engine", () => {
  beforeEach(async () => {
    await setupTestData("gold");
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe("enqueueBuild", () => {
    it("creates a new build job with all steps", async () => {
      const idempotencyKey = `test_build_${Date.now()}`;

      const result = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey,
        version: 1,
      });

      expect(result.isNew).toBe(true);
      expect(result.status).toBe("pending");
      expect(result.buildJobId).toBeDefined();

      // Verify job was created
      const [job] = await db
        .select()
        .from(buildJobs)
        .where(eq(buildJobs.id, result.buildJobId))
        .limit(1);
      expect(job).toBeDefined();
      expect(job!.idempotencyKey).toBe(idempotencyKey);
      expect(job!.version).toBe(1);
      expect(job!.status).toBe("pending");

      // Verify all steps were created
      const steps = await db
        .select()
        .from(buildJobSteps)
        .where(eq(buildJobSteps.buildJobId, result.buildJobId))
        .orderBy(buildJobSteps.stepOrder);

      expect(steps).toHaveLength(BUILD_STEPS.length);
      expect(steps.map((s) => s.stepKey)).toEqual(BUILD_STEPS.map((s) => s.stepKey));
    });

    it("returns existing job for duplicate idempotency key", async () => {
      const idempotencyKey = `test_duplicate_${Date.now()}`;

      const result1 = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey,
        version: 1,
      });

      const result2 = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey,
        version: 1,
      });

      expect(result1.buildJobId).toBe(result2.buildJobId);
      expect(result2.isNew).toBe(false);
    });

    it("allows new build with incremented version", async () => {
      const idempotencyKey = `test_version_${Date.now()}`;

      const result1 = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey: `${idempotencyKey}_v1`,
        version: 1,
      });

      const result2 = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey: `${idempotencyKey}_v2`,
        version: 2,
      });

      expect(result1.buildJobId).not.toBe(result2.buildJobId);
      expect(result1.isNew).toBe(true);
      expect(result2.isNew).toBe(true);

      const [job1] = await db.select().from(buildJobs).where(eq(buildJobs.id, result1.buildJobId)).limit(1);
      const [job2] = await db.select().from(buildJobs).where(eq(buildJobs.id, result2.buildJobId)).limit(1);
      expect(job1?.version).toBe(1);
      expect(job2?.version).toBe(2);
    });
  });

  describe("getBuildStatus", () => {
    it("returns job and steps with correct structure", async () => {
      const idempotencyKey = `test_status_${Date.now()}`;

      const { buildJobId } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey,
        version: 1,
      });

      const { job, steps } = await getBuildStatus(buildJobId);

      expect(job).not.toBeNull();
      expect(job!.id).toBe(buildJobId);
      expect(job!.status).toBe("pending");
      expect(steps).toHaveLength(BUILD_STEPS.length);
      expect(steps[0].stepKey).toBe("validate_wedding");
      expect(steps[steps.length - 1].stepKey).toBe("audit_event");
    });
  });

  describe("Pipeline Steps - Entitlement-based creation", () => {
    it("creates slideshow for Gold package", async () => {
      const idempotencyKey = `test_slideshow_${Date.now()}`;

      const { buildJobId } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey,
        version: 1,
      });

      // Execute build
      await executeBuild(buildJobId);

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { job } = await getBuildStatus(buildJobId);
      expect(job?.status).toBe("completed");

      // Verify slideshow was created
      const [slideshow] = await db
        .select()
        .from(slideshows)
        .where(and(eq(slideshows.weddingId, TEST_WEDDING_ID), isNull(slideshows.deletedAt)))
        .limit(1);

      expect(slideshow).toBeDefined();
      expect(slideshow!.title).toContain("Alice & Bob");
    });

    it("creates flipbook for Platinum package", async () => {
      // Setup Platinum wedding
      await cleanupTestData();
      await setupTestData("platinum");

      const idempotencyKey = `test_flipbook_${Date.now()}`;

      const { buildJobId } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey,
        version: 1,
      });

      await executeBuild(buildJobId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { job } = await getBuildStatus(buildJobId);
      expect(job?.status).toBe("completed");

      // Verify flipbook was created
      const [flipbook] = await db
        .select()
        .from(flipbooks)
        .where(and(eq(flipbooks.weddingId, TEST_WEDDING_ID), isNull(flipbooks.deletedAt)))
        .limit(1);

      expect(flipbook).toBeDefined();
      expect(flipbook!.title).toContain("Alice & Bob");
    });

    it("does NOT create slideshow for Silver package", async () => {
      await cleanupTestData();
      await setupTestData("silver");

      const idempotencyKey = `test_no_slideshow_${Date.now()}`;

      const { buildJobId } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey,
        version: 1,
      });

      await executeBuild(buildJobId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { job } = await getBuildStatus(buildJobId);
      expect(job?.status).toBe("completed");

      // Verify no slideshow was created
      const slideshows_result = await db
        .select()
        .from(slideshows)
        .where(and(eq(slideshows.weddingId, TEST_WEDDING_ID), isNull(slideshows.deletedAt)));

      expect(slideshows_result).toHaveLength(0);
    });

    it("does NOT create flipbook for Gold package", async () => {
      const idempotencyKey = `test_no_flipbook_${Date.now()}`;

      const { buildJobId } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey,
        version: 1,
      });

      await executeBuild(buildJobId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { job } = await getBuildStatus(buildJobId);
      expect(job?.status).toBe("completed");

      // Verify no flipbook was created
      const flipbooks_result = await db
        .select()
        .from(flipbooks)
        .where(and(eq(flipbooks.weddingId, TEST_WEDDING_ID), isNull(flipbooks.deletedAt)));

      expect(flipbooks_result).toHaveLength(0);
    });

    it("creates QR code for all packages", async () => {
      const idempotencyKey = `test_qr_${Date.now()}`;

      const { buildJobId } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey,
        version: 1,
      });

      await executeBuild(buildJobId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify QR code was created
      const [qrCode] = await db
        .select()
        .from(qrCodes)
        .where(and(eq(qrCodes.weddingId, TEST_WEDDING_ID), isNull(qrCodes.deletedAt)))
        .limit(1);

      expect(qrCode).toBeDefined();
      expect(qrCode!.publicId).toBeDefined();
      expect(qrCode!.targetUrl).toContain("/w/");
    });

    it("queues QR card email only for Platinum", async () => {
      // Gold should not queue QR card email
      const idempotencyKey = `test_email_gold_${Date.now()}`;

      const { buildJobId: goldJobId } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey,
        version: 1,
      });

      await executeBuild(goldJobId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const goldEmails = await db
        .select()
        .from(emailJobs)
        .where(and(eq(emailJobs.weddingId, TEST_WEDDING_ID), eq(emailJobs.emailType, "qr_card")));

      expect(goldEmails).toHaveLength(0);

      // Platinum should queue QR card email
      await cleanupTestData();
      await setupTestData("platinum");

      const { buildJobId: platinumJobId } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey: `test_email_platinum_${Date.now()}`,
        version: 1,
      });

      await executeBuild(platinumJobId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const platinumEmails = await db
        .select()
        .from(emailJobs)
        .where(and(eq(emailJobs.weddingId, TEST_WEDDING_ID), eq(emailJobs.emailType, "qr_card")));

      expect(platinumEmails).toHaveLength(1);
    });
  });

  describe("Expiry Configuration", () => {
    it("creates expiry_rules with correct deadlines per package", async () => {
      // Test Silver: upload +2 days, download +7 days
      await cleanupTestData();
      await setupTestData("silver");

      const { buildJobId: silverJobId } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey: `test_expiry_silver_${Date.now()}`,
        version: 1,
      });

      await executeBuild(silverJobId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const [silverExpiry] = await db
        .select()
        .from(expiryRules)
        .where(eq(expiryRules.weddingId, TEST_WEDDING_ID))
        .limit(1);

      expect(silverExpiry).toBeDefined();
      expect(silverExpiry!.uploadWindowDays).toBe(2);
      expect(silverExpiry!.downloadWindowDays).toBe(7);
      expect(silverExpiry!.downloadDeadline.getTime()).toBeGreaterThan(silverExpiry!.uploadDeadline.getTime());

      // Test Gold: upload +7 days, download +30 days
      await cleanupTestData();
      await setupTestData("gold");

      const { buildJobId: goldJobId } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey: `test_expiry_gold_${Date.now()}`,
        version: 1,
      });

      await executeBuild(goldJobId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const [goldExpiry] = await db
        .select()
        .from(expiryRules)
        .where(eq(expiryRules.weddingId, TEST_WEDDING_ID))
        .limit(1);

      expect(goldExpiry).toBeDefined();
      expect(goldExpiry!.uploadWindowDays).toBe(7);
      expect(goldExpiry!.downloadWindowDays).toBe(30);
    });
  });

  describe("Retry Logic", () => {
    it("retries failed builds up to MAX_ATTEMPTS", async () => {
      const idempotencyKey = `test_retry_${Date.now()}`;

      const { buildJobId } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey,
        version: 1,
      });

      // Manually fail a step to test retry
      await db
        .update(buildJobSteps)
        .set({ status: "failed", errorMessage: "Test failure" })
        .where(
          and(
            eq(buildJobSteps.buildJobId, buildJobId),
            eq(buildJobSteps.stepKey, "verify_payment"),
          ),
        );

      await db.update(buildJobs).set({ status: "failed", attempts: 1 }).where(eq(buildJobs.id, buildJobId));

      // Retry should work
      await retryBuild(buildJobId);

      const { job } = await getBuildStatus(buildJobId);
      expect(job?.status).toBe("pending");
    });

    it("prevents retry when max attempts exceeded", async () => {
      const idempotencyKey = `test_max_retry_${Date.now()}`;

      const { buildJobId } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey,
        version: 1,
      });

      await db.update(buildJobs).set({ status: "failed", attempts: MAX_ATTEMPTS }).where(eq(buildJobs.id, buildJobId));

      await expect(retryBuild(buildJobId)).rejects.toThrow("Max retry attempts exceeded");
    });
  });

  describe("Error Handling", () => {
    it("fails build when wedding validation fails", async () => {
      // Create wedding without required fields
      await db.update(weddings).set({ partnerOneName: null }).where(eq(weddings.id, TEST_WEDDING_ID));

      const idempotencyKey = `test_validation_fail_${Date.now()}`;

      const { buildJobId } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey,
        version: 1,
      });

      await executeBuild(buildJobId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { job } = await getBuildStatus(buildJobId);
      expect(job?.status).toBe("failed");
      expect(job?.errorMessage).toContain("Validation failed");
    });

    it("fails build when no paid order exists", async () => {
      // Remove payment
      await db.delete(payments).where(eq(payments.providerReference, "TEST-PAY-REF-001"));

      const idempotencyKey = `test_no_payment_${Date.now()}`;

      const { buildJobId } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey,
        version: 1,
      });

      await executeBuild(buildJobId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { job } = await getBuildStatus(buildJobId);
      expect(job?.status).toBe("failed");
      expect(job?.errorMessage).toContain("No completed payment found");
    });
  });

  describe("Vault Creation", () => {
    it("creates vault with correct slug and publicId", async () => {
      const idempotencyKey = `test_vault_${Date.now()}`;

      const { buildJobId } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey,
        version: 1,
      });

      await executeBuild(buildJobId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const [vault] = await db
        .select()
        .from(vaults)
        .where(and(eq(vaults.weddingId, TEST_WEDDING_ID), isNull(vaults.deletedAt)))
        .limit(1);

      expect(vault).toBeDefined();
      expect(vault!.publicId).toBeDefined();
      expect(vault!.slug).toContain("alice");
      expect(vault!.slug).toContain("bob");
      expect(vault!.status).toBe("published");
      expect(vault!.noIndex).toBe(true);
      expect(vault!.isPublic).toBe(true);
    });

    it("does not create duplicate vault on rebuild", async () => {
      const idempotencyKey = `test_vault_rebuild_${Date.now()}`;

      const { buildJobId: jobId1 } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey: `${idempotencyKey}_v1`,
        version: 1,
      });

      await executeBuild(jobId1);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const vaultsBefore = await db
        .select()
        .from(vaults)
        .where(and(eq(vaults.weddingId, TEST_WEDDING_ID), isNull(vaults.deletedAt)));

      expect(vaultsBefore).toHaveLength(1);
      const vaultId = vaultsBefore[0].id;

      // Rebuild with version 2
      const { buildJobId: jobId2 } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey: `${idempotencyKey}_v2`,
        version: 2,
      });

      await executeBuild(jobId2);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const vaultsAfter = await db
        .select()
        .from(vaults)
        .where(and(eq(vaults.weddingId, TEST_WEDDING_ID), isNull(vaults.deletedAt)));

      expect(vaultsAfter).toHaveLength(1);
      expect(vaultsAfter[0].id).toBe(vaultId); // Same vault
    });
  });

  describe("Lifecycle Events", () => {
    it("creates build_completed lifecycle event", async () => {
      const idempotencyKey = `test_lifecycle_${Date.now()}`;

      const { buildJobId } = await enqueueBuild({
        weddingId: TEST_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        customerId: TEST_CUSTOMER_ID,
        productId: TEST_PRODUCT_ID,
        idempotencyKey,
        version: 1,
      });

      await executeBuild(buildJobId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const events = await db
        .select()
        .from(lifecycleEvents)
        .where(
          and(
            eq(lifecycleEvents.weddingId, TEST_WEDDING_ID),
            eq(lifecycleEvents.eventType, "build_completed"),
          ),
        );

      expect(events).toHaveLength(1);
      expect(events[0].fromStatus).toBe("building");
      expect(events[0].toStatus).toBe("active");
      expect(events[0].metadata).toBeDefined();
    });
  });
});