/**
 * POST /api/weddings
 *
 * Creates a tenant-scoped wedding dossier (draft). Assigns a customer
 * (find-or-create by email), resolves the package to a product SKU, and
 * records optional wedding settings.
 *
 * Guards: authenticated + tenant + CREATE_WEDDING.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { eq, and, isNull, or, desc } from "drizzle-orm";

import { db } from "@/lib/db";
import { customers, products, weddings, weddingSettings } from "@/lib/db/schema";
import {
  withAuth,
  withTenant,
  withPermission,
  Permission,
} from "@/server/middleware/auth";
import type { TenantContext } from "@/server/middleware/tenant";

// ── Input Validation ─────────────────────────────────────────────────────────

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color");

const createWeddingSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(200),
    partnerOneName: z.string().max(120).optional(),
    partnerTwoName: z.string().max(120).optional(),
    weddingDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "weddingDate must be YYYY-MM-DD")
      .optional(),
    packageCode: z.enum(["silver", "gold", "platinum"]).optional(),
    customerName: z.string().min(1).max(200).optional(),
    customerEmail: z.string().email().max(320).optional(),
    settings: z
      .object({
        themeColor: hexColor.optional(),
        accentColor: hexColor.optional(),
        allowGuestUploads: z.boolean().optional(),
        requireApproval: z.boolean().optional(),
        coupleStory: z.string().max(5000).optional(),
        customMessage: z.string().max(5000).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

// ── Helpers ──────────────────────────────────────────────────────────────────

function generatePublicId(): string {
  return randomBytes(16).toString("hex");
}

async function generateWeddingCode(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `WED-${year}-`;
  const rows = await db
    .select({ code: weddings.code })
    .from(weddings)
    .where(
      and(
        eq(weddings.organizationId, organizationId),
        isNull(weddings.deletedAt),
      ),
    );
  const sequence = rows.length + 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "wedding";
}

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
        or(eq(products.organizationId, organizationId), isNull(products.organizationId)),
        eq(products.status, "active"),
        isNull(products.deletedAt),
      ),
    )
    .orderBy(desc(products.sortOrder))
    .limit(1);
  return product ?? null;
}

// ── Handler ──────────────────────────────────────────────────────────────────

async function handleCreateWedding(
  request: NextRequest,
  context: { tenant: TenantContext },
) {
  try {
    const body = await request.json();
    const parsed = createWeddingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { tenant } = context;
    const input = parsed.data;

    // Resolve package → product SKU (platform-wide or tenant-scoped).
    let productId: string | null = null;
    if (input.packageCode) {
      const product = await resolveProduct(tenant.organizationId, input.packageCode);
      if (!product) {
        return NextResponse.json(
          { error: `Package "${input.packageCode}" is not available` },
          { status: 400 },
        );
      }
      productId = product.id;
    }

    // Find-or-create the customer (tenant-scoped by email). The weddings table
    // requires a customer; when the wizard did not supply one we create a
    // clearly-internal placeholder instead of leaving a dangling reference.
    const email = (input.customerEmail ?? "").trim().toLowerCase();
    const customerKey = email || `wedding-customer-${generatePublicId()}@wedding-vault.local`;
    const customerFullName = (input.customerName ?? "").trim() || "Wedding customer";

    let [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.organizationId, tenant.organizationId),
          eq(customers.email, customerKey),
          isNull(customers.deletedAt),
        ),
      )
      .limit(1);

    if (!customer) {
      [customer] = await db
        .insert(customers)
        .values({
          organizationId: tenant.organizationId,
          publicId: generatePublicId(),
          fullName: customerFullName,
          email: customerKey,
        })
        .returning({ id: customers.id });
    }
    const customerId = customer.id;

    const publicId = generatePublicId();
    const code = await generateWeddingCode(tenant.organizationId);
    const defaultName = [input.partnerOneName, input.partnerTwoName]
      .filter(Boolean)
      .join(" & ");
    const name = input.name.trim() || defaultName || "New wedding";

    const [wedding] = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(weddings)
        .values({
          organizationId: tenant.organizationId,
          customerId,
          productId,
          publicId,
          code,
          name,
          partnerOneName: input.partnerOneName ?? null,
          partnerTwoName: input.partnerTwoName ?? null,
          weddingDate: input.weddingDate ? new Date(input.weddingDate) : null,
          status: "draft",
        })
        .returning();

      await tx.insert(weddingSettings).values({
        weddingId: created.id,
        themeColor: input.settings?.themeColor ?? "#8B5E3C",
        accentColor: input.settings?.accentColor ?? "#D4AF37",
        coupleStory: input.settings?.coupleStory ?? null,
        customMessage: input.settings?.customMessage ?? null,
        allowGuestUploads: input.settings?.allowGuestUploads ?? true,
        requireApproval: input.settings?.requireApproval ?? false,
        updatedBy: tenant.userId,
      });

      return [created];
    });

    return NextResponse.json(
      {
        wedding: {
          id: wedding.id,
          publicId,
          code,
          name,
          status: wedding.status,
          weddingDate: input.weddingDate ?? null,
          slug: slugify(`${input.partnerOneName ?? ""}-${input.partnerTwoName ?? name}`),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[API/weddings] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withAuth(
  withTenant(withPermission(Permission.CREATE_WEDDING)(handleCreateWedding)),
);