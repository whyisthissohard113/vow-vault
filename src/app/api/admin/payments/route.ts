/**
 * API route: GET /api/admin/payments
 *
 * List/search payments across tenants (immutable financial records — read-only).
 * Guards: VIEW_PLATFORM_ANALYTICS.
 */

import { NextRequest, NextResponse } from "next/server";

import { listPayments } from "@/server/services/admin-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
} from "@/server/middleware/auth";
import { parseAdminListQuery, toErrorResponse } from "@/server/admin/route-helpers";

async function handlePayments(request: NextRequest) {
  try {
    const query = parseAdminListQuery(request);
    const result = await listPayments(query);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withAuth(
  withTenant(withPermission(Permission.VIEW_PLATFORM_ANALYTICS)(handlePayments)),
);