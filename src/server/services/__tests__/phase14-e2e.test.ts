/**
 * Phase 14 — Full end-to-end integration test.
 *
 * Chain under test:
 *   Register → Create Wedding → Select Package → Checkout → Payment
 *   Webhook → Entitlement → Build → Vault → QR → Guest scan QR
 *   Guest upload → Media processing → Gallery → Expiry → Download → Purge
 *
 * UUID family: 88888888 — reserved for this Phase 14 E2E proof.
 *
 * Fixtures are lifecycle-inert: the wedding is `draft` until the build engine
 * advances it (draft → building → active), and the only `expiry_rules` row is
 * the one the build itself snapshots. The lifecycle assertions drive
 * `runLifecycleSweep` with an org scope and far-future instants so no other
 * suite's real-time sweep can interfere.
 *
 * Run: npx vitest run src/server/services/__tests__/phase14-e2e.test.ts
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "vitest";
import { eq, and, isNull, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  organizations,
  customers,
  products,
  weddings,
  weddingSettings,
  orders,
  payments,
  paymentEvents,
  lifecycleEvents,
  emailJobs,
  buildJobs,
  vaults,
  guestSessions,
  qrCodes,
  expiryRules,
  media,
  mediaVariants,
  mediaProcessingJobs,
  memories,
  slideshows,
  flipbooks,
  templates,
  templateVersions,
} from "@/lib/db/schema";

import {
  createCheckout,
  processPaymentWebhook,
} from "@/server/services/payments/billing-service";
import {
  buildSignature,
  setValidateTransport,
} from "@/server/services/payments/payfast";
import { ForbiddenError, GuestTokenRevokedError } from "@/lib/auth/errors";

import {
  executeBuild,
} from "@/server/services/build-engine";
import { runLifecycleSweep } from "@/server/lifecycle/engine";
import {
  createVaultGuestSession,
  getGuestDownloadUrlForPublicMedia,
} from "@/server/services/public-vault";
import {
  initiateGuestUpload,
  completeGuestUploadByPublicId,
} from "@/server/services/media-service";
import {
  executeMediaJob,
  maybeMarkMediaProcessed,
} from "@/server/services/media-worker";

import {
  memoryStorageClient,
  type StorageClient,
} from "@/server/services/storage/client";
import sharp from "sharp";

const ORG = "88888888-8888-8888-8888-888888888881";
const CUSTOMER = "88888888-8888-8888-8888-888888888811";
const PRODUCT = "88888888-8888-8888-8888-888888888821";
const TEMPLATE = "88888888-8888-8888-8888-888888888841";
const TEMPLATE_VERSION = "88888888-8888-8888-8888-888888888842";
const WEDDING = "88888888-8888-8888-8888-888888888831";

const GOLD_PRICE_CENTS = 79900;

const ENV_KEYS = [
  "PAYFAST_MERCHANT_ID",
  "PAYFAST_MERCHANT_KEY",
  "PAYFAST_PASSPHRASE",
  "PAYFAST_MODE",
  "PAYFAST_VALIDATE_URL",
];

async function cleanup() {
  // Remove derived media rows by mediaId first (media_variants and
  // media_processing_jobs reference media, not the org).
  const mediaRows = await db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.organizationId, ORG));
  const mediaIds = mediaRows.map((m) => m.id);
  if (mediaIds.length > 0) {
    await db.delete(mediaVariants).where(inArray(mediaVariants.mediaId, mediaIds));
    await db.delete(mediaProcessingJobs).where(inArray(mediaProcessingJobs.mediaId, mediaIds));
  }

  await db.delete(paymentEvents).where(eq(paymentEvents.organizationId, ORG));
  await db.delete(payments).where(eq(payments.organizationId, ORG));
  await db.delete(buildJobs).where(eq(buildJobs.organizationId, ORG));
  await db.delete(emailJobs).where(eq(emailJobs.organizationId, ORG));
  await db.delete(lifecycleEvents).where(eq(lifecycleEvents.organizationId, ORG));
  await db.delete(media).where(eq(media.organizationId, ORG));
  await db.delete(memories).where(eq(memories.organizationId, ORG));
  await db.delete(slideshows).where(eq(slideshows.organizationId, ORG));
  await db.delete(flipbooks).where(eq(flipbooks.organizationId, ORG));
  await db.delete(qrCodes).where(eq(qrCodes.organizationId, ORG));
  await db.delete(guestSessions).where(eq(guestSessions.organizationId, ORG));
  await db.delete(vaults).where(eq(vaults.organizationId, ORG));
  await db.delete(expiryRules).where(eq(expiryRules.weddingId, WEDDING));
  await db.delete(weddingSettings).where(eq(weddingSettings.weddingId, WEDDING));
  await db.delete(orders).where(eq(orders.organizationId, ORG));
  await db.delete(weddings).where(eq(weddings.organizationId, ORG));
  await db.delete(customers).where(eq(customers.organizationId, ORG));
  await db.delete(products).where(eq(products.organizationId, ORG));
  await db.delete(templateVersions).where(eq(templateVersions.id, TEMPLATE_VERSION));
  await db.delete(templates).where(eq(templates.id, TEMPLATE));
  await db.delete(organizations).where(eq(organizations.id, ORG));
}

async function seed() {
  await cleanup();

  await db.insert(organizations).values({
    id: ORG,
    publicId: "888888888888888888888888888881",
    name: "Phase 14 Test Co",
    slug: "phase14-test-co-8888888801",
    type: "wedding_company",
    status: "active",
  });

  await db.insert(customers).values({
    id: CUSTOMER,
    organizationId: ORG,
    publicId: "cust-88-801",
    fullName: "Alice Smith",
    email: "alice@example.com",
  });

  await db.insert(products).values({
    id: PRODUCT,
    organizationId: ORG,
    code: "gold",
    name: "Gold",
    priceCents: GOLD_PRICE_CENTS,
    status: "active",
  });

  // Platform (org-null) classic template + published version: the build
  // engine's validate_wedding + apply_template steps require both.
  await db.insert(templates).values({
    id: TEMPLATE,
    code: "classic",
    name: "Classic Template",
    status: "active",
    organizationId: null,
  });
  await db.insert(templateVersions).values({
    id: TEMPLATE_VERSION,
    templateId: TEMPLATE,
    version: 1,
    content: { fields: {} },
    isLatest: true,
  });

  await db.insert(weddings).values({
    id: WEDDING,
    organizationId: ORG,
    customerId: CUSTOMER,
    productId: PRODUCT,
    publicId: "pub-88-731",
    code: "WED-88-731",
    name: "Alice & Bob",
    partnerOneName: "Alice",
    partnerTwoName: "Bob",
    weddingDate: new Date("2026-12-25"),
    templateId: TEMPLATE,
    status: "draft",
  });

  await db.insert(weddingSettings).values({
    weddingId: WEDDING,
    allowGuestUploads: true,
  });
}

const makeJpeg = async (): Promise<Buffer> =>
  sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: { r: 220, g: 30, b: 40 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();

/**
 * Runs every pending processing job for a media item until none remain, then
 * converges the media status (mirrors the Media Worker; processPendingMediaJobs
 * is fire-and-forget and only *claims* jobs, so the e2e must execute them).
 */
