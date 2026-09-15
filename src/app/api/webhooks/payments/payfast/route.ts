/**
 * POST /api/webhooks/payments/payfast
 *
 * Receives PayFast ITN (Instant Transaction Notification) callbacks.
 *
 * Security (server-authoritative):
 * - Payloads are parsed as `application/x-www-form-urlencoded` (PayFast form
 *   POST). Signature is verified against the configured passphrase in constant
 *   time; live/test mode additionally validates server-side with PayFast.
 * - The billing service cross-checks merchant_id and amount against the
 *   payment row, then persists the event as the idempotency anchor.
 * - This route never logs payloads, signatures, or secrets.
 *
 * HTTP contract:
 *   200 acknowledged/handled (including idempotent replays)
 *   400 malformed payload, merchant/amount mismatch (do NOT retry)
 *   401 signature mismatch (do NOT retry)
 *   500 transient failure (PayFast SHOULD retry; the anchor prevents double
 *       activation)
 */

import { NextRequest, NextResponse } from "next/server";

import {
  processPaymentWebhook,
  type ProcessPaymentWebhookResult,
} from "@/server/services/payments/billing-service";
import {
  WebhookAmountMismatchError,
  WebhookRetryableError,
  WebhookSignatureError,
  WebhookValidationError,
} from "@/server/services/payments/errors";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const text = await request.text();
    const params: Record<string, string> = Object.fromEntries(
      new URLSearchParams(text),
    );

    let result: ProcessPaymentWebhookResult;
    try {
      result = await processPaymentWebhook({
        provider: "payfast",
        raw: params,
      });
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        return NextResponse.json(
          { received: false, error: error.message },
          { status: 401 },
        );
      }
      if (
        error instanceof WebhookAmountMismatchError ||
        error instanceof WebhookValidationError
      ) {
        return NextResponse.json(
          { received: false, error: error.message },
          { status: 400 },
        );
      }
      if (error instanceof WebhookRetryableError) {
        return NextResponse.json(
          { received: false, error: "Payment event could not be processed yet" },
          { status: 500 },
        );
      }
      throw error;
    }

    return NextResponse.json({
      received: true,
      eventId: result.eventId,
      provider: result.provider,
      status: result.status,
      ...(result.idempotent ? { idempotent: true } : {}),
    });
  } catch (error) {
    console.error("[API/webhooks/payments/payfast] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}