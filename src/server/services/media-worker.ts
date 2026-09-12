/**
 * Media Processing Worker — background processing for uploaded media.
 *
 * Mirrors the Build Worker polling pattern:
 *  - polls for pending media_processing_jobs
 *  - claims jobs with a CAS transition pending → processing
 *  - auto-retries failures up to maxAttempts, then fails the job
 *  - marks the media `processed` when all jobs complete / `failed` on permanent
 *    failure
 *
 * Job responsibilities:
 *  - content_hash   : re-derives the SHA-256 of the stored object, writes the
 *                     media sha256_hash, and audits content-hash duplicates.
 *  - thumbnail      : images → 320px-wide JPEG variant via sharp. Videos are a
 *                     documented no-op (no video thumbnails yet).
 *  - optimize       : images → `preview` (1280px) + `full` (2560px) WebP
 *                     variants via sharp. Videos are a documented no-op.
 *  - video_transcode: metadata probe only (MP4/MOV duration via ISO-BMFF box
 *                     walker). Real HLS transcoding requires ffmpeg and is a
 *                     documented limitation.
 *
 * All jobs are idempotent: deterministic variant keys + upsert rows.
 */

import { eq, and, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import sharp from "sharp";

import { db } from "@/lib/db";
import { auditLogs, media, mediaProcessingJobs, mediaVariants } from "@/lib/db/schema";
import { NotFoundError } from "@/lib/auth/errors";
import { createStorageClient, type StorageClient } from "@/server/services/storage/client";
import { isImageMime } from "@/server/services/storage/mime";
import { parseMp4Duration } from "@/server/services/video-metadata";

// ── Configuration ──────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_CONCURRENT_JOBS = 3;
const STALE_JOB_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

type MediaRow = typeof media.$inferSelect;
type VariantType = (typeof mediaVariants.$inferSelect)["variantType"];

// ── Worker State ───────────────────────────────────────────────────────────────

let isRunning = false;
let pollTimer: NodeJS.Timeout | null = null;
const activeJobs = new Set<string>();

// ── Job execution (exported for tests) ─────────────────────────────────────────

/**
 * Executes a single media processing job. Safe to call directly (tests and
 * manual retries). Always converges the job and media status — never throws
 * for processing failures; those are recorded on the job row.
 */
export async function executeMediaJob(jobId: string, storage?: StorageClient): Promise<void> {
  const [job] = await db
    .select()
    .from(mediaProcessingJobs)
    .where(eq(mediaProcessingJobs.id, jobId))
    .limit(1);
  if (!job) throw new NotFoundError("Media processing job");
  if (job.status === "completed" || job.status === "failed") return;

  // Never exceed the retry budget; permanently fail unprocessed jobs that did.
  if (job.attempts >= job.maxAttempts) {
    await db
      .update(mediaProcessingJobs)
      .set({
        status: "failed",
        errorMessage: "Exceeded maximum processing attempts",
        updatedAt: new Date(),
      })
      .where(eq(mediaProcessingJobs.id, jobId));
    await maybeMarkMediaProcessed(job.mediaId);
    return;
  }

  // Claim: only one worker (or user retry) may run a pending job.
  const claimed = await db
    .update(mediaProcessingJobs)
    .set({
      status: "processing",
      startedAt: new Date(),
      attempts: job.attempts + 1,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(and(eq(mediaProcessingJobs.id, jobId), eq(mediaProcessingJobs.status, "pending")))
    .returning({ id: mediaProcessingJobs.id });
  if (claimed.length === 0) return; // Another worker already claimed it.

  const attempts = job.attempts + 1;
  try {
    const client = storage ?? createStorageClient();
    await dispatchJob(job.jobType, job.mediaId, job.organizationId, client);

    await db
      .update(mediaProcessingJobs)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(mediaProcessingJobs.id, jobId));
    await maybeMarkMediaProcessed(job.mediaId);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 2000) : "Processing failed";
    const permanentlyFailed = attempts >= job.maxAttempts;
    await db
      .update(mediaProcessingJobs)
      .set(
        permanentlyFailed
          ? { status: "failed", errorMessage: message, updatedAt: new Date() }
          : { status: "pending", errorMessage: message, updatedAt: new Date() },
      )
      .where(eq(mediaProcessingJobs.id, jobId));
    if (permanentlyFailed) {
      await maybeMarkMediaProcessed(job.mediaId);
    }
    if (process.env.NODE_ENV !== "test") {
      console.error(`[MediaWorker] Job ${jobId} failed (${attempts}/${job.maxAttempts}): ${message}`);
    }
  }
}

type JobType = (typeof mediaProcessingJobs.$inferSelect)["jobType"];

/** Dispatches to the type-specific executor. */
async function dispatchJob(
  jobType: JobType,
  mediaId: string,
  organizationId: string,
  storage: StorageClient,
): Promise<void> {
  const [mediaRow] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, mediaId), eq(media.organizationId, organizationId)))
    .limit(1);
  if (!mediaRow) throw new NotFoundError("Media");

  switch (jobType) {
    case "content_hash":
      await hashAndCheckDuplicate(mediaRow, storage);
      break;
    case "thumbnail":
      await generateThumbnail(mediaRow, storage);
      break;
    case "optimize":
      await generateOptimizedVariants(mediaRow, storage);
      break;
    case "video_transcode":
      await probeVideoMetadata(mediaRow, storage);
      break;
    case "malware_scan":
      // Documented no-op: not part of the default pipeline (future feature).
      break;
    default: {
      // Exhaustive guard for future enum additions.
      const unreachable: never = jobType;
      throw new Error(`Unknown media job type: ${String(unreachable)}`);
    }
  }
}

