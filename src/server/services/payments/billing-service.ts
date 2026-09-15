/**
 * Billing service — server-authoritative checkout + webhook activation.
 *
 * Responsibilities:
 * - `createCheckout`: validate the wedding/product/customer, create the order +
 *   order_item + payment rows (single transaction), then hand off to the
 *   payment provider to build the redirect. Re-checkouts for the same wedding +
 *   product+ pending payment reuse the existing order/payment (no duplicates).
 * - `processPaymentWebhook`: verify the provider event (signature, merchant,
 *   amount), persist the raw event as the idempotency anchor, then activate the
 *   payment in a compare-and-set transaction that can never double-apply:
 *   payment → completed, order → paid, `payment_verified` lifecycle event
 *   (deduped), `payment_success` email + vault build enqueued (both idempotent
 *   by unique keys).
 * - `refundPayment` / `getPayment`: tenant-scoped billing operations.
 *
 * Security: authorization and tenant isolation are enforced here on top of the
 * auth middleware; the webhook path resolves the tenant from the payment row
 * and never trusts client input.
 */

import { randomUUID } from "node:crypto";
import { eq, and, isNull, or, desc, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  customers,
  lifecycleEvents,
  orderItems,
  orders,
  paymentEvents,
  payments,
  products,
  weddings,
  type Order,
  type Payment,
  type PaymentEvent,
} from "@/lib/db/schema";
import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import { enqueueEmail } from "@/server/email/queue";
import { enqueueBuild } from "@/server/services/build-engine";
import {
  getPaymentProvider,
  type PaymentProviderName,
  type WebhookResult,
} from "./payment-provider";
import {
  CheckoutError,
  WebhookAmountMismatchError,
  WebhookRetryableError,
  WebhookValidationError,
} from "./errors";
import {
  getPayFastConfig,
  paymentCancelUrl,
  paymentReturnUrl,
} from "./config";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateCheckoutInput {
  organizationId: string;
  /** Actor that created the checkout (audit only). */
  userId?: string;
  weddingId: string;
  productId?: string;
}

export interface CreateCheckoutResult {
  checkout: {
    orderId: string;
    paymentId: string;
    orderNumber: string;
    status: "pending" | "paid";
    itemName: string;
    itemDescription?: string | null;
    totalCents: number;
    currency: string;
    provider: PaymentProviderName;
    redirectUrl: string;
    isSimulated: boolean;
  };
}

export interface ProcessPaymentWebhookInput {
  provider: PaymentProviderName;
  raw: Record<string, string>;
  /**
   * Set ONLY by the simulated checkout flow, which vouches for the amount
   * against the payment row directly. Skips merchant_id/amount cross-checks.
   */
  simulateAmountOverride?: number;
}

/** Internal result (tenant id included for tests; routes must NOT echo it). */
export interface ProcessPaymentWebhookResult extends WebhookResult {
  organizationId: string;
  paymentId?: string;
}

export interface RefundPaymentInput {
  organizationId: string;
  paymentId: string;
  reason?: string;
  /** Optional partial amount; defaults to the full payment amount. */
  amountCents?: number;
}

export interface PaymentWithOrder {
  id: string;
  status: Payment["status"];
  amountCents: number;
  currency: string;
  provider: PaymentProviderName;
  providerReference: string;
  orderId: string;
  orderNumber: string;
  orderStatus: Order["status"];
  productName: string;
  paidAt: Date | null;
  failureReason: string | null;
  refundAmountCents: number | null;
  refundReason: string | null;
  createdAt: Date;
}

// ── Checkout ──────────────────────────────────────────────────────────────────

