/**
 * Integration tests for the phase-14 billing layer.
 *
 * Chain under test: checkout (order + order_item + payment) → PayFast ITN
 * webhook (signature verified, idempotency-anchored) → payment activation →
 * `payment_verified` lifecycle event → `payment_success` email + build
 * enqueued.
 *
 * UUID family: 77777777 — not used by any other suite (see WORKER_STATUS /
 * existing suites for the allocated 00000000–66666666 families).
 *
 * Fixtures are lifecycle-inert: every wedding is `draft` and no `expiry_rules`
 * rows are created, so global lifecycle/expiry sweeps cannot touch them.
 *
 * Run: npx vitest run src/server/services/__tests__/payments.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  organizations,
  customers,
  products,
  weddings,
  orders,
  payments,
  paymentEvents,
  lifecycleEvents,
  emailJobs,
  buildJobs,
} from "@/lib/db/schema";
import {
  createCheckout,
  processPaymentWebhook,
  refundPayment,
  getPayment,
} from "@/server/services/payments/billing-service";
import {
  buildSignature,
  verifySignature,
  setValidateTransport,
} from "@/server/services/payments/payfast";
import {
  CheckoutError,
  WebhookAmountMismatchError,
  WebhookSignatureError,
  WebhookValidationError,
} from "@/server/services/payments/errors";
import { NotFoundError, ForbiddenError } from "@/lib/auth/errors";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG = "77777777-7777-7777-7777-777777777701";
const ORG_2 = "77777777-7777-7777-7777-777777777702";
const CUSTOMER = "77777777-7777-7777-7777-777777777711";
const CUSTOMER_2 = "77777777-7777-7777-7777-777777777712";
const PRODUCT = "77777777-7777-7777-7777-777777777721";
const PRODUCT_INACTIVE = "77777777-7777-7777-7777-777777777722";
const PRODUCT_OTHER_ORG = "77777777-7777-7777-7777-777777777723";
const WEDDING = "77777777-7777-7777-7777-777777777731";
const WEDDING_NO_PRODUCT = "77777777-7777-7777-7777-777777777732";
const WEDDING_DELETED = "77777777-7777-7777-7777-777777777733";
const WEDDING_FOREIGN = "77777777-7777-7777-7777-777777777734";
const WEDDING_INACTIVE = "77777777-7777-7777-7777-777777777735";
const WEDDING_2 = "77777777-7777-7777-7777-777777777736";

const GOLD_PRICE_CENTS = 79900;

const ENV_KEYS = [
  "PAYFAST_MERCHANT_ID",
  "PAYFAST_MERCHANT_KEY",
  "PAYFAST_PASSPHRASE",
  "PAYFAST_MODE",
  "PAYFAST_VALIDATE_URL",
];

async function cleanup() {
  for (const orgId of [ORG, ORG_2]) {
    // payment_events anchors block payment deletes → delete first.
    await db.delete(paymentEvents).where(eq(paymentEvents.organizationId, orgId));
    await db.delete(payments).where(eq(payments.organizationId, orgId));
    // buildJobSteps cascade from buildJobs.
    await db.delete(buildJobs).where(eq(buildJobs.organizationId, orgId));
    await db.delete(emailJobs).where(eq(emailJobs.organizationId, orgId));
    await db.delete(lifecycleEvents).where(eq(lifecycleEvents.organizationId, orgId));
    // order_items cascade from orders.
    await db.delete(orders).where(eq(orders.organizationId, orgId));
    await db.delete(weddings).where(eq(weddings.organizationId, orgId));
    await db.delete(customers).where(eq(customers.organizationId, orgId));
    await db.delete(products).where(eq(products.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  }
}

async function seed() {
  await cleanup();

  await db.insert(organizations).values([
    {
      id: ORG,
      publicId: "7777777777777777777777777701",
      name: "Payments Test Co",
      slug: "payments-test-co-777777777701",
      type: "wedding_company",
      status: "active",
    },
    {
      id: ORG_2,
      publicId: "7777777777777777777777777702",
      name: "Foreign Co",
      slug: "foreign-co-777777777702",
      type: "wedding_company",
      status: "active",
    },
  ]);

  await db.insert(customers).values([
    {
      id: CUSTOMER,
      organizationId: ORG,
      publicId: "cust-77-701",
      fullName: "Alice Smith",
      email: "alice@example.com",
    },
    {
      id: CUSTOMER_2,
      organizationId: ORG_2,
      publicId: "cust-77-702",
      fullName: "Bob Foreign",
      email: "bob@foreign.example.com",
    },
  ]);

  await db.insert(products).values([
    {
      id: PRODUCT,
      organizationId: ORG,
      code: "gold",
      name: "Gold",
      priceCents: GOLD_PRICE_CENTS,
      status: "active",
    },
    {
      id: PRODUCT_INACTIVE,
      organizationId: ORG,
      code: "gold_inactive",
      name: "Gold (inactive)",
      priceCents: GOLD_PRICE_CENTS,
      status: "inactive",
    },
    {
      id: PRODUCT_OTHER_ORG,
      organizationId: ORG_2,
      code: "gold_other",
      name: "Gold (other org)",
      priceCents: GOLD_PRICE_CENTS,
      status: "active",
    },
  ]);

  await db.insert(weddings).values([
    {
      id: WEDDING,
      organizationId: ORG,
      customerId: CUSTOMER,
      productId: PRODUCT,
      publicId: "pub-77-731",
      code: "WED-77-731",
      name: "Alice & Bob",
      partnerOneName: "Alice",
      partnerTwoName: "Bob",
      status: "draft",
    },
    {
      id: WEDDING_NO_PRODUCT,
      organizationId: ORG,
      customerId: CUSTOMER,
      productId: null,
      publicId: "pub-77-732",
      code: "WED-77-732",
      name: "Carol & Dan",
      status: "draft",
    },
    {
      id: WEDDING_DELETED,
      organizationId: ORG,
      customerId: CUSTOMER,
      productId: PRODUCT,
      publicId: "pub-77-733",
      code: "WED-77-733",
      name: "Erin & Frank",
      status: "draft",
      deletedAt: new Date(),
    },
    {
      id: WEDDING_FOREIGN,
      organizationId: ORG_2,
      customerId: CUSTOMER_2,
      productId: PRODUCT_OTHER_ORG,
      publicId: "pub-77-734",
      code: "WED-77-734",
      name: "Foreign Couple",
      status: "draft",
    },
    {
      id: WEDDING_INACTIVE,
      organizationId: ORG,
      customerId: CUSTOMER,
      productId: PRODUCT_INACTIVE,
      publicId: "pub-77-735",
      code: "WED-77-735",
      name: "Grace & Henry",
      status: "draft",
    },
    {
      // Same org + customer + product as WEDDING but a distinct wedding — used
      // by tests that need a second unrelated purchase (the paid-order guard
      // prevents createCheckout from issuing a second order for WEDDING).
      id: WEDDING_2,
      organizationId: ORG,
      customerId: CUSTOMER,
      productId: PRODUCT,
      publicId: "pub-77-736",
      code: "WED-77-736",
      name: "Ivy & Jack",
      status: "draft",
    },
  ]);
}

/** Builds the exact ITN PayFast would send, signed with the current env. */
function buildItn(
  payment: { paymentId: string; orderId?: string; amountCents: number },
  overrides: Record<string, string> = {},
): Record<string, string> {
  const params: Record<string, string> = {
    merchant_id: process.env.PAYFAST_MERCHANT_ID ?? "",
    merchant_key: process.env.PAYFAST_MERCHANT_KEY ?? "",
    m_payment_id: payment.paymentId,
    pf_payment_id: `sim-${payment.paymentId}`,
    payment_status: "COMPLETE",
    amount_gross: (payment.amountCents / 100).toFixed(2),
    amount_fee: "0.00",
    item_name: "Gold",
    item_description: "",
    custom_str1: payment.orderId ?? "",
    ...overrides,
  };
  params["signature"] = buildSignature(
    params,
    process.env.PAYFAST_PASSPHRASE || undefined,
  );
  return params;
}

