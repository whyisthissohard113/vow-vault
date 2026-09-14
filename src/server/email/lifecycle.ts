/**
 * Lifecycle automation sweep (Phase 13).
 *
 * `scanLifecycleAutomation` is the email/automation complement to the shared
 * lifecycle engine (`src/server/lifecycle/engine.ts`). It is idempotent — safe
 * to run repeatedly and concurrently with the email worker. The engine's
 * `runLifecycleSweep` is the SINGLE mutation point for wedding status
 * transitions (DRAFT → BUILDING → ACTIVE → UPLOAD_CLOSED → DOWNLOAD_ONLY →
 * EXPIRED → ARCHIVED → DELETION_PENDING → DELETED). This module:
 *
 *  1. runs the engine sweep FIRST and mirrors guest-facing transitions into
 *     `upload_closed` / `download_closed` emails under deterministic
 *     per-wedding deadline idempotency keys,
 *  2. then enqueues the four lead-based reminder/warning emails for weddings
 *     whose CURRENT status is still `active` or `upload_closed` AFTER the
 *     sweep — so reminders never fire for download_only/expired/archived/
 *     deletion_pending/deleted weddings.
 *
 * Guest sessions are revoked by the engine at DOWNLOAD_ONLY; this module
 * never duplicates that.
 *
 * Business dates use `Africa/Johannesburg`: "now" and every reminder lead
 * window are truncated to the JNB calendar day (UTC instants of the JNB day
 * boundary) before comparison, while stored timestamps remain UTC (see
 * ADR-001). Deadline comparisons are exclusive-end: `now >= deadline` is
 * closed, and the instant of the deadline itself IS closed (never `>`).
 */

import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  customers,
  expiryRules,
  vaults,
  weddings,
  type Wedding,
  type ExpiryRule,
  type Vault,
} from "@/lib/db/schema";
import { enqueueEmail } from "@/server/email/queue";
import { appUrl, type EmailTemplateData } from "@/server/email/templates";
import { EMAIL_LIFECYCLE_LEAD_DAYS, MS_PER_DAY } from "@/server/email/constants";
import { runLifecycleSweep, type SweepTransition } from "@/server/lifecycle/engine";

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
 * Runs one lifecycle sweep. Idempotent: the engine sweep is CAS-guarded (only
 * one concurrent sweep lands a transition) and email enqueues use
 * `onConflictDoNothing` idempotency keys, so repeated runs never duplicate
 * events, emails or transitions.
 *
 * @param now  reference instant (defaults to the current time, UTC)
 */
export async function scanLifecycleAutomation(
  now: Date = new Date(),
): Promise<LifecycleScanResult> {
  // 1. Transitions: the engine sweep is the single mutation point.
  const sweep = await runLifecycleSweep(now);

  // 2. Mirror the guest-facing transitions into emails. Only transitions that
  // open a new guest-facing phase send mail (upload_closed, download_only);
  // the retention tail (expired → archived → deletion_pending → deleted) is
  // silent for customers.
  let emails = 0;
  for (const transition of sweep.statusTransitions) {
    if (transition.toStatus === "upload_closed") {
      emails += await enqueueTransitionEmail(
        transition,
        "upload_closed",
        `upload_closed_${transition.weddingId}_${transition.uploadDeadline}`,
      );
    } else if (transition.toStatus === "download_only") {
      emails += await enqueueTransitionEmail(
        transition,
        "download_closed",
        `download_closed_${transition.weddingId}_${transition.downloadDeadline}`,
      );
    }
  }

  // 3. Lead-based reminder emails for weddings still inside the guest-facing
  // window after the sweep. Statuses the sweep just advanced (e.g. to
  // download_only) are no longer matched, so their reminders can never fire.
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

  for (const row of rows) {
    emails += await enqueueReminderEmails(row, now);
  }

  return {
    weddingsScanned: sweep.weddingsScanned,
    statusTransitions: sweep.statusTransitions.length,
    emailsEnqueued: emails,
  };
}

// ── Transition emails (from the engine sweep) ──────────────────────────────────

