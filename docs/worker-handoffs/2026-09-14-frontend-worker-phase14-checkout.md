# Worker Handoff — 2026-09-14

## Worker
Frontend / SaaS UI Worker — Phase 14, wave 2 (checkout UI wiring)

## Task
Wire the real, backend-contract checkout flow into the wedding wizard, add a
"Package & payment" panel to the wedding detail page, add the `/purchase/return`
and `/purchase/cancel` settlement pages, and share the checkout client helpers.

## Status
COMPLETE

## Completed
- Created `src/app/(dashboard)/dashboard/weddings/checkout-actions.tsx` ("use client")
  as the single shared consumer of the fixed billing-layer contract:
  - Contract types: `Checkout`, `CheckoutApiResponse`, `PaymentStatus`,
    `PaymentStatusApiResponse`, `SimulatePaymentResponse`, `CheckoutUiError`,
    `Result<T>`, `CheckoutResult`, `PaymentStatusResult`, `SimulateResult`.
  - Fetch helpers: `checkoutForWedding(weddingId, productId?)`
    (POST `/api/checkout`), `fetchPaymentStatus(paymentId)`
    (GET `/api/payments/[paymentId]`), `simulatePayment(paymentId)`
    (POST `/api/payments/simulate/[paymentId]`), plus 401/403/400/404/network
    mapping. No client code ever marks a payment paid — it only opens a checkout
    and READS the webhook-fed status.
  - Status helpers: `isPaidPaymentStatus`, `isTerminalPaymentStatus`,
    `paymentAmountCents` (accepts contract `totalCents` or current backend
    `amountCents`).
  - Session remember: `rememberPaidPayment` / `getRememberedPaidPayment` /
    `clearRememberedPaidPayment` (`wmv:paid:<weddingId>` in sessionStorage) so
    re-entering a payment surface for an already-paid wedding reads the settled
    payment instead of creating a duplicate order.
  - `<CheckoutButton>` component (used on the detail page): autoStart, poll
    every 2s (MAX 90), simulated "Pay now (simulated)" flow, live redirect
    spinner, "Check again"/"Try again" after failures/exhaustion, disabled
    explanatory state when the user lacks MANAGE_PAYMENTS.
- Edited `src/app/(dashboard)/dashboard/weddings/new/wedding-wizard.tsx`:
  - Payment step now runs a real checkout: entering the step opens/reuses the
    order via `preparePayment` once per entry (`paymentStepEntered` ref);
    simulated mode keeps the user in-wizard with a "Pay now (simulated)" button
    that drives the REAL webhook pipeline, live mode redirects to PayFast and
    /purchase/return renders the settlement truth; a 2s poll loop
    (`MAX_PAYMENT_POLLS` = 90) updates status.
  - Continue/Build is gated on `paymentStatus.status === "completed"`
    (`paymentStepComplete`); attempting to continue without completion shows an
    inline error instead of advancing.
  - Order summary (item, total, order number, StatusBadge), success box
    (productName · orderNumber · `formatCurrency(paymentAmountCents(...))`),
    red error box with Try again / Check again.
  - Session remembered payments are honored on re-entry (no duplicate order).
  - Build-step failure copy updated: a build requires a server-verified
    completed order.
- Edited `src/app/(dashboard)/dashboard/weddings/[id]/page.tsx`:
  - Added "Package & payment" Card (only when `detail.package` exists) with
    package Badge, name, `formatCurrency(priceCents, currency)`, code, and an
    auto-start `<CheckoutButton weddingId canCheckout={hasPermission(tenant.role,
    Permission.MANAGE_PAYMENTS)} label="Pay for this package" />`.
- Created `src/app/(dashboard)/purchase/return/page.tsx`: server component,
  `guardPage(Permission.VIEW_PAYMENTS)`, reads `?reference=` (fallback
  `?paymentId=`) + optional `?weddingId=`, renders `<PurchaseStatusView
  outcome="return" />`, metadata robots noindex.
- Created `src/app/(dashboard)/purchase/cancel/page.tsx`: same shape with
  `outcome="cancel"`, title "Payment cancelled".