async function createPendingPayment(): Promise<{
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amountCents: number;
}> {
  const result = await createCheckout({ organizationId: ORG, weddingId: WEDDING });
  return {
    paymentId: result.checkout.paymentId,
    orderId: result.checkout.orderId,
    orderNumber: result.checkout.orderNumber,
    amountCents: result.checkout.totalCents,
  };
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  process.env.PAYFAST_MERCHANT_ID = "10000100";
  process.env.PAYFAST_MERCHANT_KEY = "53f0d2c0a9c5";
  process.env.PAYFAST_PASSPHRASE = "testpassphrase";
  process.env.PAYFAST_MODE = "simulated";
  setValidateTransport(undefined);
  await seed();
});

afterEach(async () => {
  setValidateTransport(undefined);
  await cleanup();
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildSignature / verifySignature", () => {
  it("is deterministic, excludes signature, and sorts keys case-insensitively", () => {
    // Fixture A: PayFast sandbox credentials (official docs merchant pair).
    const official: Record<string, string> = {
      merchant_id: "10000100",
      merchant_key: "46f0cd694581a",
      amount: "100.00",
      item_name: "Test Product",
    };
    expect(buildSignature(official, "jt7NOE43FZPn")).toBe(
      "4a11d7b878c729a97c65cb489cb181a4",
    );
    // The signature key is never part of the signed string.
    expect(
      buildSignature({ ...official, signature: "anything" }, "jt7NOE43FZPn"),
    ).toBe("4a11d7b878c729a97c65cb489cb181a4");

    // Fixture B: hand-computed with m_payment_id + URL-encoded values.
    const encoded: Record<string, string> = {
      merchant_id: "10000100",
      merchant_key: "53f0d2c0a9c5",
      m_payment_id: "77e5f9f4-0000-0000-0000-000000000001",
      amount: "799.00",
      item_name: "Gold Wedding Package",
      item_description: "Full wedding vault with video%20and%20slideshow",
      email_address: "test%40example.com",
      custom_str1: "77f0-0000-0000-0000-000000000001",
    };
    expect(buildSignature(encoded, "testpassphrase")).toBe(
      "8c036df2eadc40e60e665a95089a2e12",
    );
  });

  it("verifies valid signatures and rejects tampered / wrong-passphrase ones", () => {
    const params: Record<string, string> = {
      merchant_id: "10000100",
      merchant_key: "53f0d2c0a9c5",
      payment_status: "COMPLETE",
      amount_gross: "799.00",
      pf_payment_id: "sim-payment-1",
      signature: buildSignature(
        {
          merchant_id: "10000100",
          merchant_key: "53f0d2c0a9c5",
          payment_status: "COMPLETE",
          amount_gross: "799.00",
          pf_payment_id: "sim-payment-1",
        },
        "testpassphrase",
      ),
    };
    expect(verifySignature(params, "testpassphrase")).toBe(true);
    // Tampering with the amount invalidates the signature.
    expect(
      verifySignature({ ...params, amount_gross: "1.00" }, "testpassphrase"),
    ).toBe(false);
    // Wrong passphrase also fails verification.
    expect(verifySignature(params, "wrongpassphrase")).toBe(false);
  });
});

