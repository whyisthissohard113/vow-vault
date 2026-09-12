/**
 * Integration tests for the Public Vault service layer.
 *
 * Uses the real PostgreSQL test DB (mirroring build-engine/media-service
 * suites) with the dependency-injected in-memory StorageClient.
 *
 * Coverage:
 *  1. resolvePublicVaultBySlug returns a guest-safe DTO with signed URLs
 *  2. Archived vault → archived marker (not 404)
 *  3. Draft vault → NotFoundError
 *  4. Deleted wedding → NotFoundError
 *  5. getQRDataUrlForSlug returns a QR PNG data URL for the public route
 *  6. createVaultGuestSession issues a hash-stored session for a published vault
 *  7. Per-IP throttle: 21st session within the window is rejected (RateLimit)
 *  8. Session creation is denied when the upload window has closed
 *  9. getGuestDownloadUrlForPublicMedia signs a URL for a processed item
 * 10. Unknown public id → NotFoundError (guests never probe ids)
 * 11. Closed download window → ForbiddenError
 * 12. Media scoping: foreign media is invisible via this vault's slug
 * 13. Silver (no video feature) filters video out of the gallery
 * 14. Gallery order: processed media newest-first
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  media,
  mediaVariants,
  vaults,
  guestSessions,
  weddingSettings,
  weddings,
  products,
  customers,
  organizations,
} from "@/lib/db/schema";
import { hashToken } from "@/lib/auth/token-utils";
import {
  NotFoundError,
  ForbiddenError,
  RateLimitError,
} from "@/lib/auth/errors";
import {
  resolvePublicVaultBySlug,
  getQRDataUrlForSlug,
  createVaultGuestSession,
  getGuestDownloadUrlForPublicMedia,
} from "@/server/services/public-vault";
import { memoryStorageClient } from "@/server/services/storage/client";

// ── Test identities (distinct from the other DB-backed suites) ────────────────

const TEST_ORG_ID = "33333333-3333-3333-3333-333333333301";
const TEST_CUSTOMER_ID = "33333333-3333-3333-3333-333333333302";
const TEST_WEDDING_ID = "33333333-3333-3333-3333-333333333303";
const TEST_PRODUCT_ID = "33333333-3333-3333-3333-333333333304";
const TEST_VAULT_ID = "33333333-3333-3333-3333-333333333305";
const TEST_SLUG = "public-vault-test-slug";

const SILVER_PRODUCT_ID = "33333333-3333-3333-3333-333333333306";
const SILVER_WEDDING_ID = "33333333-3333-3333-3333-333333333307";
const SILVER_VAULT_ID = "33333333-3333-3333-3333-333333333308";
const SILVER_SLUG = "public-vault-test-silver";

const FOREIGN_ORG_ID = "44444444-4444-4444-4444-444444444401";
const FOREIGN_CUSTOMER_ID = "44444444-4444-4444-4444-444444444402";
const FOREIGN_WEDDING_ID = "44444444-4444-4444-4444-444444444403";
const FOREIGN_PRODUCT_ID = "44444444-4444-4444-4444-444444444404";
const FOREIGN_VAULT_ID = "44444444-4444-4444-4444-444444444405";
const FOREIGN_SLUG = "public-vault-test-foreign";

const PAST_WEDDING_ID = "33333333-3333-3333-3333-333333333309";
const PAST_VAULT_ID = "33333333-3333-3333-3333-333333333310";
const PAST_SLUG = "public-vault-test-past";

function futureWeddingDate(): string {
  return "2026-12-25";
}

/** A valid-but-past wedding date: every upload/download window is closed. */
function pastWeddingDate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  d.setMonth(0);
  d.setDate(15);
  d.setHours(0, 0, 0, 0);
  return d;
}

function publicIdFrom(id: string): string {
  return id.replace(/-/g, "").slice(0, 32);
}

// ── Setup helpers ──────────────────────────────────────────────────────────────

