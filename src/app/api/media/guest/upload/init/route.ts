/**
 * API route: POST /api/media/guest/upload/init
 *
 * Unauthenticated guest route: initialise a media upload for a vault using a
 * raw guest token (x-guest-token header). The server resolves the vault and
 * wedding from the session; the client-supplied body never carries identity.
 *
 * Guest-safe response: never includes storage keys or internal media IDs.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { initiateGuestUpload } from "@/server/services/media-service";
import { validateGuestSession } from "@/server/services/guest-sessions";
import {
  GuestTokenExpiredError,
  GuestTokenRevokedError,
  GuestTokenInvalidError,
  GuestUploadLimitError,
  MediaValidationError,
  MediaMimeRejectedError,
  MediaSizeExceededError,
  MediaSignatureRejectedError,
  DuplicateMediaError,
} from "@/lib/auth/errors";

// ── Input Validation ───────────────────────────────────────────────────────────

const guestInitUploadSchema = z.object({
  filename: z.string().min(1).max(255, "Filename too long"),
  contentType: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive("Size must be positive"),
  // Optional content hash; the authoritative dedupe hash is computed
  // server-side during processing.
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, "Invalid SHA-256 hash").optional(),
  memoryTitle: z.string().max(200).optional(),
}).strict();

// ── Route Handler ──────────────────────────────────────────────────────────────

async function handleGuestInitUpload(request: NextRequest) {
  try {
    const rawToken = request.headers.get("x-guest-token");
    if (!rawToken) {
      return NextResponse.json(
        { error: "Guest token required (x-guest-token header)" },
        { status: 401 },
      );
    }

    // Throws GuestTokenExpiredError / GuestTokenRevokedError on invalid status.
    const session = await validateGuestSession(rawToken);
    if (!session) {
      return NextResponse.json({ error: "Invalid guest token" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = guestInitUploadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { filename, contentType, sizeBytes, sha256, memoryTitle } = parsed.data;

    // The service re-validates the token and derives organization/wedding
    // scope server-side; the client cannot influence identity.
    const result = await initiateGuestUpload(rawToken, {
      filename,
      contentType,
      sizeBytes,
      sha256,
      memoryTitle,
    });

    if (result.duplicate) {
      // Duplicates carry no media ID or upload URL for guests.
      return NextResponse.json(
        { duplicate: true, message: result.message },
        { status: 200 },
      );
    }

    // Guards for the optional result fields; a valid new-upload path always
    // provides all three, so this is purely defensive before exposing them.
    if (!result.mediaId || !result.uploadUrl || !result.expiresAt) {
      return NextResponse.json(
        { error: "Upload initialization incomplete" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      mediaId: result.mediaId,
      uploadUrl: result.uploadUrl,
      expiresAt: result.expiresAt,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof GuestTokenExpiredError || error instanceof GuestTokenRevokedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof GuestTokenInvalidError || error instanceof GuestUploadLimitError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
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
    console.error("[API/media/guest/upload/init] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Export (no auth guards; guest token handled inside) ────────────────────────

export const POST = handleGuestInitUpload;