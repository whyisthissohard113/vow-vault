/**
 * Billing / payment webhook error taxonomy.
 *
 * These classes map onto the webhook route's HTTP contract:
 *   WebhookValidationError  → 400 (malformed payload, merchant/amount mismatch;
 *                              provider must NOT retry)
 *   WebhookSignatureError   → 401 (signature verification failed; provider must
 *                              NOT retry — retrying a forged payload is a waste
 *                              and a sign of a misconfigured passphrase)
 *   WebhookRetryableError   → 500 (transient processing failure; provider SHOULD
 *                              retry; the payment_events anchor prevents
 *                              double-activation on the replay)
 *
 * The checkout flow uses `CheckoutError` (→ 400) for unresolvable product
 * states and the shared `NotFoundError`/`ForbiddenError` auth errors elsewhere.
 */

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

export class CheckoutError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

export class WebhookValidationError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = "WebhookValidationError";
  }
}

export class WebhookAmountMismatchError extends WebhookValidationError {
  constructor(message: string) {
    super(message);
    this.name = "WebhookAmountMismatchError";
  }
}

export class WebhookSignatureError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export class WebhookRetryableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = "WebhookRetryableError";
  }
}