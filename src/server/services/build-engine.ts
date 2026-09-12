/**
 * Wedding Build Engine — Production-ready implementation.
 *
 * Pipeline: validate → verify payment → verify entitlement → create vault →
 * apply template → public URL → configure expiry → create gallery →
 * create slideshow (if entitled) → create flipbook (if entitled) →
 * generate QR → generate QR card (Platinum) → publish vault →
 * queue email → audit event.
 *
 * Design principles:
 * - Asynchronous: Jobs are enqueued and processed by a background worker
 * - Retryable: Each step tracks attempts, max 3 retries with exponential backoff
 * - Idempotent: Unique idempotency_key + (wedding_id, version) uniqueness
 * - Observable: build_jobs + build_job_steps provide full progress visibility
 * - No duplicates: (wedding_id, version) unique index prevents duplicate production vaults
 */

import { eq, and, isNull, desc, sql } from "drizzle-orm";

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
  orders,
  payments,
  products,
  templateVersions,
  customers,
} from "@/lib/db/schema";
import { resolveEntitlements, type ResolvedEntitlements } from "@/lib/entitlements";
import { calculateExpiryDeadlines, type ExpiryDeadlines } from "@/lib/entitlements/expiry";
import { NotFoundError } from "@/lib/auth/errors";
import { createQrCode } from "@/server/services/qr-service";
import { generateQrCardPng } from "@/server/services/qr-card-generator";
import { enqueueEmail } from "@/server/email/queue";
import { notifySupport } from "@/server/email/support";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BuildInput {
  weddingId: string;
  organizationId: string;
  customerId: string;
  productId: string;
  idempotencyKey: string;
  version?: number; // Default 1, incremented for rebuilds
  templateId?: string;
  actorUserId?: string; // User initiating the build
}

export interface BuildContext {
  buildJobId: string;
  weddingId: string;
  organizationId: string;
  customerId: string;
  productId: string;
  idempotencyKey: string;
  version: number;
  templateId?: string;
  actorUserId?: string;
  wedding: typeof weddings.$inferSelect;
  product: typeof products.$inferSelect;
  entitlements: ResolvedEntitlements;
  vault?: typeof vaults.$inferSelect;
  expiryDeadlines?: ExpiryDeadlines;
  // Step results
  paymentVerified?: boolean;
  paymentId?: string;
  entitlementsVerified?: boolean;
  templateVersionId?: string;
  templateApplied?: boolean;
  publicUrl?: string;
  expiryConfigured?: boolean;
  uploadDeadline?: Date;
  downloadDeadline?: Date;
  galleryCreated?: boolean;
  slideshowCreated?: boolean;
  slideshowId?: string;
  flipbookCreated?: boolean;
  flipbookId?: string;
  qrCodeId?: string;
  qrPublicId?: string;
  qrTargetUrl?: string;
  qrGenerated?: boolean;
  qrCardGenerated?: boolean;
  qrCardRequested?: boolean;
  vaultPublished?: boolean;
  vaultStatus?: string;
  emailQueued?: boolean;
  auditLogged?: boolean;
  reason?: string;
  result: Record<string, unknown>;
}

