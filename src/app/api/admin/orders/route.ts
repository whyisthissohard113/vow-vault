/**
 * API route: GET /api/admin/orders
 *
 * List/search orders across tenants.
 * Guards: VIEW_PLATFORM_ANALYTICS.
 */

import { NextRequest, NextResponse } from "next/server";

import { listOrders } from "@/server/services/admin-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
} from "@/server/middleware/auth";
import { parseAdminListQuery, toErrorResponse } from "@/server/admin/route-helpers";

async function handleOrders(request: NextRequest) {
  try {
    const query = parseAdminListQuery(request);
    const result = await listOrders(query);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withAuth(
  withTenant(withPermission(Permission.VIEW_PLATFORM_ANALYTICS)(handleOrders)),
);