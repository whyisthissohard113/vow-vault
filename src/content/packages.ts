/**
 * Marketing layer over the canonical package data in
 * `src/lib/entitlements/packages.ts`.
 *
 * Prices, feature flags and expiry windows are always sourced from the
 * canonical entitlements module so the marketing site can never diverge
 * from the product reality.
 */

import {
  PACKAGE_FEATURES,
  PackageCode,
  type PackageFeatureValues,
} from "@/lib/entitlements/packages";
import { formatCurrency } from "@/lib/format";

export interface PackageMarketing {
  code: PackageCode;
  name: string;
  priceLabel: string;
  emotionalTitle: string;
  emotionalBlurb: string;
  tagline: string;
  badge?: string;
  ctaLabel: string;
  highlights: string[];
  uploadDays: number;
  downloadDays: number;
  features: PackageFeatureValues;
}

export interface ComparisonFeature {
  label: string;
  tier: "all" | "gold" | "platinum";
  note?: string;
}

function features(code: PackageCode): PackageFeatureValues {
  return PACKAGE_FEATURES[code];
}

function uploadDays(code: PackageCode): number {
  return (features(code).upload_days as number) ?? 2;
}

function downloadDays(code: PackageCode): number {
  return (features(code).download_days as number) ?? 7;
}

export const PACKAGES: readonly PackageMarketing[] = [
  {
    code: PackageCode.SILVER,
    name: "Silver",
    priceLabel: formatCurrency(59900, "ZAR"),
    emotionalTitle: "The Perfect Start",
    emotionalBlurb:
      "Capture the basics beautifully. Photo gallery, guest uploads, custom colours — everything you need to keep the memories safe.",
    tagline: "Every guest. Every photo. Safe forever.",
    ctaLabel: "Choose Silver",
    highlights: [
      "Photo gallery with up to 500 photos",
      "QR code for guest uploads",
      "Custom theme & accent colours",
      "Wedding date and couple names display",
      "Uploads open 2 days after the wedding",
      "Downloads open for 7 days",
      "Email support",
    ],
    uploadDays: uploadDays(PackageCode.SILVER),
    downloadDays: downloadDays(PackageCode.SILVER),
    features: features(PackageCode.SILVER),
  },
  {
    code: PackageCode.GOLD,
    name: "Gold",
    priceLabel: formatCurrency(79900, "ZAR"),
    emotionalTitle: "The Complete Experience",
    emotionalBlurb:
      "Everything Silver delivers — plus video, live slideshow, a custom banner and unlimited photos. The complete wedding memory experience.",
    tagline: "Every angle. Every laugh. Every dance.",
    badge: "MOST LOVED",
    ctaLabel: "Choose Gold",
    highlights: [
      "Everything in Silver",
      "Unlimited photo uploads",
      "Video uploads (up to 10)",
      "Live slideshow",
      "Custom banner image",
      "Uploads open 7 days after the wedding",
      "Downloads open for 30 days",
      "Priority support",
    ],
    uploadDays: uploadDays(PackageCode.GOLD),
    downloadDays: downloadDays(PackageCode.GOLD),
    features: features(PackageCode.GOLD),
  },
  {
    code: PackageCode.PLATINUM,
    name: "Platinum",
    priceLabel: formatCurrency(109900, "ZAR"),
    emotionalTitle: "The Ultimate Keepsake",
    emotionalBlurb:
      "The full Gold experience plus intro video, interactive flipbook and custom QR design cards. 90 days to download. A keepsake for life.",
    tagline: "Preserved forever. The ultimate gift.",
    ctaLabel: "Choose Platinum",
    highlights: [
      "Everything in Gold",
      "Unlimited photo AND video uploads",
      "Interactive digital flipbook",
      "Custom QR design cards (PNG/PDF)",
      "Intro video or image",
      "Uploads open 7 days after the wedding",
      "Downloads open for 90 days",
      "Priority support",
    ],
    uploadDays: uploadDays(PackageCode.PLATINUM),
    downloadDays: downloadDays(PackageCode.PLATINUM),
    features: features(PackageCode.PLATINUM),
  },
] as const;

/** Features used in the comparison table (front-page + /packages). */
export const COMPARISON_ROWS: readonly ComparisonFeature[] = [
  { label: "Photo gallery", tier: "all" },
  { label: "QR guest upload code", tier: "all" },
  { label: "Custom theme & accent colours", tier: "all" },
  { label: "Guest names & messages", tier: "all" },
  { label: "Unlimited photo uploads", tier: "gold", note: "Fair-use limit: 500 on Silver" },
  { label: "Video uploads", tier: "gold" },
  { label: "Live slideshow", tier: "gold" },
  { label: "Custom banner image", tier: "gold" },
  { label: "Interactive flipbook", tier: "platinum" },
  { label: "Custom QR design cards", tier: "platinum" },
  { label: "Intro video / image", tier: "platinum" },
  { label: "Upload window (days)", tier: "all" },
  { label: "Download window (days)", tier: "all" },
] as const;

export function hasComparisonFeature(code: PackageCode, tier: "gold" | "platinum"): boolean {
  if (tier === "gold") {
    return code === PackageCode.GOLD || code === PackageCode.PLATINUM;
  }
  return code === PackageCode.PLATINUM;
}