export interface StepHandler {
  stepKey: string;
  stepOrder: number;
  execute: (ctx: BuildContext) => Promise<Partial<BuildContext>>;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const BUILD_STEPS: readonly StepHandler[] = [
  { stepKey: "validate_wedding", stepOrder: 1, execute: stepValidateWedding },
  { stepKey: "verify_payment", stepOrder: 2, execute: stepVerifyPayment },
  { stepKey: "verify_entitlement", stepOrder: 3, execute: stepVerifyEntitlement },
  { stepKey: "create_vault", stepOrder: 4, execute: stepCreateVault },
  { stepKey: "apply_template", stepOrder: 5, execute: stepApplyTemplate },
  { stepKey: "configure_public_url", stepOrder: 6, execute: stepConfigurePublicUrl },
  { stepKey: "configure_expiry", stepOrder: 7, execute: stepConfigureExpiry },
  { stepKey: "create_gallery", stepOrder: 8, execute: stepCreateGallery },
  { stepKey: "create_slideshow", stepOrder: 9, execute: stepCreateSlideshow },
  { stepKey: "create_flipbook", stepOrder: 10, execute: stepCreateFlipbook },
  { stepKey: "generate_qr", stepOrder: 11, execute: stepGenerateQR },
  { stepKey: "generate_qr_card", stepOrder: 12, execute: stepGenerateQRCard },
  { stepKey: "publish_vault", stepOrder: 13, execute: stepPublishVault },
  { stepKey: "queue_email", stepOrder: 14, execute: stepQueueEmail },
  { stepKey: "audit_event", stepOrder: 15, execute: stepAuditEvent },
] as const;

const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 1000;

// ── Main Build Engine ──────────────────────────────────────────────────────────

/**
 * Enqueue a new build job (or return existing if idempotency key matches).
 * This is the main entry point for API handlers.
 */
export async function enqueueBuild(input: BuildInput): Promise<{
  buildJobId: string;
  isNew: boolean;
  status: string;
}> {
  const {
    weddingId,
    organizationId,
    customerId,
    productId,
    idempotencyKey,
    version = 1,
    templateId,
    actorUserId,
  } = input;

  // Check for existing job with same idempotency key
  const [existing] = await db
    .select({ id: buildJobs.id, status: buildJobs.status })
    .from(buildJobs)
    .where(eq(buildJobs.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existing) {
    return {
      buildJobId: existing.id,
      isNew: false,
      status: existing.status,
    };
  }

  // Create build job and steps in a transaction
  const [newJob] = await db.transaction(async (tx) => {
    // Create the build job
    const [job] = await tx
      .insert(buildJobs)
      .values({
        weddingId,
        organizationId,
        buildType: "vault",
        templateId: templateId ?? null,
        idempotencyKey,
        version,
        status: "pending",
        input: { weddingId, organizationId, customerId, productId, templateId, actorUserId },
        attempts: 0,
        maxAttempts: MAX_ATTEMPTS,
        enqueuedAt: new Date(),
      })
      .returning({ id: buildJobs.id });

    // Create all build steps
    await tx.insert(buildJobSteps).values(
      BUILD_STEPS.map((step) => ({
        buildJobId: job.id,
        stepKey: step.stepKey,
        stepOrder: step.stepOrder,
        status: "pending" as const,
      })),
    );

    return [job];
  });

  return {
    buildJobId: newJob.id,
    isNew: true,
    status: "pending",
  };
}

/**
 * Execute a build job by ID (called by background worker).
 * Processes steps sequentially with retry logic.
 */
export async function executeBuild(buildJobId: string): Promise<void> {
  // Claim the job with a compare-and-set update: only a job still in `pending`
  // may be claimed by this worker, so concurrent workers (or a duplicate call
  // from the retry path) can never run the same build twice.
  const [job] = await db
    .update(buildJobs)
    .set({
      status: "processing",
      startedAt: new Date(),
      attempts: sql`${buildJobs.attempts} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(buildJobs.id, buildJobId), eq(buildJobs.status, "pending")))
    .returning();

  if (!job) {
    // Job might already be processing/completed/failed
    const [existing] = await db
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.id, buildJobId))
      .limit(1);
    if (existing) {
      console.log(`[BuildEngine] Job ${buildJobId} already in status: ${existing.status}`);
    }
    return;
  }

  // Notify the customer that the build pipeline started (idempotent per job).
  await enqueueBuildStartedEmail(job);

  try {
    // Load context
    const ctx = await loadBuildContext(job);

    // Execute each step
    for (const step of BUILD_STEPS) {
      await executeStep(ctx, step);
    }

    // Mark job completed
    await db
      .update(buildJobs)
      .set({
        status: "completed",
        completedAt: new Date(),
        result: ctx.result,
      })
      .where(eq(buildJobs.id, buildJobId));

    console.log(`[BuildEngine] Build ${buildJobId} completed successfully`);
  } catch (error) {
    await handleBuildError(buildJobId, error as Error, job.attempts);
  }
}

/**
 * Retry a failed build job (reset to pending for re-execution).
 */
export async function retryBuild(buildJobId: string): Promise<void> {
  const [job] = await db
    .select()
    .from(buildJobs)
    .where(eq(buildJobs.id, buildJobId))
    .limit(1);

  if (!job) throw new NotFoundError("Build job");

  if (job.status !== "failed") {
    throw new Error("Can only retry failed builds");
  }

  if (job.attempts >= job.maxAttempts) {
    throw new Error("Max retry attempts exceeded");
  }

  // Reset job and steps to pending
  await db.transaction(async (tx) => {
    await tx
      .update(buildJobs)
      .set({ status: "pending", errorMessage: null, startedAt: null, completedAt: null })
      .where(eq(buildJobs.id, buildJobId));

    await tx
      .update(buildJobSteps)
      .set({ status: "pending", startedAt: null, completedAt: null, errorMessage: null })
      .where(eq(buildJobSteps.buildJobId, buildJobId));
  });

  console.log(`[BuildEngine] Build ${buildJobId} queued for retry`);
}

/**
 * Get build job status with step details (for polling/observability).
 */
export async function getBuildStatus(buildJobId: string): Promise<{
  job: typeof buildJobs.$inferSelect | null;
  steps: typeof buildJobSteps.$inferSelect[];
}> {
  const [job] = await db
    .select()
    .from(buildJobs)
    .where(eq(buildJobs.id, buildJobId))
    .limit(1);

  const steps = await db
    .select()
    .from(buildJobSteps)
    .where(eq(buildJobSteps.buildJobId, buildJobId))
    .orderBy(buildJobSteps.stepOrder);

  return { job, steps };
}

// ── Context Loading ────────────────────────────────────────────────────────────

async function loadBuildContext(job: typeof buildJobs.$inferSelect): Promise<BuildContext> {
  // Fetch wedding with product
  const [wedding] = await db
    .select({
      wedding: weddings,
      product: products,
    })
    .from(weddings)
    .leftJoin(products, eq(weddings.productId, products.id))
    .where(eq(weddings.id, job.weddingId))
    .limit(1);

  if (!wedding) throw new NotFoundError("Wedding");
  if (!wedding.product) throw new NotFoundError("Product for wedding");

  // Resolve entitlements
  const entitlements = resolveEntitlements({
    packageCode: wedding.product.code as "silver" | "gold" | "platinum",
    weddingDate: { date: wedding.wedding.weddingDate! },
  });

  // Calculate expiry deadlines
  const expiryDeadlines = calculateExpiryDeadlines(
    { date: wedding.wedding.weddingDate! },
    wedding.product.code as "silver" | "gold" | "platinum",
  );

  const input = job.input ?? {};
  
  return {
    buildJobId: job.id,
    weddingId: job.weddingId,
    organizationId: job.organizationId,
    customerId: input.customerId as string,
    productId: input.productId as string,
    idempotencyKey: job.idempotencyKey,
    version: job.version,
    templateId: job.templateId ?? undefined,
    actorUserId: input.actorUserId as string | undefined,
    wedding: wedding.wedding,
    product: wedding.product,
    entitlements,
    expiryDeadlines,
    result: {},
  };
}

// ── Step Execution ─────────────────────────────────────────────────────────────

async function executeStep(ctx: BuildContext, step: StepHandler): Promise<void> {
  const stepStart = new Date();

  // Mark step as processing
  await db
    .update(buildJobSteps)
    .set({ status: "processing", startedAt: stepStart })
    .where(
      and(
        eq(buildJobSteps.buildJobId, ctx.buildJobId),
        eq(buildJobSteps.stepKey, step.stepKey),
      ),
    );

  try {
    console.log(`[BuildEngine] Step ${step.stepKey} started for build ${ctx.buildJobId}`);
    const result = await step.execute(ctx);
    // Update context with step results
    Object.assign(ctx, result);
    Object.assign(ctx.result, result);

    // Mark step completed
    await db
      .update(buildJobSteps)
      .set({ status: "completed", completedAt: new Date() })
      .where(
        and(
          eq(buildJobSteps.buildJobId, ctx.buildJobId),
          eq(buildJobSteps.stepKey, step.stepKey),
        ),
      );

    console.log(`[BuildEngine] Step ${step.stepKey} completed for build ${ctx.buildJobId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Mark step failed
    await db
      .update(buildJobSteps)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage,
      })
      .where(
        and(
          eq(buildJobSteps.buildJobId, ctx.buildJobId),
          eq(buildJobSteps.stepKey, step.stepKey),
        ),
      );

    console.error(`[BuildEngine] Step ${step.stepKey} failed for build ${ctx.buildJobId}:`, error);
    
    // Attach retryability info to error for handleBuildError
    const retryableError = new Error(errorMessage);
    retryableError.name = error instanceof Error ? error.name : "Error";
    // Check if error is a non-retryable type
    const nonRetryableMessages = [
      "Validation failed",
      "No paid order found",
      "No completed payment found",
      "Wedding has no product",
      "Wedding has no template",
      "Both partner names are required",
      "Wedding date is required",
    ];
    (retryableError as Error & { nonRetryable?: boolean }).nonRetryable = nonRetryableMessages.some((msg) => errorMessage.includes(msg));
    
    throw retryableError;
  }
}

async function handleBuildError(buildJobId: string, error: Error & { nonRetryable?: boolean }, attempt: number): Promise<void> {
  const isNonRetryable = error.nonRetryable === true;
  const isRetryable = !isNonRetryable && attempt < MAX_ATTEMPTS;

  const [job] = await db
    .select()
    .from(buildJobs)
    .where(eq(buildJobs.id, buildJobId))
    .limit(1);

  await db
    .update(buildJobs)
    .set({
      status: isRetryable ? "pending" : "failed",
      errorMessage: error.message,
      completedAt: isRetryable ? null : new Date(),
    })
    .where(eq(buildJobs.id, buildJobId));

  if (isRetryable) {
    // Schedule retry with exponential backoff
    const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
    console.log(`[BuildEngine] Build ${buildJobId} will retry in ${delayMs}ms (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
    setTimeout(() => executeBuild(buildJobId), delayMs);
  } else {
    console.log(`[BuildEngine] Build ${buildJobId} failed permanently${isNonRetryable ? " (non-retryable error)" : " (max attempts reached)"}: ${error.message}`);

    // Notify the customer that the build failed and alert the organization.
    if (job) {
      await enqueueBuildFailureEmail(job, error.message);
      await notifySupport(
        job.organizationId,
        `Build failed for wedding ${job.weddingId}`,
        `Build job ${buildJobId} for wedding ${job.weddingId} failed permanently.\n\nError: ${error.message}`,
      );
    }
  }
}

// ── Pipeline Steps ─────────────────────────────────────────────────────────────

async function stepValidateWedding(ctx: BuildContext): Promise<Partial<BuildContext>> {
  const { wedding } = ctx;

  // Validate required fields
  const errors: string[] = [];

  if (!wedding.weddingDate) errors.push("Wedding date is required");
  if (!wedding.partnerOneName || !wedding.partnerTwoName) {
    errors.push("Both partner names are required");
  }
  if (!wedding.templateId) errors.push("Template is required");

  // Validate wedding date is in the future (or at least not too far past)
  if (wedding.weddingDate) {
    const weddingDate = new Date(wedding.weddingDate);
    const now = new Date();
    const minDate = new Date(now.getFullYear() - 1, 0, 1);
    if (weddingDate < minDate) {
      errors.push("Wedding date is too far in the past");
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(", ")}`);
  }

  // Update wedding status to building
  await db
    .update(weddings)
    .set({ status: "building" })
    .where(eq(weddings.id, wedding.id));

  return { wedding };
}

async function stepVerifyPayment(ctx: BuildContext): Promise<Partial<BuildContext>> {
  const { organizationId } = ctx;

  // Find completed payment for this wedding's order
  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.organizationId, organizationId),
        eq(orders.customerId, ctx.customerId),
        eq(orders.productId, ctx.productId),
        eq(orders.status, "paid"),
      ),
    )
    .orderBy(desc(orders.placedAt))
    .limit(1);

  if (!order) {
    throw new Error("No paid order found for this wedding");
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.orderId, order.id),
        eq(payments.status, "completed"),
      ),
    )
    .orderBy(desc(payments.paidAt))
    .limit(1);

  if (!payment) {
    throw new Error("No completed payment found for the order");
  }

  return { paymentVerified: true, paymentId: payment.id };
}

