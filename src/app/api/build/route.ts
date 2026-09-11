/**
 * API route: POST /api/build
 *
 * Enqueue a wedding build job.
 * Requires: weddingId (or organizationId + customerId + productId for new wedding)
 * Returns: buildJobId, status
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { weddings, buildJobs } from "@/lib/db/schema";
import { enqueueBuild } from "@/server/services/build-engine";
import { requireTenant, validateTenantAccess, type TenantContext } from "@/server/middleware/tenant";
import { withAuth, withTenant, RouteParams } from "@/server/middleware/auth";
import { withPermission, Permission } from "@/server/middleware/auth";
import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";

// ── Input Validation ───────────────────────────────────────────────────────────

const buildRequestSchema = z.object({
  weddingId: z.string().uuid("Invalid wedding ID"),
  idempotencyKey: z.string().min(1).max(200).optional(),
  version: z.number().int().positive().optional(),
  templateId: z.string().uuid().optional(),
}).strict();

type BuildRequest = z.infer<typeof buildRequestSchema>;

// ── Route Handler ──────────────────────────────────────────────────────────────

async function handleBuild(request: NextRequest, context: { tenant: TenantContext }) {
  try {
    const body = await request.json();
    const parsed = buildRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { weddingId, idempotencyKey, version, templateId } = parsed.data;
    const { tenant } = context;

    // Verify wedding exists and belongs to tenant
    const [wedding] = await db
      .select({
        id: weddings.id,
        organizationId: weddings.organizationId,
        customerId: weddings.customerId,
        productId: weddings.productId,
        status: weddings.status,
      })
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

    // Validate tenant access
    validateTenantAccess(tenant, wedding.organizationId);

    // Check if wedding is in a buildable state
    if (wedding.status === "deleted") {
      return NextResponse.json({ error: "Cannot build deleted wedding" }, { status: 400 });
    }

    if (!wedding.productId) {
      return NextResponse.json({ error: "Wedding has no product assigned" }, { status: 400 });
    }

    // Generate idempotency key if not provided
    const finalIdempotencyKey = idempotencyKey ?? `build_${weddingId}_${version ?? 1}_${Date.now()}`;

    // Check if build already exists for this idempotency key
    const [existingBuild] = await db
      .select({ id: buildJobs.id, status: buildJobs.status })
      .from(buildJobs)
      .where(eq(buildJobs.idempotencyKey, finalIdempotencyKey))
      .limit(1);

    if (existingBuild) {
      return NextResponse.json(
        {
          buildJobId: existingBuild.id,
          status: existingBuild.status,
          message: "Build already exists for this idempotency key",
        },
        { status: 200 },
      );
    }

    // Enqueue build
    const result = await enqueueBuild({
      weddingId: wedding.id,
      organizationId: wedding.organizationId,
      customerId: wedding.customerId,
      productId: wedding.productId,
      idempotencyKey: finalIdempotencyKey,
      version: version ?? 1,
      templateId,
      actorUserId: tenant.userId,
    });

    return NextResponse.json(result, { status: result.isNew ? 201 : 200 });
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof NotFoundError ? 404 : 403 });
    }
    console.error("[API/build] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Composed Guards ────────────────────────────────────────────────────────────

// Require auth + tenant + MANAGE_WEDDING permission
export const POST = withAuth(
  withTenant(
    withPermission(Permission.MANAGE_WEDDING)(handleBuild),
  ),
);