/**
 * Loads a transitioned wedding (with its live vault + customer contact) and
 * enqueues the guest-facing "closed" email. No-ops when the wedding or its
 * customer contact is missing; the deterministic idempotency key keeps
 * concurrent replays from double-enqueueing.
 */
async function enqueueTransitionEmail(
  transition: SweepTransition,
  emailType: "upload_closed" | "download_closed",
  idempotencyKey: string,
): Promise<number> {
  const [row] = await db
    .select({ wedding: weddings, vault: vaults })
    .from(weddings)
    .leftJoin(vaults, and(eq(vaults.weddingId, weddings.id), isNull(vaults.deletedAt)))
    .where(eq(weddings.id, transition.weddingId))
    .limit(1);
  if (!row) return 0;

  const contact = await getWeddingContact(row.wedding.id);
  if (!contact) {
    console.warn(
      `[Lifecycle] Wedding ${row.wedding.id} has no customer contact; skipping ${emailType} email`,
    );
    return 0;
  }

  return queueTransitionEmail(contact, row.wedding, emailType, idempotencyKey, {
    ...baseEmailData(row.wedding, row.vault, contact),
    uploadDeadline: transition.uploadDeadline,
    downloadDeadline: transition.downloadDeadline,
  });
}

// ── Lead-based reminder emails (after the sweep has converged statuses) ────────

async function enqueueReminderEmails(
  { wedding, rule, vault }: WeddingWithRule,
  now: Date,
): Promise<number> {
  const contact = await getWeddingContact(wedding.id);
  if (!contact) {
    console.warn(`[Lifecycle] Wedding ${wedding.id} has no customer contact; skipping reminder emails`);
    return 0;
  }
  let emails = 0;
  const base = baseEmailData(wedding, vault, contact);
  const uploadDeadlineIso = rule.uploadDeadline.toISOString();
  const downloadDeadlineIso = rule.downloadDeadline.toISOString();
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
  if (wedding.status === "active" && wedding.weddingDate && nowJNB >= jnbDayStart(wedding.weddingDate) && now < rule.uploadDeadline) {
    const key = `reminder_upload_${wedding.id}_${toDateOnlyString(wedding.weddingDate)}`;
    if (await queueIfAbsent(contact, wedding, "reminder_upload", key, {
      ...base,
      uploadDeadline: uploadDeadlineIso,
      downloadDeadline: downloadDeadlineIso,
      uploadInfo: "Your guests can now add photos and videos to your private vault.",
    })) emails += 1;
  }

  // download_expiry_warning: uploads close in 3 days (active uploads only).
  if (wedding.status === "active" && now >= downloadExpiryWarningStart && now < rule.uploadDeadline) {
    const key = `download_expiry_warning_${wedding.id}_${uploadDeadlineIso}`;
    if (await queueIfAbsent(contact, wedding, "download_expiry_warning", key, {
      ...base,
      uploadDeadline: uploadDeadlineIso,
      downloadDeadline: downloadDeadlineIso,
    })) emails += 1;
  }

  // download_reminder: uploads are closed, downloads close within 7 days.
  if (wedding.status === "upload_closed" && now >= downloadReminderStart && now < rule.downloadDeadline) {
    const key = `download_reminder_${wedding.id}_${uploadDeadlineIso}`;
    if (await queueIfAbsent(contact, wedding, "download_reminder", key, {
      ...base,
      uploadDeadline: uploadDeadlineIso,
      downloadDeadline: downloadDeadlineIso,
    })) emails += 1;
  }

  // upload_expiry_warning: downloads close within 7 days. The reminder query
  // already restricts this to active/upload_closed, so download_only and the
  // retention tail never match here.
  if (now >= uploadExpiryWarningStart && now < rule.downloadDeadline) {
    const key = `upload_expiry_warning_${wedding.id}_${downloadDeadlineIso}`;
    if (await queueIfAbsent(contact, wedding, "upload_expiry_warning", key, {
      ...base,
      uploadDeadline: uploadDeadlineIso,
      downloadDeadline: downloadDeadlineIso,
    })) emails += 1;
  }

  return emails;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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