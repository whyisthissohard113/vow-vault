/**
 * API route: GET /api/admin/payments/[id]
 *
 * Payment detail (immutable financial record — read-only).
 * Guards: VIEW_PLATFORM_ANALYTICS.
 */

import { NextRequest, NextResponse } from "next/server";

import { getPaymentDetail } from "@/server/services/admin-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
  type RouteParams,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";
import { toErrorResponse } from "@/server/admin/route-helpers";

async function handlePaymentDetail(
  request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) {
  try {
    const { id } = await context.params;
    const detail = await getPaymentDetail(id);
    return NextResponse.json(detail);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withAuth(
  withTenant(withPermission(Permission.VIEW_PLATFORM_ANALYTICS)(handlePaymentDetail)),
);