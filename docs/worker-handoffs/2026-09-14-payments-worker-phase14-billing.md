# Worker Handoff — 2026-09-14

## Worker
Payments

## Task
Phase 14 billing layer on top of the existing `payments` / `payment_events` / `orders` / `order_items` tables: server-authoritative PayFast integration with simulated mode, signed ITN webhook handling, and idempotent payment activation that enqueues the payment-success email and the vault build job on the shared idempotent queues.

## Status
COMPLETE

## Completed
- **Provider-neutral adapter** (`src/server/services/payments/payment-provider.ts`): `PaymentProviderAdapter` = `name`, `createCheckout`, `handleWebhook` + registry (`registerPaymentProvider` / `getPaymentProvider`). Deliberately no network stubs: DB-level `refundPayment`/`getPayment` live in the billing service (MASTER_SPEC names those as behaviors, not adapter methods).
- **PayFast adapter** (`src/server/services/payments/payfast.ts`): MD5 signature build/verify (exclude `signature`, case-insensitive key sort with byte-level tiebreak, safe-URL-decoded values, `&passphrase=` suffix), zod ITN schema (lax object, strips unknown fields), status map (COMPLETE→completed, PENDING/PROCESSING→processing, FAILED/CANCELLED→failed, REFUNDED→refunded), amount parse as ZAR cents, integer-cents cross check `amount_gross`/`amount_fee`/`amount_net`, optional PayFast server-side validation (`GET {validateUrl}?{query}` body `=== "VALID"`) with injectable transport `setValidateTransport(fn)` for tests, 10s timeout.
- **Simulated mode** (dev default, `PAYFAST_MODE=simulated`): checkout redirect target becomes the local POST route `/api/payments/simulate/<paymentId>`; server-side validation network call is skipped but the MD5 signature is still verified — no silent trust. Hard-gated: simulate route 404s unless mode is `simulated` and `NODE_ENV !== "production"`.
- **Checkout flow** (`createCheckout` in `billing-service.ts` + `POST /api/checkout`): validates wedding, product (active, org-scoped), customer, permission (`MANAGE_PAYMENTS`); idempotent re-checkout for the same org/customer/product/wedding (reuses the pending order+payment via `orders.metadata->>'weddingId'`); crash-recovery branch attaches a fresh payment to a payment-less pending order instead of creating a duplicate order; `ORD-YYYY-NNNN` order numbers; order + order_items + payment inserted in one transaction; provider redirect with `return_url`/`cancel_url` at `/purchase/return|cancel?reference=<paymentId>` (frontend-owned pages).
- **Webhook processing** (`processPaymentWebhook`): resolves payment/order via `m_payment_id`, falls back to `custom_str1` order id; merchant + amount checks (amount check skippable only via explicit `simulateAmountOverride`; signature always verified); inserts the `payment_events` anchor (`provider_event_id` unique) with `onConflictDoNothing` → replays return `{ idempotent: true }` with nothing re-written; terminal states claim the anchor via CAS (`update … where status='received' and processedAt is null returning id`) inside a transaction; PENDING/PROCESSING is informational (anchor left `received`); FAILED/CANCELLED → `failed`, REFUNDED → `refunded`; green path: payment `completed`+`paidAt`, order `paid`+`paidAt`+`placedAt`, lifecycle `payment_verified` (deduped on `metadata->>'paymentId'`), then post-commit `enqueueEmail("payment_success")` key `payment_success_<paymentId>` and `enqueueBuild` key `by_payment_<paymentId>` (build only when the wedding has `productId` and is not deleted).
- **Routes** (all server-authoritative, tenant-isolated, zod-validated):
  - `POST /api/checkout` — guarded (withAuth + tenant + `MANAGE_PAYMENTS`), 201 `{ checkout }`, error mapping 400/403/404/500.
  - `POST /api/webhooks/payments/payfast` — unauthenticated, parses `request.text()` via `URLSearchParams`; signature error → 401, amount/validation mismatch → 400, retryable → 500, otherwise 200 `{ received, eventId, provider, status, idempotent? }`. Never echoes tenant data.
  - `POST /api/payments/simulate/[paymentId]` — dev-only, loads payment+order, builds a real signed ITN (merchant fallback `10000100`/`53f0d2c0a9c5` when env unset) and calls `processPaymentWebhook` with `simulateAmountOverride`.
- **`.env`** updated with dev PayFast config (`PAYFAST_MERCHANT_ID=10000100`, `PAYFAST_MERCHANT_KEY=53f0d2c0a9c5`, `PAYFAST_PASSPHRASE=testpassphrase`, `PAYFAST_MODE=simulated`, `PAYFAST_NOTIFY_URL=http://localhost:3000/api/webhooks/payments/payfast`); `.env.example` PayFast block refreshed to the new variable names (the legacy `PAYFAST_SANDBOX/RETURN_URL/CANCEL_URL/NOTIFY_URL` names were unreferenced in code — verified by grep).
- **Verification**: `npx tsc --noEmit` clean, `npm run lint` clean, targeted suite **13/13 passing** (`src/server/services/__tests__/payments.test.ts`, UUID family `77777777`, lifecycle-inert fixtures) covering signature fixtures, checkout e2e + reuse, webhook activation (+mail/build), replay idempotency, PENDING→COMPLETE, tampered amount/foreign merchant/bad signature rejections, FAILED/REFUNDED terminals, live-mode validation via injected transport, refund idempotency, tenant-scoped getPayment.

