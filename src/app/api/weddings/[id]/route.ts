/**
 * PATCH /api/weddings/[id]
 *
 * Updates a tenant-scoped wedding dossier (details, package, status) and its
 * settings. Package changes re-resolve the product SKU.
 *
 * Guards: authenticated + tenant + MANAGE_WEDDING.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { customers, products, weddings, weddingSettings } from "@/lib/db/schema";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
  type RouteParams,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";
import { ForbiddenError } from "@/lib/auth/errors";

// ── Input Validation ─────────────────────────────────────────────────────────

const WEDDING_STATUSES = [
  "draft",
  "building",
  "active",
  "upload_closed",
  "download_only",
  "expired",
  "archived",
  "deletion_pending",
] as const;

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color");

const updateWeddingSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    partnerOneName: z.string().max(120).nullable().optional(),
    partnerTwoName: z.string().max(120).nullable().optional(),
    weddingDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "weddingDate must be YYYY-MM-DD")
      .nullable()
      .optional(),
    packageCode: z.enum(["silver", "gold", "platinum"]).nullable().optional(),
    status: z.enum(WEDDING_STATUSES).optional(),
    customerEmail: z.string().email().max(320).optional(),
    settings: z
      .object({
        themeColor: hexColor.optional(),
        accentColor: hexColor.optional(),
        allowGuestUploads: z.boolean().optional(),
        requireApproval: z.boolean().optional(),
        coupleStory: z.string().max(5000).nullable().optional(),
        customMessage: z.string().max(5000).nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

type UpdateWeddingBody = z.infer<typeof updateWeddingSchema>;

async function resolveProduct(
  organizationId: string,
  packageCode: "silver" | "gold" | "platinum",
): Promise<{ id: string } | null> {
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.code, packageCode),
        eq(products.status, "active"),
        isNull(products.deletedAt),
      ),
    )
    .limit(1);
  return product ?? null;
}

// ── Handler ──────────────────────────────────────────────────────────────────

async function handleUpdateWedding(
  request: NextRequest,
  context: { tenant: TenantContext; params: RouteParams },
) {
  try {
    const params = await context.params;
    const weddingId = params.id;
    const { tenant } = context;

    if (!weddingId || typeof weddingId !== "string") {
      return NextResponse.json({ error: "Invalid wedding ID" }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: weddings.id })
      .from(weddings)
      .where(
        and(
          eq(weddings.id, weddingId),
          eq(weddings.organizationId, tenant.organizationId),
          isNull(weddings.deletedAt),
        ),
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Wedding not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateWeddingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const input = parsed.data as UpdateWeddingBody;

    // Resolve package → product SKU when the package is changing.
    let productId: string | null | undefined;
    if (input.packageCode !== undefined) {
      if (input.packageCode === null) {
        productId = null;
      } else {
        const product = await resolveProduct(tenant.organizationId, input.packageCode);
        if (!product) {
          return NextResponse.json(
            { error: `Package "${input.packageCode}" is not available` },
            { status: 400 },
          );
        }
        productId = product.id;
      }
    }

    // Re-link the customer when an email is provided.
    let customerId: string | undefined;
    if (input.customerEmail) {
      const email = input.customerEmail.toLowerCase();
      let [customer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.organizationId, tenant.organizationId),
            eq(customers.email, email),
            isNull(customers.deletedAt),
          ),
        )
        .limit(1);
      if (!customer) {
        [customer] = await db
          .insert(customers)
          .values({
            organizationId: tenant.organizationId,
            publicId: Array.from(
              new Uint8Array(16),
              (b) => b.toString(16).padStart(2, "0"),
            ).join(""),
            fullName: input.name?.trim() || "Wedding customer",
            email,
          })
          .returning({ id: customers.id });
      }
      customerId = customer.id;
    }

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(weddings)
        .set({
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.partnerOneName !== undefined
            ? { partnerOneName: input.partnerOneName }
            : {}),
          ...(input.partnerTwoName !== undefined
            ? { partnerTwoName: input.partnerTwoName }
            : {}),
          ...(input.weddingDate !== undefined
            ? { weddingDate: input.weddingDate ? new Date(input.weddingDate) : null }
            : {}),
          ...(productId !== undefined ? { productId } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(customerId !== undefined ? { customerId } : {}),
        })
        .where(eq(weddings.id, weddingId))
        .returning();

      if (input.settings) {
        await tx
          .update(weddingSettings)
          .set({
            ...(input.settings.themeColor !== undefined
              ? { themeColor: input.settings.themeColor }
              : {}),
            ...(input.settings.accentColor !== undefined
              ? { accentColor: input.settings.accentColor }
              : {}),
            ...(input.settings.allowGuestUploads !== undefined
              ? { allowGuestUploads: input.settings.allowGuestUploads }
              : {}),
            ...(input.settings.requireApproval !== undefined
              ? { requireApproval: input.settings.requireApproval }
              : {}),
            ...(input.settings.coupleStory !== undefined
              ? { coupleStory: input.settings.coupleStory }
              : {}),
            ...(input.settings.customMessage !== undefined
              ? { customMessage: input.settings.customMessage }
              : {}),
            updatedBy: tenant.userId,
          })
          .where(eq(weddingSettings.weddingId, weddingId));
      }

      return [row];
    });

    return NextResponse.json({
      wedding: {
        id: updated.id,
        publicId: updated.publicId,
        code: updated.code,
        name: updated.name,
        status: updated.status,
        weddingDate: updated.weddingDate
          ? updated.weddingDate.toISOString().split("T")[0]
          : null,
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[API/weddings/[id]] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const PATCH = withAuth(
  withTenant(withPermission(Permission.MANAGE_WEDDING)(handleUpdateWedding)),
);