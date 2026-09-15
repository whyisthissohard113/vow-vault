import type { Metadata } from "next";

import { guardPage } from "@/server/page-guard";
import { Permission } from "@/lib/auth/permissions";
import { PurchaseStatusView } from "../purchase-status-view";

export const metadata: Metadata = {
  title: "Payment confirmation",
  robots: { index: false, follow: false },
};

type SearchParamValue = string | string[] | undefined;

function firstParam(value: SearchParamValue): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * POST /api/checkout redirects back here (via `?reference=<paymentId>`) after
 * a customer returns from the payment provider. The redirect is never the
 * source of truth — this page only renders GET /api/payments/[paymentId].
 */
export default async function PurchaseReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  await guardPage(Permission.VIEW_PAYMENTS);

  const params = await searchParams;
  const paymentId = firstParam(params.reference) || firstParam(params.paymentId);
  const weddingId = firstParam(params.weddingId);

  return (
    <PurchaseStatusView
      paymentId={paymentId}
      weddingId={weddingId}
      outcome="return"
    />
  );
}