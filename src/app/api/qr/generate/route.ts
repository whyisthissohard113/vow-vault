/**
 * API route: POST /api/qr/generate
 *
 * Generate QR code for a wedding.
 * Requires: weddingId, optional vaultId and designId.
 * Returns: qrCodeId, publicId, targetUrl.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { weddings } from "@/lib/db/schema";
import { createQrCode } from "@/server/services/qr-service";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";
import { NotFoundError, ForbiddenError } from "@/lib/auth/errors";

// ── Input Validation ─────────────────────────────────────────────────────────

const generateQrSchema = z
  .object({
    weddingId: z.string().uuid("Invalid wedding ID"),
    vaultId: z.string().uuid("Invalid vault ID").optional(),
    designId: z.string().uuid("Invalid design ID").optional(),
  })
  .strict();

// ── Route Handler ────────────────────────────────────────────────────────────

async function handleGenerateQr(
  request: NextRequest,
  context: { tenant: TenantContext },
) {
  try {
    const body = await request.json();
    const parsed = generateQrSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { weddingId, vaultId, designId } = parsed.data;
    const { tenant } = context;

    // Verify wedding exists and belongs to tenant
    const [wedding] = await db
      .select()
      .from(weddings)
      .where(
        and(
          eq(weddings.id, weddingId),
          eq(weddings.organizationId, tenant.organizationId),
          isNull(weddings.deletedAt),
        ),
      )
      .limit(1);

    if (!wedding) {
      return NextResponse.json({ error: "Wedding not found" }, { status: 404 });
    }

    const result = await createQrCode({
      weddingId,
      organizationId: tenant.organizationId,
      vaultId,
      designId,
    });

    return NextResponse.json(
      {
        qrCodeId: result.id,
        publicId: result.publicId,
        targetUrl: result.targetUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[API/qr/generate] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Composed Guards ──────────────────────────────────────────────────────────

export const POST = withAuth(
  withTenant(
    withPermission(Permission.MANAGE_WEDDING)(handleGenerateQr),
  ),
);
