/**
 * API route: POST /api/media/guest/upload/[publicId]/complete
 *
 * Guest vault flow — confirm a guest upload after the direct PUT to the
 * presigned URL succeeded. The raw guest token is re-validated server-side
 * AND the media row must belong to that session, so one guest can never
 * complete another guest's upload. On success the media enters processing
 * (thumbnails/variants/content hash) and the session fair-use counter is
 * incremented exactly once.
 *
 * Guest-safe: response exposes only the opaque public id.
 */

import { NextRequest, NextResponse } from "next/server";

import { completeGuestUploadByPublicId } from "@/server/services/media-service";
import {
  GuestTokenExpiredError,
  GuestTokenInvalidError,
  GuestTokenRevokedError,
  GuestUploadLimitError,
  NotFoundError,
  ForbiddenError,
} from "@/lib/auth/errors";

// ── Route Handler ──────────────────────────────────────────────────────────────

async function handleGuestCompleteUpload(
  request: NextRequest,
  context: { params: Promise<{ publicId: string }> },
) {
  try {
    const { publicId } = await context.params;

    const rawToken = request.headers.get("x-guest-token");
    if (!rawToken) {
      return NextResponse.json(
        { error: "Guest token required (x-guest-token header)" },
        { status: 401 },
      );
    }

    const result = await completeGuestUploadByPublicId(rawToken, publicId);

    return NextResponse.json({ status: result.status, publicId: result.publicId });
  } catch (error) {
    if (
      error instanceof GuestTokenExpiredError ||
      error instanceof GuestTokenRevokedError ||
      error instanceof GuestTokenInvalidError
    ) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof GuestUploadLimitError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[API/media/guest/upload/[publicId]/complete] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = handleGuestCompleteUpload;