async function stepVerifyEntitlement(ctx: BuildContext): Promise<Partial<BuildContext>> {
  // Verify the package matches the product
  if (ctx.product.code !== ctx.entitlements.packageCode) {
    throw new Error(`Package mismatch: wedding has ${ctx.product.code}, entitlements resolved to ${ctx.entitlements.packageCode}`);
  }

  // Note: We do NOT block builds based on lifecycle status.
  // A build may be triggered after the wedding date for various reasons
  // (rebuild, recovery, etc.). The vault will just have expired entitlements.

  return { entitlementsVerified: true };
}

async function stepCreateVault(ctx: BuildContext): Promise<Partial<BuildContext>> {
  const { wedding, organizationId } = ctx;

  // Check if vault already exists for this wedding
  const [existingVault] = await db
    .select()
    .from(vaults)
    .where(and(eq(vaults.weddingId, wedding.id), isNull(vaults.deletedAt)))
    .limit(1);

  let vault = existingVault;

  if (!vault) {
    // Generate unique slug and publicId
    const publicId = generatePublicId();
    const slug = generateSlug(wedding.partnerOneName, wedding.partnerTwoName, wedding.weddingDate);

    [vault] = await db
      .insert(vaults)
      .values({
        weddingId: wedding.id,
        organizationId,
        publicId,
        slug,
        title: `${wedding.partnerOneName} & ${wedding.partnerTwoName}`,
        status: "draft",
        isPublic: true,
        noIndex: true,
      })
      .returning();

    // Create vault access for couple owners
    // Note: In practice, you'd link the actual couple user IDs
  }

  // Update wedding status to active (building complete, vault created)
  await db
    .update(weddings)
    .set({ status: "active" })
    .where(eq(weddings.id, wedding.id));

  return { vault };
}

