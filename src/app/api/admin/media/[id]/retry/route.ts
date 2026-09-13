/**
 * API route: POST /api/admin/media/[id]/retry
 *
 * Resets FAILED media processing jobs back to pending (idempotent; no-op for
 * healthy media). Requires explicit `confirm: true`.
 * Guards: MANAGE_PLATFORM. Audits every mutation.
 */

import { NextRequest, NextResponse } from "next/server";

import { adminRetryMediaProcessing } from "@/server/services/admin-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
  type RouteParams,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";
import { getClientMeta, parseAdminConfirmBody, toErrorResponse } from "@/server/admin/route-helpers";

async function handleRetryMedia(
  request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) {
  try {
    const { id } = await context.params;
    await parseAdminConfirmBody(request);
    const result = await adminRetryMediaProcessing(id, context.tenant, getClientMeta(request));
    if (!result.changed) {
      return NextResponse.json(result, { status: 409 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const POST = withAuth(
  withTenant(withPermission(Permission.MANAGE_PLATFORM)(handleRetryMedia)),
);