describe("createCheckout", () => {
  it("creates a pending order, line item and payment and returns the simulated redirect", async () => {
    const result = await createCheckout({
      organizationId: ORG,
      weddingId: WEDDING,
    });
    const { checkout } = result;

    expect(checkout.provider).toBe("payfast");
    expect(checkout.status).toBe("pending");
    expect(checkout.totalCents).toBe(GOLD_PRICE_CENTS);
    expect(checkout.isSimulated).toBe(true);
    expect(checkout.redirectUrl).toContain(`/api/payments/simulate/${checkout.paymentId}`);
    expect(checkout.orderNumber).toMatch(/^ORD-\d{4}-\d{4}$/);

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, checkout.orderId))
      .limit(1);
    expect(order).toBeDefined();
    expect(order!.organizationId).toBe(ORG);
    expect(order!.status).toBe("pending");
    expect(order!.totalCents).toBe(GOLD_PRICE_CENTS);

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, checkout.paymentId))
      .limit(1);
    expect(payment).toBeDefined();
    expect(payment!.provider).toBe("payfast");
    expect(payment!.providerReference).toBe(`payfast:${checkout.paymentId}`);
    expect(payment!.status).toBe("pending");
    expect(payment!.organizationId).toBe(ORG);
  });

  it("reuses the existing pending order+payment instead of duplicating", async () => {
    const first = await createCheckout({ organizationId: ORG, weddingId: WEDDING });
    const second = await createCheckout({ organizationId: ORG, weddingId: WEDDING });

    expect(second.checkout.paymentId).toBe(first.checkout.paymentId);
    expect(second.checkout.orderId).toBe(first.checkout.orderId);

    const ordersCount = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.organizationId, ORG));
    const paymentsCount = await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.organizationId, ORG));
    expect(ordersCount).toHaveLength(1);
    expect(paymentsCount).toHaveLength(1);
  });

  it("never creates a second order for an already-paid wedding", async () => {
    const pending = await createPendingPayment();
    await processPaymentWebhook({
      provider: "payfast",
      raw: buildItn(pending),
      simulateAmountOverride: pending.amountCents,
    });

    // A later checkout attempt (fresh session, different browser) must return
    // the SAME paid order/payment, never a duplicate order.
    const again = await createCheckout({ organizationId: ORG, weddingId: WEDDING });
    expect(again.checkout.status).toBe("paid");
    expect(again.checkout.orderId).toBe(pending.orderId);
    expect(again.checkout.paymentId).toBe(pending.paymentId);
    expect(again.checkout.redirectUrl).toBe("");

    const ordersCount = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.organizationId, ORG));
    expect(ordersCount).toHaveLength(1);
  });

  it("rejects: missing/deleted wedding, foreign org, no product, unavailable product", async () => {
    await expect(
      createCheckout({ organizationId: ORG, weddingId: "99e5f9f4-0000-0000-0000-000000000099" }),
    ).rejects.toBeInstanceOf(NotFoundError);

    await expect(
      createCheckout({ organizationId: ORG, weddingId: WEDDING_DELETED }),
    ).rejects.toBeInstanceOf(NotFoundError);

    await expect(
      createCheckout({ organizationId: ORG, weddingId: WEDDING_FOREIGN }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      createCheckout({ organizationId: ORG, weddingId: WEDDING_NO_PRODUCT }),
    ).rejects.toBeInstanceOf(CheckoutError);

    await expect(
      createCheckout({ organizationId: ORG, weddingId: WEDDING_INACTIVE }),
    ).rejects.toBeInstanceOf(CheckoutError);

    // A product owned by another org is not purchasable here.
    await expect(
      createCheckout({
        organizationId: ORG,
        weddingId: WEDDING,
        productId: PRODUCT_OTHER_ORG,
      }),
    ).rejects.toBeInstanceOf(CheckoutError);
  });
});