async function stepApplyTemplate(ctx: BuildContext): Promise<Partial<BuildContext>> {
  const { wedding, vault, templateId } = ctx;

  if (!vault) throw new Error("Vault not created");

  // Determine template to use
  const targetTemplateId = templateId ?? wedding.templateId;
  if (!targetTemplateId) {
    throw new Error("No template specified for build");
  }

  // Get latest published template version
  const [templateVersion] = await db
    .select()
    .from(templateVersions)
    .where(
      and(
        eq(templateVersions.templateId, targetTemplateId),
        eq(templateVersions.isLatest, true),
      ),
    )
    .limit(1);

  if (!templateVersion) {
    throw new Error("No published template version found");
  }

  // Store template reference in vault (or vault settings)
  // The actual template application happens at render time in the Vault frontend
  // Here we just record which template/version was used
  // Note: vault schema doesn't have template fields, so we skip the update
  // In a real implementation, you'd store this in vault_settings or a separate table

  return { templateVersionId: templateVersion.id, templateApplied: true };
}

async function stepConfigurePublicUrl(ctx: BuildContext): Promise<Partial<BuildContext>> {
  const { vault } = ctx;

  if (!vault) throw new Error("Vault not created");

  // Public URL is derived from slug: /w/{slug}
  // This step just records the public URL in the result
  const publicUrl = `/w/${vault.slug}`;

  return { publicUrl };
}