export async function createCheckout(
  input: CreateCheckoutInput,
): Promise<CreateCheckoutResult> {
  const { organizationId, weddingId } = input;

  const [wedding] = await db
    .select()
    .from(weddings)
    .where(and(eq(weddings.id, weddingId), isNull(weddings.deletedAt)))
    .limit(1);
  if (!wedding) {
    throw new NotFoundError("Wedding");
  }
  if (wedding.organizationId !== organizationId) {
    throw new ForbiddenError();
  }

  const targetProductId = input.productId ?? wedding.productId;
  if (!targetProductId) {
    throw new CheckoutError(
      "Wedding has no product assigned; provide productId in the request",
    );
  }

  const [product] = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.id, targetProductId),
        eq(products.status, "active"),
        isNull(products.deletedAt),
        or(
          eq(products.organizationId, organizationId),
          isNull(products.organizationId),
        ),
      ),
    )
    .limit(1);
  if (!product) {
    throw new CheckoutError("Product is not available for purchase");
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, wedding.customerId), isNull(customers.deletedAt)))
    .limit(1);
  if (!customer) {
    throw new CheckoutError("Wedding customer record is missing");
  }

  const totalCents = product.priceCents;
  const currency = product.currency ?? "ZAR";
  const provider = getPaymentProvider("payfast");
  const config = getPayFastConfig();
  const notifyUrl = config.notifyUrl;

  // ── Re-checkout guard ──────────────────────────────────────────────────────
  // A pending order + payment for the same wedding/product is reused rather
  // than duplicated (the guard is scoped by the weddingId marker we store in
  // order.metadata, so two different weddings of one customer stay distinct).
  const pending = await findPendingOrder(
    organizationId,
    customer.id,
    product.id,
    wedding.id,
  );

  if (pending?.payment) {
    const checkout = await provider.createCheckout({
      paymentId: pending.payment.id,
      orderId: pending.order.id,
      amountCents: pending.payment.amountCents,
      currency: pending.payment.currency,
      itemName: pending.itemName,
      itemDescription: pending.itemDescription ?? undefined,
      emailAddress: customer.email,
      returnUrl: paymentReturnUrl(pending.payment.id),
      cancelUrl: paymentCancelUrl(pending.payment.id),
      notifyUrl,
    });
    return {
      checkout: {
        orderId: pending.order.id,
        paymentId: pending.payment.id,
        orderNumber: pending.order.orderNumber,
        status: "pending",
        itemName: pending.itemName,
        itemDescription: pending.itemDescription,
        totalCents: pending.payment.amountCents,
        currency: pending.payment.currency,
        provider: "payfast",
        redirectUrl: checkout.redirectUrl,
        isSimulated: checkout.isSimulated,
      },
    };
  }

  // Duplicate-record guard: a wedding that already paid for this product must
  // never generate a SECOND order. Return the completed checkout instead.
  const [paidOrder] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.organizationId, organizationId),
        eq(orders.customerId, customer.id),
        eq(orders.productId, product.id),
        eq(orders.status, "paid"),
        isNull(orders.deletedAt),
        sql`${orders.metadata}->>'weddingId' = ${wedding.id}`,
      ),
    )
    .orderBy(desc(orders.paidAt))
    .limit(1);
  if (paidOrder) {
    const [paidPayment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.orderId, paidOrder.id),
          eq(payments.status, "completed"),
        ),
      )
      .orderBy(desc(payments.paidAt))
      .limit(1);
    if (paidPayment) {
      return {
        checkout: {
          orderId: paidOrder.id,
          paymentId: paidPayment.id,
          orderNumber: paidOrder.orderNumber,
          status: "paid",
          itemName: product.name,
          itemDescription: product.description,
          totalCents: paidPayment.amountCents,
          currency: paidPayment.currency,
          provider: "payfast",
          redirectUrl: "",
          isSimulated: getPayFastConfig().mode === "simulated",
        },
      };
    }
  }

  const paymentId = randomUUID();
  const providerReference = `payfast:${paymentId}`;

  // Crash recovery: a pending order with no payment (e.g. the process died
  // between the insert of the order and the payment in a previous run) gets a
  // fresh payment attached instead of a second order being created.
  if (pending && !pending.payment) {
    await db.insert(payments).values({
      id: paymentId,
      organizationId,
      orderId: pending.order.id,
      provider: "payfast",
      providerReference,
      status: "pending",
      amountCents: totalCents,
      currency,
    });
  } else if (!pending) {
    const orderNumber = await generateOrderNumber(organizationId);
    await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          organizationId,
          customerId: customer.id,
          productId: product.id,
          orderNumber,
          status: "pending",
          subtotalCents: totalCents,
          discountCents: 0,
          totalCents,
          currency,
          metadata: {
            weddingId: wedding.id,
            productCode: product.code,
            productName: product.name,
          },
          placedAt: null,
          paidAt: null,
        })
        .returning();

      await tx.insert(orderItems).values({
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        unitPriceCents: totalCents,
        quantity: 1,
        lineTotalCents: totalCents,
        metadata: { weddingId: wedding.id },
      });

      await tx.insert(payments).values({
        id: paymentId,
        organizationId,
        orderId: order.id,
        provider: "payfast",
        providerReference,
        status: "pending",
        amountCents: totalCents,
        currency,
      });

      return [order];
    });
  }

  const [createdPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerReference, providerReference))
    .limit(1);
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, createdPayment?.orderId ?? ""))
    .limit(1);
  if (!createdPayment || !order) {
    throw new CheckoutError("Checkout persistence failed; try again");
  }

  const checkout = await provider.createCheckout({
    paymentId: createdPayment.id,
    orderId: order.id,
    amountCents: totalCents,
    currency,
    itemName: product.name,
    itemDescription: product.description ?? undefined,
    emailAddress: customer.email,
    returnUrl: paymentReturnUrl(createdPayment.id),
    cancelUrl: paymentCancelUrl(createdPayment.id),
    notifyUrl,
  });

  return {
    checkout: {
      orderId: order.id,
      paymentId: createdPayment.id,
      orderNumber: order.orderNumber,
      status: "pending",
      itemName: product.name,
      itemDescription: product.description,
      totalCents,
      currency,
      provider: "payfast",
      redirectUrl: checkout.redirectUrl,
      isSimulated: checkout.isSimulated,
    },
  };
}