- Created `src/app/(dashboard)/purchase/purchase-status-view.tsx` ("use client"):
  reads status exclusively from GET `/api/payments/[paymentId]`; auto-polls
  2s while pending/processing with manual "Check again"; paid → success panel;
  failed/refunded/cancel → message + "Try checkout again" (simulated retry shows
  a fresh "Pay now (simulated)" for the new payment); missing reference → 404
  style EmptyState. The provider redirect is explicitly NOT the source of truth.

## Files changed
- `src/app/(dashboard)/dashboard/weddings/checkout-actions.tsx` (new)
- `src/app/(dashboard)/dashboard/weddings/new/wedding-wizard.tsx` (modified)
- `src/app/(dashboard)/dashboard/weddings/[id]/page.tsx` (modified)
- `src/app/(dashboard)/purchase/return/page.tsx` (new)
- `src/app/(dashboard)/purchase/cancel/page.tsx` (new)
- `src/app/(dashboard)/purchase/purchase-status-view.tsx` (new)

## Database changes
- None (no schema changes).

## API/contracts changed
- None intentionally. The UI consumes the billing-layer contract as shipped by
  the Payments worker. Observed backend contract deviations are reported below
  under Known issues (report-only; NO backend files were touched by this worker).

## Tests
- `npx tsc --noEmit` — PASS (0 errors)
- `npm run lint` — PASS (0 errors)
- Vitest deliberately NOT run (frontend-only changes; per project protocol).

## Environment changes
- None. Dev flow relies on existing `.env` setting `PAYFAST_MODE=simulated`
  (checkout returns `isSimulated: true`, redirect `/api/payments/simulate/<id>`).

## Known issues
1. `GET /api/payments/[paymentId]` returns `amountCents` from
   `billing-service.getPayment` (`PaymentWithOrder`), while the contract names
   the field `totalCents`. All UI reads go through `paymentAmountCents()` which
   accepts either, so the UI works today and with the specced shape.
2. `POST /api/checkout` / `billing-service.createCheckout` only reuses PENDING
   orders; calling it for an already-completed (paid) wedding creates a NEW
   order. UI mitigates with sessionStorage memory (`wmv:paid:<weddingId>`).
   Backend should eventually return the existing completed payment or reject
   with a "already paid" response, so a fresh browser session cannot double-pay.
3. Payment status payload has no `weddingId`; the live return URL only carries
   `?reference=<paymentId>`. The return/cancel pages accept an optional
   `?weddingId=` (used by wizard flows); without it, "View your wedding" falls
   back to the weddings list and "Try checkout again" is hidden (a new checkout
   needs a weddingId). Consider adding `weddingId` to the redirect URL in
   `billing-service`/PayFast return config.
4. `wedding_company_admin` has MANAGE_WEDDING but not MANAGE_PAYMENTS; in the
   wizard they reach the payment step, checkout 403s, and Continue stays
   disabled (by design — the spec targets owners). "Package & payment" panel on
   the detail page explains this for the same role.
5. No UI-level test for the payment step yet (backend payment suite
   13/13 covers the API); manual browser verification against
   `PAYFAST_MODE=simulated` is recommended as part of Phase 15 QA.

## Next worker
- QA/Security: run the full vitest suite (backend payment suite left to you per
  Payments worker), then manually verify the simulated wizard/detail
  checkout flow end-to-end (create wedding → package → payment → pay simulated →
  Continue → build auto-enqueues → admin payment-status pages).
- Consider surfacing `payments.failed` statuses on the detail page next to the
  "Package & payment" panel (this wave only shows paid/pending from CheckoutButton).
- Optional: show shipping of `FailureReason` normalization across
  `purchase-status-view` and the wizard copy once backend `message` strings settle.

## Decision required
- Whether to record the `amountCents` vs `totalCents` deviation and the
  duplicate-order gap in `docs/DECISIONS.md` / filing a small backend follow-up
  ticket (this worker did NOT touch DECISIONS.md per protocol).