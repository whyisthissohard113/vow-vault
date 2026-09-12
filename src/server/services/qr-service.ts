/**
 * QR Code Service — Production-grade QR generation and management.
 *
 * SECURITY REQUIREMENTS:
 *  - QR payloads encode ONLY the public destination URL (e.g., `{APP_URL}/w/{slug}`).
 *  - NEVER encode internal UUIDs, customer data, wedding details, or private info.
 *  - `publicId` is the ONLY identifier in the QR — it's opaque and stable.
 *  - QR remains valid if design changes (design is separate from the QR code record).
 *  - Always validate tenant isolation: org-scoped queries filter by organizationId.
 */

import { eq, and, isNull, desc } from "drizzle-orm";
import QRCode from "qrcode";

import { db } from "@/lib/db";
import { qrCodes, qrDesigns, vaults } from "@/lib/db/schema";
import type { QrCode, QrDesign } from "@/lib/db/schema";
import {
  QrCodeNotFoundError,
  QrGenerationError,
  ForbiddenError,
} from "@/lib/auth/errors";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreateQrCodeInput {
  weddingId: string;
  organizationId: string;
  vaultId?: string;
  designId?: string;
  customTargetUrl?: string;
}

export interface QrCodeResult {
  id: string;
  publicId: string;
  targetUrl: string;
  pngBuffer: Buffer;
}

export interface QrGenerateOptions {
  width?: number;
  margin?: number;
  errorCorrectionLevel?: string;
  color?: { dark?: string; light?: string };
}

// ── QR Image Generation ──────────────────────────────────────────────────────

/**
 * Generate QR code as a PNG buffer.
 * Encodes ONLY the targetUrl — never private data.
 */
export async function generateQrPng(
  targetUrl: string,
  options: QrGenerateOptions = {},
): Promise<Buffer> {
  try {
    const buffer = await QRCode.toBuffer(targetUrl, {
      type: "png",
      errorCorrectionLevel: (options.errorCorrectionLevel as QRCode.QRCodeErrorCorrectionLevel) ?? "M",
      width: options.width ?? 512,
      margin: options.margin ?? 2,
      color: {
        dark: options.color?.dark ?? "#000000",
        light: options.color?.light ?? "#FFFFFF",
      },
    });
    return buffer;
  } catch (error) {
    throw new QrGenerationError(
      error instanceof Error ? error.message : "Unknown QR generation error",
    );
  }
}

/**
 * Generate QR code as a base64 data URL.
 */
export async function generateQrDataUrl(
  targetUrl: string,
  options: QrGenerateOptions = {},
): Promise<string> {
  try {
    return await QRCode.toDataURL(targetUrl, {
      errorCorrectionLevel: (options.errorCorrectionLevel as QRCode.QRCodeErrorCorrectionLevel) ?? "M",
      width: options.width ?? 512,
      margin: options.margin ?? 2,
      color: {
        dark: options.color?.dark ?? "#000000",
        light: options.color?.light ?? "#FFFFFF",
      },
    });
  } catch (error) {
    throw new QrGenerationError(
      error instanceof Error ? error.message : "Unknown QR generation error",
    );
  }
}

/**
 * Generate QR code as an SVG string.
 */
export async function generateQrSvg(
  targetUrl: string,
  options: QrGenerateOptions = {},
): Promise<string> {
  try {
    return await QRCode.toString(targetUrl, {
      type: "svg",
      errorCorrectionLevel: (options.errorCorrectionLevel as QRCode.QRCodeErrorCorrectionLevel) ?? "M",
      width: options.width ?? 512,
      margin: options.margin ?? 2,
      color: {
        dark: options.color?.dark ?? "#000000",
        light: options.color?.light ?? "#FFFFFF",
      },
    });
  } catch (error) {
    throw new QrGenerationError(
      error instanceof Error ? error.message : "Unknown QR generation error",
    );
  }
}

// ── QR Code CRUD ─────────────────────────────────────────────────────────────

/**
 * Generate a 32-character opaque hex public ID.
 */
function generatePublicId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compute the target URL for a vault slug.
 */
