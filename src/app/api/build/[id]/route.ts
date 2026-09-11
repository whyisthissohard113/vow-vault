/**
 * API route: GET /api/build/[id]
 *
 * Get build job status with step details.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { buildJobs, buildJobSteps } from "@/lib/db/schema";
import { getBuildStatus } from "@/server/services/build-engine";
import { requireTenant, validateTenantAccess, type TenantContext } from "@/server/middleware/tenant";
import { withAuth, withTenant, RouteParams } from "@/server/middleware/auth";
import { withPermission, Permission } from "@/server/middleware/auth";
import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";

// ── Route Handler ──────────────────────────────────────────────────────────────

async function handleGetBuildStatus(
  request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) {
  try {
    const { id } = await context.params;
    const { tenant } = context;

    const { job, steps } = await getBuildStatus(id);

    if (!job) {
      return NextResponse.json({ error: "Build job not found" }, { status: 404 });
    }

    // Verify tenant access
    validateTenantAccess(tenant, job.organizationId);

    return NextResponse.json({
      job: {
        id: job.id,
        weddingId: job.weddingId,
        status: job.status,
        buildType: job.buildType,
        version: job.version,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        enqueuedAt: job.enqueuedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        errorMessage: job.errorMessage,
        result: job.result,
      },
      steps: steps.map((step) => ({
        stepKey: step.stepKey,
        stepOrder: step.stepOrder,
        status: step.status,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        errorMessage: step.errorMessage,
        metadata: step.metadata,
      })),
    });
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof NotFoundError ? 404 : 403 });
    }
    console.error("[API/build/[id]] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Composed Guards ────────────────────────────────────────────────────────────

export const GET = withAuth(
  withTenant(
    withPermission(Permission.VIEW_WEDDING)(handleGetBuildStatus),
  ),
);