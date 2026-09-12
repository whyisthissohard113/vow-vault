/**
 * Lifecycle automation sweep.
 *
 * `scanLifecycleAutomation` is an idempotent sweep — safe to run repeatedly and
 * concurrently with the email worker. For every ACTIVE / UPLOAD_CLOSED wedding
 * with an `expiry_rules` row it:
 *
 *  - transitions status (active → upload_closed → expired) at the exclusive
 *    deadlines, writing audit logs + lifecycle events,
 *  - enqueues the reminder / warning / closed emails through `enqueueEmail`
 *    with deterministic idempotency keys, so repeated sweeps can never create
 *    a second job.
 *
 * Business dates use `Africa/Johannesburg`: "now" and every deadline are
 * truncated to the JNB calendar day (UTC instants of the JNB day boundary)
 * before comparison, while stored timestamps remain UTC (see ADR-001).
 */

import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  auditLogs,
  customers,
  expiryRules,
  lifecycleEvents,
  vaults,
  weddings,
  type Wedding,
  type ExpiryRule,
  type Vault,
} from "@/lib/db/schema";
import { enqueueEmail } from "@/server/email/queue";
import { appUrl, type EmailTemplateData } from "@/server/email/templates";
import { EMAIL_LIFECYCLE_LEAD_DAYS, MS_PER_DAY } from "@/server/email/constants";

export const BUSINESS_TIMEZONE = "Africa/Johannesburg";

// ── JNB calendar-day helpers ───────────────────────────────────────────────────

