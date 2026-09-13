/**
 * API route: GET /api/admin/build-jobs/[id]
 *
 * Build job detail with step progress.
 * Guards: VIEW_PLATFORM_ANALYTICS.
 */

import { NextRequest, NextResponse } from "next/server";

import { getBuildJobDetail } from "@/server/services/admin-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
  type RouteParams,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";
import { toErrorResponse } from "@/server/admin/route-helpers";

async function handleBuildJobDetail(
  request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) {
  try {
    const { id } = await context.params;
    const detail = await getBuildJobDetail(id);
    return NextResponse.json(detail);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withAuth(
  withTenant(withPermission(Permission.VIEW_PLATFORM_ANALYTICS)(handleBuildJobDetail)),
);