// ── Job executors ──────────────────────────────────────────────────────────────

/** Re-derives the content hash and audits duplicates within the same wedding. */
async function hashAndCheckDuplicate(mediaRow: MediaRow, storage: StorageClient): Promise<void> {
  const buf = await storage.getObject(mediaRow.storageKey);
  const digest = createHash("sha256").update(buf).digest("hex");

  // Persist the re-derived hash (server-authoritative integrity check).
  await db
    .update(media)
    .set({ sha256Hash: digest, updatedAt: new Date() })
    .where(eq(media.id, mediaRow.id));

  const [duplicate] = await db
    .select({ id: media.id })
    .from(media)
    .where(
      and(
        eq(media.organizationId, mediaRow.organizationId),
        eq(media.weddingId, mediaRow.weddingId),
        eq(media.sha256Hash, digest),
        // Skip soft-deleted rows so a purged duplicate is not flagged.
        isNull(media.deletedAt),
      ),
    )
    .limit(1);

  if (duplicate && duplicate.id !== mediaRow.id) {
    await db.insert(auditLogs).values({
      organizationId: mediaRow.organizationId,
      action: "media.duplicate_detected",
      resourceType: "media",
      resourceId: mediaRow.id,
      metadata: { duplicateOf: duplicate.id, sha256: digest },
    });
  }
}

/** Images: 320px-wide JPEG thumbnail variant. Videos: documented no-op. */
async function generateThumbnail(mediaRow: MediaRow, storage: StorageClient): Promise<void> {
  if (!isImageMime(mediaRow.contentType)) {
    // Video thumbnails are a documented no-op (would require ffmpeg frame grab).
    return;
  }

  const buf = await storage.getObject(mediaRow.storageKey);
  const resized = await sharp(buf).rotate().resize({ width: 320 }).jpeg({ quality: 80 }).toBuffer();
  const resizedMeta = await sharp(resized).metadata();

  const variantStorageKey = buildVariantKey(mediaRow, "thumbnail", "jpg");
  await storage.putObject(variantStorageKey, resized, { contentType: "image/jpeg" });

  await upsertVariant(
    mediaRow,
    "thumbnail",
    variantStorageKey,
    "thumb.jpg",
    "image/jpeg",
    resized.length,
    { width: resizedMeta.width ?? 0, height: resizedMeta.height ?? 0 },
  );
}