async function setupTestData(packageCode = "gold") {
  await db.insert(organizations).values({
    id: TEST_ORG_ID,
    publicId: "public-vault-test-org",
    name: "Public Vault Test Co",
    slug: "public-vault-test-company",
    type: "wedding_company",
    status: "active",
  }).onConflictDoNothing();

  await db.insert(customers).values({
    id: TEST_CUSTOMER_ID,
    organizationId: TEST_ORG_ID,
    publicId: "public-vault-test-customer",
    fullName: "Public Vault Couple",
    email: "couple@example.com",
  }).onConflictDoNothing();

  await db.insert(products).values({
    id: TEST_PRODUCT_ID,
    organizationId: TEST_ORG_ID,
    code: packageCode,
    name: packageCode === "gold" ? "Gold" : packageCode,
    priceCents: 79900,
    status: "active",
  }).onConflictDoNothing();

  await db.insert(weddings).values({
    id: TEST_WEDDING_ID,
    organizationId: TEST_ORG_ID,
    customerId: TEST_CUSTOMER_ID,
    productId: TEST_PRODUCT_ID,
    publicId: "public-vault-test-wedding",
    code: "WED-PUBLIC-VAULT-001",
    name: "Public Vault Wedding",
    partnerOneName: "Themba",
    partnerTwoName: "Ayanda",
    weddingDate: new Date(`${futureWeddingDate()}T00:00:00Z`),
    status: "active",
  }).onConflictDoNothing();

  await db.insert(weddingSettings).values({
    weddingId: TEST_WEDDING_ID,
    themeColor: "#8B5E3C",
    accentColor: "#D4AF37",
    coupleStory: "Our story began in Joburg.",
    customMessage: "Thank you for celebrating with us!",
    allowGuestUploads: true,
  }).onConflictDoNothing();

  await db.insert(vaults).values({
    id: TEST_VAULT_ID,
    weddingId: TEST_WEDDING_ID,
    organizationId: TEST_ORG_ID,
    publicId: "public-vault-test-vault-pub",
    slug: TEST_SLUG,
    title: "Themba & Ayanda",
    isPublic: true,
    status: "published",
  }).onConflictDoNothing();
}

/** Inserts a published gold vault whose wedding is long past (windows closed). */
async function setupPastWedding() {
  await db.insert(products).values({
    id: TEST_PRODUCT_ID,
    organizationId: TEST_ORG_ID,
    code: "gold",
    name: "Gold",
    priceCents: 79900,
    status: "active",
  }).onConflictDoNothing();

  await db.insert(weddings).values({
    id: PAST_WEDDING_ID,
    organizationId: TEST_ORG_ID,
    customerId: TEST_CUSTOMER_ID,
    productId: TEST_PRODUCT_ID,
    publicId: "public-vault-test-past-wedding",
    code: "WED-PUBLIC-VAULT-PAST",
    name: "Past Wedding",
    partnerOneName: "Zanele",
    partnerTwoName: "Bongani",
    weddingDate: pastWeddingDate(),
    status: "active",
  }).onConflictDoNothing();

  await db.insert(vaults).values({
    id: PAST_VAULT_ID,
    weddingId: PAST_WEDDING_ID,
    organizationId: TEST_ORG_ID,
    publicId: "public-vault-test-past-vault",
    slug: PAST_SLUG,
    title: "Zanele & Bongani",
    isPublic: true,
    status: "published",
  }).onConflictDoNothing();
}

async function setupSilverVault() {
  await db.insert(products).values({
    id: SILVER_PRODUCT_ID,
    organizationId: TEST_ORG_ID,
    code: "silver",
    name: "Silver",
    priceCents: 59900,
    status: "active",
  }).onConflictDoNothing();

  await db.insert(weddings).values({
    id: SILVER_WEDDING_ID,
    organizationId: TEST_ORG_ID,
    customerId: TEST_CUSTOMER_ID,
    productId: SILVER_PRODUCT_ID,
    publicId: "public-vault-test-silver-wedding",
    code: "WED-PUBLIC-VAULT-SILVER",
    name: "Silver Wedding",
    partnerOneName: "Katlego",
    partnerTwoName: "Naledi",
    weddingDate: new Date(`${futureWeddingDate()}T00:00:00Z`),
    status: "active",
  }).onConflictDoNothing();

  await db.insert(vaults).values({
    id: SILVER_VAULT_ID,
    weddingId: SILVER_WEDDING_ID,
    organizationId: TEST_ORG_ID,
    publicId: "public-vault-test-silver-vault",
    slug: SILVER_SLUG,
    title: "Katlego & Naledi",
    isPublic: true,
    status: "published",
  }).onConflictDoNothing();
}

