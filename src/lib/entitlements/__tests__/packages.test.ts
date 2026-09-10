/**
 * Tests for feature definitions and package features.
 */

import { describe, it, expect } from "vitest";
import {
  FEATURE_DEFINITIONS,
  FEATURE_MAP,
  FEATURE_CATEGORIES,
  getFeatureDefinition,
  isValidFeatureCode,
  getAllFeatureCodes,
} from "@/lib/entitlements/features";
import {
  PackageCode,
  PACKAGE_METADATA,
  PACKAGE_FEATURES,
  getPackageMetadata,
  getPackageFeatures,
  getPackageFeature,
  packageHasFeature,
  getPackageIntegerFeature,
  packageHasUnlimited,
  getPackageFairUseLimit,
  getPackageExpiryWindows,
  isPackageUpgrade,
  getUpgradePath,
} from "@/lib/entitlements/packages";

describe("Feature Definitions", () => {
  it("has all expected feature definitions", () => {
    expect(FEATURE_DEFINITIONS.length).toBeGreaterThan(0);

    const codes = FEATURE_DEFINITIONS.map((f) => f.code);
    expect(codes).toContain("photos");
    expect(codes).toContain("video");
    expect(codes).toContain("slideshow");
    expect(codes).toContain("flipbook");
    expect(codes).toContain("custom_qr");
    expect(codes).toContain("qr_design_card");
    expect(codes).toContain("optional_colours");
    expect(codes).toContain("names_date");
    expect(codes).toContain("upload_days");
    expect(codes).toContain("download_days");
    expect(codes).toContain("unlimited_photos");
    expect(codes).toContain("unlimited_videos");
  });

  it("has valid data types for all features", () => {
    for (const feature of FEATURE_DEFINITIONS) {
      expect(["boolean", "integer", "string", "json"]).toContain(feature.dataType);
      expect(typeof feature.code).toBe("string");
      expect(feature.code.length).toBeGreaterThan(0);
      expect(typeof feature.label).toBe("string");
      expect(typeof feature.sortOrder).toBe("number");
    }
  });

  it("FEATURE_MAP has all definitions", () => {
    expect(FEATURE_MAP.size).toBe(FEATURE_DEFINITIONS.length);
    for (const feature of FEATURE_DEFINITIONS) {
      expect(FEATURE_MAP.get(feature.code)).toBe(feature);
    }
  });

  it("getFeatureDefinition returns correct feature", () => {
    const video = getFeatureDefinition("video");
    expect(video).toBeDefined();
    expect(video?.code).toBe("video");
    expect(video?.dataType).toBe("boolean");
  });

  it("getFeatureDefinition returns undefined for invalid code", () => {
    expect(getFeatureDefinition("invalid_feature")).toBeUndefined();
  });

  it("isValidFeatureCode works correctly", () => {
    expect(isValidFeatureCode("photos")).toBe(true);
    expect(isValidFeatureCode("video")).toBe(true);
    expect(isValidFeatureCode("invalid")).toBe(false);
  });

  it("getAllFeatureCodes returns all codes", () => {
    const codes = getAllFeatureCodes();
    expect(codes).toHaveLength(FEATURE_DEFINITIONS.length);
    expect(codes).toContain("photos");
    expect(codes).toContain("slideshow");
  });

  it("FEATURE_CATEGORIES groups features logically", () => {
    expect(FEATURE_CATEGORIES.core).toContain("photos");
    expect(FEATURE_CATEGORIES.core).toContain("guest_uploads");
    expect(FEATURE_CATEGORIES.media).toContain("video");
    expect(FEATURE_CATEGORIES.media).toContain("banner");
    expect(FEATURE_CATEGORIES.display).toContain("slideshow");
    expect(FEATURE_CATEGORIES.display).toContain("flipbook");
    expect(FEATURE_CATEGORIES.customization).toContain("custom_qr");
    expect(FEATURE_CATEGORIES.expiry).toContain("upload_days");
    expect(FEATURE_CATEGORIES.entitlement).toContain("unlimited_photos");
  });
});

