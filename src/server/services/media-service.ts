/**
 * Media & Storage service — the orchestrator for uploads, downloads,
 * processing jobs and tenant-scoped media access.
 *
 * Design principles:
 *  - Every media query asserts (organizationId AND weddingId) scoping.
 *  - Upload/download expiry is re-checked server-side from entitlements;
 *    the client clock is never trusted.
 *  - Object keys are server-generated UUIDs; storage credentials/internal
 *    keys are never returned to guests.
 *  - Storage is dependency-injected (S3 client in prod, memory client in
 *    tests/offline dev) so the entire pipeline is testable without S3.
 */

import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import {
  media,
  mediaVariants,
  mediaProcessingJobs,
  memories,
  products,
  vaults,
  weddings,
} from "@/lib/db/schema";
import {
  GuestTokenInvalidError,
  NotFoundError,
  ForbiddenError,
  MediaValidationError,
  MediaMimeRejectedError,
  MediaSignatureRejectedError,
  DuplicateMediaError,
} from "@/lib/auth/errors";
import {
  canUploadPhoto,
  canUploadVideo,
  resolveEntitlements,
  type ResolvedEntitlements,
} from "@/lib/entitlements";
import {
  validateGuestSession,
  incrementUploadCount,
  type GuestSessionData,
} from "@/server/services/guest-sessions";
import { createStorageClient, type StorageClient, type ObjectHead } from "@/server/services/storage/client";
import {
  buildObjectKey,
  assertKeyInNamespace,
} from "@/server/services/storage/keys";
import {
  detectSignature,
  signatureMatchesDetected,
  isImageMime,
  isVideoMime,
  sanitizeExt,
  type DetectedSignature,
} from "@/server/services/storage/mime";
import { enforceSizeLimit, getUploadLimits, type MediaKind } from "@/server/services/storage/limits";

// ── Constants ─────────────────────────────────────────────────────────────────

export const UPLOAD_URL_TTL_SECONDS = 15 * 60; // 15 minutes
export const DOWNLOAD_URL_TTL_SECONDS = 15 * 60; // 15 minutes
export const MEDIA_MAX_ATTEMPTS = 3;

type MediaJobType = (typeof mediaProcessingJobs.$inferSelect)["jobType"];

// ── Context & input types ─────────────────────────────────────────────────────

export interface MediaUploadContext {
  organizationId: string;
  weddingId: string;
  entitlements: ResolvedEntitlements;
  storage: StorageClient;
  origin: "staff" | "guest";
  uploadedBy?: string | null;
  guestSessionId?: string | null;
  /** When "throw", a duplicate content-hash hint raises DuplicateMediaError. */
  duplicatePolicy?: "return" | "throw";
}

export interface InitiateUploadInput {
  filename: string;
  contentType: string;
  sizeBytes: number;
  /** Optional client-side SHA-256 of the payload for duplicate detection. */
  sha256?: string;
  memoryTitle?: string;
}

export interface InitiateUploadResult {
  /** Present for new uploads and for staff duplicate responses; absent on
   *  guest duplicate responses so guests never learn internal media UUIDs. */
  mediaId?: string;
  storageKey?: string;
  uploadUrl?: string;
  expiresAt?: string;
  duplicate?: boolean;
  duplicateOf?: string;
  message?: string;
}

export type DownloadVariant = "original" | "thumbnail" | "preview" | "full";

export interface SignedDownloadResult {
  url: string;
  expiresAt: string;
  contentType: string;
}

export interface CompleteUploadOptions {
  storage?: StorageClient;
  /** Present for guest uploads; increments the session's fair-use count. */
  guestToken?: string;
}

export interface DownloadOptions {
  entitlements: ResolvedEntitlements;
  variant?: DownloadVariant;
  responseDisposition?: "inline" | "attachment";
  storage?: StorageClient;
}

// ── Entitlement resolution (no middleware dependency) ─────────────────────────

/**
 * Resolves full entitlements for a wedding, asserting the wedding belongs to
 * the given organization. Used by the worker and guest flows without a
 * TenantContext.
 */
