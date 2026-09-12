/**
 * API route: POST /api/webhooks/email
 *
 * Receives delivery events from email providers (delivered / opened / clicked /
 * bounced / complained / failed) and records them against email jobs.
 *
 * Security:
 * - When `EMAIL_WEBHOOK_SECRET` is configured callers must present it in the
 *   `x-webhook-secret` header, compared in constant time.
 * - When the secret is NOT configured the route logs a warning and accepts the
 *   request (dev / console-provider mode); secrets are never logged.
 * - The route never leaks internal ids or storage credentials.
 *
 * Idempotency: `recordEmailDeliveryEvent` upserts by provider_event_id, so
 * replays are harmless.
 */

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { recordEmailDeliveryEvent } from "@/server/email/delivery";

// ── Input validation ───────────────────────────────────────────────────────────

const emailWebhookSchema = z
  .object({
    provider: z.string().min(1).max(100),
    messageId: z.string().min(1).max(500),
    eventType: z.enum(["delivered", "opened", "clicked", "bounced", "complained", "failed"]),
    providerEventId: z.string().min(1).max(500),
    timestamp: z.string().datetime().or(z.number()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

// ── Webhook secret verification ────────────────────────────────────────────────

function verifyWebhookSecret(provided: string | null): boolean {
  const expected = process.env.EMAIL_WEBHOOK_SECRET;
  if (!expected) return true;

  if (!provided) {
    console.warn("[EmailWebhook] Missing x-webhook-secret header; rejecting request");
    return false;
  }

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);

  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, providedBuf);
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const secret = request.headers.get("x-webhook-secret");
    if (!verifyWebhookSecret(secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.EMAIL_WEBHOOK_SECRET) {
      console.warn("[EmailWebhook] EMAIL_WEBHOOK_SECRET is not configured; accepting unauthenticated webhook");
    }

    const body = await request.json();
    const parsed = emailWebhookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { provider, messageId, eventType, providerEventId, timestamp, metadata } = parsed.data;

    const result = await recordEmailDeliveryEvent({
      provider,
      messageId,
      eventType,
      providerEventId,
      timestamp,
      metadata,
    });

    if (!result.found) {
      // Acknowledge delivery to the provider but surface the miss, matching
      // webhook best practices (providers retry non-2xx, not 404s).
      return NextResponse.json({ received: false, reason: "email_job_not_found" }, { status: 404 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[EmailWebhook] Error handling webhook:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}