/**
 * API route: GET /api/vault/[slug]/media/[publicId]/download
 *
 * Guest vault flow — sign a short-TTL download URL for one public media
 * item inside a published vault. The download window is re-checked
 * server-side before signing; closed windows and unknown public ids never
 * yield a URL. The response contains only a presigned object URL and
 * metadata — never internal media ids or storage keys.
 *
 * Query params: `variant` (original|thumbnail|preview|full, default original)
 *               `disposition` (inline|attachment)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getGuestDownloadUrlForPublicMedia } from "@/server/services/public-vault";
import {
  ForbiddenError,
  NotFoundError,
} from "@/lib/auth/errors";

// ── Input Validation ───────────────────────────────────────────────────────────

const downloadQuerySchema = z.object({
  variant: z.enum(["original", "thumbnail", "preview", "full"]).optional(),
  disposition: z.enum(["inline", "attachment"]).optional(),
});

// ── Route Handler ──────────────────────────────────────────────────────────────

async function handleGuestDownload(
  request: NextRequest,
  context: { params: Promise<{ slug: string; publicId: string }> },
) {
  try {
    const { slug, publicId } = await context.params;

    const parsed = downloadQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { variant, disposition } = parsed.data;

    const result = await getGuestDownloadUrlForPublicMedia(slug, publicId, {
      variant,
      disposition,
    });

    return NextResponse.json({
      url: result.url,
      expiresAt: result.expiresAt,
      contentType: result.contentType,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[API/vault/[slug]/media/[publicId]/download] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = handleGuestDownload;