async function drainMediaJobs(mediaId: string, storage: StorageClient): Promise<void> {
  let guard = 0;
  for (;;) {
    guard += 1;
    if (guard > 30) throw new Error("drainMediaJobs did not converge");

    const jobs = await db
      .select()
      .from(mediaProcessingJobs)
      .where(and(eq(mediaProcessingJobs.mediaId, mediaId)));
    const pending = jobs.filter((j) => j.status === "pending");
    if (pending.length === 0) {
      await maybeMarkMediaProcessed(mediaId);
      return;
    }
    for (const job of pending) {
      await executeMediaJob(job.id, storage);
    }
  }
}

/** Build the exact ITN PayFast ITN params signed with the current env. */
function buildItn(
  payment: {
    paymentId: string;
    orderId?: string;
    amountCents: number;
  },
  overrides: Record<string, string> = {},
): Record<string, string> {
  const params: Record<string, string> = {
    merchant_id: process.env.PAYFAST_MERCHANT_ID ?? "",
    merchant_key: process.env.PAYFAST_MERCHANT_KEY ?? "",
    m_payment_id: payment.paymentId,
    pf_payment_id: `sim-${payment.paymentId}`,
    payment_status: "COMPLETE",
    amount_gross: (payment.amountCents / 100).toFixed(2),
    amount_fee: "0.00",
    item_name: "Gold",
    item_description: "",
    custom_str1: payment.orderId ?? "",
    ...overrides,
  };
  params["signature"] = buildSignature(
    params,
    process.env.PAYFAST_PASSPHRASE || undefined,
  );
  return params;
}

