/**
 * POST /api/payments/simulate/[paymentId]
 *
 * Dev-only checkout simulation endpoint. Mirrors the exact ITN payload PayFast
 * would send for the payment (same signature algorithm with the configured
 * passphrase) and feeds it through the real webhook pipeline, so the simulated
 * flow exercises the same code path as production: signature verification →
 * anchor → activation → email/build enqueue. The billing service skips only
 * the merchant_id/amount cross-checks because the route vouches for the amount
 * (`simulateAmountOverride`) against the payment row it already loaded.
 *
 * Security: this route is intentionally unauthenticated (it stands in for
 * PayFast) but is HARD-DISABLED (404) unless `PAYFAST_MODE=simulated` AND
 * `NODE_ENV !== "production"`. NEVER ship a store with simulated payments.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { payments, orders } from "@/lib/db/schema";
import {
  getPayFastConfig,
} from "@/server/services/payments/config";
import { buildSignature } from "@/server/services/payments/payfast";
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
): Promise<NextResponse> {
  // Hard gate: simulated checkout only in non-production dev.
  const config = getPayFastConfig();
  if (config.mode !== "simulated" || process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Checkout simulation is not enabled" },
      { status: 404 },
    );
  }

  try {
    const { paymentId } = await context.params;

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, payment.orderId))
      .limit(1);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const orderMeta = order.metadata as Record<string, unknown> | null;
    const itemName = (orderMeta?.productName as string | undefined) ?? "Wedding package";

    // Build the exact ITN PayFast would send (signed with the real algorithm).
    const itnParams: Record<string, string> = {
      merchant_id: config.merchantId || "10000100",
      merchant_key: config.merchantKey || "53f0d2c0a9c5",
      m_payment_id: payment.id,
      pf_payment_id: `sim-${payment.id}`,
      payment_status: "COMPLETE",
      amount_gross: (payment.amountCents / 100).toFixed(2),
      amount_fee: "0.00",
      item_name: itemName,
      item_description: "",
      custom_str1: order.id,
    };
    itnParams["signature"] = buildSignature(itnParams, config.passphrase);

    let result: ProcessPaymentWebhookResult;
    try {
      result = await processPaymentWebhook({
        provider: "payfast",
        raw: itnParams,
        // The server vouches for the amount loaded from the payment row.
        simulateAmountOverride: payment.amountCents,
      });
    } catch (error) {
      if (
        error instanceof WebhookSignatureError ||
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
      paymentId: result.paymentId ?? payment.id,
      ...(result.idempotent ? { idempotent: true } : {}),
    });
  } catch (error) {
    console.error("[API/payments/simulate] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}