/**
 * Tenant context extraction and enforcement.
 *
 * Every tenant-scoped database query MUST pass through this middleware
 * to ensure proper organization_id filtering.
 *
 * SECURITY INVARIANTS:
 *  1. Every request that accesses tenant data gets a TenantContext.
 *  2. Platform users can access any tenant; org users can only access their own.
 *  3. Couple/guest users can only access specific resources they're authorized for.
 *  4. TenantContext is NEVER trusted from client input — always derived server-side.
 */

import { auth } from "@/auth";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizationMembers } from "@/lib/db/schema";
import type { OrganizationRole } from "@/lib/auth/roles";
import {
  UnauthorizedError,
  TenantMismatchError,
} from "@/lib/auth/errors";

// ── Types ───────────────────────────────────────────────────────────────────

export interface TenantContext {
  /** Internal organization UUID. */
  organizationId: string;
  /** Authenticated user's UUID. */
  userId: string;
  /** The user's role in this specific organization. */
  role: OrganizationRole;
  /** True for platform_admin / platform_support. */
  isPlatformUser: boolean;
}

// ── Core Middleware ──────────────────────────────────────────────────────────

/**
 * Extracts and validates tenant context from the current session.
 *
 * Requires:
 *  - An active NextAuth session with a user ID.
 *  - An active membership in the organization.
 *
 * @param organizationId - The organization to validate access against.
 *                         If omitted, uses the user's primary membership.
 */
export async function requireTenant(
  organizationId?: string,
): Promise<TenantContext> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }

  const userId = session.user.id;

  // If the session already carries a role and org context, use it
  if (
    session.user.role &&
    session.user.organizationId &&
    !organizationId
  ) {
    return {
      organizationId: session.user.organizationId,
      userId,
      role: session.user.role,
      isPlatformUser: session.user.isPlatformUser,
    };
  }

  // Platform users: validate they can access the requested org
  if (session.user.isPlatformUser) {
    if (!organizationId && !session.user.organizationId) {
      throw new TenantMismatchError();
    }
    return {
      organizationId: organizationId ?? session.user.organizationId!,
      userId,
      role: session.user.role!,
      isPlatformUser: true,
    };
  }

  // Non-platform users: look up their membership
  const whereConditions = [
    eq(organizationMembers.userId, userId),
    eq(organizationMembers.status, "active"),
    isNull(organizationMembers.deletedAt),
  ];

  if (organizationId) {
    whereConditions.push(eq(organizationMembers.organizationId, organizationId));
  }

  const [membership] = await db
    .select({
      organizationId: organizationMembers.organizationId,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .where(and(...whereConditions))
    .limit(1);

  if (!membership) {
    throw new TenantMismatchError();
  }

  return {
    organizationId: membership.organizationId,
    userId,
    role: membership.role as OrganizationRole,
    isPlatformUser: false,
  };
}

/**
 * Like `requireTenant`, but returns null instead of throwing when
 * no session or membership is found. Useful for optional auth routes.
 */
export async function optionalTenant(
  organizationId?: string,
): Promise<TenantContext | null> {
  try {
    return await requireTenant(organizationId);
  } catch {
    return null;
  }
}

// ── Authorization Helpers ───────────────────────────────────────────────────

/**
 * Validates that the tenant context allows access to the given organization.
 *
 * Platform users: always allowed.
 * Org users: must be a member of the target organization.
 */
export function validateTenantAccess(
  ctx: TenantContext,
  targetOrganizationId: string,
): void {
  if (ctx.isPlatformUser) return; // Platform users can access any tenant
  if (ctx.organizationId === targetOrganizationId) return; // Same tenant
  throw new TenantMismatchError();
}
