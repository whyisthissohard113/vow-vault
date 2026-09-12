/**
 * Build Engine Worker — Background job processor.
 *
 * This worker polls for pending build jobs and executes them.
 * Can be run as a standalone process or integrated with a job queue (BullMQ, etc.).
 *
 * For production, consider using a proper queue system like BullMQ with Redis.
 * This implementation uses database polling as a simple alternative.
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { buildJobs, buildJobSteps } from "@/lib/db/schema";
import { executeBuild, getBuildStatus, retryBuild } from "./build-engine";

// ── Configuration ──────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_CONCURRENT_JOBS = 3;

// ── Worker State ───────────────────────────────────────────────────────────────

let isRunning = false;
let pollTimer: NodeJS.Timeout | null = null;
const activeJobs = new Set<string>();

// ── Main Worker Functions ──────────────────────────────────────────────────────

/**
 * Start the build worker.
 */
export async function startBuildWorker(): Promise<void> {
  if (isRunning) {
    console.log("[BuildWorker] Already running");
    return;
  }

  isRunning = true;
  console.log("[BuildWorker] Starting build worker...");

  // Process any stale jobs on startup
  await recoverStaleJobs();

  // Start polling loop
  pollLoop();
}

/**
 * Stop the build worker gracefully.
 */
export async function stopBuildWorker(): Promise<void> {
  if (!isRunning) return;

  isRunning = false;
  console.log("[BuildWorker] Stopping build worker...");

  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  // Wait for active jobs to complete (with timeout)
  const maxWaitMs = 30000;
  const startWait = Date.now();
  while (activeJobs.size > 0 && Date.now() - startWait < maxWaitMs) {
    console.log(`[BuildWorker] Waiting for ${activeJobs.size} active jobs to complete...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (activeJobs.size > 0) {
    console.warn(`[BuildWorker] Force stopping with ${activeJobs.size} jobs still active`);
  }

  console.log("[BuildWorker] Stopped");
}

/**
 * Main polling loop.
 */
function pollLoop(): void {
  if (!isRunning) return;

  processPendingJobs()
    .catch((error) => {
      console.error("[BuildWorker] Error in poll loop:", error);
    })
    .finally(() => {
      if (isRunning) {
        pollTimer = setTimeout(pollLoop, POLL_INTERVAL_MS);
      }
    });
}

/**
 * Find and process pending build jobs.
 */
async function processPendingJobs(): Promise<void> {
  // Find pending jobs that are not currently being processed
  const pendingJobs = await db
    .select({ id: buildJobs.id })
    .from(buildJobs)
    .where(
      and(
        eq(buildJobs.status, "pending"),
        // Exclude jobs already being processed by this worker
        // In a distributed setup, you'd use a distributed lock
      ),
    )
    .limit(MAX_CONCURRENT_JOBS - activeJobs.size);

  for (const job of pendingJobs) {
    if (!isRunning) break;
    if (activeJobs.size >= MAX_CONCURRENT_JOBS) break;
    if (activeJobs.has(job.id)) continue;

    activeJobs.add(job.id);
    executeBuild(job.id)
      .catch((error) => {
        console.error(`[BuildWorker] Build ${job.id} failed:`, error);
      })
      .finally(() => {
        activeJobs.delete(job.id);
      });
  }
}

/**
 * Recover jobs that were stuck in "processing" state (e.g., worker crashed).
 */
async function recoverStaleJobs(): Promise<void> {
  const staleJobs = await db
    .select({ id: buildJobs.id, attempts: buildJobs.attempts, maxAttempts: buildJobs.maxAttempts })
    .from(buildJobs)
    .where(
      and(
        eq(buildJobs.status, "processing"),
        // Job started but never completed
      ),
    );

  for (const job of staleJobs) {
    console.log(`[BuildWorker] Found stale job ${job.id}, attempts: ${job.attempts}/${job.maxAttempts}`);

    // Check if any steps are stuck in processing
    const stuckSteps = await db
      .select()
      .from(buildJobSteps)
      .where(
        and(
          eq(buildJobSteps.buildJobId, job.id),
          eq(buildJobSteps.status, "processing"),
        ),
      );

    if (stuckSteps.length > 0) {
      // Reset stuck steps to pending
      await db
        .update(buildJobSteps)
        .set({ status: "pending", startedAt: null, errorMessage: null })
        .where(eq(buildJobSteps.buildJobId, job.id));
    }

    // Reset job to pending for retry
    await db
      .update(buildJobs)
      .set({ status: "pending", startedAt: null, errorMessage: null })
      .where(eq(buildJobs.id, job.id));

    console.log(`[BuildWorker] Reset stale job ${job.id} to pending for retry`);
  }
}

// ── Utility Functions (for admin/monitoring) ───────────────────────────────────

/**
 * Get worker status.
 */
export function getWorkerStatus(): {
  isRunning: boolean;
  activeJobs: number;
  maxConcurrent: number;
} {
  return {
    isRunning,
    activeJobs: activeJobs.size,
    maxConcurrent: MAX_CONCURRENT_JOBS,
  };
}

/**
 * Manually trigger processing of a specific build job.
 */
export async function triggerBuild(buildJobId: string): Promise<{
  success: boolean;
  status: string;
}> {
  const { job } = await getBuildStatus(buildJobId);

  if (!job) {
    return { success: false, status: "not_found" };
  }

  if (job.status === "pending") {
    activeJobs.add(buildJobId);
    executeBuild(buildJobId)
      .catch((error) => console.error(`[BuildWorker] Manual trigger failed for ${buildJobId}:`, error))
      .finally(() => activeJobs.delete(buildJobId));
    return { success: true, status: "triggered" };
  }

  if (job.status === "failed") {
    await retryBuild(buildJobId);
    return { success: true, status: "retry_queued" };
  }

  return { success: false, status: job.status };
}

/**
 * Get all pending/failed builds for admin dashboard.
 */
export async function getBuildQueue(): Promise<{
  pending: typeof buildJobs.$inferSelect[];
  processing: typeof buildJobs.$inferSelect[];
  failed: typeof buildJobs.$inferSelect[];
}> {
  const [pending, processing, failed] = await Promise.all([
    db.select().from(buildJobs).where(eq(buildJobs.status, "pending")).orderBy(buildJobs.enqueuedAt).limit(50),
    db.select().from(buildJobs).where(eq(buildJobs.status, "processing")).orderBy(buildJobs.startedAt).limit(50),
    db.select().from(buildJobs).where(eq(buildJobs.status, "failed")).orderBy(desc(buildJobs.updatedAt)).limit(50),
  ]);

  return { pending, processing, failed };
}

// ── Graceful Shutdown Handling ─────────────────────────────────────────────────

if (typeof process !== "undefined") {
  process.on("SIGTERM", async () => {
    console.log("[BuildWorker] SIGTERM received");
    await stopBuildWorker();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("[BuildWorker] SIGINT received");
    await stopBuildWorker();
    process.exit(0);
  });
}