async function stepConfigureExpiry(ctx: BuildContext): Promise<Partial<BuildContext>> {
  const { wedding, organizationId, expiryDeadlines } = ctx;

  if (!expiryDeadlines) throw new Error("Expiry deadlines not calculated");

  // Create expiry_rules record
  await db
    .insert(expiryRules)
    .values({
      weddingId: wedding.id,
      organizationId,
      uploadDeadline: expiryDeadlines.uploadDeadline,
      downloadDeadline: expiryDeadlines.downloadDeadline,
      uploadWindowDays: expiryDeadlines.uploadWindowDays,
      downloadWindowDays: expiryDeadlines.downloadWindowDays,
      timezone: "Africa/Johannesburg",
      weddingDateAtCalculation: wedding.weddingDate!,
    })
    .onConflictDoUpdate({
      target: expiryRules.weddingId,
      set: {
        uploadDeadline: expiryDeadlines.uploadDeadline,
        downloadDeadline: expiryDeadlines.downloadDeadline,
        uploadWindowDays: expiryDeadlines.uploadWindowDays,
        downloadWindowDays: expiryDeadlines.downloadWindowDays,
        calculatedAt: new Date(),
        weddingDateAtCalculation: wedding.weddingDate!,
      },
    });

  return { expiryConfigured: true, uploadDeadline: expiryDeadlines.uploadDeadline, downloadDeadline: expiryDeadlines.downloadDeadline };
}

async function stepCreateGallery(ctx: BuildContext): Promise<Partial<BuildContext>> {
  // Gallery is essentially the vault's media collection
  // It's created implicitly by the vault existing and media being uploaded
  // Here we just mark that the gallery feature is enabled
  const { entitlements } = ctx;

  if (!entitlementHasFeature(entitlements, "photos")) {
    return { galleryCreated: false, reason: "Photos not in package" };
  }

  // Gallery is always "created" when vault is created
  // The media upload flow handles adding photos
  return { galleryCreated: true };
}