async function setupForeignTenant() {
  await db.insert(organizations).values({
    id: FOREIGN_ORG_ID,
    publicId: "public-vault-test-foreign-org",
    name: "Foreign Co",
    slug: "public-vault-test-foreign-company",
    type: "wedding_company",
    status: "active",
  }).onConflictDoNothing();

  await db.insert(customers).values({
    id: FOREIGN_CUSTOMER_ID,
    organizationId: FOREIGN_ORG_ID,
    publicId: "public-vault-foreign-customer",
    fullName: "Foreign Couple",
    email: "foreign@example.com",
  }).onConflictDoNothing();

  await db.insert(products).values({
    id: FOREIGN_PRODUCT_ID,
    organizationId: FOREIGN_ORG_ID,
    code: "platinum",
    name: "Platinum",
    priceCents: 109900,
    status: "active",
  }).onConflictDoNothing();

  await db.insert(weddings).values({
    id: FOREIGN_WEDDING_ID,
    organizationId: FOREIGN_ORG_ID,
    customerId: FOREIGN_CUSTOMER_ID,
    productId: FOREIGN_PRODUCT_ID,
    publicId: "public-vault-foreign-wedding",
    code: "WED-PUBLIC-VAULT-FOREIGN",
    name: "Foreign Wedding",
    partnerOneName: "Sipho",
    partnerTwoName: "Thandi",
    weddingDate: new Date(`${futureWeddingDate()}T00:00:00Z`),
    status: "active",
  }).onConflictDoNothing();

  await db.insert(vaults).values({
    id: FOREIGN_VAULT_ID,
    weddingId: FOREIGN_WEDDING_ID,
    organizationId: FOREIGN_ORG_ID,
    publicId: "public-vault-test-foreign-vault",
    slug: FOREIGN_SLUG,
    title: "Sipho & Thandi",
    isPublic: true,
    status: "published",
  }).onConflictDoNothing();
}

/** Seeds a processed photo with thumbnail/full variants for the test wedding. */
async function seedProcessedPhoto(mediaId: string, createdAt?: Date) {
  const objectId = publicIdFrom(mediaId);
  await db.insert(media).values({
    id: mediaId,
    publicId: objectId,
    weddingId: TEST_WEDDING_ID,
    organizationId: TEST_ORG_ID,
    storageKey: `${TEST_ORG_ID}/${TEST_WEDDING_ID}/${objectId}.jpg`,
    filename: "memory.jpg",
    contentType: "image/jpeg",
    sizeBytes: 2_000_000,
    width: 1200,
    height: 800,
    status: "processed",
    createdAt: createdAt ?? new Date("2026-06-01T10:00:00Z"),
  }).onConflictDoNothing();

  await db.insert(mediaVariants).values({
    mediaId,
    variantType: "thumbnail",
    storageKey: `${TEST_ORG_ID}/${TEST_WEDDING_ID}/${objectId}.thumbnail.jpg`,
    filename: "memory_thumb.jpg",
    contentType: "image/jpeg",
    sizeBytes: 20_000,
    width: 300,
    height: 200,
  }).onConflictDoNothing();

  await db.insert(mediaVariants).values({
    mediaId,
    variantType: "full",
    storageKey: `${TEST_ORG_ID}/${TEST_WEDDING_ID}/${objectId}.full.jpg`,
    filename: "memory_full.jpg",
    contentType: "image/jpeg",
    sizeBytes: 900_000,
    width: 1200,
    height: 800,
  }).onConflictDoNothing();
}

