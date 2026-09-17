/**
 * Site-wide marketing configuration.
 *
 * Plain data + environment-derived values only — no React, no components —
 * so a future admin CMS can drive the marketing site from this shape.
 */

export const SITE_NAME = "Vow Vault";
export const SITE_TAGLINE = "Your wedding day. Captured by everyone. Preserved forever.";
export const SITE_DESCRIPTION =
  "One digital vault for your entire wedding memory. Guests scan a QR code, upload photos and videos from their phones, and every moment lands in your private vault — no app, no guest accounts, no setup.";

/** Public origin used for metadata/sitemap. Overridden at runtime by env. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Absolute URL helper for routing and structured data. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The primary conversion action used across the marketing site. */
export const PRIMARY_CTA = {
  label: "Create Your Vault",
  href: "/register",
} as const;

export const SECONDARY_CTA = {
  label: "See How It Works",
  href: "/how-it-works",
} as const;