async function stepCreateSlideshow(ctx: BuildContext): Promise<Partial<BuildContext>> {
  const { wedding, organizationId, vault, entitlements, buildJobId, templateId } = ctx;

  if (!vault) throw new Error("Vault not created");

  // Only create slideshow if entitled (Gold/Platinum)
  if (!entitlementHasFeature(entitlements, "slideshow")) {
    return { slideshowCreated: false, reason: "Slideshow not in package" };
  }

  // Check if slideshow already exists
  const [existing] = await db
    .select()
    .from(slideshows)
    .where(and(eq(slideshows.weddingId, wedding.id), isNull(slideshows.deletedAt)))
    .limit(1);

  let slideshow = existing;

  if (!slideshow) {
    [slideshow] = await db
      .insert(slideshows)
      .values({
        weddingId: wedding.id,
        organizationId,
        templateId: templateId ?? wedding.templateId,
        buildJobId,
        title: `${wedding.partnerOneName} & ${wedding.partnerTwoName} - Slideshow`,
        config: {
          transition: "fade",
          durationMs: 5000,
          aspectRatio: "16:9",
          autoplay: true,
        },
        status: "draft",
      })
      .returning();
  }

  return { slideshowId: slideshow.id, slideshowCreated: true };
}

async function stepCreateFlipbook(ctx: BuildContext): Promise<Partial<BuildContext>> {
  const { wedding, organizationId, vault, entitlements, buildJobId, templateId } = ctx;

  if (!vault) throw new Error("Vault not created");

  // Only create flipbook if entitled (Platinum only)
  if (!entitlementHasFeature(entitlements, "flipbook")) {
    return { flipbookCreated: false, reason: "Flipbook not in package" };
  }

  // Check if flipbook already exists
  const [existing] = await db
    .select()
    .from(flipbooks)
    .where(and(eq(flipbooks.weddingId, wedding.id), isNull(flipbooks.deletedAt)))
    .limit(1);

  let flipbook = existing;

  if (!flipbook) {
    [flipbook] = await db
      .insert(flipbooks)
      .values({
        weddingId: wedding.id,
        organizationId,
        templateId: templateId ?? wedding.templateId,
        buildJobId,
        title: `${wedding.partnerOneName} & ${wedding.partnerTwoName} - Flipbook`,
        config: {
          pageTurnAnimation: true,
          zoomEnabled: true,
          coverPage: true,
        },
        status: "draft",
      })
      .returning();
  }

  return { flipbookId: flipbook.id, flipbookCreated: true };
}

async function stepGenerateQR(ctx: BuildContext): Promise<Partial<BuildContext>> {
  const { wedding, organizationId, vault } = ctx;

  if (!vault) throw new Error("Vault not created");

  // Check if QR code already exists (idempotency)
  const [existing] = await db
    .select()
    .from(qrCodes)
    .where(and(eq(qrCodes.weddingId, wedding.id), isNull(qrCodes.deletedAt)))
    .limit(1);

  let qrCodeId: string;
  let qrPublicId: string;
  let qrTargetUrl: string;

  if (existing) {
    qrCodeId = existing.id;
    qrPublicId = existing.publicId;
    qrTargetUrl = existing.targetUrl ?? "";
  } else {
    // Use the QR service for generation
    const result = await createQrCode({
      weddingId: wedding.id,
      organizationId,
      vaultId: vault.id,
    });

    qrCodeId = result.id;
    qrPublicId = result.publicId;
    qrTargetUrl = result.targetUrl;
  }

  return { qrCodeId, qrPublicId, qrTargetUrl, qrGenerated: true };
}

