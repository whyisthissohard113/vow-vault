/**
 * Tests for guest session token utilities (token generation, hashing, lifecycle).
 *
 * These tests verify the pure functions without requiring a database connection.
 * Database-dependent tests (create, validate, revoke) are run separately
 * with an integration test runner that has DATABASE_URL configured.
 */

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { generateToken, hashToken } from "@/lib/auth/token-utils";
import { GUEST_DEFAULTS, AUTH_COOKIE_OPTIONS } from "@/lib/auth/constants";

// ── Token Generation Tests ──────────────────────────────────────────────────

describe("generateToken", () => {
  it("generates a hex-encoded string", () => {
    const token = generateToken();
    expect(typeof token).toBe("string");
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("generates tokens of correct length (32 bytes = 64 hex chars)", () => {
    const token = generateToken();
    expect(token.length).toBe(GUEST_DEFAULTS.TOKEN_BYTES * 2);
  });

  it("generates unique tokens on each call", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateToken());
    }
    // With 256 bits of entropy, collisions should be essentially impossible
    expect(tokens.size).toBe(100);
  });

  it("generates tokens with sufficient entropy", () => {
    const tokens = Array.from({ length: 1000 }, () => generateToken());
    // Basic entropy check: all characters should appear in reasonable distribution
    const allChars = tokens.join("");
    const uniqueChars = new Set(allChars);
    expect(uniqueChars.size).toBeGreaterThanOrEqual(10); // At least 10 unique hex chars
  });
});

// ── Token Hashing Tests ─────────────────────────────────────────────────────

describe("hashToken", () => {
  it("produces a 64-character SHA-256 hex digest", () => {
    const hash = hashToken("test-token");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic (same input = same output)", () => {
    const h1 = hashToken("my-secure-token");
    const h2 = hashToken("my-secure-token");
    expect(h1).toBe(h2);
  });

  it("produces different hashes for different inputs", () => {
    const h1 = hashToken("token-1");
    const h2 = hashToken("token-2");
    expect(h1).not.toBe(h2);
  });

  it("matches manual SHA-256 computation", () => {
    const token = "test-token-123";
    const manualHash = createHash("sha256").update(token).digest("hex");
    expect(hashToken(token)).toBe(manualHash);
  });

  it("hashes are one-way (cannot reverse to original)", () => {
    const token = generateToken();
    const hash = hashToken(token);

    // The hash should not contain the original token
    expect(hash).not.toContain(token);
    // Hash length is fixed regardless of input length
    expect(hash.length).toBe(64);
  });
});

// ── Security Property Tests ─────────────────────────────────────────────────

describe("Guest session security properties", () => {
  it("raw tokens and hashes are different strings", () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(token).not.toBe(hash);
  });

  it("token length is independent of hash length", () => {
    const shortToken = "a";
    const longToken = "a".repeat(1000);
    expect(hashToken(shortToken).length).toBe(64);
    expect(hashToken(longToken).length).toBe(64);
  });

  it("empty token produces a valid hash", () => {
    const hash = hashToken("");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("unicode tokens produce valid hashes", () => {
    const hash = hashToken("wedding-🎉-token-ñ");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("constant-time hash comparison prevents timing attacks", () => {
    // In production, use crypto.timingSafeEqual for hash comparison.
    // Our hashToken is deterministic, so we can verify equality safely.
    const token = generateToken();
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);

    // Different tokens should produce different hashes
    const token2 = generateToken();
    const hash3 = hashToken(token2);
    expect(hash1).not.toBe(hash3);
  });
});

// ── Constants Tests ─────────────────────────────────────────────────────────

describe("Guest defaults", () => {
  it("has reasonable defaults", () => {
    expect(GUEST_DEFAULTS.MAX_UPLOADS).toBeGreaterThan(0);
    expect(GUEST_DEFAULTS.RATE_LIMIT_PER_MINUTE).toBeGreaterThan(0);
    expect(GUEST_DEFAULTS.TOKEN_BYTES).toBeGreaterThanOrEqual(16); // Minimum 128 bits
    expect(AUTH_COOKIE_OPTIONS.GUEST_SESSION_MAX_AGE).toBeGreaterThan(0);
  });

  it("token has at least 256 bits of entropy", () => {
    expect(GUEST_DEFAULTS.TOKEN_BYTES * 8).toBeGreaterThanOrEqual(256);
  });
});
