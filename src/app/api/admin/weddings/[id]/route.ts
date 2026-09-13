/**
 * API route: GET /api/admin/weddings/[id]
 *
 * Wedding detail with vaults, expiry rules and media/build counters.
 * Guards: VIEW_PLATFORM_ANALYTICS.
 */

import { NextRequest, NextResponse } from "next/server";

import { getWeddingDetail } from "@/server/services/admin-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
  type RouteParams,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";
import { toErrorResponse } from "@/server/admin/route-helpers";

async function handleWeddingDetail(
  request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) {
  try {
    const { id } = await context.params;
    const detail = await getWeddingDetail(id);
    return NextResponse.json(detail);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withAuth(
  withTenant(withPermission(Permission.VIEW_PLATFORM_ANALYTICS)(handleWeddingDetail)),
);