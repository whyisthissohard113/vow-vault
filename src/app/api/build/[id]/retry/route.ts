/**
 * API route: POST /api/build/[id]/retry
 *
 * Retry a failed build job.
 */

import { NextRequest, NextResponse } from "next/server";

import { retryBuild } from "@/server/services/build-engine";
import { getBuildStatus } from "@/server/services/build-engine";
import { requireTenant, validateTenantAccess, type TenantContext } from "@/server/middleware/tenant";
import { withAuth, withTenant, RouteParams } from "@/server/middleware/auth";
import { withPermission, Permission } from "@/server/middleware/auth";
import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";

// ── Route Handler ──────────────────────────────────────────────────────────────

async function handleRetryBuild(
  request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) {
  try {
    const { id } = await context.params;
    const { tenant } = context;

    const { job } = await getBuildStatus(id);

    if (!job) {
      return NextResponse.json({ error: "Build job not found" }, { status: 404 });
    }

    // Verify tenant access
    validateTenantAccess(tenant, job.organizationId);

    // Retry the build
    await retryBuild(id);

    return NextResponse.json({ success: true, message: "Build queued for retry" });
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof NotFoundError ? 404 : 403 });
    }
    console.error("[API/build/[id]/retry] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Composed Guards ────────────────────────────────────────────────────────────

export const POST = withAuth(
  withTenant(
    withPermission(Permission.MANAGE_WEDDING)(handleRetryBuild),
  ),
);