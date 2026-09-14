/**
 * PATCH /api/weddings/[id]
 *
 * Updates a tenant-scoped wedding dossier (details, package, status) and its
 * settings. Package changes re-resolve the product SKU.
 *
 * Manual-status and wedding-date semantics (Phase 13, ADR-001/ADR-011):
 *  - `status` is never written as a raw column. A manual status change is
 *    validated against the machine's `MANUAL_TRANSITIONS` whitelist
 *    (`isManualTransitionAllowed`) and applied through the engine's single
 *    CAS-guarded `transitionWeddingStatus` primitive (writes lifecycle_events
 *    + audit_logs, preserves the guard). Invalid manual transitions return 409.
 *    `deleted` cannot be set manually — it is only reached via the
 *    retention/purge tail.
 *  - a `weddingDate` (or package) change recalculates the expiry deadlines via
 *    `recalculateWeddingDeadlines` (upserts `expiry_rules`, records
 *    `wedding_date_changed` + `deadline_recalculated` lifecycle events). See
 *    ADR-001 "future wedding-date changes must be recalculated + audited".
 *    Recalculation requires both a wedding date and a package; clearing the
 *    date leaves the existing rule untouched (the sweep stops only when the
 *    retained deadlines elapse — a safe default for a date-less wedding).
 *
 * Guards: authenticated + tenant + MANAGE_WEDDING.
 */

import { NextRequest, NextResponse } from "next/server";
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
import {
  isManualTransitionAllowed,
  MANUAL_TRANSITIONS,
  transitionWeddingStatus,
  recalculateWeddingDeadlines,
  resolveWeddingPackageCode,
} from "@/server/lifecycle/engine";
import type { WeddingStatus } from "@/server/lifecycle/engine";
import { updateWeddingSchema, type UpdateWeddingBody } from "./schema";

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
      .select({ id: weddings.id, status: weddings.status, weddingDate: weddings.weddingDate })
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

    // Phase 13 manual-status validation happens BEFORE any write so invalid
    // transitions are rejected cleanly (409) with no partial update.
    const requestedStatus = input.status;
    const statusChanged =
      requestedStatus !== undefined && requestedStatus !== existing.status;
    if (statusChanged) {
      if (!isManualTransitionAllowed(existing.status, requestedStatus)) {
        return NextResponse.json(
          {
            error: `Manual transition ${existing.status} → ${requestedStatus} is not allowed`,
            allowedTransitions: MANUAL_TRANSITIONS[existing.status],
          },
          { status: 409 },
        );
      }
    }

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

    // ── Field updates (never `status`; the engine owns status mutations) ────
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

    // ── Manual status transition through the engine (CAS-guarded) ───────────
    let finalStatus: WeddingStatus = updated.status;
    let statusConflict: string | null = null;
    if (statusChanged && requestedStatus) {
      const result = await transitionWeddingStatus({
        weddingId,
        fromStatus: existing.status,
        toStatus: requestedStatus,
        reason: "Manual status change via API",
        actorUserId: tenant.userId,
        direction: "manual",
      });
      if (result.reason === "unexpected_status") {
        statusConflict = "Wedding status changed concurrently; retry the request";
      } else {
        finalStatus = requestedStatus;
      }
    }

    // ── Deadline recalculation on wedding-date / package change (ADR-001) ───
    const dateOrPackageChanged =
      input.weddingDate !== undefined || input.packageCode !== undefined;
    if (dateOrPackageChanged) {
      const effectiveDate =
        input.weddingDate !== undefined && input.weddingDate !== null
          ? input.weddingDate
          : existing.weddingDate
            ? existing.weddingDate.toISOString().slice(0, 10)
            : null;
      const packageCode =
        input.packageCode !== undefined && input.packageCode !== null
          ? input.packageCode
          : await resolveWeddingPackageCode(weddingId);

      if (effectiveDate && packageCode) {
        await recalculateWeddingDeadlines({
          weddingId,
          organizationId: tenant.organizationId,
          packageCode,
          newWeddingDate: effectiveDate,
          actorUserId: tenant.userId,
        });
      }
    }

    if (statusConflict) {
      return NextResponse.json({ error: statusConflict }, { status: 409 });
    }

    return NextResponse.json({
      wedding: {
        id: updated.id,
        publicId: updated.publicId,
        code: updated.code,
        name: updated.name,
        status: finalStatus,
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