describe("Package Metadata", () => {
  it("has three packages with correct codes", () => {
    expect(PACKAGE_METADATA).toHaveLength(3);
    const codes = PACKAGE_METADATA.map((p) => p.code);
    expect(codes).toEqual(["silver", "gold", "platinum"]);
  });

  it("has correct pricing in ZAR cents", () => {
    const silver = getPackageMetadata("silver");
    const gold = getPackageMetadata("gold");
    const platinum = getPackageMetadata("platinum");

    expect(silver?.priceCents).toBe(59900); // R599.00
    expect(gold?.priceCents).toBe(79900); // R799.00
    expect(platinum?.priceCents).toBe(109900); // R1099.00
  });

  it("has correct sort order", () => {
    expect(getPackageMetadata("silver")?.sortOrder).toBe(1);
    expect(getPackageMetadata("gold")?.sortOrder).toBe(2);
    expect(getPackageMetadata("platinum")?.sortOrder).toBe(3);
  });

  it("getPackageMetadata returns undefined for invalid code", () => {
    expect(getPackageMetadata("diamond" as any)).toBeUndefined();
  });

  it("getAllPackageCodes returns all codes in order", () => {
    const codes = getAllPackageCodes();
    expect(codes).toEqual(["silver", "gold", "platinum"]);
  });
});

describe("Package Features - Silver", () => {
  const silver = getPackageFeatures("silver");

  it("has core photo features", () => {
    expect(silver.photos).toBe(true);
    expect(silver.guest_uploads).toBe(true);
    expect(silver.max_photos).toBe(500);
  });

  it("does not have video features", () => {
    expect(silver.video).toBe(false);
    expect(silver.max_videos).toBe(0);
  });

  it("does not have display features", () => {
    expect(silver.slideshow).toBe(false);
    expect(silver.flipbook).toBe(false);
  });

  it("has basic customization", () => {
    expect(silver.custom_qr).toBe(true);
    expect(silver.qr_design_card).toBe(false);
    expect(silver.optional_colours).toBe(true);
    expect(silver.names_date).toBe(true);
  });

  it("has correct expiry windows", () => {
    expect(silver.upload_days).toBe(2); // +48 hours
    expect(silver.download_days).toBe(7);
  });

  it("does not have unlimited entitlements", () => {
    expect(silver.unlimited_photos).toBe(false);
    expect(silver.unlimited_videos).toBe(false);
  });

  it("has no intro/banner", () => {
    expect(silver.banner).toBe(false);
    expect(silver.intro).toBe(false);
  });
});

describe("Package Features - Gold", () => {
  const gold = getPackageFeatures("gold");

  it("includes all Silver features", () => {
    const silver = getPackageFeatures("silver");
    for (const [key, value] of Object.entries(silver)) {
      if (key !== "max_photos" && key !== "upload_days" && key !== "download_days") {
        expect(gold[key]).toBe(value);
      }
    }
  });

  it("has video feature enabled", () => {
    expect(gold.video).toBe(true);
    expect(gold.max_videos).toBe(10);
  });

  it("has banner and slideshow", () => {
    expect(gold.banner).toBe(true);
    expect(gold.slideshow).toBe(true);
  });

  it("has unlimited photos entitlement", () => {
    expect(gold.unlimited_photos).toBe(true);
    expect(gold.max_photos).toBe(-1); // -1 = unlimited entitlement
  });

  it("has extended expiry windows", () => {
    expect(gold.upload_days).toBe(7);
    expect(gold.download_days).toBe(30);
  });

  it("does not have flipbook or intro", () => {
    expect(gold.flipbook).toBe(false);
    expect(gold.intro).toBe(false);
    expect(gold.qr_design_card).toBe(false);
  });
});