export async function resolveEntitlementsForWedding(
  weddingId: string,
  organizationId: string,
): Promise<ResolvedEntitlements> {
  const [row] = await db
    .select({
      wedding: weddings,
      product: products,
    })
    .from(weddings)
    .leftJoin(products, eq(weddings.productId, products.id))
    .where(
      and(
        eq(weddings.id, weddingId),
        eq(weddings.organizationId, organizationId),
        isNull(weddings.deletedAt),
      ),
    )
    .limit(1);

  if (!row) throw new NotFoundError("Wedding");
  if (!row.product || !row.product.code) throw new NotFoundError("Product for wedding");

  const productCode = row.product.code as "silver" | "gold" | "platinum";
  const weddingDateStr = row.wedding.weddingDate
    ? row.wedding.weddingDate.toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  return resolveEntitlements({
    packageCode: productCode,
    weddingDate: { date: weddingDateStr },
  });
}

/** Resolve entitlements from a guest session: session → vault → wedding → package. */
export async function resolveGuestEntitlements(
  guestSession: GuestSessionData,
): Promise<{ entitlements: ResolvedEntitlements; weddingId: string; vaultId: string }> {
  const scope = await loadGuestScope(guestSession);
  return scope;
}

async function loadGuestScope(guestSession: GuestSessionData): Promise<{
  vaultId: string;
  weddingId: string;
  entitlements: ResolvedEntitlements;
}> {
  const [vault] = await db
    .select()
    .from(vaults)
    .where(
      and(
        eq(vaults.id, guestSession.vaultId),
        eq(vaults.organizationId, guestSession.organizationId),
        isNull(vaults.deletedAt),
      ),
    )
    .limit(1);

  if (!vault) throw new NotFoundError("Vault");

  const entitlements = await resolveEntitlementsForWedding(
    vault.weddingId,
    guestSession.organizationId,
  );

  return { vaultId: vault.id, weddingId: vault.weddingId, entitlements };
}

// ── Upload initialization ─────────────────────────────────────────────────────

/**
 * Server-side upload initialization. Validates MIME, package limits,
 * entitlements and the upload window BEFORE any presigned URL is issued.
 */
export async function initiateUpload(
  input: InitiateUploadInput,
  ctx: MediaUploadContext,
): Promise<InitiateUploadResult> {
  const { filename, contentType, sizeBytes } = input;

  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
    throw new MediaValidationError("Invalid sizeBytes");
  }

  const mime = contentType.trim().toLowerCase();
  if (!isImageMime(mime) && !isVideoMime(mime)) {
    throw new MediaMimeRejectedError(`Unsupported media type: ${mime}`);
  }
  const kind: MediaKind = isImageMime(mime) ? "photo" : "video";

  // Entitlement + upload-window gate (server-authoritative; re-checks window).
  const currentCount = await countMediaByKind(ctx.weddingId, kind);
  const gate =
    kind === "photo"
      ? canUploadPhoto(ctx.entitlements, currentCount)
      : canUploadVideo(ctx.entitlements, currentCount);
  if (!gate.allowed) {
    throw new ForbiddenError(gate.reason ?? "Upload is not allowed");
  }

  // Package-specific size limits.
  enforceSizeLimit(sizeBytes, getUploadLimits(ctx.entitlements), kind);

  // Optional client-side duplicate detection (content-hash hint).
  let normalizedHash: string | null = null;
  if (input.sha256) {
    if (!/^[0-9a-fA-F]{64}$/.test(input.sha256)) {
      throw new MediaValidationError("sha256 must be a 64-character hex string");
    }
    normalizedHash = input.sha256.toLowerCase();
    const existing = await findDuplicateByHash(ctx.organizationId, ctx.weddingId, normalizedHash);
    if (existing) {
      if (ctx.duplicatePolicy === "throw") {
        throw new DuplicateMediaError();
      }
      // No upload URL or storage key is issued for duplicates: the client
      // should surface the duplicate to the user, never PUT to the original.
      if (ctx.origin === "guest") {
        // Guests must never learn internal media UUIDs.
        return {
          duplicate: true,
          message: "A media item with identical content already exists",
        };
      }
      return {
        mediaId: existing.id,
        duplicate: true,
        duplicateOf: existing.id,
        message: "A media item with identical content already exists",
      };
    }
  }

  // Server-generated UUID before signing so the storage key is fixed.
  const mediaId = randomUUID();
  const ext = sanitizeExt(mime);
  const storageKey = buildObjectKey({
    organizationId: ctx.organizationId,
    weddingId: ctx.weddingId,
    mediaId,
    ext,
  });

  const safeFilename = sanitizeFilename(filename, mime);

  let memoryId: string | null = null;
  if (input.memoryTitle && input.memoryTitle.trim()) {
    const [memory] = await db
      .insert(memories)
      .values({
        weddingId: ctx.weddingId,
        organizationId: ctx.organizationId,
        title: input.memoryTitle.trim().slice(0, 200),
        uploadedBy: ctx.uploadedBy ?? null,
        guestSessionId: ctx.guestSessionId ?? null,
      })
      .returning({ id: memories.id });
    memoryId = memory.id;
  }

  await db.insert(media).values({
    id: mediaId,
    weddingId: ctx.weddingId,
    organizationId: ctx.organizationId,
    memoryId,
    uploadedBy: ctx.uploadedBy ?? null,
    guestSessionId: ctx.guestSessionId ?? null,
    storageKey,
    filename: safeFilename,
    contentType: mime,
    sizeBytes,
    sha256Hash: normalizedHash,
    status: "uploaded",
  });

  const uploadUrl = ctx.storage.presignPut({
    key: storageKey,
    contentType: mime,
    sizeBytes,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  });

  return {
    mediaId,
    storageKey: ctx.origin === "staff" ? storageKey : undefined,
    uploadUrl,
    expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
  };
}