// ── Webhook processing ────────────────────────────────────────────────────────

export async function processPaymentWebhook(
  input: ProcessPaymentWebhookInput,
): Promise<ProcessPaymentWebhookResult> {
  const provider = getPaymentProvider(input.provider);
  const result = await provider.handleWebhook(input.raw);
  const normalized = result.normalized;

  // Resolve the payment row (m_payment_id) and its tenant. `payment_events`
  // requires an organizationId, so an event that references neither a payment
  // nor a custom_str1 order is retryable: the provider will re-send and, once
  // the payment row exists, the anchor is written.
  let payment: Payment | undefined;
  if (normalized.mPaymentId) {
    [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, normalized.mPaymentId))
      .limit(1);
  }

  let organizationId = payment?.organizationId;
  if (!organizationId && normalized.raw.custom_str1) {
    const [order] = await db
      .select({ organizationId: orders.organizationId })
      .from(orders)
      .where(eq(orders.id, normalized.raw.custom_str1))
      .limit(1);
    organizationId = order?.organizationId;
  }
  if (!organizationId) {
    throw new WebhookRetryableError(
      "Webhook references no known payment or order",
    );
  }

  // Cross-check merchant id and amount against our records — skipped ONLY when
  // the simulate route vouches for the amount.
  if (input.simulateAmountOverride === undefined) {
    const config = getPayFastConfig();
    if (
      config.merchantId &&
      normalized.merchantId &&
      normalized.merchantId !== config.merchantId
    ) {
      throw new WebhookValidationError(
        "PayFast merchant_id does not match configuration",
      );
    }
    if (payment) {
      const actual = normalized.amountCents;
      if (actual === undefined || actual !== payment.amountCents) {
        throw new WebhookAmountMismatchError(
          `Amount mismatch for payment ${payment.id}: expected ${payment.amountCents} cents, got ${actual === undefined ? "none" : actual}`,
        );
      }
    }
  }

  const now = new Date();

  // ── Idempotency anchor (append-only, unique per provider_event_id) ────────
  const anchor = await insertEventAnchor({
    organizationId,
    paymentId: payment?.id ?? null,
    result,
    now,
  });

  if (
    anchor.existing &&
    anchor.existing.status === "processed" &&
    anchor.existing.processedAt
  ) {
    // Full replay: already handled, never re-activate. But the FIRST delivery
    // may have committed activation and then crashed before the idempotent
    // email/build enqueues ran. Re-running those here is harmless (unique
    // idempotency keys) and heals the lost side effects — the provider will
    // keep retrying until the enqueues land.
    if (payment && payment.status === "completed") {
      await reconcileActivationSideEffects(payment, organizationId);
    }
    return {
      ...result,
      eventId: anchor.eventId,
      idempotent: true,
      organizationId,
      paymentId: payment?.id ?? anchor.existing.paymentId ?? undefined,
    };
  }

  const eventId = anchor.eventId;

  switch (normalized.status) {
    case "processing": {
      // Informational PENDING/PROCESSING notification. Keep the anchor pending
      // so the terminal event for the same pf_payment_id can still claim it.
      return { ...result, eventId, organizationId, paymentId: payment?.id };
    }
    case "completed": {
      if (!payment) {
        throw new WebhookRetryableError(
          "Completed webhook references no payment row",
        );
      }
      return await activateCompletedPayment({
        result,
        normalized,
        eventId,
        payment,
        organizationId,
        now,
      });
    }
    case "failed": {
      if (!payment) {
        throw new WebhookRetryableError(
          "Failed webhook references no payment row",
        );
      }
      return await recordTerminalPayment({
        result,
        eventId,
        payment,
        organizationId,
        now,
        terminal:
          normalized.status === "failed" ? "failed" : "refunded",
        reason: normalized.raw.payment_status ?? "Payment failed",
      });
    }
    case "refunded": {
      if (!payment) {
        throw new WebhookRetryableError(
          "Refunded webhook references no payment row",
        );
      }
      return await recordTerminalPayment({
        result,
        eventId,
        payment,
        organizationId,
        now,
        terminal: "refunded",
        reason: "Provider refunded the payment",
      });
    }
  }
}

