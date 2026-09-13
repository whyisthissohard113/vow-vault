/**
 * API route: GET /api/admin/vaults
 *
 * List/search public vaults across tenants.
 * Guards: VIEW_PLATFORM_ANALYTICS.
 */

import { NextRequest, NextResponse } from "next/server";

import { listVaults } from "@/server/services/admin-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
} from "@/server/middleware/auth";
import { parseAdminListQuery, toErrorResponse } from "@/server/admin/route-helpers";

async function handleVaults(request: NextRequest) {
  try {
    const query = parseAdminListQuery(request);
    const result = await listVaults(query);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withAuth(
  withTenant(withPermission(Permission.VIEW_PLATFORM_ANALYTICS)(handleVaults)),
);