/**
 * Support notifications helper.
 *
 * `notifySupport` enqueues a `support_notification` email to the organization's
 * billing email. When the organization has no billing email the notification is
 * skipped with a log line — a job must never carry an empty recipient.
 *
 * The idempotency key is derived from the org id + a digest of the content, so
 * identical notifications for the same org are enqueued exactly once while
 * distinct messages (e.g. two different failed builds) still get their own rows.
 */

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { enqueueEmail, type EnqueueEmailResult } from "@/server/email/queue";

export interface NotifySupportResult extends EnqueueEmailResult {
  skipped: boolean;
}

export async function notifySupport(
  orgId: string,
  subject: string,
  body: string,
): Promise<NotifySupportResult> {
  const [org] = await db
    .select({ id: organizations.id, billingEmail: organizations.billingEmail, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) {
    console.warn(`[EmailSupport] notifySupport: organization ${orgId} not found; skipping support notification`);
    return { jobId: "", created: false, skipped: true };
  }

  if (!org.billingEmail) {
    console.warn(`[EmailSupport] notifySupport: organization ${orgId} has no billing_email; skipping support notification`);
    return { jobId: "", created: false, skipped: true };
  }

  const digest = createHash("sha1").update(`${subject}\u0000${body}`).digest("hex").slice(0, 16);
  const idempotencyKey = `support_notification_${orgId}_${digest}`;

  const result = await enqueueEmail({
    organizationId: orgId,
    emailType: "support_notification",
    toEmail: org.billingEmail,
    toName: org.name ?? undefined,
    subject,
    bodyHtml: simpleHtmlBody(body),
    bodyText: body,
    templateKey: "support_notification",
    data: { supportEmail: org.billingEmail, buildInfo: body, orgName: org.name },
    metadata: { orgName: org.name ?? null, sentTo: "support" },
    idempotencyKey,
  });

  return { ...result, skipped: false };
}

function simpleHtmlBody(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p style="margin:0;font-size:15px;line-height:1.7;color:#6B5A4A;">${escaped.replace(/\n/g, "<br/>")}</p>`;
}