// ── Activation helpers ────────────────────────────────────────────────────────

interface ActivationContext {
  result: WebhookResult;
  normalized: WebhookResult["normalized"];
  eventId: string;
  payment: Payment;
  organizationId: string;
  now: Date;
}

async function activateCompletedPayment(
  ctx: ActivationContext,
): Promise<ProcessPaymentWebhookResult> {
  const { result, normalized, eventId, payment, organizationId, now } = ctx;

  const activation = await db.transaction(async (tx) => {
    // CAS claim: only the first processor lands this update.
    const [claimed] = await tx
      .update(paymentEvents)
      .set({ status: "processed", processedAt: now })
      .where(
        and(
          eq(paymentEvents.id, eventId),
          eq(paymentEvents.status, "received"),
          isNull(paymentEvents.processedAt),
        ),
      )
      .returning({ id: paymentEvents.id });
    if (!claimed) {
      return { claimed: false } as const;
    }

    const [order] = await tx
      .select({ metadata: orders.metadata, customerId: orders.customerId })
      .from(orders)
      .where(eq(orders.id, payment.orderId))
      .limit(1);

    await tx
      .update(payments)
      .set({ status: "completed", paidAt: now })
      .where(eq(payments.id, payment.id));
    await tx
      .update(orders)
      .set({ status: "paid", placedAt: now, paidAt: now })
      .where(eq(orders.id, payment.orderId));

    // `payment_verified` lifecycle event (deduped per payment id).
    const weddingId = (order?.metadata as Record<string, unknown> | null)
      ?.weddingId as string | undefined;
    if (weddingId) {
      const [dupe] = await tx
        .select({ id: lifecycleEvents.id })
        .from(lifecycleEvents)
        .where(
          and(
            eq(lifecycleEvents.weddingId, weddingId),
            eq(lifecycleEvents.eventType, "payment_verified"),
            sql`${lifecycleEvents.metadata}->>'paymentId' = ${payment.id}`,
          ),
        )
        .limit(1);
      if (!dupe) {
        await tx.insert(lifecycleEvents).values({
          weddingId,
          organizationId,
          eventType: "payment_verified",
          reason: "Payment completed",
          actorUserId: null,
          metadata: {
            paymentId: payment.id,
            orderId: payment.orderId,
            providerEventId: normalized.providerEventId,
            amountCents: payment.amountCents,
          },
          occurredAt: now,
        });
      }
    }

    return { claimed: true, weddingId } as const;
  });

  if (!activation.claimed) {
    // Another processor (or a replay racing this one) won the CAS.
    return {
      ...result,
      eventId,
      idempotent: true,
      organizationId,
      paymentId: payment.id,
    };
  }

  // Post-commit side effects are idempotent by unique keys:
  //   email_jobs.idempotency_key  payment_success_<paymentId>
  //   build_jobs.idempotency_key  by_payment_<paymentId>
  if (activation.weddingId) {
    await enqueuePaymentSuccessEmail({
      organizationId,
      weddingId: activation.weddingId,
      payment,
    });
    await enqueuePaymentBuild({
      organizationId,
      weddingId: activation.weddingId,
      paymentId: payment.id,
    });
  }

  return { ...result, eventId, organizationId, paymentId: payment.id };
}

