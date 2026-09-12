/**
 * Email Worker — background sender for transactional email jobs.
 *
 * Mirrors the Media Worker polling pattern:
 *  - polls for pending `email_jobs` (respecting `scheduled_at`),
 *  - claims each job with a CAS transition pending → sending,
 *  - sends through the injected/configured EmailProvider,
 *  - records an `email_events` 'sent' row + an `email_sent` audit row,
 *  - on transient failure reverts to pending (attempts + 1), permanently
 *    failing + auditing once attempts are exhausted,
 *  - recovers jobs stuck in `sending` (e.g. crashed worker) once they are
 *    older than STALE_JOB_THRESHOLD_MS — a job is NEVER re-sent while another
 *    worker may still be delivering it.
 *
 * The same poll loop also runs the idempotent lifecycle automation sweep
 * (`scanLifecycleAutomation`) on a slower cadence.
 */

import { and, eq, isNull, lte, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { auditLogs, emailEvents, emailJobs } from "@/lib/db/schema";
import { NotFoundError } from "@/lib/auth/errors";
import { createEmailProvider, type EmailProvider } from "@/server/email/provider";
import { scanLifecycleAutomation } from "@/server/email/lifecycle";

// ── Configuration ──────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_CONCURRENT_JOBS = 3;
const STALE_JOB_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const LIFECYCLE_SCAN_EVERY_POLLS = 12; // ~1 minute at the 5s poll interval

// ── Worker State ───────────────────────────────────────────────────────────────

let isRunning = false;
let pollTimer: NodeJS.Timeout | null = null;
let pollCount = 0;
const activeJobs = new Set<string>();

type EmailJobRow = typeof emailJobs.$inferSelect;
type EmailEventType = (typeof emailEvents.$inferInsert)["eventType"];

// ── Job execution (exported for tests) ─────────────────────────────────────────

/**
 * Executes a single email job. Safe to call directly (tests and manual
 * retries). Converges the job and event/audit state — never throws for send
 * failures; those are recorded on the job row.
 */
export async function executeEmailJob(jobId: string, provider?: EmailProvider): Promise<void> {
  const [job] = await db
    .select()
    .from(emailJobs)
    .where(eq(emailJobs.id, jobId))
    .limit(1);
  if (!job) throw new NotFoundError("Email job");
  if (job.status === "sent" || job.status === "failed" || job.status === "cancelled") return;

  // Never exceed the retry budget; permanently fail jobs that did.
  if (job.attempts >= job.maxAttempts) {
    const reason = "Exceeded maximum send attempts";
    await db
      .update(emailJobs)
      .set({ status: "failed", errorMessage: reason, updatedAt: new Date() })
      .where(eq(emailJobs.id, jobId));
    await writeEmailEvent(jobId, "failed", { reason });
    await writeEmailAudit(job, "email_failed", { errorMessage: reason });
    return;
  }

  // Claim: only one worker (or manual retry) may run a pending job.
  const claimed = await db
    .update(emailJobs)
    .set({
      status: "sending",
      attempts: job.attempts + 1,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(and(eq(emailJobs.id, jobId), eq(emailJobs.status, "pending")))
    .returning({ id: emailJobs.id });
  if (claimed.length === 0) return; // Another worker already claimed it.

  const attempts = job.attempts + 1;
  try {
    const client = provider ?? createEmailProvider();
    const result = await client.send({
      toEmail: job.toEmail,
      toName: job.toName ?? undefined,
      fromEmail: job.fromEmail ?? undefined,
      subject: job.subject,
      html: job.bodyHtml ?? undefined,
      text: job.bodyText ?? undefined,
      metadata: job.metadata ?? undefined,
    });

    await db
      .update(emailJobs)
      .set({
        status: "sent",
        sentAt: new Date(),
        providerMessageId: result.messageId,
        updatedAt: new Date(),
      })
      .where(eq(emailJobs.id, jobId));

    await writeEmailEvent(jobId, "sent", { providerMessageId: result.messageId });
    await writeEmailAudit(job, "email_sent", { providerMessageId: result.messageId });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 2000) : "Email send failed";
    const permanentlyFailed = attempts >= job.maxAttempts;
    await db
      .update(emailJobs)
      .set(
        permanentlyFailed
          ? { status: "failed", errorMessage: message, updatedAt: new Date() }
          : { status: "pending", errorMessage: message, updatedAt: new Date() },
      )
      .where(eq(emailJobs.id, jobId));
    if (permanentlyFailed) {
      await writeEmailEvent(jobId, "failed", { reason: message });
      await writeEmailAudit(job, "email_failed", { errorMessage: message });
    }
    if (process.env.NODE_ENV !== "test") {
      console.error(`[EmailWorker] Job ${jobId} failed (${attempts}/${job.maxAttempts}): ${message}`);
    }
  }
}

// ── Event / audit helpers ──────────────────────────────────────────────────────

async function writeEmailEvent(
  jobId: string,
  eventType: EmailEventType,
  metadata: Record<string, unknown>,
): Promise<void> {
  await db.insert(emailEvents).values({
    emailJobId: jobId,
    eventType,
    // Delivery events carry their own provider_event_id; a worker-generated
    // 'sent' / 'failed' event intentionally leaves the provider id null so it
    // can never collide with (and dedupe away) a provider delivery event.
    providerEventId: null,
    occurredAt: new Date(),
    metadata,
  });
}

async function writeEmailAudit(
  job: EmailJobRow,
  action: string,
  extra: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLogs).values({
    organizationId: job.organizationId,
    action,
    resourceType: "email_job",
    resourceId: job.id,
    metadata: {
      emailType: job.emailType,
      toEmail: job.toEmail,
      ...extra,
    },
  });
}

// ── Polling (mirrors the Media Worker) ─────────────────────────────────────────

/** Claims and runs up to MAX_CONCURRENT_JOBS due pending jobs. Returns claimed count. */
export async function processPendingEmailJobs(
  provider?: EmailProvider,
  options?: { organizationId?: string },
): Promise<number> {
  const now = new Date();
  const pending = await db
    .select({ id: emailJobs.id })
    .from(emailJobs)
    .where(
      and(
        eq(emailJobs.status, "pending"),
        or(isNull(emailJobs.scheduledAt), lte(emailJobs.scheduledAt, now)),
        options?.organizationId ? eq(emailJobs.organizationId, options.organizationId) : undefined,
      ),
    )
    .limit(Math.max(0, MAX_CONCURRENT_JOBS - activeJobs.size));

  let claimed = 0;
  for (const job of pending) {
    if (activeJobs.has(job.id)) continue;

    activeJobs.add(job.id);
    claimed += 1;
    executeEmailJob(job.id, provider)
      .catch((error) => {
        console.error(`[EmailWorker] Job ${job.id} execution error:`, error);
      })
      .finally(() => {
        activeJobs.delete(job.id);
      });
  }

  return claimed;
}

/**
 * Resets jobs stuck in `sending` (e.g. worker crashed mid-send) that are
 * older than STALE_JOB_THRESHOLD_MS back to `pending` for retry. A fresh
 * `sending` job is left alone — the claiming worker may still be delivering.
 */
export async function recoverStaleEmailJobs(): Promise<number> {
  const staleThreshold = new Date(Date.now() - STALE_JOB_THRESHOLD_MS);
  const stale = await db
    .select({ id: emailJobs.id, updatedAt: emailJobs.updatedAt })
    .from(emailJobs)
    .where(eq(emailJobs.status, "sending"));

  let reset = 0;
  for (const job of stale) {
    if (!job.updatedAt || job.updatedAt >= staleThreshold) continue;
    await db
      .update(emailJobs)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(emailJobs.id, job.id));
    reset += 1;
  }
  return reset;
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

export function isEmailWorkerRunning(): boolean {
  return isRunning;
}

/** Starts the email worker (idempotent). */
export async function startEmailWorker(provider?: EmailProvider): Promise<void> {
  if (isRunning) {
    console.log("[EmailWorker] Already running");
    return;
  }

  isRunning = true;
  console.log("[EmailWorker] Starting...");
  await recoverStaleEmailJobs();
  pollLoop(provider);
}

/** Stops the email worker gracefully. */
export async function stopEmailWorker(): Promise<void> {
  if (!isRunning) return;
  isRunning = false;
  console.log("[EmailWorker] Stopping...");

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
    console.warn(`[EmailWorker] Force stopping with ${activeJobs.size} jobs still active`);
  }
  console.log("[EmailWorker] Stopped");
}

function pollLoop(provider?: EmailProvider): void {
  if (!isRunning) return;

  processPendingEmailJobs(provider)
    .catch((error) => {
      console.error("[EmailWorker] Poll loop error:", error);
    })
    .then(async () => {
      if (!isRunning) return;
      pollCount += 1;
      if (pollCount % LIFECYCLE_SCAN_EVERY_POLLS === 0) {
        try {
          const result = await scanLifecycleAutomation(new Date());
          console.log(
            `[EmailWorker] Lifecycle sweep: ${result.weddingsScanned} weddings, ` +
              `${result.statusTransitions} transitions, ${result.emailsEnqueued} emails enqueued`,
          );
        } catch (error) {
          console.error("[EmailWorker] Lifecycle sweep error:", error);
        }
      }
    })
    .finally(() => {
      if (isRunning) {
        pollTimer = setTimeout(() => pollLoop(provider), POLL_INTERVAL_MS);
      }
    });
}

// ── Graceful shutdown ──────────────────────────────────────────────────────────

if (typeof process !== "undefined") {
  process.on("SIGTERM", () => {
    void stopEmailWorker().then(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    void stopEmailWorker().then(() => process.exit(0));
  });
}