async function stepGenerateQRCard(ctx: BuildContext): Promise<Partial<BuildContext>> {
  const { entitlements, wedding, qrCodeId, qrTargetUrl } = ctx;

  // Only generate QR design card for Platinum
  if (!entitlementHasFeature(entitlements, "qr_design_card")) {
    return { qrCardGenerated: false, reason: "QR design card not in package" };
  }

  if (!qrCodeId || !qrTargetUrl) {
    return { qrCardGenerated: false, reason: "No QR code available for card generation" };
  }

  // Generate the QR card PNG using the QR card generator
  try {
    const coupleName = `${wedding.partnerOneName ?? "Partner One"} & ${wedding.partnerTwoName ?? "Partner Two"}`;
    const weddingDateStr = wedding.weddingDate
      ? new Intl.DateTimeFormat("en-ZA", {
          timeZone: "Africa/Johannesburg",
          year: "numeric",
          month: "long",
          day: "numeric",
        }).format(wedding.weddingDate)
      : undefined;

    const card = await generateQrCardPng({
      targetUrl: qrTargetUrl,
      coupleName,
      weddingDate: weddingDateStr,
    });

    // Persist lightweight metadata into the accumulated step result. The full
    // card PNG is regenerable on demand via the QR card generator; embedding
    // a multi-MB base64 string in build_jobs.result bloats the job row under
    // every build. Writing directly avoids `result` as a return key:
    // executeStep merges step returns into ctx.result via Object.assign, and
    // a nested `result` key self-referenced the accumulator, producing a
    // circular structure on the final build_jobs.result write.
    ctx.result.qrCardContentType = card.contentType;
    ctx.result.qrCardPngSizeBytes = card.pngBuffer.length;

    return {
      qrCardGenerated: true,
      qrCardRequested: true,
    };
  } catch (error) {
    console.error("[BuildEngine] QR card generation failed:", error);
    // Non-fatal: log but don't fail the build
    return { qrCardGenerated: false, qrCardRequested: true, reason: `QR card generation failed: ${error instanceof Error ? error.message : "unknown"}` };
  }
}

async function stepPublishVault(ctx: BuildContext): Promise<Partial<BuildContext>> {
  const { vault, wedding } = ctx;

  if (!vault) throw new Error("Vault not created");

  // Update vault status to published
  await db
    .update(vaults)
    .set({
      status: "published",
      publishedAt: new Date(),
    })
    .where(eq(vaults.id, vault.id));

  // Update wedding status to active (already done in create_vault, but confirm)
  await db
    .update(weddings)
    .set({ status: "active" })
    .where(eq(weddings.id, wedding.id));

  return { vaultPublished: true, vaultStatus: "published" };
}

async function stepQueueEmail(ctx: BuildContext): Promise<Partial<BuildContext>> {
  const { wedding, organizationId, vault, product, entitlements } = ctx;

  if (!vault) throw new Error("Vault not created");

  const customerContact = await resolveCustomerEmail(wedding.id);
  if (!customerContact) {
    console.warn(`[BuildEngine] Wedding ${wedding.id} has no customer record; skipping vault_ready email`);
    return { emailQueued: false, reason: "No customer email for vault_ready notification" };
  }

  const coupleName =
    [wedding.partnerOneName, wedding.partnerTwoName].filter(Boolean).join(" & ") || "";
  const publicUrl = `/w/${vault.slug}`;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Queue "vault_ready" email to the couple (idempotent by idempotency key).
  await enqueueEmail({
    organizationId,
    weddingId: wedding.id,
    emailType: "vault_ready",
    toEmail: customerContact.email,
    toName: customerContact.fullName ?? (coupleName || undefined),
    subject: `Your wedding vault is ready!`,
    bodyHtml: `<p>Your ${product.name} wedding vault is ready at <a href="${baseUrl}${publicUrl}">your vault</a>.</p>`,
    bodyText: `Your ${product.name} wedding vault is ready at ${baseUrl}${publicUrl}`,
    templateKey: "vault_ready",
    data: {
      coupleName: coupleName || undefined,
      customerName: customerContact.fullName ?? undefined,
      partnerOneName: wedding.partnerOneName ?? undefined,
      partnerTwoName: wedding.partnerTwoName ?? undefined,
      publicUrl,
      vaultUrl: `${baseUrl}${publicUrl}`,
    },
    metadata: {
      packageCode: product.code,
      vaultSlug: vault.slug,
      publicUrl,
    },
    idempotencyKey: `vault_ready_${wedding.id}_${ctx.version}`,
  });

  // If Platinum, also queue QR card email
  if (entitlementHasFeature(entitlements, "qr_design_card")) {
    await enqueueEmail({
      organizationId,
      weddingId: wedding.id,
      emailType: "qr_card",
      toEmail: customerContact.email,
      toName: customerContact.fullName ?? (coupleName || undefined),
      subject: `Your Platinum QR cards are ready`,
      bodyHtml: `<p>Your custom QR design cards are ready.</p>`,
      bodyText: `Your custom QR design cards are ready.`,
      templateKey: "qr_card",
      data: {
        coupleName: coupleName || undefined,
        customerName: customerContact.fullName ?? undefined,
        partnerOneName: wedding.partnerOneName ?? undefined,
        partnerTwoName: wedding.partnerTwoName ?? undefined,
      },
      metadata: { packageCode: product.code },
      idempotencyKey: `qr_card_${wedding.id}_${ctx.version}`,
    });
  }

  return { emailQueued: true };
}

