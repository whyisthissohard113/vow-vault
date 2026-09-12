/**
 * API route: POST /api/qr/[id]/card
 *
 * Generate QR card PNG (Platinum feature).
 * Requires: MANAGE_WEDDING permission.
 * Body: { coupleName, weddingDate?, backgroundColor?, foregroundColor? }
 * Returns: { cardBase64, contentType: "image/png" }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getQrCode } from "@/server/services/qr-service";
import { generateQrCardPng } from "@/server/services/qr-card-generator";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
  type RouteParams,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";
import {
  ForbiddenError,
  QrCodeNotFoundError,
  QrCardGenerationError,
} from "@/lib/auth/errors";

// ── Input Validation ─────────────────────────────────────────────────────────

const generateCardSchema = z
  .object({
    coupleName: z.string().min(1, "Couple name is required").max(200),
    weddingDate: z.string().max(100).optional(),
    backgroundColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
      .optional(),
    foregroundColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
      .optional(),
  })
  .strict();

// ── Route Handler ────────────────────────────────────────────────────────────

async function handleGenerateCard(
  request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) {
  try {
    const params = await context.params;
    const id = params.id;
    const { tenant } = context;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid QR code ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = generateCardSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { coupleName, weddingDate, backgroundColor, foregroundColor } = parsed.data;

    // Get QR code with tenant validation
    const qrCode = await getQrCode(id, tenant.organizationId);

    if (!qrCode.targetUrl) {
      return NextResponse.json(
        { error: "QR code has no target URL" },
        { status: 400 },
      );
    }

    // Generate the card
    const card = await generateQrCardPng({
      targetUrl: qrCode.targetUrl,
      coupleName,
      weddingDate,
      backgroundColor,
      foregroundColor,
    });

    // Return as base64
    const cardBase64 = card.pngBuffer.toString("base64");

    return NextResponse.json({
      cardBase64,
      contentType: "image/png",
      width: card.width,
      height: card.height,
    });
  } catch (error) {
    if (error instanceof QrCodeNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof QrCardGenerationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("[API/qr/[id]/card] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Composed Guards ──────────────────────────────────────────────────────────

export const POST = withAuth(
  withTenant(
    withPermission(Permission.MANAGE_WEDDING)(handleGenerateCard),
  ),
);