/** YYYY-MM-DD of the JNB calendar day containing the instant. */
export function jnbDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** UTC midnight of the JNB calendar day containing the instant. */
export function jnbDayStart(date: Date): Date {
  const [y, m, d] = jnbDateString(date).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** YYYY-MM-DD (UTC) of a date-only wedding_date value. */
function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ── Scan result ────────────────────────────────────────────────────────────────

export interface LifecycleScanResult {
  weddingsScanned: number;
  statusTransitions: number;
  emailsEnqueued: number;
}

interface WeddingWithRule {
  wedding: Wedding;
  rule: ExpiryRule;
  vault: Vault | null;
}

interface WeddingContact {
  email: string;
  fullName: string | null;
}

// ── Public sweep ───────────────────────────────────────────────────────────────

/**
 * Runs one lifecycle sweep. Idempotent: enqueues use `onConflictDoNothing`
 * idempotency keys and status transitions are guarded by CAS updates, so
 * repeated runs never duplicate emails, events or transitions.
 *
 * @param now  reference instant (defaults to the current time, UTC)
 */
export async function scanLifecycleAutomation(
  now: Date = new Date(),
): Promise<LifecycleScanResult> {
  const rows = await db
    .select({
      wedding: weddings,
      rule: expiryRules,
      vault: vaults,
    })
    .from(weddings)
    .innerJoin(expiryRules, eq(weddings.id, expiryRules.weddingId))
    .leftJoin(vaults, and(eq(vaults.weddingId, weddings.id), isNull(vaults.deletedAt)))
    .where(and(inArray(weddings.status, ["active", "upload_closed"]), isNull(weddings.deletedAt)));

  let transitions = 0;
  let emails = 0;

  for (const row of rows) {
    const outcome = await processWedding(row, now);
    transitions += outcome.transitions;
    emails += outcome.emailsEnqueued;
  }

  return { weddingsScanned: rows.length, statusTransitions: transitions, emailsEnqueued: emails };
}

// ── Per-wedding processing ─────────────────────────────────────────────────────

async function processWedding(
  { wedding, rule, vault }: WeddingWithRule,
  now: Date,
): Promise<{ transitions: number; emailsEnqueued: number }> {
  let transitions = 0;
  let emails = 0;
  let status = wedding.status;

  const contact = await getWeddingContact(wedding.id);
  if (!contact) {
    console.warn(`[Lifecycle] Wedding ${wedding.id} has no customer contact; skipping lifecycle emails`);
  }
  const base = contact ? baseEmailData(wedding, vault, contact) : {};
  const uploadDeadlineIso = rule.uploadDeadline.toISOString();
  const downloadDeadlineIso = rule.downloadDeadline.toISOString();

  // Status transitions first so email conditions see the converged state.
  if (status === "active" && now >= rule.uploadDeadline) {
    const ok = await transitionWedding(wedding, "active", "upload_closed", "Upload deadline reached", now);
    if (ok) {
      transitions += 1;
      status = "upload_closed";
      emails += await queueTransitionEmail(contact, wedding, "upload_closed", `upload_closed_${wedding.id}_${uploadDeadlineIso}`, {
        ...base,
        downloadDeadline: downloadDeadlineIso,
        uploadDeadline: uploadDeadlineIso,
      });
    }
  }

  if (status !== "expired" && now >= rule.downloadDeadline) {
    const ok = await transitionWedding(wedding, status, "expired", "Download deadline reached", now);
    if (ok) {
      transitions += 1;
      status = "expired";
      emails += await queueTransitionEmail(contact, wedding, "download_closed", `download_closed_${wedding.id}_${downloadDeadlineIso}`, {
        ...base,
        downloadDeadline: downloadDeadlineIso,
        uploadDeadline: uploadDeadlineIso,
      });
    }
  }

  if (status === "expired" || !contact) return { transitions, emailsEnqueued: emails };

  const nowJNB = jnbDayStart(now);

  const uploadExpiryWarningStart = jnbDayStart(
    new Date(rule.downloadDeadline.getTime() - EMAIL_LIFECYCLE_LEAD_DAYS.UPLOAD_EXPIRY_WARNING_LEAD_DAYS * MS_PER_DAY),
  );
  const downloadExpiryWarningStart = jnbDayStart(
    new Date(rule.uploadDeadline.getTime() - EMAIL_LIFECYCLE_LEAD_DAYS.DOWNLOAD_EXPIRY_WARNING_LEAD_DAYS * MS_PER_DAY),
  );
  const downloadReminderStart = jnbDayStart(
    new Date(rule.downloadDeadline.getTime() - EMAIL_LIFECYCLE_LEAD_DAYS.REMINDER_DOWNLOAD_LEAD_DAYS * MS_PER_DAY),
  );

  // reminder_upload: the wedding date has been reached and uploads are open.
  if (status === "active" && wedding.weddingDate && nowJNB >= jnbDayStart(wedding.weddingDate) && now < rule.uploadDeadline) {
    const key = `reminder_upload_${wedding.id}_${toDateOnlyString(wedding.weddingDate)}`;
    if (await queueIfAbsent(contact, wedding, "reminder_upload", key, {
      ...base,
      uploadDeadline: uploadDeadlineIso,
      downloadDeadline: downloadDeadlineIso,
      uploadInfo: "Your guests can now add photos and videos to your private vault.",
    })) emails += 1;
  }

  // download_expiry_warning: uploads close in 3 days.
  if (status === "active" && now >= downloadExpiryWarningStart && now < rule.uploadDeadline) {
    const key = `download_expiry_warning_${wedding.id}_${uploadDeadlineIso}`;
    if (await queueIfAbsent(contact, wedding, "download_expiry_warning", key, {
      ...base,
      uploadDeadline: uploadDeadlineIso,
      downloadDeadline: downloadDeadlineIso,
    })) emails += 1;
  }

  // download_reminder: uploads are closed, downloads close within 7 days.
  if (now >= rule.uploadDeadline && now < rule.downloadDeadline && now >= downloadReminderStart) {
    const key = `download_reminder_${wedding.id}_${uploadDeadlineIso}`;
    if (await queueIfAbsent(contact, wedding, "download_reminder", key, {
      ...base,
      uploadDeadline: uploadDeadlineIso,
      downloadDeadline: downloadDeadlineIso,
    })) emails += 1;
  }

  // upload_expiry_warning: downloads close within 7 days.
  if (now >= uploadExpiryWarningStart && now < rule.downloadDeadline) {
    const key = `upload_expiry_warning_${wedding.id}_${downloadDeadlineIso}`;
    if (await queueIfAbsent(contact, wedding, "upload_expiry_warning", key, {
      ...base,
      uploadDeadline: uploadDeadlineIso,
      downloadDeadline: downloadDeadlineIso,
    })) emails += 1;
  }

  return { transitions, emailsEnqueued: emails };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * CAS-guarded status transition. Only transitions when the current DB status
 * still matches `fromStatus` (prevents duplicate lifecycle events and audit
 * rows under concurrent sweeps).
 */
async function transitionWedding(
  wedding: Wedding,
  fromStatus: Wedding["status"],
  toStatus: Wedding["status"],
  reason: string,
  now: Date,
): Promise<boolean> {
  const updated = await db
    .update(weddings)
    .set({ status: toStatus, updatedAt: now })
    .where(and(eq(weddings.id, wedding.id), eq(weddings.status, fromStatus)))
    .returning({ id: weddings.id });

  if (updated.length === 0) return false;

  await db.insert(lifecycleEvents).values({
    weddingId: wedding.id,
    organizationId: wedding.organizationId,
    eventType: toStatus === "expired" ? "download_deadline_reached" : "upload_deadline_reached",
    fromStatus,
    toStatus,
    reason,
    occurredAt: now,
    metadata: { automation: "lifecycle_scan" },
  });

  await db.insert(auditLogs).values({
    organizationId: wedding.organizationId,
    action: "wedding_status_changed",
    resourceType: "wedding",
    resourceId: wedding.id,
    before: { status: fromStatus },
    after: { status: toStatus },
    metadata: { reason, automation: "lifecycle_scan" },
  });

  return true;
}

async function getWeddingContact(weddingId: string): Promise<WeddingContact | null> {
  const [row] = await db
    .select({ email: customers.email, fullName: customers.fullName })
    .from(customers)
    .innerJoin(weddings, eq(customers.id, weddings.customerId))
    .where(eq(weddings.id, weddingId))
    .limit(1);
  return row ?? null;
}

function baseEmailData(wedding: Wedding, vault: Vault | null, contact: WeddingContact): EmailTemplateData {
  const coupleName = [wedding.partnerOneName, wedding.partnerTwoName].filter(Boolean).join(" & ");
  const publicUrl = vault ? `/w/${vault.slug}` : undefined;
  return {
    coupleName: coupleName || wedding.name || contact.fullName || undefined,
    customerName: contact.fullName ?? undefined,
    partnerOneName: wedding.partnerOneName ?? undefined,
    partnerTwoName: wedding.partnerTwoName ?? undefined,
    publicUrl,
    vaultUrl: publicUrl ? `${appUrl()}${publicUrl}` : undefined,
    supportEmail: undefined,
  };
}

/** Enqueues an email only if the idempotency key does not already exist. */
async function queueIfAbsent(
  contact: WeddingContact,
  wedding: Wedding,
  emailType: "reminder_upload" | "download_reminder" | "upload_expiry_warning" | "download_expiry_warning",
  idempotencyKey: string,
  data: EmailTemplateData,
): Promise<boolean> {
  const result = await enqueueEmail({
    organizationId: wedding.organizationId,
    weddingId: wedding.id,
    emailType,
    toEmail: contact.email,
    toName: contact.fullName ?? undefined,
    templateKey: emailType,
    data,
    idempotencyKey,
  });
  return result.created;
}

/** Enqueues the upload_closed / download_closed email after a status transition. */
async function queueTransitionEmail(
  contact: WeddingContact | null,
  wedding: Wedding,
  emailType: "upload_closed" | "download_closed",
  idempotencyKey: string,
  data: EmailTemplateData,
): Promise<number> {
  if (!contact) return 0;
  const result = await enqueueEmail({
    organizationId: wedding.organizationId,
    weddingId: wedding.id,
    emailType,
    toEmail: contact.email,
    toName: contact.fullName ?? undefined,
    templateKey: emailType,
    data,
    idempotencyKey,
  });
  return result.created ? 1 : 0;
}