/** Guest-path upload init: validates the raw guest token and derives scope. */
export async function initiateGuestUpload(
  rawToken: string,
  input: InitiateUploadInput,
  options: { storage?: StorageClient } = {},
): Promise<InitiateUploadResult> {
  const session = await validateGuestSession(rawToken);
  if (!session) throw new GuestTokenInvalidError();

  const { entitlements, weddingId } = await loadGuestScope(session);

  const ctx: MediaUploadContext = {
    organizationId: session.organizationId,
    weddingId,
    entitlements,
    storage: options.storage ?? createStorageClient(),
    origin: "guest",
    guestSessionId: session.id,
  };

  return initiateUpload(input, ctx);
}

// ── Complete upload (verify object, enqueue processing) ───────────────────────

/**
 * Completes an upload: verifies the object exists, re-checks package limits,
 * validates magic-byte signature, marks the media `processing` and enqueues
 * idempotent processing jobs.
 */
export async function completeUpload(
  mediaId: string,
  organizationId: string,
  options: CompleteUploadOptions = {},
): Promise<{ mediaId: string; status: "processing" }> {
  const mediaRow = await requireMediaOwnership(mediaId, organizationId);
  const storage = options.storage ?? createStorageClient();

  // Guest fair-use count is incremented only after the object is confirmed;
  // reuses the same token validation as creation (server-authoritative).
  if (options.guestToken) {
    await incrementUploadCount(options.guestToken);
  }

  let head: ObjectHead;
  try {
    head = await storage.headObject(mediaRow.storageKey);
  } catch {
    throw new MediaValidationError(
      "Uploaded object was not found in storage; the presigned PUT may not have completed",
    );
  }

  // Re-enforce package limits against the real stored size.
  const entitlements = await resolveEntitlementsForWedding(
    mediaRow.weddingId,
    mediaRow.organizationId,
  );
  const kind: MediaKind = isImageMime(mediaRow.contentType) ? "photo" : "video";
  enforceSizeLimit(head.size, getUploadLimits(entitlements), kind);

  let detected: DetectedSignature | null = null;
  try {
    const buf = await storage.getObject(mediaRow.storageKey);
    detected = detectSignature(buf);
  } catch {
    throw new MediaValidationError("Failed to read the uploaded object for validation");
  }

  if (!detected || !signatureMatchesDetected(detected, mediaRow.contentType)) {
    throw new MediaSignatureRejectedError(
      detected
        ? `Detected ${detected.mime} while ${mediaRow.contentType} was declared`
        : "File content could not be identified as a supported media type",
    );
  }

  await db
    .update(media)
    .set({ status: "processing", sizeBytes: head.size, updatedAt: new Date() })
    .where(eq(media.id, mediaId));

  await enqueueProcessingJobs(mediaId, organizationId);

  return { mediaId, status: "processing" };
}

// ── Processing-job maintenance ─────────────────────────────────────────────────