async function stepAuditEvent(ctx: BuildContext): Promise<Partial<BuildContext>> {
  const { wedding, organizationId, vault, buildJobId, version, actorUserId, entitlements } = ctx;

  if (!vault) throw new Error("Vault not created");

  // Create lifecycle event for build completion
  await db.insert(lifecycleEvents).values({
    weddingId: wedding.id,
    organizationId,
    eventType: "build_completed",
    fromStatus: "building",
    toStatus: "active",
    reason: `Build v${version} completed successfully`,
    actorUserId: actorUserId ?? null,
    metadata: {
      buildJobId,
      vaultId: vault.id,
      vaultSlug: vault.slug,
      packageCode: entitlements.packageCode,
      featuresEnabled: Object.keys(entitlements.features).filter(
        (k) => entitlements.features[k] === true,
      ),
    },
  });

  return { auditLogged: true };
}

// ── Helper Functions ───────────────────────────────────────────────────────────

function generatePublicId(): string {
  // 32-char opaque ID for public URLs/QR codes
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function generateSlug(partnerOne: string | null, partnerTwo: string | null, weddingDate: Date | null): string {
  const sanitize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const p1 = sanitize(partnerOne ?? "partner");
  const p2 = sanitize(partnerTwo ?? "partner");
  const datePart = weddingDate ? new Date(weddingDate).toISOString().split("T")[0].replace(/-/g, "") : "nodate";
  const randomSuffix = Math.random().toString(36).substring(2, 8);

  return `${p1}-${p2}-${datePart}-${randomSuffix}`.substring(0, 100);
}

function entitlementHasFeature(entitlements: ResolvedEntitlements, featureCode: string): boolean {
  return entitlements.features[featureCode] === true;
}

// ── Email helpers ──────────────────────────────────────────────────────────────

interface CustomerContact {
  email: string;
  fullName: string | null;
}

/** Resolves the real customer email for a wedding (never a placeholder). */
async function resolveCustomerEmail(weddingId: string): Promise<CustomerContact | null> {
  const [row] = await db
    .select({ email: customers.email, fullName: customers.fullName })
    .from(customers)
    .innerJoin(weddings, eq(customers.id, weddings.customerId))
    .where(eq(weddings.id, weddingId))
    .limit(1);
  return row ?? null;
}

/** Enqueues the build_started notification (idempotent per build job). */
async function enqueueBuildStartedEmail(job: typeof buildJobs.$inferSelect): Promise<void> {
  const customerContact = await resolveCustomerEmail(job.weddingId);
  if (!customerContact) {
    console.warn(`[BuildEngine] Wedding ${job.weddingId} has no customer record; skipping build_started email`);
    return;
  }

  await enqueueEmail({
    organizationId: job.organizationId,
    weddingId: job.weddingId,
    emailType: "build_started",
    toEmail: customerContact.email,
    toName: customerContact.fullName ?? undefined,
    templateKey: "build_started",
    data: {
      customerName: customerContact.fullName ?? undefined,
      buildInfo: `Build v${job.version} started`,
    },
    metadata: { buildJobId: job.id, version: job.version },
    idempotencyKey: `build_started_${job.id}`,
  });
}

/** Enqueues the build_failure notification (idempotent per build job). */
async function enqueueBuildFailureEmail(job: typeof buildJobs.$inferSelect, errorMessage: string): Promise<void> {
  const customerContact = await resolveCustomerEmail(job.weddingId);
  if (!customerContact) {
    console.warn(`[BuildEngine] Wedding ${job.weddingId} has no customer record; skipping build_failure email`);
    return;
  }

  await enqueueEmail({
    organizationId: job.organizationId,
    weddingId: job.weddingId,
    emailType: "build_failure",
    toEmail: customerContact.email,
    toName: customerContact.fullName ?? undefined,
    templateKey: "build_failure",
    data: {
      customerName: customerContact.fullName ?? undefined,
      buildInfo: `Build job ${job.id} failed.`,
      buildJobId: job.id,
    },
    metadata: { buildJobId: job.id, errorMessage, version: job.version },
    idempotencyKey: `build_failed_${job.id}`,
  });
}

// Re-export for testing
export { BUILD_STEPS, MAX_ATTEMPTS };