async function recordTerminalPayment(
  ctx: {
    result: WebhookResult;
    eventId: string;
    payment: Payment;
    organizationId: string;
    now: Date;
    terminal: "failed" | "refunded";
    reason: string;
  },
): Promise<ProcessPaymentWebhookResult> {
  const { result, eventId, payment, organizationId, now, terminal, reason } =
    ctx;

  const handled = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(paymentEvents)
      .set({ status: "processed", processedAt: now })
      .where(
        and(
          eq(paymentEvents.id, eventId),
          eq(paymentEvents.status, "received"),
          isNull(paymentEvents.processedAt),
        ),
      )
      .returning({ id: paymentEvents.id });
    if (!claimed) {
      return { claimed: false } as const;
    }

    if (terminal === "failed") {
      await tx
        .update(payments)
        .set({ status: "failed", failureReason: reason })
        .where(eq(payments.id, payment.id));
      await tx
        .update(orders)
        .set({ status: "failed" })
        .where(eq(orders.id, payment.orderId));
    } else {
      await tx
        .update(payments)
        .set({
          status: "refunded",
          refundAmountCents: payment.amountCents,
          refundReason: reason,
          refundedAt: now,
        })
        .where(eq(payments.id, payment.id));
      await tx
        .update(orders)
        .set({ status: "refunded" })
        .where(eq(orders.id, payment.orderId));
    }

    return { claimed: true } as const;
  });

  if (!handled.claimed) {
    return { ...result, eventId, idempotent: true, organizationId, paymentId: payment.id };
  }
  return { ...result, eventId, organizationId, paymentId: payment.id };
}

// ── Refund / lookup ───────────────────────────────────────────────────────────

/** Refunds a completed payment (idempotent for already-refunded payments). */
export async function refundPayment(
  input: RefundPaymentInput,
): Promise<{ refunded: boolean; alreadyRefunded: boolean }> {
  const { organizationId, paymentId } = input;

  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(eq(payments.id, paymentId), eq(payments.organizationId, organizationId)),
    )
    .limit(1);
  if (!payment) {
    throw new NotFoundError("Payment");
  }
  if (payment.status === "refunded") {
    return { refunded: true, alreadyRefunded: true };
  }
  if (payment.status !== "completed") {
    throw new CheckoutError("Only completed payments can be refunded");
  }

  const now = new Date();
  const refundAmountCents = input.amountCents ?? payment.amountCents;

  await db.transaction(async (tx) => {
    await tx
      .insert(paymentEvents)
      .values({
        organizationId,
        paymentId,
        providerEventId: `refund:${paymentId}`,
        eventType: "payment_refunded",
        provider: payment.provider,
        status: "processed",
        processedAt: now,
        payload: { reason: input.reason ?? null, amountCents: refundAmountCents },
      })
      .onConflictDoNothing({ target: paymentEvents.providerEventId });

    await tx
      .update(payments)
      .set({
        status: "refunded",
        refundAmountCents,
        refundReason: input.reason ?? null,
        refundedAt: now,
      })
      .where(eq(payments.id, paymentId));
    await tx
      .update(orders)
      .set({ status: "refunded" })
      .where(eq(orders.id, payment.orderId));
  });

  return { refunded: true, alreadyRefunded: false };
}