/** Images: `preview` (1280px) + `full` (2560px) WebP variants. */
async function generateOptimizedVariants(mediaRow: MediaRow, storage: StorageClient): Promise<void> {
  if (!isImageMime(mediaRow.contentType)) {
    // Video optimization is a documented no-op for now.
    return;
  }

  const buf = await storage.getObject(mediaRow.storageKey);
  const base = sharp(buf).rotate();

  const preview = await base.clone().resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const full = await base.clone().resize({ width: 2560, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();

  const previewKey = buildVariantKey(mediaRow, "preview", "webp");
  const fullKey = buildVariantKey(mediaRow, "full", "webp");

  await Promise.all([
    storage.putObject(previewKey, preview, { contentType: "image/webp" }),
    storage.putObject(fullKey, full, { contentType: "image/webp" }),
  ]);

  const previewMeta = await sharp(preview).metadata();
  const fullMeta = await sharp(full).metadata();

  await upsertVariant(mediaRow, "preview", previewKey, "preview.webp", "image/webp", preview.length, {
    width: previewMeta.width ?? 0,
    height: previewMeta.height ?? 0,
  });
  await upsertVariant(mediaRow, "full", fullKey, "full.webp", "image/webp", full.length, {
    width: fullMeta.width ?? 0,
    height: fullMeta.height ?? 0,
  });
}

/** MP4/MOV duration probe (no transcoding). Stores duration_ms on the media. */
async function probeVideoMetadata(mediaRow: MediaRow, storage: StorageClient): Promise<void> {
  const buf = await storage.getObject(mediaRow.storageKey);
  const durationMs = parseMp4Duration(buf);

  if (durationMs !== null) {
    await db
      .update(media)
      .set({ durationMs, updatedAt: new Date() })
      .where(eq(media.id, mediaRow.id));
  }
}

// ── Variant helpers ────────────────────────────────────────────────────────────

function buildVariantKey(mediaRow: MediaRow, variantType: string, ext: string): string {
  // The per-object path segment is the opaque public id (not the internal
  // UUID) so variant URLs handed to guests never reveal internal ids.
  return (
    `${mediaRow.organizationId}/${mediaRow.weddingId}/` +
    `${mediaRow.publicId}.${variantType}.${ext}`
  );
}

/**
 * Upserts a media_variants row. The variant key is deterministic so re-runs
 * overwrite the object and keep the row consistent (idempotent).
 */
async function upsertVariant(
  mediaRow: MediaRow,
  variantType: VariantType,
  storageKey: string,
  filename: string,
  contentType: string,
  sizeBytes: number,
  dimensions: { width: number; height: number },
): Promise<void> {
  const [existing] = await db
    .select({ id: mediaVariants.id })
    .from(mediaVariants)
    .where(
      and(eq(mediaVariants.mediaId, mediaRow.id), eq(mediaVariants.variantType, variantType)),
    )
    .limit(1);

  if (existing) {
    await db
      .update(mediaVariants)
      .set({ storageKey, filename, contentType, sizeBytes, ...dimensions, updatedAt: new Date() })
      .where(eq(mediaVariants.id, existing.id));
    return;
  }

  await db.insert(mediaVariants).values({
    mediaId: mediaRow.id,
    variantType,
    storageKey,
    filename,
    contentType,
    sizeBytes,
    width: dimensions.width || null,
    height: dimensions.height || null,
  });
}

// ── Media status convergence ───────────────────────────────────────────────────

/**
 * When no jobs remain pending/processing, converge the media status:
 * any permanently-failed job → `failed`, otherwise all done → `processed`.
 */
export async function maybeMarkMediaProcessed(mediaId: string): Promise<void> {
  const jobs = await db
    .select({ status: mediaProcessingJobs.status })
    .from(mediaProcessingJobs)
    .where(eq(mediaProcessingJobs.mediaId, mediaId));

  const outstanding = jobs.filter((j) => j.status === "pending" || j.status === "processing");
  if (outstanding.length > 0) return;

  const permanentlyFailed = jobs.some((j) => j.status === "failed");
  await db
    .update(media)
    .set({ status: permanentlyFailed ? "failed" : "processed", updatedAt: new Date() })
    .where(eq(media.id, mediaId));
}

// ── Polling (mirrors the Build Worker) ─────────────────────────────────────────

/** Claims and runs up to MAX_CONCURRENT_JOBS pending jobs. Returns claimed count. */
export async function processPendingMediaJobs(storage?: StorageClient): Promise<number> {
  const pending = await db
    .select({ id: mediaProcessingJobs.id })
    .from(mediaProcessingJobs)
    .where(eq(mediaProcessingJobs.status, "pending"))
    .limit(Math.max(0, MAX_CONCURRENT_JOBS - activeJobs.size));

  let claimed = 0;
  for (const job of pending) {
    if (!isRunning && activeJobs.size === 0) break;
    if (activeJobs.has(job.id)) continue;

    activeJobs.add(job.id);
    claimed += 1;
    executeMediaJob(job.id, storage)
      .catch((error) => {
        console.error(`[MediaWorker] Job ${job.id} execution error:`, error);
      })
      .finally(() => {
        activeJobs.delete(job.id);
      });
  }

  return claimed;
}

/**
 * Resets jobs stuck in `processing` (e.g. worker crashed mid-job) that are
 * older than STALE_JOB_THRESHOLD_MS back to `pending` for retry.
 */
export async function recoverStaleMediaJobs(): Promise<number> {
  const staleThreshold = new Date(Date.now() - STALE_JOB_THRESHOLD_MS);
  const stale = await db
    .select({ id: mediaProcessingJobs.id, updatedAt: mediaProcessingJobs.updatedAt })
    .from(mediaProcessingJobs)
    .where(eq(mediaProcessingJobs.status, "processing"));

  let reset = 0;
  for (const job of stale) {
    if (!job.updatedAt || job.updatedAt >= staleThreshold) continue;
    await db
      .update(mediaProcessingJobs)
      .set({ status: "pending", startedAt: null, updatedAt: new Date() })
      .where(eq(mediaProcessingJobs.id, job.id));
    reset += 1;
  }
  return reset;
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

export function isMediaWorkerRunning(): boolean {
  return isRunning;
}

/** Starts the media worker (idempotent). */
export async function startMediaWorker(storage?: StorageClient): Promise<void> {
  if (isRunning) {
    console.log("[MediaWorker] Already running");
    return;
  }

  isRunning = true;
  console.log("[MediaWorker] Starting...");
  await recoverStaleMediaJobs();
  pollLoop(storage);
}

/** Stops the media worker gracefully. */
export async function stopMediaWorker(): Promise<void> {
  if (!isRunning) return;
  isRunning = false;
  console.log("[MediaWorker] Stopping...");

  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  const maxWaitMs = 30000;
  const startWait = Date.now();
  while (activeJobs.size > 0 && Date.now() - startWait < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (activeJobs.size > 0) {
    console.warn(`[MediaWorker] Force stopping with ${activeJobs.size} jobs still active`);
  }
  console.log("[MediaWorker] Stopped");
}

function pollLoop(storage?: StorageClient): void {
  if (!isRunning) return;

  processPendingMediaJobs(storage)
    .catch((error) => {
      console.error("[MediaWorker] Poll loop error:", error);
    })
    .finally(() => {
      if (isRunning) {
        pollTimer = setTimeout(() => pollLoop(storage), POLL_INTERVAL_MS);
      }
    });
}

// ── Graceful shutdown ──────────────────────────────────────────────────────────

if (typeof process !== "undefined") {
  process.on("SIGTERM", () => {
    void stopMediaWorker().then(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    void stopMediaWorker().then(() => process.exit(0));
  });
}