/**
 * Public base URL for guest-facing links (derived from NEXT_PUBLIC_APP_URL
 * with a localhost fallback for development).
 */
export function serverUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}