/** Tenant-scoped payment + order snapshot. */
export async function getPayment(input: {
  organizationId: string;
  paymentId: string;
}): Promise<PaymentWithOrder | null> {
  const [row] = await db
    .select({
      payment: payments,
      order: orders,
      productName: products.name,
    })
    .from(payments)
    .innerJoin(orders, eq(payments.orderId, orders.id))
    .innerJoin(products, eq(orders.productId, products.id))
    .where(
      and(
        eq(payments.id, input.paymentId),
        eq(payments.organizationId, input.organizationId),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }
  return {
    id: row.payment.id,
    status: row.payment.status,
    amountCents: row.payment.amountCents,
    currency: row.payment.currency,
    provider: row.payment.provider as PaymentProviderName,
    providerReference: row.payment.providerReference,
    orderId: row.payment.orderId,
    orderNumber: row.order.orderNumber,
    orderStatus: row.order.status,
    productName: row.productName,
    paidAt: row.payment.paidAt,
    failureReason: row.payment.failureReason,
    refundAmountCents: row.payment.refundAmountCents,
    refundReason: row.payment.refundReason,
    createdAt: row.payment.createdAt,
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

interface PendingOrder {
  order: Order;
  payment?: Payment;
  itemName: string;
  itemDescription?: string | null;
}

async function findPendingOrder(
  organizationId: string,
  customerId: string,
  productId: string,
  weddingId: string,
): Promise<PendingOrder | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.organizationId, organizationId),
        eq(orders.customerId, customerId),
        eq(orders.productId, productId),
        eq(orders.status, "pending"),
        isNull(orders.deletedAt),
        sql`${orders.metadata}->>'weddingId' = ${weddingId}`,
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);
  if (!order) {
    return null;
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.orderId, order.id),
        or(eq(payments.status, "pending"), eq(payments.status, "processing")),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);

  const metadata = order.metadata as Record<string, unknown> | null;
  return {
    order,
    payment,
    itemName: (metadata?.productName as string | undefined) ?? "Wedding package",
    itemDescription: (metadata?.productDescription as string | undefined) ?? null,
  };
}

async function generateOrderNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;
  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(eq(orders.organizationId, organizationId), isNull(orders.deletedAt)),
    );
  return `${prefix}${String(rows.length + 1).padStart(4, "0")}`;
}

async function insertEventAnchor(args: {
  organizationId: string;
  paymentId: string | null;
  result: WebhookResult;
  now: Date;
}): Promise<{ eventId: string; existing?: PaymentEvent }> {
  const [inserted] = await db
    .insert(paymentEvents)
    .values({
      organizationId: args.organizationId,
      paymentId: args.paymentId,
      providerEventId: args.result.eventId,
      eventType: args.result.eventType,
      provider: args.result.provider,
      status: "received",
      payload: args.result.normalized.raw as Record<string, unknown>,
    })
    .onConflictDoNothing({ target: paymentEvents.providerEventId })
    .returning({ id: paymentEvents.id });

  if (inserted) {
    return { eventId: inserted.id };
  }

  const [existing] = await db
    .select()
    .from(paymentEvents)
    .where(eq(paymentEvents.providerEventId, args.result.eventId))
    .limit(1);
  if (!existing) {
    throw new WebhookRetryableError(
      "Unique conflict without an existing payment event row",
    );
  }
  return { eventId: existing.id, existing };
}

/**
 * Re-apply the idempotent post-activation side effects (payment_success email
 * + automatic vault build) for an already-activated payment. Called from the
 * webhook replay path so a crash between activation commit and enqueue is
 * healed by the provider's retry. Both effects are keyed by unique idempotency
 * keys, so re-running them is always a no-op when they already landed.
 */