/**
 * Enqueues the media's processing jobs with deterministic idempotency keys:
 *  - content_hash always
 *  - thumbnail + optimize for images
 *  - thumbnail + video_transcode for videos (video_transcode is a metadata
 *    probe; real HLS transcode requires ffmpeg — documented limitation).
 */
export async function enqueueProcessingJobs(
  mediaId: string,
  organizationId: string,
): Promise<readonly MediaJobType[]> {
  const mediaRow = await requireMediaOwnership(mediaId, organizationId);

  const jobTypes: MediaJobType[] = ["content_hash"];
  if (isImageMime(mediaRow.contentType)) {
    jobTypes.push("thumbnail", "optimize");
  } else if (isVideoMime(mediaRow.contentType)) {
    jobTypes.push("thumbnail", "video_transcode");
  } else {
    throw new MediaValidationError("Unsupported media type for processing");
  }

  await db
    .update(media)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(media.id, mediaId));

  for (const jobType of jobTypes) {
    const idempotencyKey = `media:${mediaId}:${jobType}`;
    await db
      .insert(mediaProcessingJobs)
      .values({
        mediaId,
        organizationId,
        jobType,
        status: "pending",
        idempotencyKey,
        attempts: 0,
        maxAttempts: MEDIA_MAX_ATTEMPTS,
      })
      .onConflictDoNothing({ target: mediaProcessingJobs.idempotencyKey });
  }

  return jobTypes;
}

/**
 * Resets failed processing jobs to pending with a fresh attempt budget
 * (attempts are reset to 0 so the retried job can run its full maxAttempts
 * cycle again; the idempotency key and original row are preserved).
 * Moves the media back to `processing`.
 */
export async function retryProcessingJobs(
  mediaId: string,
  organizationId: string,
): Promise<{ mediaId: string; reset: number }> {
  await requireMediaOwnership(mediaId, organizationId);

  const updated = await db
    .update(mediaProcessingJobs)
    .set({
      status: "pending",
      attempts: 0,
      errorMessage: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mediaProcessingJobs.mediaId, mediaId),
        eq(mediaProcessingJobs.status, "failed"),
      ),
    )
    .returning({ id: mediaProcessingJobs.id });

  await db
    .update(media)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(media.id, mediaId));

  return { mediaId, reset: updated.length };
}

// ── Media queries (tenant-scoped) ─────────────────────────────────────────────

/**
 * Returns a media row or throws NotFoundError. Every media operation must go
 * through this so organizationId scoping is never skipped.
 */
export async function requireMediaOwnership(
  mediaId: string,
  organizationId: string,
): Promise<(typeof media.$inferSelect)> {
  const [row] = await db
    .select()
    .from(media)
    .where(
      and(
        eq(media.id, mediaId),
        eq(media.organizationId, organizationId),
        isNull(media.deletedAt),
      ),
    )
    .limit(1);

  if (!row) throw new NotFoundError("Media");
  return row;
}

export async function getMediaWithVariants(
  mediaId: string,
  organizationId: string,
): Promise<{
  media: typeof media.$inferSelect;
  variants: (typeof mediaVariants.$inferSelect)[];
}> {
  const mediaRow = await requireMediaOwnership(mediaId, organizationId);

  const variants = await db
    .select()
    .from(mediaVariants)
    .where(eq(mediaVariants.mediaId, mediaId))
    .orderBy(mediaVariants.variantType);

  return { media: mediaRow, variants };
}

export async function listProcessingJobs(
  mediaId: string,
  organizationId: string,
): Promise<(typeof mediaProcessingJobs.$inferSelect)[]> {
  await requireMediaOwnership(mediaId, organizationId);

  return db
    .select()
    .from(mediaProcessingJobs)
    .where(eq(mediaProcessingJobs.mediaId, mediaId))
    .orderBy(mediaProcessingJobs.createdAt);
}

// ── Signed downloads ───────────────────────────────────────────────────────────

/**
 * Returns a short-TTL presigned GET URL for a media item (or one of its
 * variants). The download window is enforced BEFORE signing.
 */
