/**
 * API route: GET /api/media/[id]/download
 *
 * Returns a short-lived presigned download URL, either for an authenticated
 * user (VIEW_WEDDING permission) or for a guest carrying a valid raw guest
 * token (x-guest-token header). Guests are re-scoped to their vault at the
 * server; they can never generate URLs for other organizations' media.
 */

import { NextRequest, NextResponse } from "next/server";

import { getSignedDownloadUrl } from "@/server/services/media-service";
import { getSignedDownloadUrlForGuest } from "@/server/services/media-service";
import { requireMediaOwnership } from "@/server/services/media-service";
import { resolveEntitlementsForWedding } from "@/server/services/media-service";
import { validateGuestSession } from "@/server/services/guest-sessions";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
  type RouteParams,
  type RawHandler,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";
import {
  GuestTokenExpiredError,
  GuestTokenRevokedError,
  GuestTokenInvalidError,
  NotFoundError,
  ForbiddenError,
  MediaValidationError,
} from "@/lib/auth/errors";

// ── Shared query parsing ───────────────────────────────────────────────────────

function parseDownloadQuery(request: NextRequest) {
  const url = new URL(request.url);
  const variant = url.searchParams.get("variant");
  const disposition = url.searchParams.get("disposition");

  let variantType: "original" | "thumbnail" | "preview" | "full" = "original";
  if (variant === "thumbnail" || variant === "preview" || variant === "full") {
    variantType = variant;
  }

  let responseDisposition: "inline" | "attachment" = "inline";
  if (disposition === "attachment") {
    responseDisposition = "attachment";
  }

  return { variantType, responseDisposition };
}

// ── Guest path ─────────────────────────────────────────────────────────────────

async function handleGuestDownload(
  request: NextRequest,
  context: { params: RouteParams },
) {
  try {
    const rawToken = request.headers.get("x-guest-token");
    if (!rawToken) {
      return NextResponse.json(
        { error: "Guest token required (x-guest-token header)" },
        { status: 401 },
      );
    }

    const session = await validateGuestSession(rawToken);
    if (!session) {
      return NextResponse.json({ error: "Invalid guest token" }, { status: 401 });
    }

    const { id } = await context.params;
    const { variantType, responseDisposition } = parseDownloadQuery(request);

    const result = await getSignedDownloadUrlForGuest(id, session, {
      variant: variantType,
      responseDisposition,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GuestTokenExpiredError || error instanceof GuestTokenRevokedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof GuestTokenInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof MediaValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[API/media/[id]/download:guest] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Authenticated path ─────────────────────────────────────────────────────────

async function handleAuthenticatedDownload(
  request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) {
  try {
    const { id } = await context.params;
    const { tenant } = context;

    const { variantType, responseDisposition } = parseDownloadQuery(request);

    // Resolve the media within the tenant first, then its entitlements so the
    // download-window check runs with up-to-date package state.
    const mediaRow = await requireMediaOwnership(id, tenant.organizationId);
    const entitlements = await resolveEntitlementsForWedding(mediaRow.weddingId, tenant.organizationId);

    const result = await getSignedDownloadUrl(id, tenant.organizationId, {
      entitlements,
      variant: variantType,
      responseDisposition,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[API/media/[id]/download] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Composed Guards ────────────────────────────────────────────────────────────

const authenticatedDownload = withAuth(
  withTenant(
    withPermission(Permission.VIEW_WEDDING)(handleAuthenticatedDownload),
  ),
);

/**
 * Dual-mode export: a guest token header switches to the guest path; otherwise
 * the standard auth + tenant + permission chain applies with VIEW_WEDDING.
 */
export const GET: RawHandler = async (request, context) => {
  if (request.headers.has("x-guest-token")) {
    return handleGuestDownload(request, context);
  }
  return authenticatedDownload(request, context);
};