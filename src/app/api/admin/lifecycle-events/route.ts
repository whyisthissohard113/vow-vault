/**
 * API route: GET /api/admin/lifecycle-events
 *
 * Platform-wide wedding lifecycle event trail.
 * Guards: VIEW_PLATFORM_ANALYTICS.
 */

import { NextRequest, NextResponse } from "next/server";

import { listLifecycleEvents } from "@/server/services/admin-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
} from "@/server/middleware/auth";
import { adminListQuerySchema, toErrorResponse } from "@/server/admin/route-helpers";

async function handleLifecycleEvents(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = adminListQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("eventType") ?? undefined,
      organizationId: searchParams.get("organizationId") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const result = await listLifecycleEvents(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withAuth(
  withTenant(withPermission(Permission.VIEW_PLATFORM_ANALYTICS)(handleLifecycleEvents)),
);