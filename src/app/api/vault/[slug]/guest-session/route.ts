/**
 * API route: POST /api/vault/[slug]/guest-session
 *
 * Guest vault flow — create a scoped guest session for a published vault.
 * No authentication required by design: the vault slug is the public
 * share key. The server re-checks the upload window, package entitlement,
 * rotate cap and a light per-IP throttle before issuing a token.
 *
 * Guest-safe payload: the raw token is returned exactly once to the caller;
 * only its SHA-256 hash is persisted.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createVaultGuestSession } from "@/server/services/public-vault";
import {
  ForbiddenError,
  NotFoundError,
  RateLimitError,
} from "@/lib/auth/errors";

// ── Input Validation ───────────────────────────────────────────────────────────

const guestSessionSchema = z.object({
  displayName: z.string().trim().max(120, "Name too long").optional(),
}).strict();

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Best-effort client IP extraction. `x-forwarded-for` is the standard
 * proxy header; fall back to `x-real-ip` for direct deployments. Used only
 * for a coarse per-IP throttle approximation (no Redis in scope).
 */
function getClientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip");
  return realIp?.trim() || undefined;
}

// ── Route Handler ──────────────────────────────────────────────────────────────

async function handleGuestSession(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;

    const body = await request.json();
    const parsed = guestSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { displayName } = parsed.data;

    const result = await createVaultGuestSession(slug, {
      displayName,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[API/vault/[slug]/guest-session] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = handleGuestSession;