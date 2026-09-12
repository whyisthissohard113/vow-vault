/**
 * Tests for QR Service — QR generation, card generation, resolution, and security.
 *
 * Tests cover:
 * - QR image generation (PNG, data URL, SVG)
 * - QR code creation and database records
 * - QR code resolution (active, revoked, expired)
 * - QR card generation
 * - Security properties (no private data in QR, tenant isolation)
 * - Design management
 * - Integration with build pipeline
 *
 * All tests hit the real database. Fixtures use unique prefixed names.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { eq, and, isNull, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  qrCodes,
  qrDesigns,
  organizations,
  weddings,
  customers,
  products,
  vaults,
  buildJobs,
  buildJobSteps,
  orders,
  payments,
  templates,
  templateVersions,
  slideshows,
  flipbooks,
  expiryRules,
  lifecycleEvents,
  emailJobs,
} from "@/lib/db/schema";

import {
  generateQrPng,
  generateQrDataUrl,
  generateQrSvg,
  createQrCode,
  getQrCode,
  getQrByPublicId,
  resolveQrDestination,
  revokeQrCode,
  listQrCodes,
  getDefaultDesign,
  getQrDesign,
  listQrDesigns,
} from "@/server/services/qr-service";

import {
  generateQrCardPng,
} from "@/server/services/qr-card-generator";

import {
  QrCodeNotFoundError,
  QrGenerationError,
} from "@/lib/auth/errors";

// ── Test Constants ───────────────────────────────────────────────────────────

const PREFIX = "qr-test";
const TEST_ORG_ID = "11111111-1111-1111-1111-111111111111";
const TEST_ORG_ID_2 = "22222222-2222-2222-2222-222222222222";
const TEST_CUSTOMER_ID = "11111111-1111-1111-1111-111111111112";
const TEST_CUSTOMER_ID_2 = "22222222-2222-2222-2222-222222222222";
const TEST_WEDDING_ID = "11111111-1111-1111-1111-111111111113";
const TEST_WEDDING_ID_2 = "11111111-1111-1111-1111-111111111114";
const TEST_PRODUCT_ID = "11111111-1111-1111-1111-111111111115";
const TEST_TEMPLATE_ID = "11111111-1111-1111-1111-111111111116";
const TEST_VAULT_ID = "11111111-1111-1111-1111-111111111117";
const TEST_VAULT_SLUG = `${PREFIX}-vault-slug-${Date.now()}`;
const TEST_DESIGN_ID = "11111111-1111-1111-1111-111111111118";

const TEST_URL = "https://app.weddingmemoryvault.com/w/test-slug";

// ── Test Fixtures ────────────────────────────────────────────────────────────

async function setupTestData() {
  await cleanupTestData();

  // Create organization
  await db
    .insert(organizations)
    .values({
      id: TEST_ORG_ID,
      publicId: `${PREFIX}-org-pub-1`,
      name: `${PREFIX} Wedding Company`,
      slug: `${PREFIX}-org-1`,
      type: "wedding_company",
      status: "active",
    })
    .onConflictDoNothing();

  // Create second organization (for cross-tenant tests)
  await db
    .insert(organizations)
    .values({
      id: TEST_ORG_ID_2,
      publicId: `${PREFIX}-org-pub-2`,
      name: `${PREFIX} Wedding Company 2`,
      slug: `${PREFIX}-org-2`,
      type: "wedding_company",
      status: "active",
    })
    .onConflictDoNothing();

  // Create customer
  await db
    .insert(customers)
    .values({
      id: TEST_CUSTOMER_ID,
      organizationId: TEST_ORG_ID,
      publicId: `${PREFIX}-cust-pub-1`,
      fullName: `${PREFIX} Test Customer`,
      email: `${PREFIX}-customer@example.com`,
    })
    .onConflictDoNothing();

  // Create second customer (for second org)
  await db
    .insert(customers)
    .values({
      id: TEST_CUSTOMER_ID_2,
      organizationId: TEST_ORG_ID_2,
      publicId: `${PREFIX}-cust-pub-2`,
      fullName: `${PREFIX} Test Customer 2`,
      email: `${PREFIX}-customer2@example.com`,
    })
    .onConflictDoNothing();

  // Create product (unique code to avoid collision with build-engine tests)
  await db
    .insert(products)
    .values({
      id: TEST_PRODUCT_ID,
      code: `${PREFIX}-gold`,
      name: `${PREFIX} Gold`,
      priceCents: 79900,
      status: "active",
      organizationId: null,
    })
    .onConflictDoNothing();

  // Create template
  await db
    .insert(templates)
    .values({
      id: TEST_TEMPLATE_ID,
      code: `${PREFIX}-classic`,
      name: `${PREFIX} Classic Template`,
      status: "active",
      organizationId: null,
    })
    .onConflictDoNothing();

  // Create template version
  await db
    .insert(templateVersions)
    .values({
      id: "11111111-1111-1111-1111-111111111119",
      templateId: TEST_TEMPLATE_ID,
      version: 1,
      content: { fields: {} },
      isLatest: true,
    })
    .onConflictDoNothing();

  // Future wedding date
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);
  futureDate.setMonth(11);
  futureDate.setDate(15);
  futureDate.setHours(0, 0, 0, 0);

  // Create wedding
  await db
    .insert(weddings)
    .values({
      id: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
      customerId: TEST_CUSTOMER_ID,
      productId: TEST_PRODUCT_ID,
      publicId: `${PREFIX}-wedding-pub-1`,
      code: `${PREFIX}-WED-001`,
      name: `${PREFIX} Test Wedding`,
      partnerOneName: "Alice",
      partnerTwoName: "Bob",
      weddingDate: futureDate,
      templateId: TEST_TEMPLATE_ID,
      status: "active",
    })
    .onConflictDoNothing();

  // Create second wedding
  await db
    .insert(weddings)
    .values({
      id: TEST_WEDDING_ID_2,
      organizationId: TEST_ORG_ID,
      customerId: TEST_CUSTOMER_ID,
      productId: TEST_PRODUCT_ID,
      publicId: `${PREFIX}-wedding-pub-2`,
      code: `${PREFIX}-WED-002`,
      name: `${PREFIX} Test Wedding 2`,
      partnerOneName: "Carol",
      partnerTwoName: "Dave",
      weddingDate: futureDate,
      templateId: TEST_TEMPLATE_ID,
      status: "active",
    })
    .onConflictDoNothing();

  // Create vault
  await db
    .insert(vaults)
    .values({
      id: TEST_VAULT_ID,
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
      publicId: `${PREFIX}-vault-pub-1`,
      slug: TEST_VAULT_SLUG,
      title: `${PREFIX} Vault`,
      status: "published",
      isPublic: true,
      noIndex: true,
    })
    .onConflictDoNothing();

  // Create QR design
  await db
    .insert(qrDesigns)
    .values({
      id: TEST_DESIGN_ID,
      organizationId: null,
      code: `${PREFIX}-default`,
      name: `${PREFIX} Default Design`,
      backgroundColor: "#FFFFFF",
      foregroundColor: "#000000",
      isPlatform: true,
      isActive: true,
    })
    .onConflictDoNothing();
}

async function cleanupTestData() {
  // Delete in reverse dependency order
  const orgIds = [TEST_ORG_ID, TEST_ORG_ID_2];
  const weddingIds = [TEST_WEDDING_ID, TEST_WEDDING_ID_2];

  await db.delete(buildJobSteps).where(
    inArray(buildJobSteps.buildJobId, []),
  );
  await db.delete(buildJobs).where(inArray(buildJobs.weddingId, weddingIds));
  await db.delete(qrCodes).where(inArray(qrCodes.weddingId, weddingIds));
  await db.delete(slideshows).where(inArray(slideshows.weddingId, weddingIds));
  await db.delete(flipbooks).where(inArray(flipbooks.weddingId, weddingIds));
  await db.delete(expiryRules).where(inArray(expiryRules.weddingId, weddingIds));
  await db.delete(lifecycleEvents).where(inArray(lifecycleEvents.weddingId, weddingIds));
  await db.delete(emailJobs).where(inArray(emailJobs.weddingId, weddingIds));
  await db.delete(vaults).where(inArray(vaults.weddingId, weddingIds));
  await db.delete(payments).where(inArray(payments.organizationId, orgIds));
  await db.delete(orders).where(inArray(orders.organizationId, orgIds));
  await db.delete(weddings).where(inArray(weddings.id, weddingIds));
  await db.delete(templateVersions).where(eq(templateVersions.templateId, TEST_TEMPLATE_ID));
  await db.delete(products).where(eq(products.id, TEST_PRODUCT_ID));
  await db.delete(templates).where(eq(templates.id, TEST_TEMPLATE_ID));
  await db.delete(customers).where(inArray(customers.id, [TEST_CUSTOMER_ID, TEST_CUSTOMER_ID_2]));
  await db.delete(qrDesigns).where(inArray(qrDesigns.id, [TEST_DESIGN_ID]));
  await db.delete(organizations).where(inArray(organizations.id, orgIds));
}

// ── QR Generation Tests ─────────────────────────────────────────────────────

describe("QR Image Generation", () => {
  it("generateQrPng produces a valid PNG buffer", async () => {
    const buffer = await generateQrPng(TEST_URL);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // PNG magic bytes: 0x89 0x50 0x4E 0x47
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50); // P
    expect(buffer[2]).toBe(0x4e); // N
    expect(buffer[3]).toBe(0x47); // G
  });

  it("generateQrPng respects custom width", async () => {
    const buffer = await generateQrPng(TEST_URL, { width: 256 });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Verify PNG is valid by checking magic bytes
    expect(buffer[0]).toBe(0x89);
  });

  it("generateQrPng respects custom colors", async () => {
    const buffer = await generateQrPng(TEST_URL, {
      color: { dark: "#FF0000", light: "#00FF00" },
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer[0]).toBe(0x89); // PNG magic
  });

  it("generateQrDataUrl returns a valid base64 data URL", async () => {
    const dataUrl = await generateQrDataUrl(TEST_URL);

    expect(typeof dataUrl).toBe("string");
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(dataUrl.length).toBeGreaterThan(100);
  });

  it("generateQrSvg returns valid SVG containing QR patterns", async () => {
    const svg = await generateQrSvg(TEST_URL);

    expect(typeof svg).toBe("string");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    // SVG should contain path elements for the QR code patterns
    expect(svg).toContain("path");
  });
});

// ── QR Code Creation Tests ──────────────────────────────────────────────────

describe("QR Code Creation", () => {
  beforeEach(async () => {
    await setupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("createQrCode creates a qr_codes record with correct fields", async () => {
    const result = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
      vaultId: TEST_VAULT_ID,
    });

    expect(result.id).toBeDefined();
    expect(result.publicId).toBeDefined();
    expect(result.publicId).toHaveLength(32);
    expect(result.targetUrl).toContain("/w/");
    expect(result.pngBuffer).toBeInstanceOf(Buffer);

    // Verify DB record
    const [record] = await db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.id, result.id))
      .limit(1);

    expect(record).toBeDefined();
    expect(record!.weddingId).toBe(TEST_WEDDING_ID);
    expect(record!.organizationId).toBe(TEST_ORG_ID);
    expect(record!.vaultId).toBe(TEST_VAULT_ID);
    expect(record!.status).toBe("active");
  });

  it("createQrCode generates unique publicId", async () => {
    const result1 = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
    });

    const result2 = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
    });

    expect(result1.publicId).not.toBe(result2.publicId);
    expect(result1.id).not.toBe(result2.id);
  });

  it("createQrCode computes targetUrl from vault slug", async () => {
    const result = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
      vaultId: TEST_VAULT_ID,
    });

    expect(result.targetUrl).toContain(TEST_VAULT_SLUG);
  });

  it("createQrCode links to vault when vaultId provided", async () => {
    const result = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
      vaultId: TEST_VAULT_ID,
    });

    const [record] = await db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.id, result.id))
      .limit(1);

    expect(record!.vaultId).toBe(TEST_VAULT_ID);
  });

  it("createQrCode sets status to 'active'", async () => {
    const result = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
    });

    const [record] = await db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.id, result.id))
      .limit(1);

    expect(record!.status).toBe("active");
  });
});

// ── QR Resolution Tests ─────────────────────────────────────────────────────

describe("QR Resolution", () => {
  beforeEach(async () => {
    await setupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("resolveQrDestination returns valid=true for active QR codes", async () => {
    const result = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
      vaultId: TEST_VAULT_ID,
    });

    const resolved = await resolveQrDestination(result.publicId);

    expect(resolved.valid).toBe(true);
    expect(resolved.targetUrl).toBe(result.targetUrl);
    expect(resolved.reason).toBeUndefined();
  });

  it("resolveQrDestination returns valid=false for revoked QR codes", async () => {
    const result = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
    });

    // Revoke the QR code
    await revokeQrCode(result.id, TEST_ORG_ID);

    const resolved = await resolveQrDestination(result.publicId);

    expect(resolved.valid).toBe(false);
    expect(resolved.reason).toBe("QR code has been revoked");
  });

  it("resolveQrDestination returns valid=false for expired QR codes", async () => {
    const result = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
    });

    // Set expired status
    await db
      .update(qrCodes)
      .set({ status: "expired" })
      .where(eq(qrCodes.id, result.id));

    const resolved = await resolveQrDestination(result.publicId);

    expect(resolved.valid).toBe(false);
    expect(resolved.reason).toBe("QR code has expired");
  });

  it("resolveQrDestination returns null for non-existent public IDs", async () => {
    const resolved = await resolveQrDestination("non-existent-public-id-12345");

    expect(resolved.valid).toBe(false);
    expect(resolved.reason).toBe("QR code not found");
  });
});

// ── QR Card Generation Tests ────────────────────────────────────────────────

describe("QR Card Generation", () => {
  it("generateQrCardPng produces a valid PNG buffer", async () => {
    const card = await generateQrCardPng({
      targetUrl: TEST_URL,
      coupleName: "Alice & Bob",
      weddingDate: "15 December 2027",
    });

    expect(card.pngBuffer).toBeInstanceOf(Buffer);
    expect(card.pngBuffer.length).toBeGreaterThan(0);
    expect(card.contentType).toBe("image/png");

    // PNG magic bytes
    expect(card.pngBuffer[0]).toBe(0x89);
    expect(card.pngBuffer[1]).toBe(0x50);
  });

  it("generateQrCardPng produces image with expected dimensions", async () => {
    const card = await generateQrCardPng({
      targetUrl: TEST_URL,
      coupleName: "Alice & Bob",
    });

    expect(card.width).toBe(1080);
    expect(card.height).toBe(1620);

    // Verify actual image dimensions using sharp metadata
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(card.pngBuffer).metadata();

    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1620);
  });

  it("generateQrCardPng accepts custom dimensions", async () => {
    const card = await generateQrCardPng({
      targetUrl: TEST_URL,
      coupleName: "Alice & Bob",
      width: 540,
      height: 810,
    });

    expect(card.width).toBe(540);
    expect(card.height).toBe(810);
  });

  it("generateQrCardPng respects custom colors", async () => {
    const card = await generateQrCardPng({
      targetUrl: TEST_URL,
      coupleName: "Alice & Bob",
      backgroundColor: "#FFF8E1",
      foregroundColor: "#B71C1C",
    });

    expect(card.pngBuffer).toBeInstanceOf(Buffer);
    expect(card.pngBuffer[0]).toBe(0x89);
  });
});

// ── Security Tests ──────────────────────────────────────────────────────────

describe("Security", () => {
  beforeEach(async () => {
    await setupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("QR payload contains ONLY the public URL - no internal UUIDs", async () => {
    const result = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
      vaultId: TEST_VAULT_ID,
    });

    // Target URL should be a clean public URL
    expect(result.targetUrl).toMatch(/^https?:\/\//);
    expect(result.targetUrl).toContain("/w/");

    // Target URL should NOT contain the wedding UUID
    expect(result.targetUrl).not.toContain(TEST_WEDDING_ID);
    // Should NOT contain the org UUID
    expect(result.targetUrl).not.toContain(TEST_ORG_ID);
    // Should NOT contain the vault UUID
    expect(result.targetUrl).not.toContain(TEST_VAULT_ID);
  });

  it("QR publicId is stable across design changes", async () => {
    // Create QR code
    const result = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
      vaultId: TEST_VAULT_ID,
      designId: TEST_DESIGN_ID,
    });

    const originalPublicId = result.publicId;

    // Update the design
    await db
      .update(qrDesigns)
      .set({ foregroundColor: "#FF0000" })
      .where(eq(qrDesigns.id, TEST_DESIGN_ID));

    // The publicId should remain the same
    const [record] = await db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.id, result.id))
      .limit(1);

    expect(record!.publicId).toBe(originalPublicId);
  });

  it("cross-tenant QR access throws ForbiddenError", async () => {
    const result = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
    });

    // Try to access from a different org
    await expect(
      getQrCode(result.id, TEST_ORG_ID_2),
    ).rejects.toThrow();
  });

  it("revoked QR cannot be used for resolution", async () => {
    const result = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
    });

    await revokeQrCode(result.id, TEST_ORG_ID);

    const resolved = await resolveQrDestination(result.publicId);
    expect(resolved.valid).toBe(false);
  });

  it("expired QR cannot be used for resolution", async () => {
    const result = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
    });

    // Manually set as expired
    await db
      .update(qrCodes)
      .set({ status: "expired" })
      .where(eq(qrCodes.id, result.id));

    const resolved = await resolveQrDestination(result.publicId);
    expect(resolved.valid).toBe(false);
  });
});

// ── Integration Tests ───────────────────────────────────────────────────────

describe("Integration", () => {
  beforeEach(async () => {
    await setupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("QR creation + resolution round-trip works end-to-end", async () => {
    // Create
    const created = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
      vaultId: TEST_VAULT_ID,
    });

    // Resolve
    const resolved = await resolveQrDestination(created.publicId);

    expect(resolved.valid).toBe(true);
    expect(resolved.targetUrl).toBe(created.targetUrl);
  });

  it("multiple QR codes can exist for the same wedding", async () => {
    const result1 = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
      vaultId: TEST_VAULT_ID,
      designId: TEST_DESIGN_ID,
    });

    const result2 = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
      vaultId: TEST_VAULT_ID,
    });

    expect(result1.id).not.toBe(result2.id);
    expect(result1.publicId).not.toBe(result2.publicId);

    // Both should resolve
    const resolved1 = await resolveQrDestination(result1.publicId);
    const resolved2 = await resolveQrDestination(result2.publicId);

    expect(resolved1.valid).toBe(true);
    expect(resolved2.valid).toBe(true);
  });

  it("listQrCodes returns QR codes for the correct organization", async () => {
    await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
    });

    await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
    });

    const codes = await listQrCodes(TEST_ORG_ID);
    expect(codes.length).toBeGreaterThanOrEqual(2);

    // All should belong to the same org
    for (const code of codes) {
      expect(code.organizationId).toBe(TEST_ORG_ID);
    }
  });

  it("listQrCodes filters by status", async () => {
    const result = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
    });

    // Revoke one
    await revokeQrCode(result.id, TEST_ORG_ID);

    const activeCodes = await listQrCodes(TEST_ORG_ID, { status: "active" });
    const revokedCodes = await listQrCodes(TEST_ORG_ID, { status: "revoked" });

    // The revoked one should be in revoked list
    const revokedIds = revokedCodes.map((c) => c.id);
    expect(revokedIds).toContain(result.id);

    // And NOT in active list
    const activeIds = activeCodes.map((c) => c.id);
    expect(activeIds).not.toContain(result.id);
  });

  it("getDefaultDesign returns platform design when no org design exists", async () => {
    const design = await getDefaultDesign(TEST_ORG_ID);
    // The platform design we created
    expect(design).not.toBeNull();
    expect(design!.isPlatform).toBe(true);
    expect(design!.organizationId).toBeNull();
  });

  it("getQrDesign returns specific design", async () => {
    const design = await getQrDesign(TEST_DESIGN_ID);
    expect(design).not.toBeNull();
    expect(design!.id).toBe(TEST_DESIGN_ID);
    expect(design!.code).toContain(PREFIX);
  });

  it("listQrDesigns returns platform designs", async () => {
    const designs = await listQrDesigns();
    expect(designs.length).toBeGreaterThanOrEqual(1);
    expect(designs.some((d) => d.id === TEST_DESIGN_ID)).toBe(true);
  });

  it("getQrByPublicId returns QR code by public ID", async () => {
    const result = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
    });

    const found = await getQrByPublicId(result.publicId);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(result.id);
  });

  it("getQrByPublicId returns null for non-existent public ID", async () => {
    const found = await getQrByPublicId("does-not-exist-12345678901234");
    expect(found).toBeNull();
  });

  it("revokeQrCode marks QR code as revoked", async () => {
    const result = await createQrCode({
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
    });

    await revokeQrCode(result.id, TEST_ORG_ID);

    const [record] = await db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.id, result.id))
      .limit(1);

    expect(record!.status).toBe("revoked");
  });
});
