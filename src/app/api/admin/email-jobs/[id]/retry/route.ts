/**
 * API route: POST /api/admin/email-jobs/[id]/retry
 *
 * Resets a FAILED email job to pending with a fresh attempt budget.
 * Idempotency key preserved; no-op for sent/sending/pending/cancelled jobs.
 * Requires explicit `confirm: true`.
 * Guards: MANAGE_PLATFORM. Audits every mutation.
 */

import { NextRequest, NextResponse } from "next/server";

import { adminRetryEmailJob } from "@/server/services/admin-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
  type RouteParams,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";
import { getClientMeta, parseAdminConfirmBody, toErrorResponse } from "@/server/admin/route-helpers";

async function handleRetryEmail(
  request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) {
  try {
    const { id } = await context.params;
    await parseAdminConfirmBody(request);
    const result = await adminRetryEmailJob(id, context.tenant, getClientMeta(request));
    if (!result.changed) {
      return NextResponse.json(result, { status: 409 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const POST = withAuth(
  withTenant(withPermission(Permission.MANAGE_PLATFORM)(handleRetryEmail)),
);