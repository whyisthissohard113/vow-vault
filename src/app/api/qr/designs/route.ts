/**
 * API route: GET /api/qr/designs
 *
 * List available QR designs (platform-wide + org-specific).
 * Requires: withAuth + withTenant.
 */

import { NextRequest, NextResponse } from "next/server";

import { listQrDesigns } from "@/server/services/qr-service";
import {
  withAuth,
  withTenant,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";

// ── Route Handler ────────────────────────────────────────────────────────────

async function handleListDesigns(
  request: NextRequest,
  context: { tenant: TenantContext },
) {
  try {
    const { tenant } = context;

    const designs = await listQrDesigns(tenant.organizationId);

    return NextResponse.json({
      designs: designs.map((d) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        backgroundColor: d.backgroundColor,
        foregroundColor: d.foregroundColor,
        logoKey: d.logoKey,
        isPlatform: d.isPlatform,
        isActive: d.isActive,
      })),
    });
  } catch (error) {
    console.error("[API/qr/designs] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Composed Guards ──────────────────────────────────────────────────────────

export const GET = withAuth(withTenant(handleListDesigns));
