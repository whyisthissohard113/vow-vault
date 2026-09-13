/**
 * API route: GET /api/admin/build-jobs
 *
 * List build jobs with status filter.
 * Guards: VIEW_PLATFORM_ANALYTICS.
 */

import { NextRequest, NextResponse } from "next/server";

import { listBuildJobs } from "@/server/services/admin-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
} from "@/server/middleware/auth";
import { parseAdminListQuery, toErrorResponse } from "@/server/admin/route-helpers";

async function handleBuildJobs(request: NextRequest) {
  try {
    const query = parseAdminListQuery(request);
    const result = await listBuildJobs(query);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withAuth(
  withTenant(withPermission(Permission.VIEW_PLATFORM_ANALYTICS)(handleBuildJobs)),
);