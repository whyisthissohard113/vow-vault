/**
 * Central Entitlement Service.
 *
 * This is the single entry point for all entitlement checks.
 * Consumed by: Builder, Vault, API, Frontend, Media processing, etc.
 *
 * Key principle: All entitlement logic lives here. No scattered package checks.
 */

import { type PackageCode, PackageFeatureValues, getPackageFeatures } from "./packages";
import { type FeatureCode, FEATURE_MAP, FEATURE_DEFINITIONS } from "./features";
import {
  calculateExpiryDeadlines,
  type ExpiryDeadlines,
  type WeddingDateInput,
  isUploadOpen,
  isDownloadOpen,
  getLifecycleStatusFromDeadlines,
  BUSINESS_TIMEZONE,
} from "./expiry";

/**
 * Resolved entitlements for a specific wedding/vault.
 * Combines package features with any overrides/customizations.
 */
export interface ResolvedEntitlements {
  /** The package code (silver/gold/platinum) */
  packageCode: PackageCode;
  /** All feature values for this entitlement */
  features: PackageFeatureValues;
  /** Calculated expiry deadlines (UTC) */
  expiry: ExpiryDeadlines;
  /** Current lifecycle status derived from deadlines */
  lifecycleStatus: "active" | "upload_closed" | "download_only" | "expired";
  /** Whether uploads are currently allowed */
  uploadOpen: boolean;
  /** Whether downloads are currently allowed */
  downloadOpen: boolean;
}

/**
 * Input for resolving entitlements.
 */
export interface ResolveEntitlementsInput {
  /** The package code purchased */
  packageCode: PackageCode;
  /** The wedding date (YYYY-MM-DD in Africa/Johannesburg) */
  weddingDate: WeddingDateInput;
  /** Optional feature overrides (e.g., from custom wedding_settings) */
  featureOverrides?: Partial<PackageFeatureValues>;
  /** Current time for lifecycle calculation (defaults to now) */
  now?: Date;
}

/**
 * Resolve complete entitlements for a wedding/vault.
 * This is the main function other services should call.
 */
export function resolveEntitlements(input: ResolveEntitlementsInput): ResolvedEntitlements {
  const { packageCode, weddingDate, featureOverrides = {}, now = new Date() } = input;

  // Get base package features
  const baseFeatures = getPackageFeatures(packageCode);

  // Merge overrides (e.g., from wedding_settings customizations)
  const features: PackageFeatureValues = {
    ...baseFeatures,
    ...featureOverrides,
  } as PackageFeatureValues;

  // Calculate expiry deadlines
  const expiry = calculateExpiryDeadlines(weddingDate, packageCode);

  // Determine current lifecycle status
  const lifecycleStatus = getLifecycleStatusFromDeadlines(
    expiry.uploadDeadline,
    expiry.downloadDeadline,
    now,
  );

  return {
    packageCode,
    features,
    expiry,
    lifecycleStatus,
    uploadOpen: isUploadOpen(expiry.uploadDeadline, now),
    downloadOpen: isDownloadOpen(expiry.downloadDeadline, now),
  };
}

/**
 * Get a specific feature value from resolved entitlements.
 */
export function getEntitlementFeature<T = unknown>(
  entitlements: ResolvedEntitlements,
  featureCode: FeatureCode,
): T | undefined {
  return entitlements.features[featureCode] as T | undefined;
}

/**
 * Check if a boolean feature is enabled in entitlements.
 */
export function entitlementHasFeature(
  entitlements: ResolvedEntitlements,
  featureCode: FeatureCode,
): boolean {
  const value = getEntitlementFeature(entitlements, featureCode);
  return value === true;
}

/**
 * Get integer feature value from entitlements.
 */
export function getEntitlementIntegerFeature(
  entitlements: ResolvedEntitlements,
  featureCode: FeatureCode,
): number {
  const value = getEntitlementFeature(entitlements, featureCode);
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseInt(value, 10);
  return 0;
}

/**
 * Check if entitlements include a specific feature by name (convenience).
 * Maps friendly names to actual feature codes.
 */
export function hasFeature(
  entitlements: ResolvedEntitlements,
  feature: "photos" | "videos" | "video" | "banner" | "intro" | "slideshow" | "flipbook" | "qr_design_card",
): boolean {
  // Map friendly names to actual feature codes
  const featureMap: Record<string, string> = {
    videos: "video",
    video: "video",
    photos: "photos",
    banner: "banner",
    intro: "intro",
    slideshow: "slideshow",
    flipbook: "flipbook",
    qr_design_card: "qr_design_card",
  };
  const code = featureMap[feature] ?? feature;
  return entitlementHasFeature(entitlements, code as FeatureCode);
}

