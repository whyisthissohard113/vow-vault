/**
 * API route: GET /api/admin/email-jobs/[id]
 *
 * Email job detail.
 * Guards: VIEW_PLATFORM_ANALYTICS.
 */

import { NextRequest, NextResponse } from "next/server";

import { getEmailJobDetail } from "@/server/services/admin-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
  type RouteParams,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";
import { toErrorResponse } from "@/server/admin/route-helpers";

async function handleEmailJobDetail(
  request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) {
  try {
    const { id } = await context.params;
    const detail = await getEmailJobDetail(id);
    return NextResponse.json(detail);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withAuth(
  withTenant(withPermission(Permission.VIEW_PLATFORM_ANALYTICS)(handleEmailJobDetail)),
);