/**
 * Provider delivery-event tracking (email webhooks).
 *
 * `recordEmailDeliveryEvent` maps a provider-neutral delivery notification to
 * the internal `email_jobs` / `email_events` model:
 * - finds the job by `provider_message_id` (case-insensitive, tolerant of the
 *   angle-bracket and `provider:` prefixes providers sometimes add),
 * - appends an `email_events` row with `onConflictDoNothing` keyed on
 *   `provider_event_id`, so replaying a webhook is a no-op,
 * - marks the job failed for bounce / complaint / permanent failure events and
 *   audits them.
 *
 * The function never throws for a missing job: it returns `{ found: false }`
 * so callers can answer 404 without swallowing genuine errors.
 */

import { and, eq, ilike, isNotNull, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { auditLogs, emailEvents, emailJobs } from "@/lib/db/schema";

export const DELIVERY_EVENT_TYPES = [
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "failed",
] as const;

export type DeliveryEventType = (typeof DELIVERY_EVENT_TYPES)[number];

export interface EmailDeliveryEventInput {
  provider: string;
  messageId: string;
  eventType: DeliveryEventType;
  providerEventId: string;
  timestamp?: string | number;
  metadata?: Record<string, unknown>;
}

export interface EmailDeliveryEventResult {
  found: boolean;
  inserted: boolean;
}

// ── Message id normalisation ───────────────────────────────────────────────────

/** Lowercases and strips the angle brackets some providers wrap ids in. */
export function normalizeProviderMessageId(id: string | null | undefined): string {
  if (!id) return "";
  return id.trim().replace(/^<|>$/g, "").toLowerCase();
}

/** Drops a leading `provider:` prefix segment (e.g. `ses:abc` → `abc`). */
export function stripMessageIdPrefix(id: string): string {
  const idx = id.lastIndexOf(":");
  return idx > 0 ? id.slice(idx + 1) : id;
}

async function findEmailJobByProviderMessageId(messageId: string) {
  const normalized = normalizeProviderMessageId(messageId);
  const stripped = stripMessageIdPrefix(normalized);
  const variants = Array.from(
    new Set([normalized, stripped, `<${normalized}>`, `<${stripped}>`]),
  );

  if (variants.length === 0) return null;

  const rows = await db
    .select()
    .from(emailJobs)
    .where(
      and(
        isNotNull(emailJobs.providerMessageId),
        or(...variants.map((v) => ilike(emailJobs.providerMessageId, v))),
      ),
    )
    .limit(20);

  const job = rows.find((r) => variants.includes(normalizeProviderMessageId(r.providerMessageId)));
  return job ?? null;
}

// ── Public service ─────────────────────────────────────────────────────────────

/**
 * Records a provider delivery event. Idempotent per `providerEventId`.
 * Returns `{ found: false }` when no job matches the provided message id.
 */
export async function recordEmailDeliveryEvent(
  input: EmailDeliveryEventInput,
): Promise<EmailDeliveryEventResult> {
  const job = await findEmailJobByProviderMessageId(input.messageId);
  if (!job) return { found: false, inserted: false };

  const occurredAt =
    input.timestamp === undefined
      ? new Date()
      : new Date(input.timestamp) instanceof Date && !Number.isNaN(new Date(input.timestamp).getTime())
        ? new Date(input.timestamp)
        : new Date();

  const [insertedRow] = await db
    .insert(emailEvents)
    .values({
      emailJobId: job.id,
      eventType: input.eventType,
      providerEventId: input.providerEventId,
      occurredAt,
      metadata: { provider: input.provider, ...(input.metadata ?? {}) },
    })
    .onConflictDoNothing({
      target: emailEvents.providerEventId,
      // The unique index is partial (`provider_event_id is not null`); the
      // conflict target must carry the same predicate.
      where: sql`${emailEvents.providerEventId} is not null`,
    })
    .returning({ id: emailEvents.id });

  if (input.eventType === "bounced" || input.eventType === "complained" || input.eventType === "failed") {
    const action = input.eventType === "bounced" ? "email_bounced" : "email_failed";
    const reason =
      input.eventType === "complained"
        ? `Spam complaint reported by provider ${input.provider}`
        : `${input.eventType} reported by provider ${input.provider}`;

    await db
      .update(emailJobs)
      .set({ status: "failed", errorMessage: reason, updatedAt: new Date() })
      .where(eq(emailJobs.id, job.id));

    await db.insert(auditLogs).values({
      organizationId: job.organizationId,
      action,
      resourceType: "email_job",
      resourceId: job.id,
      metadata: {
        emailType: job.emailType,
        toEmail: job.toEmail,
        provider: input.provider,
        providerEventId: input.providerEventId,
      },
    });
  }

  return { found: true, inserted: insertedRow !== undefined };
}