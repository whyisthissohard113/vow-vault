"use client";

/**
 * Shared client helpers for the real wedding checkout flow.
 *
 * Consumes the fixed billing-layer contract (backend is authoritative, do not
 * invent new API shapes):
 *   - POST /api/checkout                     → 201 { checkout } (pending orders/payments are reused)
 *   - GET  /api/payments/[paymentId]          → 200 { payment }   (tenant-scoped status poll)
 *   - POST /api/payments/simulate/[paymentId] → 200 { received, status, paymentId, eventId } (dev only)
 *
 * Payment activation is WEBHOOK-ONLY. Nothing in this file ever marks a
 * payment paid — it opens a checkout and READS status. Live-mode redirects are
 * handed to the provider, and the /purchase/return + /purchase/cancel pages
 * render the settlement truth when the customer returns.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";

// ── Contract types ──────────────────────────────────────────────────────────

export type PaymentStatusValue =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "refunded";

export interface Checkout {
  orderId: string;
  paymentId: string;
  orderNumber: string;
  status: "pending";
  itemName: string;
  itemDescription: string | null;
  totalCents: number;
  currency: string;
  provider: string;
  redirectUrl: string;
  isSimulated: boolean;
}

export interface CheckoutApiResponse {
  checkout: Checkout;
}

/**
 * Payment + order snapshot returned by GET /api/payments/[paymentId].
 *
 * The contract names the amount field `totalCents`; the current backend
 * returns `amountCents`. Consumers read amounts through `paymentAmountCents()`
 * which accepts either, so the UI works against the real response today and the
 * specced shape tomorrow.
 */
export interface PaymentStatus {
  id: string;
  status: PaymentStatusValue;
  orderNumber: string;
  orderStatus: string;
  productName: string;
  totalCents?: number;
  amountCents?: number;
  currency: string;
  paidAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface PaymentStatusApiResponse {
  payment: PaymentStatus;
}

export interface SimulatePaymentResponse {
  received: boolean;
  status: string;
  paymentId: string;
  eventId: string;
}

export type CheckoutErrorKind =
  | "unauthorized"
  | "forbidden"
  | "validation"
  | "not-found"
  | "not-enabled"
  | "network"
  | "server";

export interface CheckoutUiError {
  kind: CheckoutErrorKind;
  message: string;
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: CheckoutUiError };

export type CheckoutResult = Result<Checkout>;
export type PaymentStatusResult = Result<PaymentStatus>;
export type SimulateResult = Result<SimulatePaymentResponse>;

// ── Constants ───────────────────────────────────────────────────────────────

export const PAYMENT_POLL_INTERVAL_MS = 2000;
export const MAX_PAYMENT_POLLS = 90; // 2s × 90 ≈ 3 minutes before giving up.

// ── Fetch helpers ───────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

async function apiErrorFromResponse(res: Response): Promise<CheckoutUiError> {
  let message = "";
  try {
    const body = (await res.json()) as { error?: string };
    message = typeof body.error === "string" ? body.error : "";
  } catch {
    // Non-JSON body — fall through to the status-based message.
  }

  if (res.status === 401) {
    return {
      kind: "unauthorized",
      message: message || "Please sign in to continue.",
    };
  }
  if (res.status === 403) {
    return {
      kind: "forbidden",
      message: message || "You don't have permission to manage payments for this wedding.",
    };
  }
  if (res.status === 404) {
    return {
      kind: "not-found",
      message: message || "The wedding or payment was not found.",
    };
  }
  if (res.status === 400) {
    return {
      kind: "validation",
      message:
        message ||
        "This wedding isn't ready for checkout — assign a package, then try again.",
    };
  }
  return {
    kind: "server",
    message: message || "The payment service is unavailable right now. Try again in a moment.",
  };
}

/**
 * Opens (or reuses) the checkout for a wedding.
 * POST /api/checkout is guarded by auth + tenant + MANAGE_PAYMENTS.
 */
export async function checkoutForWedding(
  weddingId: string,
  productId?: string,
): Promise<CheckoutResult> {
  if (!isUuid(weddingId)) {
    return {
      ok: false,
      error: { kind: "validation", message: "Invalid wedding id." },
    };
  }
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        productId ? { weddingId, productId } : { weddingId },
      ),
    });
    if (res.status === 201) {
      const body = (await res.json()) as CheckoutApiResponse;
      if (!body.checkout?.paymentId || !body.checkout?.orderId) {
        return {
          ok: false,
          error: { kind: "server", message: "The checkout response was incomplete." },
        };
      }
      return { ok: true, value: body.checkout };
    }
    return { ok: false, error: await apiErrorFromResponse(res) };
  } catch {
    return {
      ok: false,
      error: { kind: "network", message: "Network error while contacting the payment service." },
    };
  }
}

/**
 * Tenant-scoped payment status poll (auth + VIEW_PAYMENTS).
 * Never used to activate — only to read the webhook-fed truth.
 */
