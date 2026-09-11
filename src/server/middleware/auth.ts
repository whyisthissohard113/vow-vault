/**
 * Server-side authorization guard Higher-Order Functions (HOFs).
 *
 * These wrap Next.js App Router API handlers to enforce authentication,
 * tenant isolation, role checks, and permission gates before the
 * handler logic executes.
 *
 * Usage:
 *   export const GET = withAuth(withPermission(Permission.VIEW_WEDDING)(handler));
 *   export const POST = withTenant(withRole(["couple_owner"])(handler));
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireTenant, type TenantContext } from "./tenant";
import type { OrganizationRole } from "@/lib/auth/roles";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import {
  UnauthorizedError,
  ForbiddenError,
  TenantMismatchError,
} from "@/lib/auth/errors";

export { Permission } from "@/lib/auth/permissions";

// ── Types ───────────────────────────────────────────────────────────────────

export type RouteParams = Promise<Record<string, string> | { id: string }>;

export type AuthenticatedHandler = (
  request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) => Promise<NextResponse>;

export type RawHandler = (
  request: NextRequest,
  context: { params: RouteParams },
) => Promise<NextResponse>;

// ── Guard HOFs ──────────────────────────────────────────────────────────────

/**
 * Ensures the request has a valid NextAuth session.
 * Calls `handler` with the request if authenticated, otherwise returns 401.
 */
export function withAuth(handler: RawHandler): RawHandler {
  return async (request: NextRequest, context: { params: RouteParams }) => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }
      return handler(request, context);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      throw error;
    }
  };
}

/**
 * Extracts and validates tenant context from the session.
 * Passes `{ tenant }` as the second argument to the handler.
 */
export function withTenant(handler: AuthenticatedHandler): RawHandler {
  return async (request: NextRequest, context: { params: RouteParams }) => {
    try {
      // Try to extract org ID from query params or headers
      const url = new URL(request.url);
      const orgId =
        url.searchParams.get("organizationId") ??
        request.headers.get("x-organization-id");

      const tenant = await requireTenant(orgId ?? undefined);
      return handler(request, { tenant, params: context.params });
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error instanceof ForbiddenError || error instanceof TenantMismatchError) {
        return NextResponse.json(
          { error: "Access denied to this organization" },
          { status: 403 },
        );
      }
      throw error;
    }
  };
}

/**
 * Restricts access to users with one of the specified roles.
 * Must be used AFTER `withTenant`.
 */
export function withRole(roles: readonly OrganizationRole[]) {
  return (handler: AuthenticatedHandler): AuthenticatedHandler => {
    return async (request, context) => {
      const { tenant } = context;

      if (!roles.includes(tenant.role)) {
        return NextResponse.json(
          {
            error: "Insufficient role",
            required: roles,
            current: tenant.role,
          },
          { status: 403 },
        );
      }

      return handler(request, context);
    };
  };
}

/**
 * Gates access to a specific permission.
 * Must be used AFTER `withTenant`.
 */
export function withPermission(permission: Permission) {
  return (handler: AuthenticatedHandler): AuthenticatedHandler => {
    return async (request, context) => {
      const { tenant } = context;

      if (!hasPermission(tenant.role, permission)) {
        return NextResponse.json(
          {
            error: "Insufficient permissions",
            required: permission,
            current: tenant.role,
          },
          { status: 403 },
        );
      }

      return handler(request, context);
    };
  };
}

/**
 * Ensures the current user has access to a specific organization.
 * Platform users always pass; org users must be members.
 */
export function requireOrganizationAccess(
  targetOrgId: string,
  ctx: TenantContext,
): void {
  if (ctx.isPlatformUser) return;
  if (ctx.organizationId === targetOrgId) return;
  throw new ForbiddenError();
}

// ── TenantContext extraction without HOF (for use in route handlers) ────────

/**
 * Standalone function to get tenant context inside a route handler.
 * Throws 401/403 appropriate HTTP errors as NextResponse.
 */
export async function getTenantContext(
  request: NextRequest,
): Promise<TenantContext> {
  const url = new URL(request.url);
  const orgId =
    url.searchParams.get("organizationId") ??
    request.headers.get("x-organization-id");

  return requireTenant(orgId ?? undefined);
}