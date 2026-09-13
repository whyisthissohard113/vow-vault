/**
 * API route: GET /api/admin/storage
 *
 * Platform storage overview. Never returns credentials — only endpoint,
 * bucket, region and aggregate media stats.
 * Guards: VIEW_PLATFORM_ANALYTICS.
 */

import { NextResponse } from "next/server";

import { getStorageOverview } from "@/server/services/admin-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
} from "@/server/middleware/auth";
import { toErrorResponse } from "@/server/admin/route-helpers";

async function handleStorage() {
  try {
    const overview = await getStorageOverview();
    return NextResponse.json(overview);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withAuth(
  withTenant(withPermission(Permission.VIEW_PLATFORM_ANALYTICS)(handleStorage)),
);