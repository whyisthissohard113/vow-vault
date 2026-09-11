/**
 * API route: GET /api/media/[id]
 *
 * Fetch media metadata (and variant summaries). Tenant-scoped: 404 when the
 * media belongs to another organization. Internal storage keys are never
 * returned to clients.
 */

import { NextRequest, NextResponse } from "next/server";

import { getMediaWithVariants } from "@/server/services/media-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
  type RouteParams,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";
import { NotFoundError, ForbiddenError } from "@/lib/auth/errors";

// ── Route Handler ──────────────────────────────────────────────────────────────

async function handleGetMedia(
  request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) {
  try {
    const { id } = await context.params;
    const { tenant } = context;

    const { media, variants } = await getMediaWithVariants(id, tenant.organizationId);

    return NextResponse.json({
      mediaId: media.id,
      weddingId: media.weddingId,
      filename: media.filename,
      contentType: media.contentType,
      sizeBytes: media.sizeBytes,
      status: media.status,
      memoryId: media.memoryId,
      uploadedBy: media.uploadedBy,
      guestSessionId: media.guestSessionId,
      sha256: media.sha256Hash,
      width: media.width,
      height: media.height,
      durationMs: media.durationMs,
      createdAt: media.createdAt,
      variants: variants.map((variant) => ({
        variantType: variant.variantType,
        contentType: variant.contentType,
        sizeBytes: variant.sizeBytes,
        width: variant.width,
        height: variant.height,
      })),
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[API/media/[id]] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Composed Guards ────────────────────────────────────────────────────────────

export const GET = withAuth(
  withTenant(
    withPermission(Permission.VIEW_WEDDING)(handleGetMedia),
  ),
);