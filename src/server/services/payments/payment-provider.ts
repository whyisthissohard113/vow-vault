/**
 * Payment provider adapter contract.
 *
 * The billing service talks to this neutral interface only; concrete adapters
 * (PayFast for phase 14) translate the provider's idiosyncrasies into a single
 * normalized webhook shape and a redirect-based checkout result.
 *
 * Contract stability: this interface is the boundary between the billing
 * service and payment providers. Do not change field semantics without
 * recording the change in `docs/DECISIONS.md` and updating both sides.
 */

export const SUPPORTED_PAYMENT_PROVIDERS = ["payfast"] as const;

export type PaymentProviderName = (typeof SUPPORTED_PAYMENT_PROVIDERS)[number];

/** Inputs for opening a checkout at the provider (already price-verified). */
export interface CheckoutInput {
  /** Our internal payment id (payments.id). Used as `m_payment_id`. */
  paymentId: string;
  /** Our internal order id (orders.id). Passed as `custom_str1`. */
  orderId: string;
  amountCents: number;
  currency: string;
  itemName: string;
  itemDescription?: string;
  emailAddress?: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

export interface CheckoutResult {
  /** Absolute URL the customer is redirected to at the provider. */
  redirectUrl: string;
  /** True when the local simulated checkout was used (never hits PayFast). */
  isSimulated: boolean;
  provider: PaymentProviderName;
  /** Form params sent to the provider (audit/debugging). */
  formParams?: Record<string, string>;
}

/** Normalized payment terminal state from a provider event. */
export type NormalizedWebhookStatus =
  | "completed"
  | "processing"
  | "failed"
  | "refunded";

/** The subset of provider fields the billing layer trusts after verification. */
export interface NormalizedWebhookEvent {
  /** Provider-side transaction id (idempotency anchor: pf_payment_id). */
  providerEventId: string;
  /** Our internal payment id when the provider returns it (m_payment_id). */
  mPaymentId?: string;
  /** Provider-scoped reference matching `payments.provider_reference`. */
  paymentReference?: string;
  status: NormalizedWebhookStatus;
  amountCents?: number;
  amountFeeCents?: number;
  merchantId?: string;
  /** Raw signature as supplied by the provider (verification already done). */
  signature?: string;
  provider: PaymentProviderName;
  /** Full raw payload retained for audit/replay. */
  raw: Record<string, string>;
}

export type WebhookEventType =
  | "payment_verified"
  | "payment_received"
  | "payment_failed"
  | "payment_refunded"
  | "notification";

export interface WebhookResult {
  /** Provider event id (pf_payment_id) — the deduplication anchor. */
  eventId: string;
  eventType: WebhookEventType;
  /** provider-scoped reference (e.g. `payfast:<paymentId>`), if resolvable. */
  paymentReference?: string;
  status: NormalizedWebhookStatus;
  amountCents?: number;
  provider: PaymentProviderName;
  /**
   * True when the webhook was a replay of an already-processed event. The
   * billing service never re-activates an idempotent replay.
   */
  idempotent?: boolean;
  normalized: NormalizedWebhookEvent;
}

export interface PaymentProviderAdapter {
  readonly name: PaymentProviderName;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /**
   * Verifies and normalizes a raw provider webhook payload.
   * Throws provider-specific errors; must never return unverified data.
   */
  handleWebhook(raw: Record<string, string>): Promise<WebhookResult>;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const registry = new Map<PaymentProviderName, PaymentProviderAdapter>();

export function registerPaymentProvider(adapter: PaymentProviderAdapter): void {
  registry.set(adapter.name, adapter);
}

export function getPaymentProvider(name: string): PaymentProviderAdapter {
  const adapter = registry.get(name as PaymentProviderName);
  if (!adapter) {
    throw new Error(`Unsupported payment provider: ${name}`);
  }
  return adapter;
}