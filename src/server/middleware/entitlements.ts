/**
 * Server-side Entitlement Guards.
 *
 * Higher-Order Functions for API routes that enforce entitlement checks.
 * All checks happen server-side — never trust client-side feature flags.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { weddings, vaults, weddingSettings } from "@/lib/db/schema";
import type { TenantContext } from "./tenant";
import { requireTenant, validateTenantAccess } from "./tenant";
import { resolveEntitlements, type ResolvedEntitlements } from "@/lib/entitlements";
import { TenantMismatchError, ForbiddenError, NotFoundError } from "@/lib/auth/errors";

// ── Types ──────────────────────────────────────────────────────────────────────

export type EntitlementHandler = (
  request: NextRequest,
  context: { tenant: TenantContext; entitlements: ResolvedEntitlements },
) => Promise<NextResponse>;

export type WeddingIdHandler = (
  request: NextRequest,
  context: { tenant: TenantContext; weddingId: string },
) => Promise<NextResponse>;

export type VaultIdHandler = (
  request: NextRequest,
  context: { tenant: TenantContext; vaultId: string },
) => Promise<NextResponse>;

// ── Core Entitlement Resolution ────────────────────────────────────────────────

/**
 * Resolve entitlements for a wedding by ID.
 * Fetches wedding, package, and wedding settings, then calculates full entitlements.
 */
export async function resolveWeddingEntitlements(
  weddingId: string,
  tenant: TenantContext,
): Promise<ResolvedEntitlements> {
  // Verify tenant access
  const wedding = await db
    .select({
      id: weddings.id,
      packageCode: weddings.packageCode,
      weddingDate: weddings.weddingDate,
      organizationId: weddings.organizationId,
    })
    .from(weddings)
    .where(
      and(
        eq(weddings.id, weddingId),
        eq(weddings.organizationId, tenant.organizationId),
        isNull(weddings.deletedAt),
      ),
    )
    .limit(1);

  if (!wedding.length) {
    throw new NotFoundError("Wedding");
  }

  const w = wedding[0];

  // Validate tenant access (platform users can access any tenant)
  validateTenantAccess(tenant, w.organizationId);

  // Fetch wedding settings for feature overrides
  const settings = await db
    .select()
    .from(weddingSettings)
    .where(eq(weddingSettings.weddingId, weddingId))
    .limit(1);

  const featureOverrides = settings[0]?.featuresOverrides as Record<string, unknown> | undefined;

  // Resolve entitlements
  return resolveEntitlements({
    packageCode: w.packageCode as "silver" | "gold" | "platinum",
    weddingDate: { date: w.weddingDate },
    featureOverrides,
  });
}

/**
 * Resolve entitlements for a vault by ID.
 */
export async function resolveVaultEntitlements(
  vaultId: string,
  tenant: TenantContext,
): Promise<ResolvedEntitlements> {
  const vault = await db
    .select({
      id: vaults.id,
      weddingId: vaults.weddingId,
      organizationId: vaults.organizationId,
    })
    .from(vaults)
    .where(
      and(
        eq(vaults.id, vaultId),
        eq(vaults.organizationId, tenant.organizationId),
        isNull(vaults.deletedAt),
      ),
    )
    .limit(1);

  if (!vault.length) {
    throw new NotFoundError("Vault");
  }

  return resolveWeddingEntitlements(vault[0].weddingId, tenant);
}

// ── Guard HOFs ─────────────────────────────────────────────────────────────────

/**
 * Guard that resolves wedding entitlements and passes them to the handler.
 * Requires valid tenant context (use withTenant first).
 */
export function withWeddingEntitlements(handler: EntitlementHandler) {
  return async (request: NextRequest, context: { tenant: TenantContext }) => {
    try {
      // Extract wedding ID from query params or body
      const url = new URL(request.url);
      const weddingId = url.searchParams.get("weddingId") ?? url.searchParams.get("id");

      if (!weddingId) {
        return NextResponse.json(
          { error: "weddingId parameter required" },
          { status: 400 },
        );
      }

      const entitlements = await resolveWeddingEntitlements(weddingId, context.tenant);

      return handler(request, { tenant: context.tenant, entitlements });
    } catch (error) {
      if (error instanceof TenantMismatchError || error instanceof ForbiddenError) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      if (error instanceof NotFoundError) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      throw error;
    }
  };
}

/**
 * Guard that resolves vault entitlements and passes them to the handler.
 */
export function withVaultEntitlements(handler: EntitlementHandler) {
  return async (request: NextRequest, context: { tenant: TenantContext }) => {
    try {
      const url = new URL(request.url);
      const vaultId = url.searchParams.get("vaultId") ?? url.searchParams.get("id");

      if (!vaultId) {
        return NextResponse.json(
          { error: "vaultId parameter required" },
          { status: 400 },
        );
      }

      const entitlements = await resolveVaultEntitlements(vaultId, context.tenant);

      return handler(request, { tenant: context.tenant, entitlements });
    } catch (error) {
      if (error instanceof TenantMismatchError || error instanceof ForbiddenError) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      if (error instanceof NotFoundError) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      throw error;
    }
  };
}

// ── Feature-Specific Guards ────────────────────────────────────────────────────

/**
 * Guard that requires a specific feature to be enabled in the package.
 * Must be used AFTER withWeddingEntitlements or withVaultEntitlements.
 */
