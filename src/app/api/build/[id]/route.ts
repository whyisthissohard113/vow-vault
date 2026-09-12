/**
 * API route: GET /api/build/[id]
 *
 * Get build job status with step details.
 *
 * Guards: authenticated + tenant + VIEW_WEDDING. Tenant isolation is enforced
 * against the job's organization_id.
 */

import { NextRequest, NextResponse } from "next/server";

import { getBuildStatus } from "@/server/services/build-engine";
import { type TenantContext, validateTenantAccess } from "@/server/middleware/tenant";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
  type RouteParams,
} from "@/server/middleware/auth";
import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";

async function handleGetBuildStatus(
  _request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) {
  try {
    const params = await context.params;
    const id = params.id;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid build job id" }, { status: 400 });
    }

    const { job, steps } = await getBuildStatus(id);

    if (!job) {
      return NextResponse.json({ error: "Build job not found" }, { status: 404 });
    }

    validateTenantAccess(context.tenant, job.organizationId);

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
      return NextResponse.json(
        { error: error.message },
        { status: error instanceof NotFoundError ? 404 : 403 },
      );
    }
    console.error("[API/build/[id]] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withAuth(
  withTenant(withPermission(Permission.VIEW_WEDDING)(handleGetBuildStatus)),
);