describe("Package Features - Platinum", () => {
  const platinum = getPackageFeatures("platinum");

  it("includes all Gold features", () => {
    const gold = getPackageFeatures("gold");
    for (const [key, value] of Object.entries(gold)) {
      if (key !== "max_videos" && key !== "download_days") {
        expect(platinum[key]).toBe(value);
      }
    }
  });

  it("has intro and flipbook", () => {
    expect(platinum.intro).toBe(true);
    expect(platinum.flipbook).toBe(true);
  });

  it("has QR design card", () => {
    expect(platinum.qr_design_card).toBe(true);
  });

  it("has unlimited video entitlement", () => {
    expect(platinum.unlimited_videos).toBe(true);
    expect(platinum.max_videos).toBe(-1);
  });

  it("has extended download window", () => {
    expect(platinum.download_days).toBe(90);
  });
});

describe("Package Feature Helpers", () => {
  it("packageHasFeature works for boolean features", () => {
    expect(packageHasFeature("silver", "photos")).toBe(true);
    expect(packageHasFeature("silver", "video")).toBe(false);
    expect(packageHasFeature("gold", "video")).toBe(true);
    expect(packageHasFeature("platinum", "flipbook")).toBe(true);
  });

  it("getPackageIntegerFeature works for integer features", () => {
    expect(getPackageIntegerFeature("silver", "max_photos")).toBe(500);
    expect(getPackageIntegerFeature("gold", "max_photos")).toBe(-1);
    expect(getPackageIntegerFeature("platinum", "max_videos")).toBe(-1);
    expect(getPackageIntegerFeature("silver", "upload_days")).toBe(2);
    expect(getPackageIntegerFeature("gold", "upload_days")).toBe(7);
    expect(getPackageIntegerFeature("platinum", "download_days")).toBe(90);
  });

  it("packageHasUnlimited works correctly", () => {
    expect(packageHasUnlimited("silver", "photos")).toBe(false);
    expect(packageHasUnlimited("gold", "photos")).toBe(true);
    expect(packageHasUnlimited("platinum", "photos")).toBe(true);
    expect(packageHasUnlimited("silver", "videos")).toBe(false);
    expect(packageHasUnlimited("gold", "videos")).toBe(false);
    expect(packageHasUnlimited("platinum", "videos")).toBe(true);
  });

  it("getPackageFairUseLimit returns correct limits", () => {
    expect(getPackageFairUseLimit("silver", "photos")).toBe(500);
    expect(getPackageFairUseLimit("gold", "photos")).toBe(-1);
    expect(getPackageFairUseLimit("platinum", "photos")).toBe(-1);
    expect(getPackageFairUseLimit("silver", "videos")).toBe(0);
    expect(getPackageFairUseLimit("gold", "videos")).toBe(10);
    expect(getPackageFairUseLimit("platinum", "videos")).toBe(-1);
  });

  it("getPackageExpiryWindows returns correct windows", () => {
    expect(getPackageExpiryWindows("silver")).toEqual({ uploadDays: 2, downloadDays: 7 });
    expect(getPackageExpiryWindows("gold")).toEqual({ uploadDays: 7, downloadDays: 30 });
    expect(getPackageExpiryWindows("platinum")).toEqual({ uploadDays: 7, downloadDays: 90 });
  });
});

describe("Package Upgrade Logic", () => {
  it("isPackageUpgrade works correctly", () => {
    expect(isPackageUpgrade("silver", "gold")).toBe(true);
    expect(isPackageUpgrade("silver", "platinum")).toBe(true);
    expect(isPackageUpgrade("gold", "platinum")).toBe(true);
    expect(isPackageUpgrade("gold", "silver")).toBe(false);
    expect(isPackageUpgrade("platinum", "gold")).toBe(false);
    expect(isPackageUpgrade("silver", "silver")).toBe(false);
  });

  it("getUpgradePath returns correct paths", () => {
    expect(getUpgradePath("silver")).toEqual(["gold", "platinum"]);
    expect(getUpgradePath("gold")).toEqual(["platinum"]);
    expect(getUpgradePath("platinum")).toEqual([]);
  });
});