describe("Phase 14 — Full end-to-end integration", () => {
  beforeEach(async () => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
    process.env.PAYFAST_MERCHANT_ID = "10000100";
    process.env.PAYFAST_MERCHANT_KEY = "53f0d2c0a9c5";
    process.env.PAYFAST_PASSPHRASE = "testpassphrase";
    process.env.PAYFAST_MODE = "simulated";
    setValidateTransport(undefined);
    await seed();
  });

  afterEach(async () => {
    setValidateTransport(undefined);
    await cleanup();
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  it("completes the entire flow: checkout→payment→build→vault→guest→media→gallery→expiry→download→purge", async () => {
    /***********************************************************************
     * STEP 1 — Checkout (order + order_item + pending payment)
     **********************************************************************/
    const first = await createCheckout({ organizationId: ORG, weddingId: WEDDING });
    expect(first.checkout.status).toBe("pending");
    expect(first.checkout.paymentId).toBeDefined();
    expect(first.checkout.orderId).toBeDefined();
    expect(first.checkout.totalCents).toBe(GOLD_PRICE_CENTS);
    expect(first.checkout.itemName).toBe("Gold");
    expect(first.checkout.currency).toBe("ZAR");
    expect(first.checkout.orderNumber).toMatch(/^ORD-\d{4}-\d{4}$/);

    /***********************************************************************
     * STEP 2 — Payment webhook COMPLETE → activation + auto-build
     **********************************************************************/
    const [pendingPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.organizationId, ORG))
      .limit(1);
    expect(pendingPayment).toBeDefined();

    const webhookResult = await processPaymentWebhook({
      provider: "payfast",
      raw: buildItn({
        paymentId: pendingPayment!.id,
        orderId: first.checkout.orderId,
        amountCents: pendingPayment!.amountCents,
      }),
      simulateAmountOverride: pendingPayment!.amountCents,
    });
    expect(webhookResult.status).toBe("completed");
    expect(webhookResult.paymentId).toBe(pendingPayment!.id);

    // Order is now paid; payment status is completed.
    const [updatedOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, first.checkout.orderId))
      .limit(1);
    expect(updatedOrder!.status).toBe("paid");

    // payment_verified lifecycle event written for the wedding.
    const lifecycle = await db
      .select()
      .from(lifecycleEvents)
      .where(
        and(
          eq(lifecycleEvents.weddingId, WEDDING),
          eq(lifecycleEvents.eventType, "payment_verified"),
        ),
      );
    expect(lifecycle).toHaveLength(1);

    // Build job auto-enqueued (by_payment_<paymentId>).
    const [buildJob] = await db
      .select()
      .from(buildJobs)
      .where(
        and(
          eq(buildJobs.organizationId, ORG),
          eq(buildJobs.idempotencyKey, `by_payment_${pendingPayment!.id}`),
        ),
      )
      .limit(1);
    expect(buildJob).toBeDefined();
    expect(buildJob!.status).toBe("pending");

    /***********************************************************************
     * STEP 3 — Execute the build job (all steps)
     **********************************************************************/
    await executeBuild(buildJob!.id);

    // After executeBuild: vault published, all steps completed.
    const [publishedVault] = await db
      .select()
      .from(vaults)
      .where(and(eq(vaults.weddingId, WEDDING), isNull(vaults.deletedAt)))
      .limit(1);
    expect(publishedVault).toBeDefined();
    expect(publishedVault!.status).toBe("published");
    expect(publishedVault!.noIndex).toBe(true);
    expect(publishedVault!.publishedAt).toBeDefined();

    // QR code active (gold: QR generated, styled card skipped). The vault is
    // now published, which also proves `configure_public_url` ran.
    const [qrCode] = await db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.weddingId, WEDDING))
      .limit(1);
    expect(qrCode).toBeDefined();
    expect(qrCode!.status).toBe("active");

    // Expiry rules snapshotted from the wedding date (JNB → UTC instants).
    const [expiryRule] = await db
      .select()
      .from(expiryRules)
      .where(eq(expiryRules.weddingId, WEDDING))
      .limit(1);
    expect(expiryRule).toBeDefined();
    expect(expiryRule!.uploadDeadline).toBeDefined();
    expect(expiryRule!.downloadDeadline).toBeDefined();
    expect(expiryRule!.uploadWindowDays).toBeGreaterThan(0);
    expect(expiryRule!.downloadWindowDays).toBeGreaterThan(0);

    // Email jobs: vault_ready queued with the build idempotency key (gold has
    // no qr_card email).
    const emailRows = await db
      .select()
      .from(emailJobs)
      .where(eq(emailJobs.organizationId, ORG));
    expect(
      emailRows.some(
        (e) => e.emailType === "vault_ready" && e.idempotencyKey === `vault_ready_${WEDDING}_1`,
      ),
    ).toBe(true);

    // Wedding status is active after build (the lifecycle engine owns status;
    // the build advanced draft → building → active).
    const [weddingRow] = await db
      .select()
      .from(weddings)
      .where(eq(weddings.id, WEDDING))
      .limit(1);
    expect(weddingRow!.status).toBe("active");

    // Slideshow created for the gold package (draft until the asset worker
    // renders it; the build step leaves generated assets at draft).
    const [slideshow] = await db
      .select()
      .from(slideshows)
      .where(eq(slideshows.weddingId, WEDDING))
      .limit(1);
    expect(slideshow).toBeDefined();
    expect(slideshow!.title).toContain("Alice & Bob");

    /***********************************************************************
     * STEP 4 — Guest flow: scan QR → create session → initiate → complete
     **********************************************************************/
    const vaultSlug = publishedVault!.slug!;

    // Create a guest session; no IP to bypass the per-IP throttles.
    const guestSession = await createVaultGuestSession(vaultSlug, {
      displayName: "Guest One",
      ipAddress: undefined,
    });
    const rawToken = guestSession.token;

    const uploadResult = await initiateGuestUpload(rawToken, {
      filename: "table.jpg",
      contentType: "image/jpeg",
      sizeBytes: 2_500,
    });
    expect(uploadResult.publicId).toBeDefined();
    expect(uploadResult.uploadUrl).toBeDefined();
    expect(uploadResult.uploadUrl!.startsWith("memory://")).toBe(true);

    const [mediaRowByPublicId] = await db
      .select()
      .from(media)
      .where(
        and(
          eq(media.publicId, uploadResult.publicId!),
          eq(media.organizationId, ORG),
        ),
      )
      .limit(1);
    expect(mediaRowByPublicId).toBeDefined();
    const storageKey = mediaRowByPublicId!.storageKey!;

    // PUT the JPEG object into the SAME memory storage client that completes it.
    const storage = memoryStorageClient();
    const jpegBuffer = await makeJpeg();
    await storage.putObject(storageKey, jpegBuffer, {
      contentType: "image/jpeg",
    });

    // Complete the upload by public id — idempotent if re-posted.
    const completed = await completeGuestUploadByPublicId(
      rawToken,
      uploadResult.publicId!,
      { storage },
    );
    expect(completed.status).toBe("processing");

    // The media row left `uploaded` and moved to `processing` (the QA audit
    // moved the fair-use increment to AFTER object validation).
    const [afterComplete] = await db
      .select()
      .from(media)
      .where(eq(media.id, mediaRowByPublicId!.id))
      .limit(1);
    expect(afterComplete!.status).toBe("processing");

    // A duplicate complete is a no-op (never re-validates or re-increments).
    const replayComplete = await completeGuestUploadByPublicId(
      rawToken,
      uploadResult.publicId!,
      { storage },
    );
    expect(replayComplete.status).toBe("processing");

    /***********************************************************************
     * STEP 5 — Media processing pipeline
     **********************************************************************/
    await drainMediaJobs(mediaRowByPublicId!.id, storage);

    const [processedMedia] = await db
      .select()
      .from(media)
      .where(eq(media.id, mediaRowByPublicId!.id))
      .limit(1);
    expect(processedMedia!.status).toBe("processed");

    const [variant] = await db
      .select()
      .from(mediaVariants)
      .where(eq(mediaVariants.mediaId, processedMedia!.id))
      .limit(1);
    expect(variant).toBeDefined();
    expect(variant!.variantType).toBe("thumbnail");

    /***********************************************************************
     * STEP 6 — Gallery + download availability (while the window is open)
     **********************************************************************/
    const downloadUrl = await getGuestDownloadUrlForPublicMedia(
      vaultSlug,
      uploadResult.publicId!,
      { variant: "original", storage },
    );
    expect(downloadUrl.url).toBeDefined();
    expect(downloadUrl.url!.startsWith("memory://")).toBe(true);

    // Gallery listing shows processed media (public vault lists only rows in
    // `processed` for the wedding).
    const [galleryMedia] = await db
      .select()
      .from(media)
      .where(
        and(
          eq(media.weddingId, WEDDING),
          eq(media.organizationId, ORG),
          eq(media.status, "processed"),
          isNull(media.deletedAt),
        ),
      )
      .limit(1);
    expect(galleryMedia).toBeDefined();
    expect(galleryMedia!.publicId).toBe(uploadResult.publicId!);

    /***********************************************************************
     * STEP 7 — Lifecycle sweep / expiry chain
     *
     * One status step per sweep (org-scoped, far-future instants):
     *   active → upload_closed → download_only (sessions revoked) → expired
     *   → archived (vault archived) → deletion_pending → deleted (tombstone).
     **********************************************************************/
    // Sweep 1: past the upload deadline → upload_closed.
    const sweep1 = await runLifecycleSweep(new Date("2040-01-01T00:00:00.000Z"), {
      organizationId: ORG,
    });
    expect(sweep1.statusTransitions.map((t) => t.toStatus)).toEqual(["upload_closed"]);
    const [weddingAfterSweep1] = await db
      .select()
      .from(weddings)
      .where(eq(weddings.id, WEDDING))
      .limit(1);
    expect(weddingAfterSweep1!.status).toBe("upload_closed");

    // Uploads are now blocked (status gate + deadline) but downloads remain.
    await expect(
      initiateGuestUpload(rawToken, {
        filename: "extra.jpg",
        contentType: "image/jpeg",
        sizeBytes: 500,
      }),
    ).rejects.toThrow(ForbiddenError);

    const downloadStillAllowed = await getGuestDownloadUrlForPublicMedia(
      vaultSlug,
      uploadResult.publicId!,
      { variant: "original", storage },
    );
    expect(downloadStillAllowed.url).toBeDefined();

    // Sweep 2: past the download deadline → download_only, sessions revoked.
    const sweep2 = await runLifecycleSweep(new Date("2045-01-01T00:00:00.000Z"), {
      organizationId: ORG,
    });
    expect(sweep2.statusTransitions.map((t) => t.toStatus)).toEqual(["download_only"]);
    expect(sweep2.guestSessionsRevoked).toBeGreaterThanOrEqual(1);
    const [weddingAfterSweep2] = await db
      .select()
      .from(weddings)
      .where(eq(weddings.id, WEDDING))
      .limit(1);
    expect(weddingAfterSweep2!.status).toBe("download_only");

    // Downloads and uploads are both blocked at download_only. The sweep
    // revoked the live guest session, so the token check fails first with the
    // revoked-token error (the status gate is the second line of defense).
    await expect(
      getGuestDownloadUrlForPublicMedia(vaultSlug, uploadResult.publicId!, {
        variant: "original",
        storage,
      }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      initiateGuestUpload(rawToken, {
        filename: "extra2.jpg",
        contentType: "image/jpeg",
        sizeBytes: 500,
      }),
    ).rejects.toThrow(GuestTokenRevokedError);

    // Sweep 3: + expiry retention grace → expired.
    const sweep3 = await runLifecycleSweep(new Date("2050-01-01T00:00:00.000Z"), {
      organizationId: ORG,
    });
    expect(sweep3.statusTransitions.map((t) => t.toStatus)).toEqual(["expired"]);
    const [weddingAfterSweep3] = await db
      .select()
      .from(weddings)
      .where(eq(weddings.id, WEDDING))
      .limit(1);
    expect(weddingAfterSweep3!.status).toBe("expired");

    // Sweep 4: + archive grace → archived (vault archived too).
    const sweep4 = await runLifecycleSweep(new Date("2055-01-01T00:00:00.000Z"), {
      organizationId: ORG,
    });
    expect(sweep4.statusTransitions.map((t) => t.toStatus)).toEqual(["archived"]);
    const [weddingAfterSweep4] = await db
      .select()
      .from(weddings)
      .where(eq(weddings.id, WEDDING))
      .limit(1);
    expect(weddingAfterSweep4!.status).toBe("archived");
    const [vaultArchived] = await db
      .select({ status: vaults.status })
      .from(vaults)
      .where(eq(vaults.weddingId, WEDDING))
      .limit(1);
    expect(vaultArchived!.status).toBe("archived");

    // Sweep 5: + retention period → deletion_pending.
    const sweep5 = await runLifecycleSweep(new Date("2065-01-01T00:00:00.000Z"), {
      organizationId: ORG,
    });
    expect(sweep5.statusTransitions.map((t) => t.toStatus)).toEqual(["deletion_pending"]);
    const [weddingAfterSweep5] = await db
      .select()
      .from(weddings)
      .where(eq(weddings.id, WEDDING))
      .limit(1);
    expect(weddingAfterSweep5!.status).toBe("deletion_pending");

    // Sweep 6: + purge cancellation window → deleted (tombstone; the row and
    // its vault survive for audit/forensics with a deletedAt stamp).
    const sweep6 = await runLifecycleSweep(new Date("2075-01-01T00:00:00.000Z"), {
      organizationId: ORG,
    });
    expect(sweep6.weddingsPurged).toBe(1);
    expect(sweep6.statusTransitions.map((t) => t.toStatus)).toEqual(["deleted"]);

    const [weddingAfterSweep6] = await db
      .select({ status: weddings.status, deletedAt: weddings.deletedAt })
      .from(weddings)
      .where(eq(weddings.id, WEDDING))
      .limit(1);
    expect(weddingAfterSweep6).toBeDefined();
    expect(weddingAfterSweep6!.status).toBe("deleted");
    expect(weddingAfterSweep6!.deletedAt).not.toBeNull();

    const [vaultAfterPurge] = await db
      .select({ status: vaults.status, deletedAt: vaults.deletedAt })
      .from(vaults)
      .where(eq(vaults.weddingId, WEDDING))
      .limit(1);
    expect(vaultAfterPurge).toBeDefined();
    expect(vaultAfterPurge!.deletedAt).not.toBeNull();

    console.log(
      "✅ Phase 14 E2E integration test completed successfully — full flow verified.",
    );
  });
});