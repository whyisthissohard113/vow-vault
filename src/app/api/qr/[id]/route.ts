/**
 * API route: GET/DELETE /api/qr/[id]
 *
 * GET  — Get QR code details (requires VIEW_WEDDING).
 * DELETE — Revoke QR code (requires MANAGE_WEDDING).
 */

import { NextRequest, NextResponse } from "next/server";

import { getQrCode, revokeQrCode } from "@/server/services/qr-service";
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
} from "@/lib/auth/errors";

// ── GET Handler ──────────────────────────────────────────────────────────────

async function handleGetQrCode(
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

    const qrCode = await getQrCode(id, tenant.organizationId);

    return NextResponse.json({
      id: qrCode.id,
      publicId: qrCode.publicId,
      weddingId: qrCode.weddingId,
      vaultId: qrCode.vaultId,
      targetUrl: qrCode.targetUrl,
      status: qrCode.status,
      designId: qrCode.designId,
      generatedAt: qrCode.generatedAt?.toISOString(),
      expiresAt: qrCode.expiresAt?.toISOString(),
      createdAt: qrCode.createdAt?.toISOString(),
    });
  } catch (error) {
    if (error instanceof QrCodeNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[API/qr/[id]] GET Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── DELETE Handler ───────────────────────────────────────────────────────────

async function handleDeleteQrCode(
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

    await revokeQrCode(id, tenant.organizationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof QrCodeNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[API/qr/[id]] DELETE Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Composed Guards ──────────────────────────────────────────────────────────

export const GET = withAuth(
  withTenant(
    withPermission(Permission.VIEW_WEDDING)(handleGetQrCode),
  ),
);

export const DELETE = withAuth(
  withTenant(
    withPermission(Permission.MANAGE_WEDDING)(handleDeleteQrCode),
  ),
);
