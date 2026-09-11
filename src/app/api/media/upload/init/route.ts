/**
 * API route: POST /api/media/upload/init
 *
 * Authenticated staff route: initialise a media upload for a wedding.
 * Authoritative checks: tenant membership, UPLOAD_MEDIA permission,
 * package entitlements, upload window, size limit and MIME signature.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { initiateUpload } from "@/server/services/media-service";
import { resolveEntitlementsForWedding } from "@/server/services/media-service";
import { createStorageClient } from "@/server/services/storage/client";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
  type RouteParams,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";
import {
  MediaValidationError,
  MediaMimeRejectedError,
  MediaSizeExceededError,
  MediaSignatureRejectedError,
  DuplicateMediaError,
  NotFoundError,
  ForbiddenError,
} from "@/lib/auth/errors";

// ── Input Validation ───────────────────────────────────────────────────────────

const initUploadSchema = z.object({
  weddingId: z.string().uuid("Invalid wedding ID"),
  filename: z.string().min(1).max(255, "Filename too long"),
  contentType: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive("Size must be positive"),
  // Optional content hash; when provided it enables duplicate detection at
  // init-time. The authoritative dedupe hash is computed server-side during
  // processing.
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, "Invalid SHA-256 hash").optional(),
  memoryTitle: z.string().max(200).optional(),
}).strict();

// ── Route Handler ──────────────────────────────────────────────────────────────

async function handleInitUpload(
  request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) {
  try {
    const body = await request.json();
    const parsed = initUploadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { tenant } = context;
    const { weddingId, filename, contentType, sizeBytes, sha256, memoryTitle } = parsed.data;

    // Resolve the wedding within the tenant; throws NotFoundError if the
    // wedding does not exist or belongs to another organization.
    const entitlements = await resolveEntitlementsForWedding(weddingId, tenant.organizationId);

    const result = await initiateUpload(
      { filename, contentType, sizeBytes, sha256, memoryTitle },
      {
        organizationId: tenant.organizationId,
        weddingId,
        entitlements,
        storage: createStorageClient(),
        origin: "staff",
        uploadedBy: tenant.userId,
        duplicatePolicy: "return",
      },
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof MediaValidationError || error instanceof MediaMimeRejectedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof MediaSizeExceededError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    if (error instanceof MediaSignatureRejectedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof DuplicateMediaError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[API/media/upload/init] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Composed Guards ────────────────────────────────────────────────────────────

export const POST = withAuth(
  withTenant(
    withPermission(Permission.UPLOAD_MEDIA)(handleInitUpload),
  ),
);