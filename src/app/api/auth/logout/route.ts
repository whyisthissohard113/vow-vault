/**
 * POST /api/auth/logout
 *
 * Signs out the current user by invalidating the session cookie.
 * Uses NextAuth's built-in signOut which clears the JWT cookie.
 */

import { NextResponse } from "next/server";
import { signOut } from "@/auth";

export async function POST() {
  try {
    await signOut({ redirect: false });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[LOGOUT] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
