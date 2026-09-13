/**
 * API route: GET /api/admin/audit-logs
 *
 * Platform-wide immutable audit trail (filterable by org/actor/resource/action).
 * Guards: VIEW_PLATFORM_ANALYTICS.
 */

import { NextRequest, NextResponse } from "next/server";

import { listAuditLogs } from "@/server/services/admin-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
} from "@/server/middleware/auth";
import { parseAuditListQuery, toErrorResponse } from "@/server/admin/route-helpers";

async function handleAuditLogs(request: NextRequest) {
  try {
    const query = parseAuditListQuery(request);
    const result = await listAuditLogs(query);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withAuth(
  withTenant(withPermission(Permission.VIEW_PLATFORM_ANALYTICS)(handleAuditLogs)),
);