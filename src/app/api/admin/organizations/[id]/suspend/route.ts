/**
 * API route: POST /api/admin/organizations/[id]/suspend
 *
 * Suspends an ACTIVE wedding-company organization (idempotent; refuses
 * platform orgs). Requires explicit `confirm: true`.
 * Guards: MANAGE_PLATFORM. Audits every mutation.
 */

import { NextRequest, NextResponse } from "next/server";

import { adminSuspendOrganization } from "@/server/services/admin-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
  type RouteParams,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";
import {
  getClientMeta,
  parseAdminConfirmBody,
  toErrorResponse,
} from "@/server/admin/route-helpers";

async function handleSuspend(
  request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) {
  try {
    const { id } = await context.params;
    const { reason } = await parseAdminConfirmBody(request);
    const result = await adminSuspendOrganization(id, context.tenant, {
      ...getClientMeta(request),
    });
    if (!result.changed) {
      return NextResponse.json(result, { status: 409 });
    }
    return NextResponse.json({ ...result, reason: reason ?? null });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const POST = withAuth(
  withTenant(withPermission(Permission.MANAGE_PLATFORM)(handleSuspend)),
);