export async function fetchPaymentStatus(
  paymentId: string,
): Promise<PaymentStatusResult> {
  try {
    const res = await fetch(`/api/payments/${encodeURIComponent(paymentId)}`, {
      cache: "no-store",
    });
    if (res.status === 200) {
      const body = (await res.json()) as PaymentStatusApiResponse;
      if (!body.payment?.id) {
        return {
          ok: false,
          error: { kind: "server", message: "Payment status response was incomplete." },
        };
      }
      return { ok: true, value: body.payment };
    }
    if (res.status === 404) {
      return { ok: false, error: { kind: "not-found", message: "Payment not found." } };
    }
    return { ok: false, error: await apiErrorFromResponse(res) };
  } catch {
    return {
      ok: false,
      error: { kind: "network", message: "Network error while checking payment status." },
    };
  }
}

/**
 * Dev-only checkout simulation (404 outside PAYFAST_MODE=simulated).
 * Drives the simulated payment through the REAL webhook pipeline.
 */
export async function simulatePayment(paymentId: string): Promise<SimulateResult> {
  try {
    const res = await fetch(
      `/api/payments/simulate/${encodeURIComponent(paymentId)}`,
      { method: "POST" },
    );
    if (res.status === 200) {
      const body = (await res.json()) as SimulatePaymentResponse;
      return { ok: true, value: body };
    }
    if (res.status === 404) {
      return {
        ok: false,
        error: {
          kind: "not-enabled",
          message: "Checkout simulation isn't enabled in this environment.",
        },
      };
    }
    return { ok: false, error: await apiErrorFromResponse(res) };
  } catch {
    return {
      ok: false,
      error: { kind: "network", message: "Network error while simulating the payment." },
    };
  }
}

// ── Small status helpers ────────────────────────────────────────────────────

export function isPaidPaymentStatus(
  status: PaymentStatusValue | null | undefined,
): boolean {
  return status === "completed";
}

export function isTerminalPaymentStatus(
  status: PaymentStatusValue | null | undefined,
): boolean {
  return status === "completed" || status === "failed" || status === "refunded";
}

/** Amount in cents from the payment snapshot (contract `totalCents` or the current backend `amountCents`). */
export function paymentAmountCents(payment: PaymentStatus | null | undefined): number {
  if (!payment) return 0;
  return payment.totalCents ?? payment.amountCents ?? 0;
}

// ── Per-wedding completed-payment memory (session) ──────────────────────────
// The checkout endpoint only reuses *pending* orders; re-entering a payment
// surface for an already-paid wedding would create a duplicate order. Keeping a
// per-wedding completed paymentId in the current browser session lets the UI
// read the settled payment directly instead of opening a new checkout.

const PAID_MEMORY_PREFIX = "wmv:paid:";

function paidMemoryKey(weddingId: string): string {
  return `${PAID_MEMORY_PREFIX}${weddingId}`;
}

export function rememberPaidPayment(weddingId: string, paymentId: string): void {
  try {
    sessionStorage.setItem(paidMemoryKey(weddingId), paymentId);
  } catch {
    // Storage unavailable (private mode / SSR guard) → skip.
  }
}

export function getRememberedPaidPayment(weddingId: string): string | null {
  try {
    return sessionStorage.getItem(paidMemoryKey(weddingId));
  } catch {
    return null;
  }
}

export function clearRememberedPaidPayment(weddingId: string): void {
  try {
    sessionStorage.removeItem(paidMemoryKey(weddingId));
  } catch {
    // Ignore.
  }
}

// ── <CheckoutButton> ────────────────────────────────────────────────────────
// Used on the wedding detail page ("Package & payment" panel). The wizard uses
// the same fetch helpers above with its own step UI.

