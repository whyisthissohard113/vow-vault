/**
 * API route: GET /api/admin/health
 *
 * Platform health snapshot (database, migrations, worker processes, queues).
 * Guards: VIEW_PLATFORM_ANALYTICS.
 */

import { NextResponse } from "next/server";

import { getPlatformHealth } from "@/server/services/admin-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
} from "@/server/middleware/auth";
import { toErrorResponse } from "@/server/admin/route-helpers";

async function handleHealth() {
  try {
    const health = await getPlatformHealth();
    return NextResponse.json(health);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withAuth(
  withTenant(withPermission(Permission.VIEW_PLATFORM_ANALYTICS)(handleHealth)),
);