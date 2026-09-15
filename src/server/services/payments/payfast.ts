/**
 * PayFast adapter — checkout form + ITN (Instant Transaction Notification)
 * verification and normalization.
 *
 * Security invariants (server-side only, never exposed to guests):
 * 1. Every ITN payload must carry a valid MD5 signature over the submitted
 *    parameters + the merchant passphrase; `signature` itself is excluded from
 *    the signed string and the comparison runs in constant time.
 * 2. In live/test mode the payload is additionally confirmed with PayFast's
 *    server-side validation endpoint (`VALID` body) before any DB write.
 * 3. In simulated mode (dev) network validation is skipped but the MD5
 *    signature is STILL verified — the simulate route signs real payloads with
 *    the configured passphrase.
 *
 * Signature algorithm (PayFast): exclude `signature`, sort keys alphabetically
 * (case-insensitive, ties broken by byte order), url-decode values, join as
 * `key=value` pairs with `&`, append `&passphrase=<pass>` when configured, MD5
 * hex lowercase. Values already arrive decoded (URLSearchParams) so decoding is
 * a no-op except when callers pass pre-encoded fixture values.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import {
  type CheckoutInput,
  type CheckoutResult,
  type NormalizedWebhookEvent,
  type NormalizedWebhookStatus,
  type PaymentProviderAdapter,
  type WebhookEventType,
  type WebhookResult,
  registerPaymentProvider,
} from "./payment-provider";
import {
  WebhookSignatureError,
  WebhookValidationError,
} from "./errors";
import {
  getPayFastConfig,
  PAYFAST_SIMULATED_REDIRECT_BASE,
  type PayFastConfig,
} from "./config";

// ── Signature ─────────────────────────────────────────────────────────────────

/** URL-decodes a value safely; leaves malformed sequences untouched. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function compareEntries(
  a: [string, string],
  b: [string, string],
): number {
  const la = a[0].toLowerCase();
  const lb = b[0].toLowerCase();
  if (la !== lb) {
    return la < lb ? -1 : 1;
  }
  return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
}

/**
 * Builds the PayFast MD5 signature for `params`.
 * `signature` is always excluded; `passphrase` is appended when provided.
 */
export function buildSignature(
  params: Record<string, string>,
  passphrase?: string,
): string {
  const parts = Object.entries(params)
    .filter(([key]) => key !== "signature")
    .sort(compareEntries)
    .map(([key, value]) => `${key}=${safeDecode(value)}`);
  if (passphrase) {
    parts.push(`passphrase=${passphrase}`);
  }
  return createHash("md5").update(parts.join("&")).digest("hex");
}

function timingSafeHexEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Verifies `params.signature` in constant time. */
export function verifySignature(
  params: Record<string, string>,
  passphrase?: string,
): boolean {
  const provided = params["signature"];
  if (!provided) {
    return false;
  }
  const expected = buildSignature(params, passphrase);
  return timingSafeHexEqual(provided, expected);
}

// ── Server-side validation (live/test only) ───────────────────────────────────

export type ValidateTransport = (
  config: PayFastConfig,
  params: Record<string, string>,
) => Promise<boolean>;

let validateTransport: ValidateTransport | undefined;

/**
 * Injects the network transport used for server-side validation. Tests set this
 * to avoid real network calls; production uses the real HTTP transport.
 */
export function setValidateTransport(fn: ValidateTransport | undefined): void {
  validateTransport = fn;
}

