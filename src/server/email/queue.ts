/**
 * Email enqueue service.
 *
 * Inserts `email_jobs` rows with status `pending`. Idempotency is enforced by
 * the unique index on `email_jobs.idempotency_key`:
 * - retries / duplicate calls NEVER create a second row, and
 * - the email worker only ever sends pending rows, so a duplicate enqueue can
 *   never cause the same email to be sent twice.
 *
 * Subject/body are resolved through `renderEmail(templateKey ?? emailType)`
 * when they are not provided explicitly.
 *
 * Never hardcode placeholder recipients: callers must resolve real customer or
 * support addresses (see build-engine integration).
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { emailJobs } from "@/lib/db/schema";
import { renderEmail, type EmailTemplateData, type EmailTemplateKey } from "@/server/email/templates";

type EmailJobType = (typeof emailJobs.$inferInsert)["emailType"];

export interface EnqueueEmailInput {
  organizationId: string;
  weddingId?: string;
  /** Must be a real resolved address — never a placeholder. */
  toEmail: string;
  toName?: string;
  fromEmail?: string;
  fromName?: string;
  emailType: EmailJobType;
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
  templateKey?: string;
  /** Template context used only when subject/body are not provided. */
  data: EmailTemplateData;
  metadata?: Record<string, unknown>;
  scheduledAt?: Date;
  maxAttempts?: number;
  idempotencyKey: string;
}

export interface EnqueueEmailResult {
  jobId: string;
  created: boolean;
}

/**
 * Enqueues a transactional email. Duplicate `idempotencyKey` calls return the
 * existing job id with `created: false` and never touch the row.
 */
export async function enqueueEmail(input: EnqueueEmailInput): Promise<EnqueueEmailResult> {
  const templateKey = (input.templateKey ?? input.emailType) as EmailTemplateKey;

  let subject = input.subject;
  let bodyHtml = input.bodyHtml;
  let bodyText = input.bodyText;

  if (!subject || !bodyHtml || !bodyText) {
    const rendered = renderEmail(templateKey, input.data);
    subject = subject ?? rendered.subject;
    bodyHtml = bodyHtml ?? rendered.html;
    bodyText = bodyText ?? rendered.text;
  }

  const [row] = await db
    .insert(emailJobs)
    .values({
      organizationId: input.organizationId,
      weddingId: input.weddingId ?? null,
      emailType: input.emailType,
      toEmail: input.toEmail,
      toName: input.toName ?? null,
      fromEmail: input.fromEmail ?? null,
      subject,
      bodyHtml,
      bodyText,
      templateKey,
      status: "pending",
      idempotencyKey: input.idempotencyKey,
      scheduledAt: input.scheduledAt ?? new Date(),
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 3,
      metadata: input.metadata ?? null,
    })
    .onConflictDoNothing({ target: emailJobs.idempotencyKey })
    .returning({ id: emailJobs.id });

  if (row) {
    return { jobId: row.id, created: true };
  }

  // Conflict path: the row already exists (from a previous enqueue, retry or
  // concurrent sweep). Return its id without mutating anything.
  const [existing] = await db
    .select({ id: emailJobs.id })
    .from(emailJobs)
    .where(eq(emailJobs.idempotencyKey, input.idempotencyKey))
    .limit(1);

  return { jobId: existing?.id ?? "", created: false };
}