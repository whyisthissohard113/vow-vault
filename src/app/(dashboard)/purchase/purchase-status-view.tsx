"use client";

/**
 * PurchaseStatusView — the settlement truth page shown after a checkout
 * return/cancel redirect.
 *
 * Reads payment status exclusively from GET /api/payments/[paymentId]
 * (webhook-fed). The provider redirect is NEVER the source of truth:
 *   - completed  → success state (order number, item, amount).
 *   - pending/processing → auto-poll every 2s with a manual "check again".
 *   - failed/refunded/cancelled → clear message + retry checkout when a
 *     weddingId is available.
 *   - missing/invalid id → not-found style message.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconAlert, IconCard, IconCheck } from "@/components/icons";
import { formatCurrency } from "@/lib/format";
import {
  MAX_PAYMENT_POLLS,
  PAYMENT_POLL_INTERVAL_MS,
  checkoutForWedding,
  fetchPaymentStatus,
  isPaidPaymentStatus,
  paymentAmountCents,
  simulatePayment,
  type Checkout,
  type CheckoutUiError,
  type PaymentStatus,
} from "../dashboard/weddings/checkout-actions";

type Phase = "loading" | "polling" | "paid" | "failed" | "invalid";

export function PurchaseStatusView({
  paymentId,
  weddingId,
  outcome,
}: {
  paymentId: string;
  weddingId: string;
  outcome: "return" | "cancel";
}) {
  // Watch the payment the user was redirected away from; a retry checkout may
  // create a fresh payment that this view then follows instead.
  const [watchPaymentId, setWatchPaymentId] = useState<string>(paymentId);
  const [phase, setPhase] = useState<Phase>(paymentId ? "loading" : "invalid");
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState<CheckoutUiError | null>(null);
  const [pollActive, setPollActive] = useState(true);
  const [manualCheckNonce, setManualCheckNonce] = useState(0);
  const [retryCheckout, setRetryCheckout] = useState<Checkout | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!watchPaymentId || !pollActive) return;
    let stopped = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      if (stopped) return;
      polls += 1;
      const res = await fetchPaymentStatus(watchPaymentId);
      if (stopped) return;
      if (res.ok) {
        setPayment(res.value);
        if (isPaidPaymentStatus(res.value.status)) {
          setPhase("paid");
          setPollActive(false);
          return;
        }
        if (res.value.status === "failed" || res.value.status === "refunded") {
          setPhase("failed");
          setError({
            kind: "validation",
            message:
              res.value.failureReason ??
              (outcome === "cancel"
                ? "The payment was cancelled — no charge was made."
                : "The payment did not complete."),
          });
          setPollActive(false);
          return;
        }
        setPhase("polling");
      } else if (res.error.kind === "not-found") {
        setPhase("invalid");
        setPollActive(false);
        return;
      } else if (
        res.error.kind === "unauthorized" ||
        res.error.kind === "forbidden"
      ) {
        setPhase("failed");
        setError(res.error);
        setPollActive(false);
        return;
      }
      if (polls >= MAX_PAYMENT_POLLS) {
        // Stop auto-polling but keep the state visible; the user can check
        // again manually below.
        setPollActive(false);
        return;
      }
      timer = setTimeout(check, PAYMENT_POLL_INTERVAL_MS);
    };

    void check();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [watchPaymentId, pollActive, manualCheckNonce, outcome]);

  const checkAgain = useCallback(() => {
    setPhase("loading");
    setPollActive(true);
    setManualCheckNonce((n) => n + 1);
  }, []);

  const handleRetryCheckout = useCallback(async () => {
    if (!weddingId) return;
    setBusy(true);
    setError(null);
    const result = await checkoutForWedding(weddingId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRetryCheckout(result.value);
    if (!result.value.isSimulated) {
      // Live mode: back to the provider; the return link leads here again.
      window.location.href = result.value.redirectUrl;
      return;
    }
    // Simulated mode: keep the failure panel visible but now offer a fresh
    // "Pay now (simulated)" for the new payment. The poll below follows this
    // payment once the user pays.
    setWatchPaymentId(result.value.paymentId);
    setPhase("failed");
    setError({ kind: "validation", message: "No charge was made — start a new payment below." });
  }, [weddingId]);

  const handleSimulatedPay = useCallback(async () => {
    if (!retryCheckout) return;
    setBusy(true);
    setError(null);
    const res = await simulatePayment(retryCheckout.paymentId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setPhase("failed");
      return;
    }
    // The simulate endpoint already ran the real webhook pipeline; the poll
    // loop (still watching this payment) surfaces the completed status.
    setWatchPaymentId(retryCheckout.paymentId);
    setPhase("polling");
    setPollActive(true);
    setManualCheckNonce((n) => n + 1);
  }, [retryCheckout]);

  // Missing/invalid reference or payment not found.
  if (!paymentId || phase === "invalid") {
    return (
      <EmptyState
        icon={<IconAlert className="h-8 w-8" />}
        title={paymentId ? "Payment not found" : "Payment reference missing"}
        description={
          paymentId
            ? "We couldn't find that payment. Return to the dashboard to view your weddings and payments."
            : "We couldn't find a payment reference in that link."
        }
        action={
          <Link href="/dashboard">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        }
      />
    );
  }

  // Paid — the vault build auto-enqueues server-side on payment activation.
  if (phase === "paid" && payment) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
          <IconCheck className="mx-auto h-10 w-10 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">
            Payment confirmed
          </h1>
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            {payment.productName} · {payment.orderNumber} ·{" "}
            {formatCurrency(paymentAmountCents(payment), payment.currency)}
          </p>
          <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">
            We&apos;re building your vault — the gallery, slideshow and QR code
            will be ready shortly.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href={weddingId ? `/dashboard/weddings/${weddingId}` : "/dashboard/weddings"}
          >
            <Button leftIcon={<IconCard />}>View your wedding</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost">Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Waiting on the webhook to settle.
  if (phase === "loading" || phase === "polling") {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="rounded-2xl border border-zinc-200 p-8 text-center dark:border-zinc-800">
          <span
            className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-50"
            aria-hidden="true"
          />
          <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {pollActive
              ? "Waiting for payment confirmation…"
              : "Still waiting for payment confirmation"}
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {outcome === "cancel"
              ? "The payment was cancelled at the provider. If you changed your mind, you can start a new checkout below."
              : "This page checks every few seconds. The payment is only confirmed after the provider verifies it server-side."}
          </p>
          {pollActive ? (
            <p className="mt-3 text-xs text-zinc-400">
              Auto-checking every {(PAYMENT_POLL_INTERVAL_MS / 1000).toFixed(0)}s…
            </p>
          ) : null}
          <Button variant="outline" className="mt-5" onClick={checkAgain}>
            Check again
          </Button>
        </div>
      </div>
    );
  }

  // Failed / refunded / cancelled.
  const canRetry =
    error?.kind === "validation" ||
    error?.kind === "network" ||
    error?.kind === "server";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/40">
        <IconAlert className="mx-auto h-10 w-10 text-red-500" />
        <h1 className="mt-4 text-2xl font-semibold text-red-900 dark:text-red-100">
          {outcome === "cancel" ? "Payment cancelled" : "Payment didn&apos;t complete"}
        </h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error?.message ??
            (outcome === "cancel"
              ? "No charge was made."
              : "No charge was made — you can try again.")}
        </p>
        {canRetry ? (
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {retryCheckout?.isSimulated ? (
              <Button onClick={handleSimulatedPay} loading={busy}>
                Pay now (simulated)
              </Button>
            ) : weddingId ? (
              <Button onClick={handleRetryCheckout} loading={busy}>
                Try checkout again
              </Button>
            ) : (
              <>
                <Link href="/dashboard/weddings">
                  <Button variant="outline">Back to weddings</Button>
                </Link>
                <Link href="/dashboard/payments">
                  <Button variant="ghost">View payments</Button>
                </Link>
              </>
            )}
          </div>
        ) : null}
        {!retryCheckout && canRetry && !weddingId ? (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            A new checkout can be started from the wedding&apos;s “Package &amp;
            payment” panel.
          </p>
        ) : null}
      </div>
    </div>
  );
}