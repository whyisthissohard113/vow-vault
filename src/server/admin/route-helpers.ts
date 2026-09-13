/**
 * Shared helpers for Platform Admin API routes.
 *
 * Route guards always run first (withAuth → withTenant → withPermission), so
 * every handler below can assume a validated platform session. These helpers
 * only standardize query parsing, request metadata extraction and error
 * mapping — no authorization decisions happen here.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { AdminRequestMeta } from "@/server/services/admin-service";
import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";

// ── Query parsing ──────────────────────────────────────────────────────────────

export const adminListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().optional(),
    search: z.string().trim().max(200).optional(),
    status: z.string().trim().max(60).optional(),
    organizationId: z.string().uuid().optional(),
  })
  .strict();

export function parseAdminListQuery(request: NextRequest): z.infer<typeof adminListQuerySchema> {
  const { searchParams } = new URL(request.url);
  const parsed = adminListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    organizationId: searchParams.get("organizationId") ?? undefined,
  });
  if (!parsed.success) {
    throw new InvalidQueryError(parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}

export class InvalidQueryError extends Error {
  constructor(public details: unknown) {
    super("Invalid query parameters");
    this.name = "InvalidQueryError";
  }
}

/** Migration-state read uses `eventType`, audit logs use `action`/`resourceType`. */
export const auditListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().optional(),
    search: z.string().trim().max(200).optional(),
    organizationId: z.string().uuid().optional(),
    action: z.string().trim().max(120).optional(),
    resourceType: z.string().trim().max(80).optional(),
    resourceId: z.string().uuid().optional(),
  })
  .strict();

export function parseAuditListQuery(request: NextRequest): z.infer<typeof auditListQuerySchema> {
  const { searchParams } = new URL(request.url);
  const parsed = auditListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    organizationId: searchParams.get("organizationId") ?? undefined,
    action: searchParams.get("action") ?? undefined,
    resourceType: searchParams.get("resourceType") ?? undefined,
    resourceId: searchParams.get("resourceId") ?? undefined,
  });
  if (!parsed.success) {
    throw new InvalidQueryError(parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}

// ── Write body parsing ─────────────────────────────────────────────────────────

/**
 * Every admin mutation requires an explicit `confirm: true` in the JSON body.
 * This is the server-side double-confirm gate for irreversible/impactful
 * lifecycle actions.
 */
export const adminConfirmSchema = z
  .object({
    confirm: z.literal(true),
    reason: z.string().trim().max(255).optional(),
  })
  .strict();

export async function parseAdminConfirmBody(request: NextRequest): Promise<{ reason?: string }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new InvalidQueryError("Request body must be valid JSON");
  }
  const parsed = adminConfirmSchema.safeParse(body);
  if (!parsed.success) {
    throw new InvalidQueryError(parsed.error.flatten().fieldErrors);
  }
  return { reason: parsed.data.reason };
}

// ── Request metadata (audit) ───────────────────────────────────────────────────

export function getClientMeta(request: NextRequest): AdminRequestMeta {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ipAddress = (forwarded ?? realIp ?? "")
    .split(",")[0]!
    .trim()
    .slice(0, 45) || undefined;
  const userAgent = request.headers.get("user-agent")?.trim().slice(0, 500) || undefined;
  return { ipAddress, userAgent };
}

// ── Error mapping ──────────────────────────────────────────────────────────────

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof InvalidQueryError) {
    return NextResponse.json({ error: error.message, details: error.details }, { status: 400 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  console.error("[Admin API] Error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}