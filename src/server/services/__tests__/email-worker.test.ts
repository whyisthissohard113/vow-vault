/**
 * Integration tests for the transactional email layer: idempotent enqueue,
 * worker execution (CAS claim, retries, stale recovery), delivery-event
 * webhook idempotency, support notifications, and the lifecycle automation
 * sweep. Runs against the real dev Postgres database like the other server
 * suites; every test cleans up exactly the rows it creates.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  organizations,
  customers,
  weddings,
  vaults,
  expiryRules,
  lifecycleEvents,
  emailJobs,
  emailEvents,
  auditLogs,
} from "@/lib/db/schema";
import { enqueueEmail } from "@/server/email/queue";
import { notifySupport } from "@/server/email/support";
import { executeEmailJob, processPendingEmailJobs, recoverStaleEmailJobs } from "@/server/services/email-worker";
import { recordEmailDeliveryEvent } from "@/server/email/delivery";
import { scanLifecycleAutomation } from "@/server/email/lifecycle";
import type { EmailMessage, EmailProvider } from "@/server/email/provider";

// ── Test identity (isolated from every other suite's UUID ranges) ─────────────

const ORG_A = "33333333-3333-3333-3333-333333333310";
const CUST_A = "33333333-3333-3333-3333-333333333311";
const WED_A = "33333333-3333-3333-3333-333333333312";

const ORG_BILLING = "33333333-3333-3333-3333-333333333320";
const CUST_E = "33333333-3333-3333-3333-333333333321"; // lifecycle expiring fixture
const WED_E = "33333333-3333-3333-3333-333333333322";
const VAULT_E = "33333333-3333-3333-3333-333333333323";
const CUST_R = "33333333-3333-3333-3333-333333333324"; // lifecycle reminder fixture
const WED_R = "33333333-3333-3333-3333-333333333325";
const VAULT_R = "33333333-3333-3333-3333-333333333326";

const ORG_NO_BILLING = "33333333-3333-3333-3333-333333333330";

const ALL_ORGS = [ORG_A, ORG_BILLING, ORG_NO_BILLING];

// ── Fake provider ──────────────────────────────────────────────────────────────

class FakeEmailProvider implements EmailProvider {
  sent: EmailMessage[] = [];
  messageIds: string[] = [];
  fail = false;

  async send(message: EmailMessage): Promise<{ messageId: string }> {
    if (this.fail) {
      throw new Error("SMTP 554 5.7.1 Relay access denied");
    }
    this.sent.push(message);
    // Unique per send so it can never collide with another job, even when
    // other suites share the dev database in parallel runs.
    const messageId = `fake-${randomUUID()}`;
    this.messageIds.push(messageId);
    return { messageId };
  }
}

// ── Fixtures ───────────────────────────────────────────────────────────────────

async function createOrg(id: string, billingEmail?: string): Promise<void> {
  await db
    .insert(organizations)
    .values({
      id,
      publicId: `pub-org-${id.slice(-6)}`,
      name: `Test Org ${id.slice(-4)}`,
      slug: `test-org-${id.slice(-4)}`,
      type: "wedding_company",
      status: "active",
      ...(billingEmail ? { billingEmail } : {}),
    })
    .onConflictDoNothing();
}

async function createCustomer(id: string, orgId: string): Promise<void> {
  await db
    .insert(customers)
    .values({
      id,
      organizationId: orgId,
      publicId: `pub-cust-${id.slice(-6)}`,
      fullName: "Alice Smith",
      email: `alice+${id.slice(-4)}@example.com`,
    })
    .onConflictDoNothing();
}

async function createWedding(
  id: string,
  orgId: string,
  customerId: string,
  opts: { status?: "active" | "upload_closed"; weddingDate?: Date } = {},
): Promise<void> {
  await db
    .insert(weddings)
    .values({
      id,
      organizationId: orgId,
      customerId,
      publicId: `pub-wed-${id.slice(-6)}`,
      code: `WED-${id.slice(-4)}`,
      name: "Test Wedding",
      partnerOneName: "Alice",
      partnerTwoName: "Bob",
      weddingDate: opts.weddingDate ?? new Date("2026-06-01T00:00:00.000Z"),
      status: opts.status ?? "active",
      timezone: "Africa/Johannesburg",
    })
    .onConflictDoNothing();
}

async function createVault(id: string, orgId: string, weddingId: string): Promise<void> {
  await db
    .insert(vaults)
    .values({
      id,
      weddingId,
      organizationId: orgId,
      publicId: `pub-vault-${id.slice(-6)}`,
      slug: `test-vault-${id.slice(-4)}`,
      title: "Test Vault",
      status: "published",
      publishedAt: new Date(),
    })
    .onConflictDoNothing();
}

async function createExpiryRule(
  orgId: string,
  weddingId: string,
  uploadDeadline: Date,
  downloadDeadline: Date,
): Promise<void> {
  await db
    .insert(expiryRules)
    .values({
      weddingId,
      organizationId: orgId,
      uploadDeadline,
      downloadDeadline,
      uploadWindowDays: 30,
      downloadWindowDays: 30,
      timezone: "Africa/Johannesburg",
      weddingDateAtCalculation: new Date("2026-06-01T00:00:00.000Z"),
    })
    .onConflictDoNothing({ target: expiryRules.weddingId });
}

type EmailType = (typeof emailJobs.$inferInsert)["emailType"];

async function countEmailJobs(orgId: string, emailType?: EmailType): Promise<number> {
  const rows = await db
    .select({ id: emailJobs.id })
    .from(emailJobs)
    .where(
      emailType
        ? and(eq(emailJobs.organizationId, orgId), eq(emailJobs.emailType, emailType))
        : eq(emailJobs.organizationId, orgId),
    );
  return rows.length;
}

// ── Cleanup ────────────────────────────────────────────────────────────────────

async function cleanup() {
  await db.delete(emailJobs).where(inArray(emailJobs.organizationId, ALL_ORGS));
  await db.delete(lifecycleEvents).where(inArray(lifecycleEvents.organizationId, ALL_ORGS));
  await db.delete(expiryRules).where(inArray(expiryRules.organizationId, ALL_ORGS));
  await db.delete(vaults).where(inArray(vaults.organizationId, ALL_ORGS));
  await db.delete(weddings).where(inArray(weddings.organizationId, ALL_ORGS));
  await db.delete(auditLogs).where(inArray(auditLogs.organizationId, ALL_ORGS));
  await db.delete(customers).where(inArray(customers.organizationId, ALL_ORGS));
  await db.delete(organizations).where(inArray(organizations.id, ALL_ORGS));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("email queue", () => {
  beforeEach(async () => {
    await cleanup();
    await createOrg(ORG_A);
    await createCustomer(CUST_A, ORG_A);
    await createWedding(WED_A, ORG_A, CUST_A);
  });
  afterEach(cleanup);

  it("enqueues a pending job and dedupes by idempotency key", async () => {
    const first = await enqueueEmail({
      organizationId: ORG_A,
      weddingId: WED_A,
      emailType: "reminder_upload",
      toEmail: "alice@example.com",
      templateKey: "reminder_upload",
      data: { uploadDeadline: "2026-06-28T10:00:00.000Z", downloadDeadline: "2026-08-02T10:00:00.000Z" },
      idempotencyKey: "test_dedupe_1",
    });
    expect(first.created).toBe(true);
    expect(first.jobId).not.toBe("");

    const duplicate = await enqueueEmail({
      organizationId: ORG_A,
      weddingId: WED_A,
      emailType: "reminder_upload",
      toEmail: "alice@example.com",
      templateKey: "reminder_upload",
      data: { uploadDeadline: "2026-06-28T10:00:00.000Z" },
      idempotencyKey: "test_dedupe_1",
    });
    expect(duplicate.created).toBe(false);
    expect(duplicate.jobId).toBe(first.jobId);

    expect(await countEmailJobs(ORG_A, "reminder_upload")).toBe(1);

    // The row carries rendered content and default scheduling/max attempts.
    const [job] = await db.select().from(emailJobs).where(eq(emailJobs.id, first.jobId)).limit(1);
    expect(job.status).toBe("pending");
    expect(job.subject).toContain("Guest uploads are open");
    expect(job.bodyHtml).toContain("<!DOCTYPE html>");
    expect(job.maxAttempts).toBe(3);
  });

  it("uses provided subject/body when given and schedules future jobs", async () => {
    const { jobId, created } = await enqueueEmail({
      organizationId: ORG_A,
      weddingId: WED_A,
      emailType: "reminder_upload",
      toEmail: "alice@example.com",
      subject: "Custom subject",
      bodyHtml: "<p>Custom html</p>",
      bodyText: "Custom text",
      templateKey: "reminder_upload",
      data: {},
      scheduledAt: new Date("2099-01-01T00:00:00.000Z"),
      maxAttempts: 5,
      idempotencyKey: "test_custom_1",
    });
    expect(created).toBe(true);

    const [job] = await db.select().from(emailJobs).where(eq(emailJobs.id, jobId)).limit(1);
    expect(job.subject).toBe("Custom subject");
    expect(job.bodyHtml).toBe("<p>Custom html</p>");
    expect(job.maxAttempts).toBe(5);
    expect(job.scheduledAt!.getTime()).toBe(new Date("2099-01-01T00:00:00.000Z").getTime());
  });
});

describe("email worker", () => {
  beforeEach(async () => {
    await cleanup();
    await createOrg(ORG_A);
    await createCustomer(CUST_A, ORG_A);
    await createWedding(WED_A, ORG_A, CUST_A);
  });
  afterEach(cleanup);

  it("sends a pending job and records sent event + audit", async () => {
    const provider = new FakeEmailProvider();
    const { jobId } = await enqueueEmail({
      organizationId: ORG_A,
      weddingId: WED_A,
      emailType: "vault_ready",
      toEmail: "alice@example.com",
      toName: "Alice Smith",
      templateKey: "vault_ready",
      data: { coupleName: "Alice & Bob", vaultUrl: "http://localhost:3000/w/x" },
      idempotencyKey: "test_send_1",
    });

    await executeEmailJob(jobId, provider);

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0].toEmail).toBe("alice@example.com");

    const [job] = await db.select().from(emailJobs).where(eq(emailJobs.id, jobId)).limit(1);
    expect(job.status).toBe("sent");
    expect(job.providerMessageId).toMatch(/^fake-/);
    expect(job.sentAt).not.toBeNull();

    const events = await db.select().from(emailEvents).where(eq(emailEvents.emailJobId, jobId));
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("sent");

    const audits = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.organizationId, ORG_A), eq(auditLogs.resourceId, jobId)));
    expect(audits.some((a) => a.action === "email_sent")).toBe(true);
  });

  it("does not resend a completed job", async () => {
    const provider = new FakeEmailProvider();
    const { jobId } = await enqueueEmail({
      organizationId: ORG_A,
      emailType: "vault_ready",
      toEmail: "alice@example.com",
      templateKey: "vault_ready",
      data: {},
      idempotencyKey: "test_once_1",
    });
    await executeEmailJob(jobId, provider);
    await executeEmailJob(jobId, provider);
    expect(provider.sent).toHaveLength(1);
  });

  it("retries transient failures then permanently fails at max attempts", async () => {
    const provider = new FakeEmailProvider();
    provider.fail = true;
    const { jobId } = await enqueueEmail({
      organizationId: ORG_A,
      emailType: "reminder_upload",
      toEmail: "alice@example.com",
      templateKey: "reminder_upload",
      data: {},
      idempotencyKey: "test_retry_1",
    });

    await executeEmailJob(jobId, provider);
    let [job] = await db.select().from(emailJobs).where(eq(emailJobs.id, jobId)).limit(1);
    expect(job.status).toBe("pending");
    expect(job.attempts).toBe(1);

    await executeEmailJob(jobId, provider);
    [job] = await db.select().from(emailJobs).where(eq(emailJobs.id, jobId)).limit(1);
    expect(job.status).toBe("pending");
    expect(job.attempts).toBe(2);

    await executeEmailJob(jobId, provider);
    [job] = await db.select().from(emailJobs).where(eq(emailJobs.id, jobId)).limit(1);
    expect(job.status).toBe("failed");
    expect(job.attempts).toBe(3);

    // No further sends once failed.
    await executeEmailJob(jobId, provider);
    expect(provider.sent).toHaveLength(0);

    const events = await db.select().from(emailEvents).where(eq(emailEvents.emailJobId, jobId));
    expect(events.some((e) => e.eventType === "failed")).toBe(true);
    const audits = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.organizationId, ORG_A), eq(auditLogs.resourceId, jobId)));
    expect(audits.some((a) => a.action === "email_failed")).toBe(true);
  });

  it("only picks due jobs in the polling sweep", async () => {
    const provider = new FakeEmailProvider();

    const future = await enqueueEmail({
      organizationId: ORG_A,
      emailType: "vault_ready",
      toEmail: "a@example.com",
      templateKey: "vault_ready",
      data: {},
      scheduledAt: new Date("2099-01-01T00:00:00.000Z"),
      idempotencyKey: "test_future_1",
    });

    // Scoped to ORG_A so this suite never claims jobs created by other suites
    // that share the dev database in parallel runs.
    const claimedFuture = await processPendingEmailJobs(provider, { organizationId: ORG_A });
    expect(claimedFuture).toBe(0);
    await new Promise((r) => setTimeout(r, 50));

    const [futureJob] = await db.select().from(emailJobs).where(eq(emailJobs.id, future.jobId)).limit(1);
    expect(futureJob.status).toBe("pending");

    const due = await enqueueEmail({
      organizationId: ORG_A,
      emailType: "vault_ready",
      toEmail: "b@example.com",
      templateKey: "vault_ready",
      data: {},
      idempotencyKey: "test_due_1",
    });

    const claimedDue = await processPendingEmailJobs(provider, { organizationId: ORG_A });
    expect(claimedDue).toBe(1);
    await new Promise((r) => setTimeout(r, 50));

    const [dueJob] = await db.select().from(emailJobs).where(eq(emailJobs.id, due.jobId)).limit(1);
    expect(dueJob.status).toBe("sent");
  });

  it("recovers stale sending jobs but leaves fresh ones alone", async () => {
    const old = new Date(Date.now() - 10 * 60 * 1000);
    const now = new Date();

    const staleJob = await enqueueEmail({
      organizationId: ORG_A,
      emailType: "vault_ready",
      toEmail: "a@example.com",
      templateKey: "vault_ready",
      data: {},
      idempotencyKey: "test_stale_1",
    });
    const freshJob = await enqueueEmail({
      organizationId: ORG_A,
      emailType: "vault_ready",
      toEmail: "b@example.com",
      templateKey: "vault_ready",
      data: {},
      idempotencyKey: "test_fresh_sending_1",
    });

    await db
      .update(emailJobs)
      .set({ status: "sending", updatedAt: old })
      .where(eq(emailJobs.id, staleJob.jobId));
    await db
      .update(emailJobs)
      .set({ status: "sending", updatedAt: now })
      .where(eq(emailJobs.id, freshJob.jobId));

    const reset = await recoverStaleEmailJobs();
    expect(reset).toBe(1);

    const [stale] = await db.select().from(emailJobs).where(eq(emailJobs.id, staleJob.jobId)).limit(1);
    const [fresh] = await db.select().from(emailJobs).where(eq(emailJobs.id, freshJob.jobId)).limit(1);
    expect(stale.status).toBe("pending");
    expect(fresh.status).toBe("sending");
  });
});

describe("email delivery events (webhook)", () => {
  beforeEach(async () => {
    await cleanup();
    await createOrg(ORG_A);
    await createCustomer(CUST_A, ORG_A);
    await createWedding(WED_A, ORG_A, CUST_A);
  });
  afterEach(cleanup);

  async function createSentJob(): Promise<{ jobId: string; providerMessageId: string }> {
    const provider = new FakeEmailProvider();
    const { jobId } = await enqueueEmail({
      organizationId: ORG_A,
      emailType: "vault_ready",
      toEmail: "alice@example.com",
      templateKey: "vault_ready",
      data: {},
      idempotencyKey: `test_delivery_${randomUUID()}`,
    });
    await executeEmailJob(jobId, provider);
    return { jobId, providerMessageId: provider.messageIds[0] ?? "" };
  }

  it("returns not-found for an unknown message id", async () => {
    const result = await recordEmailDeliveryEvent({
      provider: "smtp",
      messageId: "no-such-message",
      eventType: "delivered",
      providerEventId: "evt-missing",
    });
    expect(result.found).toBe(false);
  });

  it("records delivery events idempotently by provider event id", async () => {
    const { jobId, providerMessageId } = await createSentJob();
    expect(providerMessageId).toMatch(/^fake-/);

    const deliveredEventId = `evt-delivered-${randomUUID()}`;
    const first = await recordEmailDeliveryEvent({
      provider: "smtp",
      messageId: providerMessageId,
      eventType: "delivered",
      providerEventId: deliveredEventId,
      timestamp: "2026-06-20T10:05:00.000Z",
      metadata: { region: "eu-west" },
    });
    expect(first).toEqual({ found: true, inserted: true });

    // Replay of the same provider event is a no-op.
    const replay = await recordEmailDeliveryEvent({
      provider: "smtp",
      messageId: providerMessageId,
      eventType: "delivered",
      providerEventId: deliveredEventId,
    });
    expect(replay).toEqual({ found: true, inserted: false });

    // A different event for the same message still records (open tracking).
    const open = await recordEmailDeliveryEvent({
      provider: "smtp",
      messageId: providerMessageId,
      eventType: "opened",
      providerEventId: "evt-opened-1",
    });
    expect(open).toEqual({ found: true, inserted: true });

    const events = await db.select().from(emailEvents).where(eq(emailEvents.emailJobId, jobId));
    const deliveredRows = events.filter((e) => e.eventType === "delivered");
    expect(deliveredRows).toHaveLength(1);
    expect(events.some((e) => e.eventType === "opened")).toBe(true);
  });

  it("normalizes angle-bracket-prefixed provider message ids", async () => {
    const { jobId, providerMessageId } = await createSentJob();
    const result = await recordEmailDeliveryEvent({
      provider: "ses",
      messageId: `<ses:out:${providerMessageId.toUpperCase()}>`,
      eventType: "delivered",
      providerEventId: `evt-prefixed-${randomUUID()}`,
    });
    expect(result.found).toBe(true);
    expect(result.inserted).toBe(true);
    expect(jobId).toBe(jobId);
  });

  it("marks the job failed + audits on bounce", async () => {
    const { jobId, providerMessageId } = await createSentJob();

    const result = await recordEmailDeliveryEvent({
      provider: "smtp",
      messageId: providerMessageId,
      eventType: "bounced",
      providerEventId: `evt-bounce-${randomUUID()}`,
    });
    expect(result).toEqual({ found: true, inserted: true });

    const [job] = await db.select().from(emailJobs).where(eq(emailJobs.id, jobId)).limit(1);
    expect(job.status).toBe("failed");
    expect(job.errorMessage).toContain("bounced");

    const audits = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.organizationId, ORG_A), eq(auditLogs.resourceId, jobId)));
    expect(audits.some((a) => a.action === "email_bounced")).toBe(true);
  });
});

describe("support notifications", () => {
  beforeEach(async () => {
    await cleanup();
    await createOrg(ORG_BILLING, "billing@example.com");
    await createOrg(ORG_NO_BILLING);
  });
  afterEach(cleanup);

  it("enqueues a support_notification to the billing email and dedupes identical content", async () => {
    const first = await notifySupport(ORG_BILLING, "Build failed", "Details about the failure");
    expect(first.skipped).toBe(false);
    expect(first.created).toBe(true);

    const duplicate = await notifySupport(ORG_BILLING, "Build failed", "Details about the failure");
    expect(duplicate.skipped).toBe(false);
    expect(duplicate.created).toBe(false);
    expect(duplicate.jobId).toBe(first.jobId);

    const [job] = await db.select().from(emailJobs).where(eq(emailJobs.id, first.jobId)).limit(1);
    expect(job.emailType).toBe("support_notification");
    expect(job.toEmail).toBe("billing@example.com");
  });

  it("skips (never enqueues) when the organization has no billing email", async () => {
    const result = await notifySupport(ORG_NO_BILLING, "Build failed", "Details");
    expect(result.skipped).toBe(true);
    expect(await countEmailJobs(ORG_NO_BILLING, "support_notification")).toBe(0);
  });
});

describe("lifecycle automation sweep", () => {
  beforeEach(async () => {
    await cleanup();
    await createOrg(ORG_BILLING, "billing@example.com");
  });
  afterEach(cleanup);

  it("transitions statuses and enqueues upload/download closed + warning emails exactly once", async () => {
    await createCustomer(CUST_E, ORG_BILLING);
    await createWedding(WED_E, ORG_BILLING, CUST_E);
    await createVault(VAULT_E, ORG_BILLING, WED_E);
    await createExpiryRule(
      ORG_BILLING,
      WED_E,
      new Date("2026-06-20T10:00:00.000Z"),
      new Date("2026-07-20T10:00:00.000Z"),
    );

    // Phase A: upload deadline passed, download deadline open.
    const phaseA = await scanLifecycleAutomation(new Date("2026-06-20T11:00:00.000Z"));
    expect(phaseA.statusTransitions).toBe(1);
    expect(phaseA.emailsEnqueued).toBe(1);

    // Phase B: inside the download / expiry warning windows (no new transition).
    const phaseB = await scanLifecycleAutomation(new Date("2026-07-20T09:00:00.000Z"));
    expect(phaseB.statusTransitions).toBe(0);
    expect(phaseB.emailsEnqueued).toBe(2);

    // Re-running the same state enqueues nothing new.
    const phaseBRepeat = await scanLifecycleAutomation(new Date("2026-07-20T09:00:00.000Z"));
    expect(phaseBRepeat.emailsEnqueued).toBe(0);

    // Phase C: download deadline passed → expired + download_closed email.
    const phaseC = await scanLifecycleAutomation(new Date("2026-07-20T11:00:00.000Z"));
    expect(phaseC.statusTransitions).toBe(1);
    expect(phaseC.emailsEnqueued).toBe(1);

    // Final state: expired, no more scans match.
    const [wedding] = await db.select().from(weddings).where(eq(weddings.id, WED_E)).limit(1);
    expect(wedding.status).toBe("expired");

    // One job per trigger, no duplicates across the whole life of the wedding.
    expect(await countEmailJobs(ORG_BILLING, "upload_closed")).toBe(1);
    expect(await countEmailJobs(ORG_BILLING, "download_reminder")).toBe(1);
    expect(await countEmailJobs(ORG_BILLING, "upload_expiry_warning")).toBe(1);
    expect(await countEmailJobs(ORG_BILLING, "download_closed")).toBe(1);
    expect(await countEmailJobs(ORG_BILLING, "reminder_upload")).toBe(0);
    expect(await countEmailJobs(ORG_BILLING, "download_expiry_warning")).toBe(0);

    // Lifecycle events recorded for both transitions.
    const events = await db.select().from(lifecycleEvents).where(eq(lifecycleEvents.weddingId, WED_E));
    expect(events).toHaveLength(2);
    expect(events.some((e) => e.eventType === "upload_deadline_reached" && e.fromStatus === "active" && e.toStatus === "upload_closed")).toBe(true);
    expect(events.some((e) => e.eventType === "download_deadline_reached" && e.fromStatus === "upload_closed" && e.toStatus === "expired")).toBe(true);

    // Customer-facing emails go to the resolved customer email, never a placeholder.
    const uploadClosedJobs = await db
      .select({ toEmail: emailJobs.toEmail })
      .from(emailJobs)
      .where(and(eq(emailJobs.organizationId, ORG_BILLING), eq(emailJobs.emailType, "upload_closed")));
    expect(uploadClosedJobs[0].toEmail).toContain("@example.com");

    // Audit trail for the transitions.
    const audits = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.organizationId, ORG_BILLING), eq(auditLogs.action, "wedding_status_changed")));
    expect(audits).toHaveLength(2);
  });

  it("enqueues reminder_upload + download_expiry_warning inside those windows, exactly once", async () => {
    await createCustomer(CUST_R, ORG_BILLING);
    await createWedding(WED_R, ORG_BILLING, CUST_R);
    await createVault(VAULT_R, ORG_BILLING, WED_R);
    await createExpiryRule(
      ORG_BILLING,
      WED_R,
      new Date("2026-06-20T10:00:00.000Z"),
      new Date("2026-07-20T10:00:00.000Z"),
    );

    // Phase 1: uploads open, wedding date passed → upload reminder only.
    const phase1 = await scanLifecycleAutomation(new Date("2026-06-15T12:00:00.000Z"));
    expect(phase1.statusTransitions).toBe(0);
    expect(phase1.emailsEnqueued).toBe(1);
    expect(await countEmailJobs(ORG_BILLING, "reminder_upload")).toBe(1);
    expect(await countEmailJobs(ORG_BILLING, "download_expiry_warning")).toBe(0);

    // Phase 2: within 3 days of the upload deadline → expiry warning, reminder
    // still would fire but dedupes on its idempotency key.
    const phase2 = await scanLifecycleAutomation(new Date("2026-06-18T12:00:00.000Z"));
    expect(phase2.emailsEnqueued).toBe(1);
    expect(await countEmailJobs(ORG_BILLING, "reminder_upload")).toBe(1);
    expect(await countEmailJobs(ORG_BILLING, "download_expiry_warning")).toBe(1);

    // Phase 3: same state again → nothing new.
    const phase3 = await scanLifecycleAutomation(new Date("2026-06-18T12:00:00.000Z"));
    expect(phase3.emailsEnqueued).toBe(0);
    expect(await countEmailJobs(ORG_BILLING, "reminder_upload")).toBe(1);
    expect(await countEmailJobs(ORG_BILLING, "download_expiry_warning")).toBe(1);
  });
});