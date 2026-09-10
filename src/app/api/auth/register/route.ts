/**
 * POST /api/auth/register
 *
 * Creates a new user account with email + password.
 * Returns 201 on success, 4xx/5xx on validation or DB errors.
 *
 * SECURITY:
 *  - Passwords are bcrypt-hashed server-side (12 rounds).
 *  - No sensitive data is returned in the response.
 *  - Email uniqueness is enforced by DB partial unique index.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq, and, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { PASSWORD_POLICY } from "@/lib/auth/constants";

// ── Input Validation ────────────────────────────────────────────────────────

const registerSchema = z
  .object({
    email: z
      .string()
      .email("Invalid email address")
      .max(320, "Email too long"),
    password: z
      .string()
      .min(PASSWORD_POLICY.MIN_LENGTH, `Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters`)
      .max(PASSWORD_POLICY.MAX_LENGTH, `Password must be at most ${PASSWORD_POLICY.MAX_LENGTH} characters`),
    fullName: z
      .string()
      .min(1, "Full name is required")
      .max(200, "Full name too long")
      .optional(),
  })
  .strict();

// ── Route Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Parse + validate body
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { email, password, fullName } = parsed.data;

    // 2. Check for existing non-deleted user with same email
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, PASSWORD_POLICY.BCRYPT_ROUNDS);

    // 4. Insert user
    const [created] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        fullName: fullName ?? null,
        status: "active",
      })
      .returning({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
      });

    // 5. Return safe subset (no password hash, no internal IDs exposed to client)
    return NextResponse.json(
      {
        user: {
          id: created.id,
          email: created.email,
          createdAt: created.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    // Don't leak internal errors
    console.error("[REGISTER] Unhandled error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
