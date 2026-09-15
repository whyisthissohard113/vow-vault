/**
 * GET /api/payments/[paymentId]
 *
 * Tenant-scoped payment + order status lookup. Used by the checkout return /
 * cancel pages and the wedding dashboard to poll payment state AFTER a
 * checkout redirect — never to activate (activation is webhook-only).
 *
 * Guards: authenticated + tenant + VIEW_PAYMENTS.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";
import { getPayment } from "@/server/services/payments/billing-service";

const paramsSchema = z.object({
  paymentId: z.string().uuid("Invalid payment ID"),
});

async function handleGetPayment(
  _request: NextRequest,
  context: { tenant: TenantContext; params: Promise<Record<string, string>> },
): Promise<NextResponse> {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const payment = await getPayment({
    organizationId: context.tenant.organizationId,
    paymentId: parsed.data.paymentId,
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // Internal ids are only ever returned to the tenant surface (authenticated
  // dashboard/return page); guests never reach this route or these ids.
  return NextResponse.json({ payment });
}

export const GET = withAuth(
  withTenant(withPermission(Permission.VIEW_PAYMENTS)(handleGetPayment)),
);