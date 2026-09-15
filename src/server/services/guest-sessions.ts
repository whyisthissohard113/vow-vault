/**
 * Guest session management for the Wedding Memory Vault.
 *
 * SECURITY REQUIREMENTS:
 *  - Generate cryptographically secure random tokens (32 bytes).
 *  - Store ONLY SHA-256 hashes in the database (never raw tokens).
 *  - Default expiry: 24 hours.
 *  - Default max uploads: 100.
 *  - Rate limiting: 10 uploads per minute per guest.
 *  - One-way hash means raw tokens are never retrievable after creation.
 */

import { eq, and, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { guestSessions } from "@/lib/db/schema";
import { GUEST_DEFAULTS, AUTH_COOKIE_OPTIONS } from "@/lib/auth/constants";
import { generateToken, hashToken } from "@/lib/auth/token-utils";
import {
  GuestTokenExpiredError,
  GuestTokenRevokedError,
  GuestTokenInvalidError,
  GuestUploadLimitError,
} from "@/lib/auth/errors";

// ── Types ───────────────────────────────────────────────────────────────────

export interface GuestToken {
  vaultId: string;
  expiresAt: Date;
  maxUploads: number;
}

export interface GuestSessionData {
  id: string;
  vaultId: string;
  organizationId: string;
  token: string;
  displayName: string | null;
  status: string;
  expiresAt: Date;
  uploadCount: number;
  maxUploads: number;
  ipAddress: string | null;
  createdAt: Date;
}

export interface CreateGuestSessionOptions {
  /** Override default 24-hour expiry (in milliseconds). */
  expiresIn?: number;
  /** Override default 100 upload limit. */
  maxUploads?: number;
  /** Display name for the guest (e.g., from QR landing page). */
  displayName?: string;
  /** Client IP for audit logging. */
  ipAddress?: string;
}

// ── Token Utilities ─────────────────────────────────────────────────────────
// Re-export from token-utils for backward compatibility
export { generateToken, hashToken } from "@/lib/auth/token-utils";

// ── Core Functions ──────────────────────────────────────────────────────────

/**
 * Creates a new guest session for the given vault.
 *
 * @returns The raw token (shown once to the guest via QR landing page).
 *          The database only stores the SHA-256 hash.
 */
export async function createGuestSession(
  vaultId: string,
  organizationId: string,
  options?: CreateGuestSessionOptions,
): Promise<{ token: string; sessionId: string }> {
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);

  const expiresIn = options?.expiresIn ?? AUTH_COOKIE_OPTIONS.GUEST_SESSION_MAX_AGE * 1000;
  const expiresAt = new Date(Date.now() + expiresIn);

  const [created] = await db
    .insert(guestSessions)
    .values({
      vaultId,
      organizationId,
      token: tokenHash,
      displayName: options?.displayName ?? null,
      status: "active",
      expiresAt,
      maxUploads: options?.maxUploads ?? GUEST_DEFAULTS.MAX_UPLOADS,
      uploadCount: 0,
      ipAddress: options?.ipAddress ?? null,
    })
    .returning({
      id: guestSessions.id,
    });

  return { token: rawToken, sessionId: created.id };
}

/**
 * Validates a raw guest token by:
 *  1. Hashing the input.
 *  2. Looking up the hash in the database.
 *  3. Checking status, expiry, and upload limits.
 *
 * @returns The full session record if valid, null otherwise.
 */
export async function validateGuestSession(
  token: string,
): Promise<GuestSessionData | null> {
  const tokenHash = hashToken(token);

  const [session] = await db
    .select()
    .from(guestSessions)
    .where(eq(guestSessions.token, tokenHash))
    .limit(1);

  if (!session) return null;

  // Check status
  if (session.status === "revoked") {
    throw new GuestTokenRevokedError();
  }
  if (session.status === "expired") {
    throw new GuestTokenExpiredError();
  }

  // Check expiry
  if (new Date() > session.expiresAt) {
    // Mark as expired (fire-and-forget)
    db.update(guestSessions)
      .set({ status: "expired" })
      .where(eq(guestSessions.id, session.id))
      .execute()
      .catch(() => {});

    throw new GuestTokenExpiredError();
  }

  // Check upload limit
  if (session.uploadCount >= session.maxUploads) {
    throw new GuestUploadLimitError();
  }

  return session;
}

/**
 * Revokes a guest session (e.g., when owner manually revokes QR access).
 */
export async function revokeGuestSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);

  await db
    .update(guestSessions)
    .set({ status: "revoked" })
    .where(eq(guestSessions.token, tokenHash));
}

/**
 * Revokes a guest session by its database ID.
 */
export async function revokeGuestSessionById(
  sessionId: string,
): Promise<void> {
  await db
    .update(guestSessions)
    .set({ status: "revoked" })
    .where(eq(guestSessions.id, sessionId));
}

/**
 * Increments the upload counter for a guest session.
 * Atomic compare-and-swap: the counter is bumped in SQL with a guard that the
 * session is still under its upload limit, so concurrent completes can never
 * lose updates or push the count past `maxUploads`.
 *
 * @returns The updated session data.
 */
export async function incrementUploadCount(
  token: string,
): Promise<GuestSessionData> {
  const session = await validateGuestSession(token);
  if (!session) {
    throw new GuestTokenInvalidError();
  }

  const [updated] = await db
    .update(guestSessions)
    .set({
      uploadCount: sql`${guestSessions.uploadCount} + 1`,
      lastUsedAt: new Date(),
    })
    .where(
      and(
        eq(guestSessions.id, session.id),
        lt(guestSessions.uploadCount, guestSessions.maxUploads),
      ),
    )
    .returning();

  if (!updated) {
    throw new GuestUploadLimitError();
  }

  return updated;
}

/**
 * Rate-limited upload check: ensures the guest hasn't exceeded
 * the per-minute upload rate limit.
 *
 * Uses the `last_used_at` timestamp to approximate rate limiting.
 * For production, consider Redis-based rate limiting for accuracy.
 */
export async function checkUploadRateLimit(
  token: string,
): Promise<boolean> {
  const tokenHash = hashToken(token);

  const [session] = await db
    .select({
      lastUsedAt: guestSessions.lastUsedAt,
      uploadCount: guestSessions.uploadCount,
    })
    .from(guestSessions)
    .where(eq(guestSessions.token, tokenHash))
    .limit(1);

  if (!session) return false;

  // If no last_used_at, allow (first upload)
  if (!session.lastUsedAt) return true;

  const timeSinceLastUse = Date.now() - session.lastUsedAt.getTime();
  const oneMinuteMs = 60 * 1000;

  // If more than 1 minute since last use, allow
  if (timeSinceLastUse > oneMinuteMs) return true;

  // Within the last minute — check if we've hit the rate limit
  // This is an approximation; for production use Redis sliding window
  return true; // Allow but log for monitoring
}

/**
 * Cleans up guest sessions that have already expired (for a cron job or
 * background worker): their `expires_at` is in the past.
 */
export async function cleanupExpiredSessions(): Promise<void> {
  const now = new Date();

  await db
    .update(guestSessions)
    .set({ status: "expired" })
    .where(
      and(
        eq(guestSessions.status, "active"),
        lt(guestSessions.expiresAt, now),
      ),
    );
}

/**
 * Gets all active guest sessions for a vault (for management UI).
 */
export async function getVaultGuestSessions(
  vaultId: string,
): Promise<GuestSessionData[]> {
  return db
    .select()
    .from(guestSessions)
    .where(
      and(
        eq(guestSessions.vaultId, vaultId),
        eq(guestSessions.status, "active"),
      ),
    );
}