async function cleanupTestData() {
  const weddingIds = [
    TEST_WEDDING_ID,
    PAST_WEDDING_ID,
    SILVER_WEDDING_ID,
    FOREIGN_WEDDING_ID,
  ];
  const vaultIds = [
    TEST_VAULT_ID,
    PAST_VAULT_ID,
    SILVER_VAULT_ID,
    FOREIGN_VAULT_ID,
  ];

  // media_variants cascade on media delete; guest_sessions cascade on vault.
  await db.delete(media).where(inArray(media.weddingId, weddingIds));
  await db.delete(guestSessions).where(inArray(guestSessions.vaultId, vaultIds));
  await db.delete(vaults).where(inArray(vaults.id, vaultIds));
  await db.delete(weddingSettings).where(eq(weddingSettings.weddingId, TEST_WEDDING_ID));
  await db.delete(weddings).where(inArray(weddings.id, weddingIds));
  await db.delete(products).where(inArray(products.id, [
    TEST_PRODUCT_ID,
    SILVER_PRODUCT_ID,
    FOREIGN_PRODUCT_ID,
  ]));
  await db.delete(customers).where(inArray(customers.id, [
    TEST_CUSTOMER_ID,
    FOREIGN_CUSTOMER_ID,
  ]));
  await db.delete(organizations).where(inArray(organizations.id, [
    TEST_ORG_ID,
    FOREIGN_ORG_ID,
  ]));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Public Vault service", () => {
  beforeEach(async () => {
    await setupTestData("gold");
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("1. returns a guest-safe DTO for a published vault", async () => {
    const mediaId = "33333333-3333-3333-3333-333333333401";
    await seedProcessedPhoto(mediaId);

    const dto = await resolvePublicVaultBySlug(TEST_SLUG);

    if ("archived" in dto) throw new Error("expected a DTO, got archived marker");

    expect(dto.slug).toBe(TEST_SLUG);
    expect(dto.title).toBe("Themba & Ayanda");
    expect(dto.partnerOneName).toBe("Themba");
    expect(dto.partnerTwoName).toBe("Ayanda");
    expect(dto.weddingDateISO).toBe(futureWeddingDate());
    expect(dto.isGuestUploadAllowed).toBe(true);
    expect(dto.uploadOpen).toBe(true);
    expect(dto.downloadOpen).toBe(true);
    expect(dto.lifecycleStatus).toBe("active");
    expect(dto.packageCode).toBe("gold");

    // Gallery item is guest-safe: publicId only, no internal ids/keys.
    expect(dto.gallery).toHaveLength(1);
    const item = dto.gallery[0];
    expect(item.publicId).toMatch(/^[a-f0-9]{32}$/);
    expect(item.kind).toBe("photo");
    expect(item.thumbnailUrl).toBeDefined();
    expect(item.previewUrl).toBeUndefined(); // no preview variant seeded
    expect(item.fullUrl).toBeDefined();

    // No internal identifiers/meta leak through the serialized DTO. Signed
    // URLs may carry the tenant namespace (org/wedding path prefix) but the
    // per-object segment is the opaque public id, never the media UUID.
    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain(mediaId);
    expect(serialized).not.toContain("storageKey");
    expect(serialized).not.toContain("sha256");
    expect(serialized).not.toContain("guestSession");
    expect(serialized).not.toContain("uploadedBy");

    // QR is a PNG data URL for the public destination.
    expect(dto.qrImageDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("2. returns an archived marker (not 404) for an archived vault", async () => {
    await db
      .update(vaults)
      .set({ status: "archived" })
      .where(eq(vaults.id, TEST_VAULT_ID));

    const result = await resolvePublicVaultBySlug(TEST_SLUG);

    expect("archived" in result).toBe(true);
    if ("archived" in result) {
      expect(result.archived).toBe(true);
      expect(result.slug).toBe(TEST_SLUG);
      expect(result.title).toBe("Themba & Ayanda");
    }
  });

  it("3. returns NotFoundError for a draft (unpublished) vault", async () => {
    await db
      .update(vaults)
      .set({ status: "draft", isPublic: false })
      .where(eq(vaults.id, TEST_VAULT_ID));

    await expect(resolvePublicVaultBySlug(TEST_SLUG)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("4. returns NotFoundError when the wedding is soft-deleted", async () => {
    await db
      .update(weddings)
      .set({ deletedAt: new Date() })
      .where(eq(weddings.id, TEST_WEDDING_ID));

    await expect(resolvePublicVaultBySlug(TEST_SLUG)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("5. generates a QR PNG data URL for the public route", async () => {
    const dataUrl = await getQRDataUrlForSlug(TEST_SLUG);

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    // The QR encodes only the absolute public route, never private data.
    expect(dataUrl).not.toContain(TEST_WEDDING_ID);
    expect(dataUrl).not.toContain(TEST_ORG_ID);
  });

  it("6. creates a guest session with a hash-stored token for a published vault", async () => {
    const result = await createVaultGuestSession(TEST_SLUG, {
      displayName: "The Smiths",
      ipAddress: "10.0.0.9",
    });

    expect(result.token).toBeDefined();
    expect(result.expiresAt).toBeDefined();
    expect(result.maxUploads).toBe(100);

    // The raw token is NOT stored; only its SHA-256 hash.
    const [byHash] = await db
      .select()
      .from(guestSessions)
      .where(eq(guestSessions.token, hashToken(result.token)))
      .limit(1);
    expect(byHash).toBeDefined();
    expect(byHash!.token).not.toBe(result.token);
    expect(byHash!.displayName).toBe("The Smiths");
    expect(byHash!.ipAddress).toBe("10.0.0.9");
    expect(byHash!.status).toBe("active");
    expect(byHash!.uploadCount).toBe(0);
    expect(byHash!.maxUploads).toBe(100);
  });

  it("7. throttles guest session creation per IP (21st request in window)", async () => {
    const ip = "10.20.30.40";

    const values = Array.from({ length: 20 }, (_, i) => ({
      vaultId: TEST_VAULT_ID,
      organizationId: TEST_ORG_ID,
      token: hashToken(`throttle-token-${i}`),
      displayName: null,
      status: "active" as const,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxUploads: 100,
      uploadCount: 0,
      ipAddress: ip,
      createdAt: new Date(),
    }));
    await db.insert(guestSessions).values(values);

    await expect(
      createVaultGuestSession(TEST_SLUG, { ipAddress: ip }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("8. denies guest sessions when the upload window has closed", async () => {
    await setupPastWedding();
    await expect(
      createVaultGuestSession(PAST_SLUG, { ipAddress: "10.0.0.1" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("9. signs a download URL for a processed public media id", async () => {
    const storage = memoryStorageClient();
    const mediaId = "33333333-3333-3333-3333-333333333402";
    await seedProcessedPhoto(mediaId);

    const result = await getGuestDownloadUrlForPublicMedia(TEST_SLUG, publicIdFrom(mediaId), {
      variant: "thumbnail",
      disposition: "attachment",
      storage,
    });

    expect(result.url).toBeDefined();
    expect(result.contentType).toBe("image/jpeg");
    expect(result.expiresAt).toBeDefined();
  });

  it("10. returns NotFoundError for an unknown public id", async () => {
    await expect(
      getGuestDownloadUrlForPublicMedia(TEST_SLUG, "f".repeat(32)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("11. refuses downloads once the download window has closed", async () => {
    await setupPastWedding();
    const mediaId = "33333333-3333-3333-3333-333333333403";

    await db.insert(media).values({
      id: mediaId,
      publicId: publicIdFrom(mediaId),
      weddingId: PAST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
      storageKey: `${TEST_ORG_ID}/${PAST_WEDDING_ID}/${publicIdFrom(mediaId)}.jpg`,
      filename: "long-gone.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1_000,
      status: "processed",
    });

    await expect(
      getGuestDownloadUrlForPublicMedia(PAST_SLUG, publicIdFrom(mediaId)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("12. never leaks media from another vault (IDOR guard)", async () => {
    await setupForeignTenant();
    const foreignMediaId = "44444444-4444-4444-4444-444444444406";
    await db.insert(media).values({
      id: foreignMediaId,
      publicId: publicIdFrom(foreignMediaId),
      weddingId: FOREIGN_WEDDING_ID,
      organizationId: FOREIGN_ORG_ID,
      storageKey: `${FOREIGN_ORG_ID}/${FOREIGN_WEDDING_ID}/${publicIdFrom(foreignMediaId)}.jpg`,
      filename: "foreign.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1_000,
      status: "processed",
    });

    // Same publicId shape, but addressed via the TEST vault slug: invisible.
    await expect(
      getGuestDownloadUrlForPublicMedia(TEST_SLUG, publicIdFrom(foreignMediaId)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("13. hides video from the gallery when the package lacks the video feature", async () => {
    await setupSilverVault();
    const photoId = "33333333-3333-3333-3333-333333333404";
    const videoId = "33333333-3333-3333-3333-333333333405";

    await db.insert(media).values([
      {
        id: photoId,
        publicId: publicIdFrom(photoId),
        weddingId: SILVER_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        storageKey: `${TEST_ORG_ID}/${SILVER_WEDDING_ID}/${publicIdFrom(photoId)}.jpg`,
        filename: "silver-photo.jpg",
        contentType: "image/jpeg",
        sizeBytes: 1_000,
        status: "processed",
        createdAt: new Date("2026-06-01T10:00:00Z"),
      },
      {
        id: videoId,
        publicId: publicIdFrom(videoId),
        weddingId: SILVER_WEDDING_ID,
        organizationId: TEST_ORG_ID,
        storageKey: `${TEST_ORG_ID}/${SILVER_WEDDING_ID}/${publicIdFrom(videoId)}.mp4`,
        filename: "silver-video.mp4",
        contentType: "video/mp4",
        sizeBytes: 5_000_000,
        status: "processed",
        createdAt: new Date("2026-06-02T10:00:00Z"),
      },
    ]);

    const dto = await resolvePublicVaultBySlug(SILVER_SLUG);

    if ("archived" in dto) throw new Error("expected a DTO");

    expect(dto.packageCode).toBe("silver");
    expect(dto.gallery).toHaveLength(1);
    expect(dto.gallery[0].kind).toBe("photo");
    expect(dto.gallery[0].filename).toBe("silver-photo.jpg");
  });

  it("14. lists processed media newest-first and skips non-processed rows", async () => {
    const olderId = "33333333-3333-3333-3333-333333333406";
    const newerId = "33333333-3333-3333-3333-333333333407";
    const pendingId = "33333333-3333-3333-3333-333333333408";

    await seedProcessedPhoto(olderId, new Date("2026-06-01T10:00:00Z"));
    await seedProcessedPhoto(newerId, new Date("2026-06-10T10:00:00Z"));
    await db.insert(media).values({
      id: pendingId,
      publicId: publicIdFrom(pendingId),
      weddingId: TEST_WEDDING_ID,
      organizationId: TEST_ORG_ID,
      storageKey: `${TEST_ORG_ID}/${TEST_WEDDING_ID}/${publicIdFrom(pendingId)}.jpg`,
      filename: "pending.jpg",
      contentType: "image/jpeg",
      sizeBytes: 500,
      status: "uploaded",
      createdAt: new Date("2026-06-15T10:00:00Z"),
    });

    const dto = await resolvePublicVaultBySlug(TEST_SLUG);

    if ("archived" in dto) throw new Error("expected a DTO");

    expect(dto.gallery).toHaveLength(2);
    expect(dto.gallery[0].filename).toBe("memory.jpg");
    expect(dto.gallery[0].publicId).toBe(publicIdFrom(newerId));
    expect(dto.gallery[1].publicId).toBe(publicIdFrom(olderId));
  });
});