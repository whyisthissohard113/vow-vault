/**
 * API route: GET /api/admin/customers
 *
 * List/search customers across tenants with order counts.
 * Guards: VIEW_PLATFORM_ANALYTICS.
 */

import { NextRequest, NextResponse } from "next/server";

import { listCustomers } from "@/server/services/admin-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
} from "@/server/middleware/auth";
import { parseAdminListQuery, toErrorResponse } from "@/server/admin/route-helpers";

async function handleCustomers(request: NextRequest) {
  try {
    const query = parseAdminListQuery(request);
    const result = await listCustomers(query);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withAuth(
  withTenant(withPermission(Permission.VIEW_PLATFORM_ANALYTICS)(handleCustomers)),
);