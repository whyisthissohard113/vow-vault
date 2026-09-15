/**
 * Payment configuration — lazy environment reader.
 *
 * The billing layer keeps a provider-neutral interface, but PayFast is the
 * only provider implemented for phase 14. All values are read from the
 * environment AT CALL TIME (never cached at module load) so tests can mutate
 * `process.env` per test and the dev/simulated switch behaves correctly in a
 * hot-reloading Next.js server.
 *
 * Environment variables (see `.env.example`):
 *   PAYFAST_MERCHANT_ID      Sandbox/live merchant id
 *   PAYFAST_MERCHANT_KEY     Sandbox/live merchant key
 *   PAYFAST_PASSPHRASE       Security salt (optional; when set it is appended
 *                            to the signature string)
 *   PAYFAST_MODE             "simulated" (default/dev) | "test" | "live"
 *   PAYFAST_NOTIFY_URL       Overrides the ITN callback URL advertised to PayFast
 *   PAYFAST_VALIDATE_URL     Server-side validation endpoint (live/test only)
 *   PAYFAST_ITN_URL          PayFast payment page URL (live/test only)
 *
 * `simulated` mode never talks to PayFast: checkout returns a local simulate
 * URL and webhooks skip server-side validation (signature checks still run).
 */

export type PayFastMode = "live" | "test" | "simulated";

export interface PayFastConfig {
  merchantId: string;
  merchantKey: string;
  passphrase?: string;
  mode: PayFastMode;
  notifyUrl: string;
  validateUrl: string;
  itnUrl: string;
}

const SIMULATED_MODES: readonly string[] = ["simulated", "test", "live"];

function parseMode(value: string | undefined): PayFastMode {
  const mode = (value ?? "simulated").trim().toLowerCase();
  if ((SIMULATED_MODES as readonly string[]).includes(mode)) {
    return mode as PayFastMode;
  }
  // Unknown modes fall back to simulated (dev safety) but stay loud.
  console.warn(`[Payments] Unknown PAYFAST_MODE "${value}"; defaulting to simulated`);
  return "simulated";
}

/**
 * Reads the current PayFast configuration from the environment.
 * Empty merchant id/key are allowed (unconfigured dev installs) but callers
 * that create a real checkout surface their absence.
 */
export function getPayFastConfig(): PayFastConfig {
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return {
    merchantId: process.env.PAYFAST_MERCHANT_ID ?? "",
    merchantKey: process.env.PAYFAST_MERCHANT_KEY ?? "",
    passphrase: process.env.PAYFAST_PASSPHRASE?.trim() || undefined,
    mode: parseMode(process.env.PAYFAST_MODE),
    notifyUrl:
      process.env.PAYFAST_NOTIFY_URL ?? `${appUrl}/api/webhooks/payments/payfast`,
    validateUrl:
      process.env.PAYFAST_VALIDATE_URL ??
      "https://www.payfast.co.za/eng/query/validate",
    itnUrl: process.env.PAYFAST_ITN_URL ?? "https://www.payfast.co.za/eng/process",
  };
}

/**
 * Base path of the local checkout simulation endpoint. Kept in the config
 * module so adapters and the simulate route agree on one constant.
 */
export const PAYFAST_SIMULATED_REDIRECT_BASE = "/api/payments/simulate";

/** Shared helper to build app-relative payment redirect URLs used by checkout. */
export function paymentReturnUrl(paymentId: string): string {
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${appUrl}/purchase/return?reference=${paymentId}`;
}

export function paymentCancelUrl(paymentId: string): string {
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${appUrl}/purchase/cancel?reference=${paymentId}`;
}