function computeTargetUrl(slug: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/w/${slug}`;
}

/**
 * Create a QR code record in the database AND generate the PNG.
 * Auto-generates publicId, computes targetUrl from vault slug.
 */
export async function createQrCode(
  input: CreateQrCodeInput,
): Promise<QrCodeResult> {
  const { weddingId, organizationId, vaultId, designId } = input;

  let targetUrl = input.customTargetUrl;

  if (!targetUrl) {
    // Resolve target URL from vault
    if (vaultId) {
      const [vault] = await db
        .select({ slug: vaults.slug })
        .from(vaults)
        .where(
          and(
            eq(vaults.id, vaultId),
            eq(vaults.organizationId, organizationId),
            isNull(vaults.deletedAt),
          ),
        )
        .limit(1);

      if (!vault) {
        throw new QrCodeNotFoundError("Vault for QR code");
      }
      targetUrl = computeTargetUrl(vault.slug);
    } else {
      // Try to find vault by wedding
      const [vault] = await db
        .select({ slug: vaults.slug })
        .from(vaults)
        .where(
          and(
            eq(vaults.weddingId, weddingId),
            eq(vaults.organizationId, organizationId),
            isNull(vaults.deletedAt),
          ),
        )
        .limit(1);

      if (vault) {
        targetUrl = computeTargetUrl(vault.slug);
      } else {
        // Fallback: use APP_URL with a placeholder
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        targetUrl = `${baseUrl}/w/pending-${weddingId}`;
      }
    }
  }

  const publicId = generatePublicId();

  // Insert QR code record
  const [qrCode] = await db
    .insert(qrCodes)
    .values({
      weddingId,
      vaultId: vaultId ?? null,
      organizationId,
      designId: designId ?? null,
      publicId,
      targetUrl,
      status: "active",
      generatedAt: new Date(),
      expiresAt: null,
    })
    .returning();

  // Generate PNG buffer
  // Load design colors if a design is specified
  let qrOptions: QrGenerateOptions = {};
  if (designId) {
    const design = await getQrDesign(designId);
    if (design) {
      qrOptions = {
        color: {
          dark: design.foregroundColor,
          light: design.backgroundColor,
        },
      };
    }
  }

  const pngBuffer = await generateQrPng(targetUrl, qrOptions);

  return {
    id: qrCode.id,
    publicId: qrCode.publicId,
    targetUrl: qrCode.targetUrl ?? targetUrl,
    pngBuffer,
  };
}

/**
 * Get QR code record with tenant validation.
 * Throws QrCodeNotFoundError if missing, ForbiddenError if cross-tenant.
 */
export async function getQrCode(
  qrCodeId: string,
  organizationId: string,
): Promise<QrCode> {
  const [qrCode] = await db
    .select()
    .from(qrCodes)
    .where(
      and(
        eq(qrCodes.id, qrCodeId),
        isNull(qrCodes.deletedAt),
      ),
    )
    .limit(1);

  if (!qrCode) {
    throw new QrCodeNotFoundError();
  }

  // Tenant isolation check
  if (qrCode.organizationId !== organizationId) {
    throw new ForbiddenError("QR code belongs to another organization");
  }

  return qrCode;
}

/**
 * Look up QR code by public ID (for resolution).
 * No tenant check — this is for public resolution.
 */
export async function getQrByPublicId(publicId: string): Promise<QrCode | null> {
  const [qrCode] = await db
    .select()
    .from(qrCodes)
    .where(
      and(
        eq(qrCodes.publicId, publicId),
        isNull(qrCodes.deletedAt),
      ),
    )
    .limit(1);

  return qrCode ?? null;
}

/**
 * Resolve the target URL for a scanned QR code.
 * Checks status: active = ok, revoked/expired = error.
 */
export async function resolveQrDestination(
  publicId: string,
): Promise<{ targetUrl: string; valid: boolean; reason?: string }> {
  const qrCode = await getQrByPublicId(publicId);

  if (!qrCode) {
    return {
      targetUrl: "",
      valid: false,
      reason: "QR code not found",
    };
  }

  if (qrCode.status === "revoked") {
    return {
      targetUrl: qrCode.targetUrl ?? "",
      valid: false,
      reason: "QR code has been revoked",
    };
  }

  if (qrCode.status === "expired") {
    return {
      targetUrl: qrCode.targetUrl ?? "",
      valid: false,
      reason: "QR code has expired",
    };
  }

  // Check expiry date if set
  if (qrCode.expiresAt && qrCode.expiresAt < new Date()) {
    return {
      targetUrl: qrCode.targetUrl ?? "",
      valid: false,
      reason: "QR code has expired",
    };
  }

  return {
    targetUrl: qrCode.targetUrl ?? "",
    valid: true,
  };
}

/**
 * Mark QR code as revoked. Tenant-validated.
 */
export async function revokeQrCode(
  qrCodeId: string,
  organizationId: string,
): Promise<void> {
  // Get and validate tenant
  const qrCode = await getQrCode(qrCodeId, organizationId);

  if (qrCode.status !== "active") {
    // Already revoked or expired — no-op
    return;
  }

  await db
    .update(qrCodes)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(qrCodes.id, qrCodeId));
}

/**
 * List QR codes for an organization.
 */
export async function listQrCodes(
  organizationId: string,
  filters?: { weddingId?: string; status?: string },
): Promise<QrCode[]> {
  const conditions = [
    eq(qrCodes.organizationId, organizationId),
    isNull(qrCodes.deletedAt),
  ];

  if (filters?.weddingId) {
    conditions.push(eq(qrCodes.weddingId, filters.weddingId));
  }
  if (filters?.status) {
    conditions.push(eq(qrCodes.status, filters.status as "active" | "revoked" | "expired"));
  }

  const results = await db
    .select()
    .from(qrCodes)
    .where(and(...conditions))
    .orderBy(desc(qrCodes.createdAt));

  return results;
}

// ── QR Design Management ─────────────────────────────────────────────────────

/**
 * Get the default platform QR design (organizationId IS NULL, isPlatform=true).
 * If organizationId provided, also check org-specific designs.
 */
export async function getDefaultDesign(
  organizationId?: string,
): Promise<QrDesign | null> {
  // First check for org-specific default
  if (organizationId) {
    const [orgDesign] = await db
      .select()
      .from(qrDesigns)
      .where(
        and(
          eq(qrDesigns.organizationId, organizationId),
          eq(qrDesigns.isActive, true),
          isNull(qrDesigns.deletedAt),
        ),
      )
      .orderBy(desc(qrDesigns.createdAt))
      .limit(1);

    if (orgDesign) return orgDesign;
  }

  // Fall back to platform default
  const [platformDesign] = await db
    .select()
    .from(qrDesigns)
    .where(
      and(
        isNull(qrDesigns.organizationId),
        eq(qrDesigns.isPlatform, true),
        eq(qrDesigns.isActive, true),
        isNull(qrDesigns.deletedAt),
      ),
    )
    .limit(1);

  return platformDesign ?? null;
}

/**
 * Get a specific QR design.
 */
export async function getQrDesign(designId: string): Promise<QrDesign | null> {
  const [design] = await db
    .select()
    .from(qrDesigns)
    .where(
      and(
        eq(qrDesigns.id, designId),
        isNull(qrDesigns.deletedAt),
      ),
    )
    .limit(1);

  return design ?? null;
}

/**
 * List available QR designs (platform-wide + org-specific).
 */
export async function listQrDesigns(
  organizationId?: string,
): Promise<QrDesign[]> {
  if (organizationId) {
    // Platform designs + org-specific designs
    const results = await db
      .select()
      .from(qrDesigns)
      .where(
        and(
          isNull(qrDesigns.deletedAt),
          eq(qrDesigns.isActive, true),
        ),
      )
      .orderBy(desc(qrDesigns.createdAt));

    // Filter: platform designs (orgId is null) or org-specific designs
    return results.filter(
      (d) => d.organizationId === null || d.organizationId === organizationId,
    );
  }

  // No org specified: platform designs only
  const results = await db
    .select()
    .from(qrDesigns)
    .where(
      and(
        isNull(qrDesigns.organizationId),
        eq(qrDesigns.isPlatform, true),
        eq(qrDesigns.isActive, true),
        isNull(qrDesigns.deletedAt),
      ),
    )
    .orderBy(desc(qrDesigns.createdAt));

  return results;
}
