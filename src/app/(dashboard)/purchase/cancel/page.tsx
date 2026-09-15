import type { Metadata } from "next";

import { guardPage } from "@/server/page-guard";
import { Permission } from "@/lib/auth/permissions";
import { PurchaseStatusView } from "../purchase-status-view";

export const metadata: Metadata = {
  title: "Payment cancelled",
  robots: { index: false, follow: false },
};

type SearchParamValue = string | string[] | undefined;

function firstParam(value: SearchParamValue): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * Cancel page for the checkout redirect (via `?reference=<paymentId>`). Like
 * the return page it only renders server-reported status — the provider
 * redirect marks nothing.
 */
export default async function PurchaseCancelPage({
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
      outcome="cancel"
    />
  );
}