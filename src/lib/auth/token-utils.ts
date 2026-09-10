/**
 * Pure cryptographic utilities for guest session tokens.
 *
 * Extracted from guest-sessions.ts so they can be tested and used
 * without pulling in the database module.
 */

import { randomBytes, createHash } from "node:crypto";
import { GUEST_DEFAULTS } from "@/lib/auth/constants";

/**
 * Generates a cryptographically secure random token.
 * Returns a hex-encoded string of `TOKEN_BYTES` bytes.
 */
export function generateToken(): string {
  return randomBytes(GUEST_DEFAULTS.TOKEN_BYTES).toString("hex");
}

/**
 * One-way SHA-256 hash of a raw token.
 * This is what gets stored in the database.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
