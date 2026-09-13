/**
 * API route: GET /api/admin/organizations/[id]
 *
 * Organization detail with members and aggregate financial/count metrics.
 * Guards: VIEW_PLATFORM_ANALYTICS.
 */

import { NextRequest, NextResponse } from "next/server";

import { getOrganizationDetail } from "@/server/services/admin-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
  type RouteParams,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";
import { toErrorResponse } from "@/server/admin/route-helpers";

async function handleOrganizationDetail(
  request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) {
  try {
    const { id } = await context.params;
    const detail = await getOrganizationDetail(id);
    return NextResponse.json(detail);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withAuth(
  withTenant(withPermission(Permission.VIEW_PLATFORM_ANALYTICS)(handleOrganizationDetail)),
);