async function reconcileActivationSideEffects(
  payment: Payment,
  organizationId: string,
): Promise<void> {
  const [order] = await db
    .select({ metadata: orders.metadata })
    .from(orders)
    .where(eq(orders.id, payment.orderId))
    .limit(1);
  const weddingId = (order?.metadata as Record<string, unknown> | null)
    ?.weddingId as string | undefined;
  if (!weddingId) return;

  await enqueuePaymentSuccessEmail({ organizationId, weddingId, payment });
  await enqueuePaymentBuild({
    organizationId,
    weddingId,
    paymentId: payment.id,
  });
}

async function enqueuePaymentSuccessEmail(args: {
  organizationId: string;
  weddingId: string;
  payment: Payment;
}): Promise<void> {
  const { organizationId, weddingId, payment } = args;

  const [row] = await db
    .select({ wedding: weddings, customer: customers })
    .from(weddings)
    .innerJoin(customers, eq(weddings.customerId, customers.id))
    .where(eq(weddings.id, weddingId))
    .limit(1);
  if (!row) {
    console.warn(`[Payments] Wedding ${weddingId} not found; skipping payment_success email`);
    return;
  }

  const email = (row.customer.email ?? "").trim().toLowerCase();
  // AGENTS.md: emails only ever target real resolved addresses, never placeholders.
  if (!email || email.endsWith("@wedding-vault.local")) {
    console.warn(
      `[Payments] Wedding ${weddingId} has no real customer email; skipping payment_success email`,
    );
    return;
  }

  const coupleName = [row.wedding.partnerOneName, row.wedding.partnerTwoName]
    .filter(Boolean)
    .join(" & ");

  const [order] = await db
    .select({ metadata: orders.metadata })
    .from(orders)
    .where(eq(orders.id, payment.orderId))
    .limit(1);
  const orderMeta = order?.metadata as Record<string, unknown> | null;
  const packageName = (orderMeta?.productName as string | undefined) ?? undefined;

  await enqueueEmail({
    organizationId,
    weddingId,
    emailType: "payment_success",
    toEmail: email,
    toName: row.customer.fullName ?? undefined,
    subject: `Payment confirmed for ${coupleName || "your wedding vault"}`,
    bodyHtml: `<p>Thank you! Your payment for the <strong>${escapeHtml(packageName ?? "your")}</strong> package has been received and confirmed.</p><p>We're now preparing your private wedding memory vault. You'll receive another email the moment it's ready to share.</p>`,
    bodyText: `Payment confirmed for ${coupleName || "your wedding vault"}.\n\nThank you! Your payment for the ${packageName ?? "your"} package has been received and confirmed.\n\nWe're now preparing your private wedding memory vault. You'll receive another email the moment it's ready to share.`,
    templateKey: "payment_success",
    data: {
      coupleName: coupleName || undefined,
      customerName: row.customer.fullName ?? undefined,
      packageName,
      supportEmail: "support@weddingmemoryvault.app",
    },
    metadata: { paymentId: payment.id, orderId: payment.orderId },
    idempotencyKey: `payment_success_${payment.id}`,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function enqueuePaymentBuild(args: {
  organizationId: string;
  weddingId: string;
  paymentId: string;
}): Promise<void> {
  const { organizationId, weddingId, paymentId } = args;

  const [wedding] = await db
    .select()
    .from(weddings)
    .where(and(eq(weddings.id, weddingId), isNull(weddings.deletedAt)))
    .limit(1);
  if (!wedding) {
    console.warn(`[Payments] Wedding ${weddingId} not found; skipping build enqueue`);
    return;
  }
  if (!wedding.productId) {
    return;
  }

  await enqueueBuild({
    weddingId: wedding.id,
    organizationId,
    customerId: wedding.customerId,
    productId: wedding.productId,
    idempotencyKey: `by_payment_${paymentId}`,
    templateId: wedding.templateId ?? undefined,
  });
}