async function validateWithPayfastHttp(
  config: PayFastConfig,
  params: Record<string, string>,
): Promise<boolean> {
  const query = Object.entries(params)
    .filter(([key]) => key !== "signature")
    .sort(compareEntries)
    .map(([key, value]) => `${key}=${encodeURIComponent(safeDecode(value))}`)
    .join("&");
  const url = `${config.validateUrl}?${query}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    return false;
  }
  const body = (await response.text()).trim();
  return body === "VALID";
}

/** Confirms the payload with PayFast unless a transport is injected. */
export async function validateWithPayfast(
  config: PayFastConfig,
  params: Record<string, string>,
): Promise<boolean> {
  if (config.mode === "simulated") {
    return true;
  }
  if (validateTransport) {
    return validateTransport(config, params);
  }
  return validateWithPayfastHttp(config, params);
}

// ── ITN parsing / normalization ───────────────────────────────────────────────

/** Lax schema: unknown PayFast fields are stripped, required anchors asserted. */
const payfastWebhookSchema = z.object({
  merchant_id: z.string().min(1),
  merchant_key: z.string().optional(),
  pf_payment_id: z.string().min(1, "pf_payment_id is required"),
  m_payment_id: z.string().optional(),
  payment_status: z.string().min(1, "payment_status is required"),
  amount_gross: z.string().optional(),
  amount_fee: z.string().optional(),
  custom_str1: z.string().optional(),
  item_name: z.string().optional(),
  item_description: z.string().optional(),
  signature: z.string().optional(),
});

type PayFastWebhookFields = z.infer<typeof payfastWebhookSchema>;

const PAYFAST_STATUS_TO_NORMALIZED: Record<string, NormalizedWebhookStatus> = {
  COMPLETE: "completed",
  PENDING: "processing",
  PROCESSING: "processing",
  FAILED: "failed",
  CANCELLED: "failed",
  REFUNDED: "refunded",
};

function parseCents(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.round(parsed * 100);
}

function mapEventType(status: NormalizedWebhookStatus): WebhookEventType {
  switch (status) {
    case "completed":
      return "payment_verified";
    case "processing":
      return "payment_received";
    case "failed":
      return "payment_failed";
    case "refunded":
      return "payment_refunded";
  }
}

function normalizeIpn(
  fields: PayFastWebhookFields,
  raw: Record<string, string>,
): NormalizedWebhookEvent {
  const status = PAYFAST_STATUS_TO_NORMALIZED[fields.payment_status];
  if (!status) {
    throw new WebhookValidationError(
      `Unknown PayFast payment_status "${fields.payment_status}"`,
    );
  }
  const mPaymentId = fields.m_payment_id?.trim() || undefined;
  return {
    providerEventId: fields.pf_payment_id,
    mPaymentId,
    paymentReference: mPaymentId ? `payfast:${mPaymentId}` : undefined,
    status,
    amountCents: parseCents(fields.amount_gross),
    amountFeeCents: parseCents(fields.amount_fee),
    merchantId: fields.merchant_id,
    signature: fields.signature,
    provider: "payfast",
    raw,
  };
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export const payfastAdapter: PaymentProviderAdapter = {
  name: "payfast",

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const config = getPayFastConfig();
    const params: Record<string, string> = {
      merchant_id: config.merchantId,
      merchant_key: config.merchantKey,
      m_payment_id: input.paymentId,
      amount: (input.amountCents / 100).toFixed(2),
      item_name: input.itemName,
      item_description: input.itemDescription ?? "",
      email_address: input.emailAddress ?? "",
      custom_str1: input.orderId,
      return_url: input.returnUrl,
      cancel_url: input.cancelUrl,
      notify_url: input.notifyUrl,
    };
    params["signature"] = buildSignature(params, config.passphrase);

    if (config.mode === "simulated") {
      return {
        redirectUrl: `${PAYFAST_SIMULATED_REDIRECT_BASE}/${input.paymentId}`,
        isSimulated: true,
        provider: "payfast",
        formParams: params,
      };
    }

    const query = new URLSearchParams(params).toString();
    return {
      redirectUrl: `${config.itnUrl}?${query}`,
      isSimulated: false,
      provider: "payfast",
      formParams: params,
    };
  },

  async handleWebhook(raw: Record<string, string>): Promise<WebhookResult> {
    const config = getPayFastConfig();
    const parsed = payfastWebhookSchema.safeParse(raw);
    if (!parsed.success) {
      throw new WebhookValidationError(
        `Malformed PayFast ITN payload: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".")} ${issue.message}`)
          .join("; ")}`,
      );
    }

    if (!verifySignature(raw, config.passphrase)) {
      // Do NOT leak whether the passphrase or the payload differed.
      throw new WebhookSignatureError("PayFast ITN signature verification failed");
    }

    if (config.mode !== "simulated") {
      const valid = await validateWithPayfast(config, raw);
      if (!valid) {
        throw new WebhookValidationError(
          "PayFast server-side validation rejected the ITN",
        );
      }
    }

    const normalized = normalizeIpn(parsed.data, raw);
    return {
      eventId: normalized.providerEventId,
      eventType: mapEventType(normalized.status),
      paymentReference: normalized.paymentReference,
      status: normalized.status,
      amountCents: normalized.amountCents,
      provider: "payfast",
      normalized,
    };
  },
};

registerPaymentProvider(payfastAdapter);