## Files changed
- `src/server/services/payments/config.ts` (new) — lazy `getPayFastConfig`, `PAYFAST_SIMULATED_REDIRECT_BASE`, `paymentReturnUrl`/`paymentCancelUrl`
- `src/server/services/payments/payment-provider.ts` (new)
- `src/server/services/payments/errors.ts` (new) — PaymentError, CheckoutError, WebhookValidationError, WebhookAmountMismatchError, WebhookSignatureError, WebhookRetryableError
- `src/server/services/payments/payfast.ts` (new)
- `src/server/services/payments/billing-service.ts` (new) — createCheckout, processPaymentWebhook, activateCompletedPayment, recordTerminalPayment, refundPayment, getPayment
- `src/app/api/checkout/route.ts` (new)
- `src/app/api/webhooks/payments/payfast/route.ts` (new)
- `src/app/api/payments/simulate/[paymentId]/route.ts` (new)
- `src/server/services/__tests__/payments.test.ts` (new — 13 tests)
- `.env`, `.env.example` (gitignored) — PayFast vars
- `docs/DECISIONS.md`, `docs/WORKER_STATUS.md`, this handoff

## Database changes
- None. No migrations ran; `payments`, `payment_events`, `orders`, `order_items` already existed (`0000`–`0003` applied). No schema contract altered.

## API/contracts changed
- **Provider adapter surface** (material): `PaymentProviderAdapter` exposes only `createCheckout` + `handleWebhook` (+ `name`). `verifyPayment`/`refundPayment`/`getPayment` equivalents exist as DB-level billing-service functions, not adapter network stubs. Adapters are side-effect-free factories registered as singletons.
- **Checkout route contract** (`POST /api/checkout`, body `{ weddingId, productId? }`): 201 `{ checkout: { orderId, paymentId, orderNumber, status: "pending", itemName, itemDescription, totalCents, currency: "ZAR", provider: "payfast", redirectUrl, isSimulated } }`. Re-checkout for the same wedding reuses the pending payment instead of 409.
- **Webhook contract**: provider retries on `WebhookRetryableError` (500); permanent failures (401 signature / 400 amount+mismatch) are not retried by PayFast; replays are safe and reported `idempotent: true`; NONCE in webhook body activates processing (`payment->'status'` processing update only, informational row).
- **Idempotency keys** consumed: `payment_success_<paymentId>` (email), `by_payment_<paymentId>` (build). Lifecycle event `payment_verified` deduped on `metadata->>'paymentId'`.
- **Env contract**: `PAYFAST_MODE` ∈ `live|test|simulated` (unknown → warn + simulated). Simulated mode still verifies signatures and skips the PayFast validate GET only.
- Simulate route maps signature failures to 400 (same-process config error; the public webhook route maps them to 401 as PayFast expects).

## Tests
- `npx vitest run src/server/services/__tests__/payments.test.ts` — **13 passed** (real dev Postgres; `docker compose up -d postgres minio redis`).
- `npx tsc --noEmit` — clean.
- `npm run lint` — clean (0 warnings).
- Full-suite run intentionally skipped: the QA/Security worker (phase-14 audit) is concurrently executing the entire suite against the same dev DB; the targeted payments suite is green and isolated to its own UUID family.

## Environment changes
- `.env` (gitignored): new `PAYFAST_*` block above; `PAYFAST_MODE=simulated` means local checkouts redirect to the in-app simulator — no external account needed.
- `.env.example`: PayFast block refreshed to `PAYFAST_MERCHANT_ID/KEY/PASSPHRASE/MODE/NOTIFY_URL` + commented `PAYFAST_VALIDATE_URL`/`PAYFAST_ITN_URL` overrides.

## Known issues
- Email + build enqueues happen after the financial transaction commits (non-transactional side effects). Idempotency keys (`payment_success_<id>`, `by_payment_<id>`) make duplicates impossible, but a crash between commit and enqueue would miss that email/build and require a manual re-run. Recorded for the next worker as an acceptable trade-off; a dead-letter/reconcile job later can re-enqueue from `payment_events`.
- `payment_events.organizationId` is NOT NULL in the schema, so a webhook whose payment and order are both unresolvable returns a retryable 500 with no events row written (deviation from an earlier design that allowed persisting the failure). Safe: PayFast will retry and an operator can trace via `provider_event_id` sniffing.
- Billing writes the `payment_verified` lifecycle event directly (same pattern the build engine uses); `wedding.status` is intentionally NEVER touched here — life-cycle engine owns status.
- The simulate route 404s under `NODE_ENV=production` even for admin testing; use `PAYFAST_MODE=test` with real PayFast credentials for that scenario.

## Next worker
- Frontend: build the `/purchase/return|/purchase/cancel` pages the checkout redirects to (`?reference=<paymentId>`), wire the wizard payment step to `POST /api/checkout` and poll payment status; the dashboard Orders/Payments pages light up once real `orders`/`payments` rows exist.
- Payments (follow-up): real PayFast integration runbook (`PAYFAST_MODE=test`/`live`, credentials, `PAYFAST_VALIDATE_URL`/`PAYFAST_ITN_URL`), refund admin surface calling `refundPayment`, payment history endpoint for the dashboard, optional `payment_failed` email.

## Decision required
- From orchestrator: confirm the contract deviations are acceptable or request changes: (1) billing writes `payment_verified` lifecycle events directly; (2) auto-build is triggered on payment (only when the wedding has a `productId` product); (3) unresolvable-webhook org enforcement (retryable 500, no events row); (4) `wedding.status` left untouched by payments; (5) post-commit enqueue crash window. Recorded in `docs/DECISIONS.md` (Phase 14 contract refinements).