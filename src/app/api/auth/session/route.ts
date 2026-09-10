/**
 * GET /api/auth/session
 *
 * Returns the current authenticated session or null.
 * NextAuth already provides this via /api/auth/session, but we expose
 * our own for consistency and to control the response shape.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ session: null });
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error("[SESSION] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
