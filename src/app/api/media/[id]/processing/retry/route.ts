/**
 * API route: POST /api/media/[id]/processing/retry
 *
 * Reset failed media processing jobs back to pending (fresh attempt budget).
 * Tenant-scoped: 404 when the media belongs to another organization.
 */

import { NextRequest, NextResponse } from "next/server";

import { retryProcessingJobs } from "@/server/services/media-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
  type RouteParams,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";
import { NotFoundError, ForbiddenError } from "@/lib/auth/errors";

// ── Route Handler ──────────────────────────────────────────────────────────────

async function handleRetryProcessing(
  request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) {
  try {
    const { id } = await context.params;
    const { tenant } = context;

    const result = await retryProcessingJobs(id, tenant.organizationId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[API/media/[id]/processing/retry] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Composed Guards ────────────────────────────────────────────────────────────

export const POST = withAuth(
  withTenant(
    withPermission(Permission.MANAGE_WEDDING)(handleRetryProcessing),
  ),
);