/**
 * Auth-related constants for the Wedding Memory Vault.
 */

/** Cookie configuration */
export const AUTH_COOKIE_OPTIONS = {
  /** Session cookie name used by NextAuth */
  SESSION_COOKIE_NAME: "authjs.session-token",
  /** Maximum session age in seconds (7 days) */
  SESSION_MAX_AGE: 7 * 24 * 60 * 60,
  /** Guest session max age in seconds (24 hours) */
  GUEST_SESSION_MAX_AGE: 24 * 60 * 60,
} as const;

/** Password policy */
export const PASSWORD_POLICY = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  BCRYPT_ROUNDS: 12,
} as const;

/** Guest upload defaults */
export const GUEST_DEFAULTS = {
  MAX_UPLOADS: 100,
  /** Rate limit: uploads per minute per guest */
  RATE_LIMIT_PER_MINUTE: 10,
  /** Token length in bytes (32 bytes = 256 bits of entropy) */
  TOKEN_BYTES: 32,
} as const;

/** API route paths */
export const API_ROUTES = {
  LOGIN: "/api/auth/login",
  REGISTER: "/api/auth/register",
  LOGOUT: "/api/auth/logout",
  SESSION: "/api/auth/session",
  SIGN_IN: "/api/auth/signin",
  SIGN_OUT: "/api/auth/signout",
} as const;