export function withFeature(featureCode: string) {
  return (handler: EntitlementHandler): EntitlementHandler => {
    return async (request, context) => {
      const { entitlements } = context;

      // Check if feature is enabled
      const hasFeature = entitlements.features[featureCode] === true;

      if (!hasFeature) {
        return NextResponse.json(
          {
            error: "Feature not included in package",
            feature: featureCode,
            package: entitlements.packageCode,
          },
          { status: 403 },
        );
      }

      return handler(request, context);
    };
  };
}

/**
 * Guard that requires upload window to be open.
 */
export function withUploadOpen(handler: EntitlementHandler): EntitlementHandler {
  return async (request, context) => {
    const { entitlements } = context;

    if (!entitlements.uploadOpen) {
      return NextResponse.json(
        {
          error: "Upload window has closed",
          uploadDeadline: entitlements.expiry.uploadDeadline.toISOString(),
        },
        { status: 403 },
      );
    }

    return handler(request, context);
  };
}

/**
 * Guard that requires download window to be open.
 */
export function withDownloadOpen(handler: EntitlementHandler): EntitlementHandler {
  return async (request, context) => {
    const { entitlements } = context;

    if (!entitlements.downloadOpen) {
      return NextResponse.json(
        {
          error: "Download window has closed",
          downloadDeadline: entitlements.expiry.downloadDeadline.toISOString(),
        },
        { status: 403 },
      );
    }

    return handler(request, context);
  };
}

/**
 * Guard that requires specific lifecycle status.
 */
export function withLifecycleStatus(
  allowedStatuses: ReadonlyArray<"active" | "upload_closed" | "download_only" | "expired">,
) {
  return (handler: EntitlementHandler): EntitlementHandler => {
    return async (request, context) => {
      const { entitlements } = context;

      if (!allowedStatuses.includes(entitlements.lifecycleStatus)) {
        return NextResponse.json(
          {
            error: "Operation not allowed in current lifecycle state",
            currentStatus: entitlements.lifecycleStatus,
            allowedStatuses,
          },
          { status: 403 },
        );
      }

      return handler(request, context);
    };
  };
}

// ── Composite Guards for Common Patterns ───────────────────────────────────────

/**
 * Full stack: Auth → Tenant → Wedding Entitlements → Feature → Upload Open
 * Usage: export const POST = withAuth(withTenant(withWeddingEntitlements(withFeature("video")(withUploadOpen(handler)))));
 */
export function createUploadGuard(requiredFeatures: string[] = []) {
  return (handler: EntitlementHandler) => {
    let guarded = handler;

    // Apply feature guards (innermost first)
    for (const feature of requiredFeatures.reverse()) {
      guarded = withFeature(feature)(guarded);
    }

    // Then upload window guard
    guarded = withUploadOpen(guarded);

    // Then entitlements
    guarded = withWeddingEntitlements(guarded);

    return guarded;
  };
}

/**
 * Full stack for download: Auth → Tenant → Vault Entitlements → Download Open
 */
export function createDownloadGuard() {
  return (handler: EntitlementHandler) => {
    let guarded = withDownloadOpen(handler);
    guarded = withVaultEntitlements(guarded);
    return guarded;
  };
}

/**
 * Full stack for vault rendering: Auth → Tenant → Vault Entitlements
 * (No feature check - vault rendering handles feature availability in UI)
 */
export function createVaultRenderGuard() {
  return withVaultEntitlements;
}

// ── Standalone Helper Functions (for use inside route handlers) ────────────────

/**
 * Get entitlements inside a route handler without HOF.
 * Throws appropriate HTTP errors as NextResponse.
 */
export async function getWeddingEntitlements(
  request: NextRequest,
  tenant: TenantContext,
): Promise<ResolvedEntitlements> {
  const url = new URL(request.url);
  const weddingId = url.searchParams.get("weddingId") ?? url.searchParams.get("id");

  if (!weddingId) {
    throw new Error("weddingId parameter required");
  }

  return resolveWeddingEntitlements(weddingId, tenant);
}

/**
 * Get vault entitlements inside a route handler.
 */
export async function getVaultEntitlements(
  request: NextRequest,
  tenant: TenantContext,
): Promise<ResolvedEntitlements> {
  const url = new URL(request.url);
  const vaultId = url.searchParams.get("vaultId") ?? url.searchParams.get("id");

  if (!vaultId) {
    throw new Error("vaultId parameter required");
  }

  return resolveVaultEntitlements(vaultId, tenant);
}

/**
 * Check if a feature is available for the current entitlements.
 * Returns false (not error) for easy inline checks.
 */
export function checkFeature(entitlements: ResolvedEntitlements, featureCode: string): boolean {
  return entitlements.features[featureCode] === true;
}

/**
 * Assert that a feature is available, throwing ForbiddenError if not.
 * Use inside route handlers for inline checks.
 */
export function assertFeature(entitlements: ResolvedEntitlements, featureCode: string): void {
  if (!checkFeature(entitlements, featureCode)) {
    throw new ForbiddenError(`Feature '${featureCode}' not included in ${entitlements.packageCode} package`);
  }
}

/**
 * Assert that upload window is open.
 */
export function assertUploadOpen(entitlements: ResolvedEntitlements): void {
  if (!entitlements.uploadOpen) {
    throw new ForbiddenError("Upload window has closed");
  }
}

/**
 * Assert that download window is open.
 */
export function assertDownloadOpen(entitlements: ResolvedEntitlements): void {
  if (!entitlements.downloadOpen) {
    throw new ForbiddenError("Download window has closed");
  }
}