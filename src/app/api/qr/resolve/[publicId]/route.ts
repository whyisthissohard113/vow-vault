/**
 * API route: GET /api/qr/resolve/[publicId]
 *
 * Public endpoint for QR scan resolution. NO auth required.
 * Returns: { targetUrl, valid, reason? } or 302 redirect.
 */

import { NextRequest, NextResponse } from "next/server";

import { resolveQrDestination } from "@/server/services/qr-service";

// ── Route Handler ────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  try {
    const params = await context.params;
    const publicId = params.publicId;

    if (!publicId || typeof publicId !== "string") {
      return NextResponse.json(
        { error: "Invalid public ID" },
        { status: 400 },
      );
    }

    const result = await resolveQrDestination(publicId);

    if (!result.valid) {
      return NextResponse.json(
        {
          targetUrl: result.targetUrl,
          valid: false,
          reason: result.reason,
        },
        { status: 200 },
      );
    }

    // Check if client wants redirect or JSON
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("text/html") || accept.includes("*/*")) {
      // Redirect to the vault page
      return NextResponse.redirect(result.targetUrl, 302);
    }

    // Return JSON for API consumers
    return NextResponse.json({
      targetUrl: result.targetUrl,
      valid: true,
    });
  } catch (error) {
    console.error("[API/qr/resolve] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