describe("processPaymentWebhook activation", () => {
  it("completes the payment, marks the order paid, and enqueues email+build", async () => {
    const pending = await createPendingPayment();
    const itn = buildItn(pending);

    const result = await processPaymentWebhook({
      provider: "payfast",
      raw: itn,
      simulateAmountOverride: pending.amountCents,
    });

    expect(result.idempotent).toBeUndefined();
    expect(result.status).toBe("completed");
    expect(result.organizationId).toBe(ORG);
    expect(result.paymentId).toBe(pending.paymentId);

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, pending.paymentId))
      .limit(1);
    expect(payment!.status).toBe("completed");
    expect(payment!.paidAt).toBeInstanceOf(Date);

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, pending.orderId))
      .limit(1);
    expect(order!.status).toBe("paid");
    expect(order!.paidAt).toBeInstanceOf(Date);
    expect(order!.placedAt).toBeInstanceOf(Date);

    // payment_verified lifecycle event (deduped by paymentId in metadata).
    const lifecycle = await db
      .select()
      .from(lifecycleEvents)
      .where(
        and(
          eq(lifecycleEvents.weddingId, WEDDING),
          eq(lifecycleEvents.eventType, "payment_verified"),
        ),
      );
    expect(lifecycle).toHaveLength(1);
    expect((lifecycle[0]!.metadata as { paymentId?: string }).paymentId).toBe(
      pending.paymentId,
    );

    // payment_success email job (idempotency key anchored to the payment).
    const emails = await db
      .select()
      .from(emailJobs)
      .where(eq(emailJobs.organizationId, ORG));
    expect(emails).toHaveLength(1);
    expect(emails[0]!.emailType).toBe("payment_success");
    expect(emails[0]!.toEmail).toBe("alice@example.com");
    expect(emails[0]!.idempotencyKey).toBe(`payment_success_${pending.paymentId}`);

    // Build job enqueued with the payment idempotency key.
    const builds = await db
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.weddingId, WEDDING));
    expect(builds.some((b) => b.idempotencyKey === `by_payment_${pending.paymentId}`)).toBe(
      true,
    );

    // Raw webhook retained for audit/replay.
    const events = await db
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.organizationId, ORG));
    expect(events).toHaveLength(1);
    expect(events[0]!.status).toBe("processed");
    expect(events[0]!.providerEventId).toBe(`sim-${pending.paymentId}`);
    expect(events[0]!.paymentId).toBe(pending.paymentId);
  });

  it("replays processed events idempotently without re-activation", async () => {
    const pending = await createPendingPayment();
    const itn = buildItn(pending);

    const first = await processPaymentWebhook({
      provider: "payfast",
      raw: itn,
      simulateAmountOverride: pending.amountCents,
    });
    expect(first.idempotent).toBeUndefined();

    const replay = await processPaymentWebhook({
      provider: "payfast",
      raw: itn,
      simulateAmountOverride: pending.amountCents,
    });
    expect(replay.idempotent).toBe(true);

    const lifecycle = await db
      .select()
      .from(lifecycleEvents)
      .where(eq(lifecycleEvents.weddingId, WEDDING));
    expect(lifecycle).toHaveLength(1);

    const emails = await db
      .select()
      .from(emailJobs)
      .where(eq(emailJobs.organizationId, ORG));
    expect(emails).toHaveLength(1);

    const builds = await db
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.organizationId, ORG));
    expect(builds.filter((b) => b.idempotencyKey.startsWith("by_payment_"))).toHaveLength(1);
  });

  it("replays heal a crash between activation commit and idempotent side effects", async () => {
    const pending = await createPendingPayment();
    const itn = buildItn(pending);

    const first = await processPaymentWebhook({
      provider: "payfast",
      raw: itn,
      simulateAmountOverride: pending.amountCents,
    });
    expect(first.idempotent).toBeUndefined();

    // Simulate the crash window: activation committed (payment + order +
    // lifecycle event) but the process died BEFORE the email/build enqueues.
    await db
      .delete(emailJobs)
      .where(
        and(
          eq(emailJobs.organizationId, ORG),
          eq(emailJobs.idempotencyKey, `payment_success_${pending.paymentId}`),
        ),
      );
    await db
      .delete(buildJobs)
      .where(
        and(
          eq(buildJobs.organizationId, ORG),
          eq(buildJobs.idempotencyKey, `by_payment_${pending.paymentId}`),
        ),
      );

    // Provider retries the same event. It must NOT re-activate the payment,
    // but it MUST re-apply the missing side effects (reconcile) so the vault
    // build and confirmation email are not lost forever.
    const replay = await processPaymentWebhook({
      provider: "payfast",
      raw: itn,
      simulateAmountOverride: pending.amountCents,
    });
    expect(replay.idempotent).toBe(true);

    const emails = await db
      .select()
      .from(emailJobs)
      .where(eq(emailJobs.organizationId, ORG));
    expect(
      emails.some((e) => e.idempotencyKey === `payment_success_${pending.paymentId}`),
    ).toBe(true);

    const builds = await db
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.organizationId, ORG));
    expect(
      builds.some((b) => b.idempotencyKey === `by_payment_${pending.paymentId}`),
    ).toBe(true);
  });

  it("treats PENDING as informational and still activates the terminal COMPLETE", async () => {
    const pending = await createPendingPayment();

    const info = await processPaymentWebhook({
      provider: "payfast",
      raw: buildItn(pending, { payment_status: "PENDING" }),
      simulateAmountOverride: pending.amountCents,
    });
    expect(info.status).toBe("processing");

    const [stillPending] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, pending.paymentId))
      .limit(1);
    expect(stillPending!.status).toBe("pending");

    const completed = await processPaymentWebhook({
      provider: "payfast",
      raw: buildItn(pending),
      simulateAmountOverride: pending.amountCents,
    });
    expect(completed.status).toBe("completed");

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, pending.paymentId))
      .limit(1);
    expect(payment!.status).toBe("completed");
  });

  it("rejects tampered amounts, foreign merchants and bad signatures", async () => {
    const pending = await createPendingPayment();

    // Amount tampering (re-signed to reach the amount cross-check).
    await expect(
      processPaymentWebhook({
        provider: "payfast",
        raw: buildItn(pending, { amount_gross: "1.00" }),
        // No simulateAmountOverride → the service checks the amount itself.
      }),
    ).rejects.toBeInstanceOf(WebhookAmountMismatchError);

    // Merchant mismatch.
    await expect(
      processPaymentWebhook({
        provider: "payfast",
        raw: buildItn(pending, { merchant_id: "99999999" }),
      }),
    ).rejects.toBeInstanceOf(WebhookValidationError);

    // Bad signature.
    await expect(
      processPaymentWebhook({
        provider: "payfast",
        raw: { ...buildItn(pending), signature: "0".repeat(32) },
      }),
    ).rejects.toBeInstanceOf(WebhookSignatureError);

    // Nothing was persisted: no payment_events anchors at all.
    const events = await db
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.organizationId, ORG));
    expect(events).toHaveLength(0);
  });

  it("records FAILED and REFUNDED terminal states", async () => {
    const failed = await createPendingPayment();
    await processPaymentWebhook({
      provider: "payfast",
      raw: buildItn(failed, { payment_status: "FAILED" }),
      simulateAmountOverride: failed.amountCents,
    });
    const [failedPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, failed.paymentId))
      .limit(1);
    expect(failedPayment!.status).toBe("failed");
    expect(failedPayment!.failureReason).toBe("FAILED");
    const [failedOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, failed.orderId))
      .limit(1);
    expect(failedOrder!.status).toBe("failed");

    const refunded = await createPendingPayment();
    await processPaymentWebhook({
      provider: "payfast",
      raw: buildItn(refunded, { payment_status: "REFUNDED" }),
      simulateAmountOverride: refunded.amountCents,
    });
    const [refundedPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, refunded.paymentId))
      .limit(1);
    expect(refundedPayment!.status).toBe("refunded");
    expect(refundedPayment!.refundAmountCents).toBe(refunded.amountCents);
    const [refundedOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, refunded.orderId))
      .limit(1);
    expect(refundedOrder!.status).toBe("refunded");
  });

  it("runs server-side validation in live mode via the injectable transport", async () => {
    process.env.PAYFAST_MODE = "live";

    // Valid response → activation proceeds.
    setValidateTransport(async () => true);
    const pending = await createPendingPayment();
    const result = await processPaymentWebhook({
      provider: "payfast",
      raw: buildItn(pending),
      simulateAmountOverride: pending.amountCents,
    });
    expect(result.status).toBe("completed");

    // A fresh payment whose server-side validation fails is rejected and
    // never activated. Uses a DIFFERENT wedding: the paid-order guard means
    // createCheckout for an already-paid wedding returns the paid checkout.
    const second = await createCheckout({ organizationId: ORG, weddingId: WEDDING_2 });
    const secondPaymentId = second.checkout.paymentId;
    setValidateTransport(async () => false);
    await expect(
      processPaymentWebhook({
        provider: "payfast",
        raw: buildItn({ paymentId: secondPaymentId, amountCents: second.checkout.totalCents }),
        simulateAmountOverride: second.checkout.totalCents,
      }),
    ).rejects.toBeInstanceOf(WebhookValidationError);

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, secondPaymentId))
      .limit(1);
    expect(payment!.status).toBe("pending");
  });
});

