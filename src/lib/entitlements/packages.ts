/**
 * Product package definitions and entitlements.
 *
 * This module defines the three packages (Silver, Gold, Platinum)
 * and their feature values. This is the canonical source for
 * what each package includes.
 */

import type { FeatureCode } from "./features";

/**
 * Package codes as defined in MASTER_SPEC.
 */
export const PackageCode = {
  SILVER: "silver",
  GOLD: "gold",
  PLATINUM: "platinum",
} as const;

export type PackageCode = (typeof PackageCode)[keyof typeof PackageCode];

/**
 * Package metadata for display and pricing.
 */
export interface PackageMetadata {
  code: PackageCode;
  name: string;
  description: string;
  priceCents: number;
  currency: "ZAR";
  sortOrder: number;
}

/**
 * Package metadata for the three tiers.
 */
export const PACKAGE_METADATA: readonly PackageMetadata[] = [
  {
    code: PackageCode.SILVER,
    name: "Silver",
    description: "Basic setup with photo gallery and guest uploads",
    priceCents: 59900, // R599.00
    currency: "ZAR",
    sortOrder: 1,
  },
  {
    code: PackageCode.GOLD,
    name: "Gold",
    description: "Silver + video, slideshow, banner, unlimited photos",
    priceCents: 79900, // R799.00
    currency: "ZAR",
    sortOrder: 2,
  },
  {
    code: PackageCode.PLATINUM,
    name: "Platinum",
    description: "Gold + intro, flipbook, QR design cards, extended download",
    priceCents: 109900, // R1099.00
    currency: "ZAR",
    sortOrder: 3,
  },
] as const;

/**
 * Feature values for each package.
 * These values are stored in product_feature_values table.
 */
export type PackageFeatureValues = Record<FeatureCode, unknown>;

const SILVER_FEATURES: PackageFeatureValues = {
  // Core
  photos: true,
  guest_uploads: true,
  max_photos: 500, // Fair-use limit
  // Media
  video: false,
  max_videos: 0,
  banner: false,
  intro: false,
  // Display
  slideshow: false,
  flipbook: false,
  // Customization
  custom_qr: true,
  qr_design_card: false,
  optional_colours: true,
  names_date: true,
  // Expiry (from wedding date in Africa/Johannesburg)
  upload_days: 2, // +48 hours
  download_days: 7,
  // Entitlements
  unlimited_photos: false,
  unlimited_videos: false,
};

const GOLD_FEATURES: PackageFeatureValues = {
  ...SILVER_FEATURES,
  // Media upgrades
  video: true,
  max_videos: 10, // Fair-use limit
  banner: true,
  // Display upgrades
  slideshow: true,
  // Entitlements
  unlimited_photos: true, // Commercial entitlement; fair-use still applies
  max_photos: -1, // -1 indicates unlimited entitlement
  // Expiry
  upload_days: 7,
  download_days: 30,
};

const PLATINUM_FEATURES: PackageFeatureValues = {
  ...GOLD_FEATURES,
  // Media upgrades
  intro: true,
  max_videos: -1, // Unlimited video entitlement
  unlimited_videos: true,
  // Display upgrades
  flipbook: true,
  // Customization upgrades
  qr_design_card: true,
  // Expiry
  download_days: 90,
};

/**
 * Complete feature values for each package.
 */
export const PACKAGE_FEATURES: Record<PackageCode, PackageFeatureValues> = {
  [PackageCode.SILVER]: SILVER_FEATURES,
  [PackageCode.GOLD]: GOLD_FEATURES,
  [PackageCode.PLATINUM]: PLATINUM_FEATURES,
} as const;

/**
 * Get metadata for a package.
 */
export function getPackageMetadata(code: PackageCode): PackageMetadata | undefined {
  return PACKAGE_METADATA.find((p) => p.code === code);
}

/**
 * Get all package codes.
 */
export function getAllPackageCodes(): PackageCode[] {
  return PACKAGE_METADATA.map((p) => p.code);
}

/**
 * Get feature values for a package.
 */
export function getPackageFeatures(code: PackageCode): PackageFeatureValues {
  return PACKAGE_FEATURES[code] ?? SILVER_FEATURES;
}

/**
 * Get a specific feature value for a package.
 */
export function getPackageFeature<T = unknown>(
  code: PackageCode,
  featureCode: FeatureCode,
): T | undefined {
  return PACKAGE_FEATURES[code]?.[featureCode] as T | undefined;
}

/**
 * Check if a package has a boolean feature enabled.
 */
export function packageHasFeature(code: PackageCode, featureCode: FeatureCode): boolean {
  const value = getPackageFeature(code, featureCode);
  return value === true;
}

/**
 * Get integer feature value for a package (e.g., max_photos, upload_days).
 */
export function getPackageIntegerFeature(code: PackageCode, featureCode: FeatureCode): number {
  const value = getPackageFeature(code, featureCode);
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseInt(value, 10);
  return 0;
}

/**
 * Check if a package has unlimited entitlement for a resource.
 */
export function packageHasUnlimited(code: PackageCode, resource: "photos" | "videos"): boolean {
  if (resource === "photos") return packageHasFeature(code, "unlimited_photos");
  if (resource === "videos") return packageHasFeature(code, "unlimited_videos");
  return false;
}

/**
 * Get the fair-use limit for a resource in a package.
 * Returns -1 for unlimited entitlement (technical limits still apply).
 */
export function getPackageFairUseLimit(code: PackageCode, resource: "photos" | "videos"): number {
  if (resource === "photos") return getPackageIntegerFeature(code, "max_photos");
  if (resource === "videos") return getPackageIntegerFeature(code, "max_videos");
  return 0;
}

/**
 * Get expiry window days for a package.
 */
export function getPackageExpiryWindows(code: PackageCode): {
  uploadDays: number;
  downloadDays: number;
} {
  return {
    uploadDays: getPackageIntegerFeature(code, "upload_days"),
    downloadDays: getPackageIntegerFeature(code, "download_days"),
  };
}

/**
 * Check if package A is an upgrade of package B.
 */
export function isPackageUpgrade(from: PackageCode, to: PackageCode): boolean {
  const order = { [PackageCode.SILVER]: 1, [PackageCode.GOLD]: 2, [PackageCode.PLATINUM]: 3 };
  return order[to] > order[from];
}

/**
 * Get the upgrade path from a package.
 */
export function getUpgradePath(code: PackageCode): PackageCode[] {
  const all = getAllPackageCodes();
  const idx = all.indexOf(code);
  return all.slice(idx + 1);
}