/**
 * Get the fair-use limit for photos from entitlements.
 * Returns -1 for unlimited entitlement.
 */
export function getPhotoLimit(entitlements: ResolvedEntitlements): number {
  return getEntitlementIntegerFeature(entitlements, "max_photos");
}

/**
 * Get the fair-use limit for videos from entitlements.
 * Returns -1 for unlimited entitlement.
 */
export function getVideoLimit(entitlements: ResolvedEntitlements): number {
  return getEntitlementIntegerFeature(entitlements, "max_videos");
}

/**
 * Check if photo uploads are allowed (feature + within limits + upload window open).
 */
export function canUploadPhoto(
  entitlements: ResolvedEntitlements,
  currentPhotoCount: number,
): { allowed: boolean; reason?: string } {
  if (!entitlementHasFeature(entitlements, "photos")) {
    return { allowed: false, reason: "Photo uploads not included in package" };
  }
  if (!entitlements.uploadOpen) {
    return { allowed: false, reason: "Upload window has closed" };
  }
  const limit = getPhotoLimit(entitlements);
  if (limit >= 0 && currentPhotoCount >= limit) {
    return { allowed: false, reason: `Photo limit reached (${limit})` };
  }
  return { allowed: true };
}

/**
 * Check if video uploads are allowed.
 */
export function canUploadVideo(
  entitlements: ResolvedEntitlements,
  currentVideoCount: number,
): { allowed: boolean; reason?: string } {
  if (!entitlementHasFeature(entitlements, "video")) {
    return { allowed: false, reason: "Video uploads not included in package" };
  }
  if (!entitlements.uploadOpen) {
    return { allowed: false, reason: "Upload window has closed" };
  }
  const limit = getVideoLimit(entitlements);
  if (limit >= 0 && currentVideoCount >= limit) {
    return { allowed: false, reason: `Video limit reached (${limit})` };
  }
  return { allowed: true };
}

/**
 * Check if a display feature should be rendered in the vault.
 * Used by Vault frontend to conditionally render components.
 */
export function shouldRenderFeature(
  entitlements: ResolvedEntitlements,
  feature: "banner" | "slideshow" | "flipbook" | "intro" | "qr_design_card",
): boolean {
  return entitlementHasFeature(entitlements, feature);
}

/**
 * Get upload/download expiry dates formatted for display.
 */
export function getExpiryDisplay(entitlements: ResolvedEntitlements): {
  uploadDeadline: string;
  downloadDeadline: string;
  uploadDaysLeft: number;
  downloadDaysLeft: number;
} {
  const { expiry } = entitlements;
  const now = new Date();

  return {
    uploadDeadline: expiry.uploadDeadline.toLocaleString("en-ZA", {
      timeZone: BUSINESS_TIMEZONE,
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    downloadDeadline: expiry.downloadDeadline.toLocaleString("en-ZA", {
      timeZone: BUSINESS_TIMEZONE,
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    uploadDaysLeft: Math.max(0, Math.ceil((expiry.uploadDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
    downloadDaysLeft: Math.max(0, Math.ceil((expiry.downloadDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
  };
}

/**
 * Validate that a feature code exists in the feature registry.
 */
export function validateFeatureCode(code: string): code is FeatureCode {
  return FEATURE_MAP.has(code as FeatureCode);
}

/**
 * Get all available features with their values for a package (for admin UI).
 */
export function getPackageFeatureSummary(packageCode: PackageCode): Array<{
  code: FeatureCode;
  label: string;
  description: string;
  value: unknown;
  dataType: string;
}> {
  const features = getPackageFeatures(packageCode);
  return FEATURE_DEFINITIONS.map((def) => ({
    code: def.code,
    label: def.label,
    description: def.description,
    value: features[def.code] ?? def.defaultValue,
    dataType: def.dataType,
  }));
}

// Re-export types for convenience
export type { PackageCode, PackageFeatureValues } from "./packages";
export type { FeatureCode } from "./features";
export type { ExpiryDeadlines, WeddingDateInput } from "./expiry";
export { BUSINESS_TIMEZONE } from "./expiry";
export { PACKAGE_METADATA, getPackageFeatures } from "./packages";
export { FEATURE_DEFINITIONS, FEATURE_CATEGORIES, getFeatureDefinition } from "./features";