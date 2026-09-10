/**
 * Feature definitions for the Wedding Memory Vault.
 *
 * This is the single source of truth for all product features.
 * Each feature has a code, data type, and default value.
 *
 * Features are organized by category for clarity.
 */

export type FeatureDataType = "boolean" | "integer" | "string" | "json";

export interface FeatureDefinition {
  code: string;
  label: string;
  description: string;
  dataType: FeatureDataType;
  defaultValue: unknown;
  sortOrder: number;
}

/**
 * All feature definitions for the platform.
 * These are the canonical feature definitions that map to product_features table.
 */
export const FEATURE_DEFINITIONS: readonly FeatureDefinition[] = [
  // ── Core Gallery Features ───────────────────────────────────────────────────
  {
    code: "photos",
    label: "Photo Gallery",
    description: "Guest photo upload and gallery display",
    dataType: "boolean",
    defaultValue: true,
    sortOrder: 10,
  },
  {
    code: "guest_uploads",
    label: "Guest Uploads",
    description: "Allow guests to upload photos via QR code",
    dataType: "boolean",
    defaultValue: true,
    sortOrder: 20,
  },
  {
    code: "max_photos",
    label: "Maximum Photos",
    description: "Maximum number of photos allowed (fair-use limit; -1 = unlimited)",
    dataType: "integer",
    defaultValue: 500,
    sortOrder: 30,
  },

  // ── Media Features ──────────────────────────────────────────────────────────
  {
    code: "video",
    label: "Video Upload",
    description: "Allow guests to upload videos",
    dataType: "boolean",
    defaultValue: false,
    sortOrder: 40,
  },
  {
    code: "max_videos",
    label: "Maximum Videos",
    description: "Maximum number of videos allowed (fair-use limit; -1 = unlimited)",
    dataType: "integer",
    defaultValue: 0,
    sortOrder: 50,
  },
  {
    code: "banner",
    label: "Banner Image",
    description: "Custom banner/header image for the vault",
    dataType: "boolean",
    defaultValue: false,
    sortOrder: 60,
  },
  {
    code: "intro",
    label: "Intro Media",
    description: "Intro video/image that plays before gallery",
    dataType: "boolean",
    defaultValue: false,
    sortOrder: 70,
  },

  // ── Display Features ────────────────────────────────────────────────────────
  {
    code: "slideshow",
    label: "Slideshow",
    description: "Auto-playing slideshow of guest photos",
    dataType: "boolean",
    defaultValue: false,
    sortOrder: 80,
  },
  {
    code: "flipbook",
    label: "Digital Flipbook",
    description: "Interactive page-flip photo album",
    dataType: "boolean",
    defaultValue: false,
    sortOrder: 90,
  },

  // ── Customization Features ──────────────────────────────────────────────────
  {
    code: "custom_qr",
    label: "Custom QR Code",
    description: "Custom styled QR code with branding",
    dataType: "boolean",
    defaultValue: true,
    sortOrder: 100,
  },
  {
    code: "qr_design_card",
    label: "QR Design Card",
    description: "Printable QR card design (PNG/PDF)",
    dataType: "boolean",
    defaultValue: false,
    sortOrder: 110,
  },
  {
    code: "optional_colours",
    label: "Optional Colours",
    description: "Customizable colour theme",
    dataType: "boolean",
    defaultValue: true,
    sortOrder: 120,
  },
  {
    code: "names_date",
    label: "Names & Date Display",
    description: "Display couple names and wedding date",
    dataType: "boolean",
    defaultValue: true,
    sortOrder: 130,
  },

  // ── Expiry Window Features (calculated from wedding date) ───────────────────
  {
    code: "upload_days",
    label: "Upload Window (Days)",
    description: "Days after wedding date when uploads close",
    dataType: "integer",
    defaultValue: 2,
    sortOrder: 200,
  },
  {
    code: "download_days",
    label: "Download Window (Days)",
    description: "Days after wedding date when downloads close",
    dataType: "integer",
    defaultValue: 7,
    sortOrder: 210,
  },

  // ── Entitlement Flags ───────────────────────────────────────────────────────
  {
    code: "unlimited_photos",
    label: "Unlimited Photos",
    description: "Entitlement to unlimited photos (fair-use still applies)",
    dataType: "boolean",
    defaultValue: false,
    sortOrder: 300,
  },
  {
    code: "unlimited_videos",
    label: "Unlimited Videos",
    description: "Entitlement to unlimited videos (fair-use still applies)",
    dataType: "boolean",
    defaultValue: false,
    sortOrder: 310,
  },
] as const;

/**
 * Feature code type derived from definitions.
 */
export type FeatureCode = (typeof FEATURE_DEFINITIONS)[number]["code"];

/**
 * Map feature code to its definition for quick lookup.
 */
export const FEATURE_MAP: ReadonlyMap<FeatureCode, FeatureDefinition> = new Map(
  FEATURE_DEFINITIONS.map((f) => [f.code, f]),
);

/**
 * Feature codes by category for easier composition.
 */
export const FEATURE_CATEGORIES = {
  core: ["photos", "guest_uploads", "max_photos"] as const,
  media: ["video", "max_videos", "banner", "intro"] as const,
  display: ["slideshow", "flipbook"] as const,
  customization: ["custom_qr", "qr_design_card", "optional_colours", "names_date"] as const,
  expiry: ["upload_days", "download_days"] as const,
  entitlement: ["unlimited_photos", "unlimited_videos"] as const,
} as const;

/**
 * Get all feature codes.
 */
export function getAllFeatureCodes(): FeatureCode[] {
  return FEATURE_DEFINITIONS.map((f) => f.code);
}

/**
 * Get feature definition by code.
 */
export function getFeatureDefinition(code: FeatureCode): FeatureDefinition | undefined {
  return FEATURE_MAP.get(code);
}

/**
 * Check if a feature code is valid.
 */
export function isValidFeatureCode(code: string): code is FeatureCode {
  return FEATURE_MAP.has(code as FeatureCode);
}