describe("refundPayment / getPayment", () => {
  it("refunds only completed payments, idempotently", async () => {
    const pending = await createPendingPayment();

    await expect(
      refundPayment({ organizationId: ORG, paymentId: pending.paymentId }),
    ).rejects.toBeInstanceOf(CheckoutError);

    await processPaymentWebhook({
      provider: "payfast",
      raw: buildItn(pending),
      simulateAmountOverride: pending.amountCents,
    });

    const result = await refundPayment({
      organizationId: ORG,
      paymentId: pending.paymentId,
      reason: "Test refund",
    });
    expect(result).toEqual({ refunded: true, alreadyRefunded: false });

    const again = await refundPayment({
      organizationId: ORG,
      paymentId: pending.paymentId,
      reason: "Test refund",
    });
    expect(again).toEqual({ refunded: true, alreadyRefunded: true });

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, pending.paymentId))
      .limit(1);
    expect(payment!.status).toBe("refunded");
    expect(payment!.refundReason).toBe("Test refund");
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, pending.orderId))
      .limit(1);
    expect(order!.status).toBe("refunded");
  });

  it("returns a tenant-scoped payment snapshot", async () => {
    const pending = await createPendingPayment();

    const snapshot = await getPayment({
      organizationId: ORG,
      paymentId: pending.paymentId,
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot!.orderNumber).toBe(pending.orderNumber);
    expect(snapshot!.productName).toBe("Gold");
    expect(snapshot!.amountCents).toBe(GOLD_PRICE_CENTS);
    expect(snapshot!.status).toBe("pending");

    // Cross-tenant access is denied by an empty result (never a leak).
    const foreign = await getPayment({
      organizationId: ORG_2,
      paymentId: pending.paymentId,
    });
    expect(foreign).toBeNull();
  });
});