export interface CheckoutButtonProps {
  weddingId: string;
  /**
   * True when the signed-in user holds MANAGE_PAYMENTS (owner / platform
   * admin). When false the button is replaced with an explanation — the API is
   * the real gate, this only avoids pointless 403s.
   */
  canCheckout?: boolean;
  /** Opens/reuses the checkout as soon as the component mounts (used on the detail page). */
  autoStart?: boolean;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

type CheckoutPhase = "idle" | "preparing" | "simulated" | "redirecting" | "paid" | "failed";

export function CheckoutButton({
  weddingId,
  canCheckout = true,
  autoStart = false,
  label = "Pay now",
  variant = "primary",
  size = "md",
}: CheckoutButtonProps) {
  const [phase, setPhase] = useState<CheckoutPhase>("idle");
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState<CheckoutUiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [pollsExhausted, setPollsExhausted] = useState(false);
  const flowStartedRef = useRef(false);

  const runFlow = useCallback(async () => {
    if (!canCheckout) {
      setPhase("failed");
      setError({
        kind: "forbidden",
        message: "Only an owner can start payment for this wedding.",
      });
      return;
    }
    setBusy(true);
    setError(null);
    setPollsExhausted(false);
    setPayment(null);
    setPhase("preparing");
    try {
      // Already paid in this browser session? Read that payment instead of
      // creating a duplicate order.
      const remembered = getRememberedPaidPayment(weddingId);
      if (remembered) {
        const rememberedRes = await fetchPaymentStatus(remembered);
        if (rememberedRes.ok && isPaidPaymentStatus(rememberedRes.value.status)) {
          setPayment(rememberedRes.value);
          setPhase("paid");
          return;
        }
      }

      const result = await checkoutForWedding(weddingId);
      if (!result.ok) {
        setPhase("failed");
        setError(result.error);
        return;
      }
      const nextCheckout = result.value;
      setCheckout(nextCheckout);
      if (nextCheckout.isSimulated) {
        // Stay here: the "Pay now (simulated)" button drives the webhook
        // pipeline and the poll loop below reflects the result.
        setPhase("simulated");
      } else {
        // Live/test PayFast: hand over to the provider. The redirect is never
        // the source of truth — /purchase/return renders the settled status.
        setPhase("redirecting");
        window.location.href = nextCheckout.redirectUrl;
      }
    } finally {
      setBusy(false);
    }
  }, [canCheckout, weddingId]);

  // Auto-start once per mount (server-side this is idempotent for pending orders).
  useEffect(() => {
    if (!autoStart || flowStartedRef.current) return;
    flowStartedRef.current = true;
    void runFlow();
  }, [autoStart, runFlow]);

  const checkoutId = checkout?.paymentId ?? null;

  // Poll the payment while a simulated checkout is waiting on the webhook.
  useEffect(() => {
    if (phase !== "simulated" || !checkoutId) return;
    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled) return;
      polls += 1;
      const res = await fetchPaymentStatus(checkoutId);
      if (cancelled) return;
      if (res.ok) {
        setPayment(res.value);
        if (isPaidPaymentStatus(res.value.status)) {
          rememberPaidPayment(weddingId, checkoutId);
          setPhase("paid");
          return;
        }
        if (res.value.status === "failed" || res.value.status === "refunded") {
          setPollsExhausted(false);
          setPhase("failed");
          setError({
            kind: "validation",
            message: res.value.failureReason ?? "The payment did not complete.",
          });
          return;
        }
      } else if (
        res.error.kind === "unauthorized" ||
        res.error.kind === "forbidden" ||
        res.error.kind === "not-found"
      ) {
        setPhase("failed");
        setError(res.error);
        return;
      }
      if (polls >= MAX_PAYMENT_POLLS) {
        setPollsExhausted(true);
        setPhase("failed");
        setError({
          kind: "validation",
          message: "Still waiting for payment confirmation. Check again in a moment.",
        });
        return;
      }
      timer = setTimeout(tick, PAYMENT_POLL_INTERVAL_MS);
    };

    timer = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase, checkoutId, weddingId]);

  const handleSimulatedPay = useCallback(async () => {
    if (!checkout) return;
    setBusy(true);
    setError(null);
    const res = await simulatePayment(checkout.paymentId);
    setBusy(false);
    if (!res.ok) {
      setPhase("failed");
      setError(res.error);
      return;
    }
    // The simulate endpoint already ran the real webhook pipeline; the live
    // poll loop (still active in `simulated`) surfaces the completed status.
    setPhase("simulated");
  }, [checkout]);

  if (!canCheckout) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Only owners can start payment for this wedding.
      </p>
    );
  }

  if (phase === "paid" && payment) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
          Payment confirmed
        </p>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
          {payment.productName} · {payment.orderNumber} ·{" "}
          {formatCurrency(paymentAmountCents(payment), payment.currency)}
        </p>
        <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
          The vault build starts automatically once the payment is verified.
        </p>
      </div>
    );
  }

  if (phase === "failed") {
    const canRetry =
      error?.kind === "validation" ||
      error?.kind === "network" ||
      error?.kind === "server";
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <p className="font-medium">Payment couldn&apos;t be completed</p>
          <p className="mt-1">{error?.message ?? "Something went wrong."}</p>
        </div>
        {canRetry ? (
          <div className="flex flex-wrap items-center gap-3">
            {pollsExhausted && checkout ? (
              <Button
                variant="outline"
                size={size}
                onClick={() => {
                  setPollsExhausted(false);
                  setError(null);
                  setPhase("simulated");
                }}
              >
                Check again
              </Button>
            ) : (
              <Button variant="outline" size={size} onClick={runFlow} loading={busy}>
                Try again
              </Button>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  if (phase === "redirecting") {
    return (
      <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
        Returning from the payment provider…
      </div>
    );
  }

  if (phase === "simulated" && checkout) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={variant}
            size={size}
            onClick={handleSimulatedPay}
            loading={busy}
          >
            Pay now (simulated)
          </Button>
          {payment?.status === "pending" || payment?.status === "processing" ? (
            <span className="inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span
                className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
              Waiting for payment confirmation…
            </span>
          ) : null}
        </div>
        <p className="text-xs text-zinc-400">
          Order {checkout.orderNumber} · {checkout.itemName} ·{" "}
          {formatCurrency(checkout.totalCents, checkout.currency)}{" "}
          <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Test payment
          </span>
        </p>
      </div>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={runFlow}
      loading={phase === "preparing" || busy}
    >
      {phase === "preparing" ? "Opening checkout…" : label}
    </Button>
  );
}