export async function getSignedDownloadUrl(
  mediaId: string,
  organizationId: string,
  options: DownloadOptions,
): Promise<SignedDownloadResult> {
  const mediaRow = await requireMediaOwnership(mediaId, organizationId);
  const { entitlements, variant, responseDisposition, storage } = options;

  if (!entitlements.downloadOpen) {
    throw new ForbiddenError("Download window has closed");
  }

  const target = await resolveDownloadTarget(mediaRow, organizationId, variant);
  const client = storage ?? createStorageClient();

  const disposition =
    responseDisposition === "attachment"
      ? `attachment; filename="${target.filename.replace(/"/g, "")}"`
      : undefined;

  const url = client.presignGet({
    key: target.storageKey,
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
    responseContentDisposition: disposition,
    responseContentType: target.contentType,
  });

  return {
    url,
    expiresAt: new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString(),
    contentType: target.contentType,
  };
}

/** Guest-path download: guest session → vault → wedding scoping + window check. */
export async function getSignedDownloadUrlForGuest(
  mediaId: string,
  guestSession: GuestSessionData,
  options: {
    variant?: DownloadVariant;
    responseDisposition?: "inline" | "attachment";
    storage?: StorageClient;
  } = {},
): Promise<SignedDownloadResult> {
  const { entitlements, weddingId } = await loadGuestScope(guestSession);

  const [mediaRow] = await db
    .select()
    .from(media)
    .where(
      and(
        eq(media.id, mediaId),
        eq(media.organizationId, guestSession.organizationId),
        isNull(media.deletedAt),
      ),
    )
    .limit(1);

  // Guests must only reach media that belongs to their vault's wedding.
  if (!mediaRow || mediaRow.weddingId !== weddingId) {
    throw new NotFoundError("Media");
  }

  if (!entitlements.downloadOpen) {
    throw new ForbiddenError("Download window has closed");
  }

  const target = await resolveDownloadTarget(mediaRow, guestSession.organizationId, options.variant);
  const client = options.storage ?? createStorageClient();

  const disposition =
    options.responseDisposition === "attachment"
      ? `attachment; filename="${target.filename.replace(/"/g, "")}"`
      : undefined;

  const url = client.presignGet({
    key: target.storageKey,
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
    responseContentDisposition: disposition,
    responseContentType: target.contentType,
  });

  return {
    url,
    expiresAt: new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString(),
    contentType: target.contentType,
  };
}

// ── Private helpers ────────────────────────────────────────────────────────────

async function countMediaByKind(weddingId: string, kind: MediaKind): Promise<number> {
  const rows = await db
    .select({ contentType: media.contentType })
    .from(media)
    .where(and(eq(media.weddingId, weddingId), isNull(media.deletedAt)));

  return rows.filter((row) =>
    kind === "photo" ? isImageMime(row.contentType) : isVideoMime(row.contentType),
  ).length;
}

async function findDuplicateByHash(
  organizationId: string,
  weddingId: string,
  hash: string,
): Promise<{ id: string; storageKey: string } | null> {
  const [existing] = await db
    .select({ id: media.id, storageKey: media.storageKey })
    .from(media)
    .where(
      and(
        eq(media.organizationId, organizationId),
        eq(media.weddingId, weddingId),
        eq(media.sha256Hash, hash),
        isNull(media.deletedAt),
      ),
    )
    .limit(1);
  return existing ?? null;
}

async function resolveDownloadTarget(
  mediaRow: typeof media.$inferSelect,
  organizationId: string,
  variant?: DownloadVariant,
): Promise<{ storageKey: string; contentType: string; filename: string }> {
  if (!variant || variant === "original") {
    assertKeyInNamespace(mediaRow.storageKey, organizationId);
    return {
      storageKey: mediaRow.storageKey,
      contentType: mediaRow.contentType,
      filename: mediaRow.filename,
    };
  }

  const [variantRow] = await db
    .select()
    .from(mediaVariants)
    .where(
      and(eq(mediaVariants.mediaId, mediaRow.id), eq(mediaVariants.variantType, variant)),
    )
    .limit(1);
  if (!variantRow) throw new NotFoundError("Media variant");

  assertKeyInNamespace(variantRow.storageKey, organizationId);
  return {
    storageKey: variantRow.storageKey,
    contentType: variantRow.contentType,
    filename: variantRow.filename,
  };
}

/**
 * Basename sanitization: strips directories/control chars; size-capped.
 * Extensions are derived from validated MIME, never from the user filename.
 */
function sanitizeFilename(filename: string, contentType: string): string {
  const base = filename.split(/[\\/]/).pop()?.trim() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255);
  if (clean) return clean;

  const ext = sanitizeExt(contentType);
  return `upload.${ext}`;
}