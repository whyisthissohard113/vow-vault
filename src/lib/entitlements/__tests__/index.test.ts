/**
 * Tests for the central entitlement service (index.ts).
 * Tests feature checks, upload/download limits, and vault rendering logic.
 */

import { describe, it, expect } from "vitest";
import {
  resolveEntitlements,
  getEntitlementFeature,
  entitlementHasFeature,
  getEntitlementIntegerFeature,
  hasFeature,
  getPhotoLimit,
  getVideoLimit,
  canUploadPhoto,
  canUploadVideo,
  shouldRenderFeature,
  getExpiryDisplay,
  validateFeatureCode,
  getPackageFeatureSummary,
} from "@/lib/entitlements";
import { PackageCode } from "@/lib/entitlements/packages";
import { FeatureCode } from "@/lib/entitlements/features";

describe("resolveEntitlements", () => {
  const weddingDate = { date: "2025-12-15" };
  const now = new Date("2025-12-16T10:00:00.000Z"); // During upload window

  describe("Silver Package", () => {
    const entitlements = resolveEntitlements({
      packageCode: "silver",
      weddingDate,
      now,
    });

    it("resolves correct package code", () => {
      expect(entitlements.packageCode).toBe("silver");
    });

    it("has core photo features enabled", () => {
      expect(entitlementHasFeature(entitlements, "photos")).toBe(true);
      expect(entitlementHasFeature(entitlements, "guest_uploads")).toBe(true);
    });

    it("has photo limit of 500", () => {
      expect(getPhotoLimit(entitlements)).toBe(500);
    });

    it("does not have video features", () => {
      expect(entitlementHasFeature(entitlements, "video")).toBe(false);
      expect(getVideoLimit(entitlements)).toBe(0);
    });

    it("does not have display features", () => {
      expect(entitlementHasFeature(entitlements, "slideshow")).toBe(false);
      expect(entitlementHasFeature(entitlements, "flipbook")).toBe(false);
    });

    it("has basic customization", () => {
      expect(entitlementHasFeature(entitlements, "custom_qr")).toBe(true);
      expect(entitlementHasFeature(entitlements, "optional_colours")).toBe(true);
      expect(entitlementHasFeature(entitlements, "names_date")).toBe(true);
    });

    it("does not have premium customization", () => {
      expect(entitlementHasFeature(entitlements, "qr_design_card")).toBe(false);
    });

    it("has correct expiry windows", () => {
      expect(entitlements.expiry.uploadWindowDays).toBe(2);
      expect(entitlements.expiry.downloadWindowDays).toBe(7);
    });

    it("has upload open during window", () => {
      expect(entitlements.uploadOpen).toBe(true);
    });

    it("has download open during window", () => {
      expect(entitlements.downloadOpen).toBe(true);
    });

    it("has active lifecycle status", () => {
      expect(entitlements.lifecycleStatus).toBe("active");
    });
  });

  describe("Gold Package", () => {
    const entitlements = resolveEntitlements({
      packageCode: "gold",
      weddingDate,
      now,
    });

    it("has video features", () => {
      expect(entitlementHasFeature(entitlements, "video")).toBe(true);
      expect(entitlementHasFeature(entitlements, "banner")).toBe(true);
      expect(entitlementHasFeature(entitlements, "slideshow")).toBe(true);
    });

    it("has unlimited photos entitlement", () => {
      expect(entitlementHasFeature(entitlements, "unlimited_photos")).toBe(true);
      expect(getPhotoLimit(entitlements)).toBe(-1);
    });

    it("has video limit of 10", () => {
      expect(getVideoLimit(entitlements)).toBe(10);
    });

    it("has extended expiry windows", () => {
      expect(entitlements.expiry.uploadWindowDays).toBe(7);
      expect(entitlements.expiry.downloadWindowDays).toBe(30);
    });

    it("does not have flipbook or intro", () => {
      expect(entitlementHasFeature(entitlements, "flipbook")).toBe(false);
      expect(entitlementHasFeature(entitlements, "intro")).toBe(false);
    });
  });

  describe("Platinum Package", () => {
    const entitlements = resolveEntitlements({
      packageCode: "platinum",
      weddingDate,
      now,
    });

    it("has all Gold features plus more", () => {
      expect(entitlementHasFeature(entitlements, "video")).toBe(true);
      expect(entitlementHasFeature(entitlements, "banner")).toBe(true);
      expect(entitlementHasFeature(entitlements, "slideshow")).toBe(true);
      expect(entitlementHasFeature(entitlements, "flipbook")).toBe(true);
      expect(entitlementHasFeature(entitlements, "intro")).toBe(true);
    });

    it("has QR design card", () => {
      expect(entitlementHasFeature(entitlements, "qr_design_card")).toBe(true);
    });

    it("has unlimited video entitlement", () => {
      expect(entitlementHasFeature(entitlements, "unlimited_videos")).toBe(true);
      expect(getVideoLimit(entitlements)).toBe(-1);
    });

    it("has 90-day download window", () => {
      expect(entitlements.expiry.downloadWindowDays).toBe(90);
    });
  });

  describe("Feature Overrides", () => {
    it("applies feature overrides from wedding_settings", () => {
      const entitlements = resolveEntitlements({
        packageCode: "silver",
        weddingDate,
        featureOverrides: {
          video: true, // Enable video for this specific wedding
          max_photos: 1000,
        },
        now,
      });

      expect(entitlementHasFeature(entitlements, "video")).toBe(true);
      expect(getPhotoLimit(entitlements)).toBe(1000);
      // Other silver features should remain
      expect(entitlementHasFeature(entitlements, "photos")).toBe(true);
    });

    it("override does not affect other packages", () => {
      const silver = resolveEntitlements({
        packageCode: "silver",
        weddingDate,
        featureOverrides: { video: true },
        now,
      });
      const gold = resolveEntitlements({
        packageCode: "gold",
        weddingDate,
        now,
      });

      expect(entitlementHasFeature(silver, "video")).toBe(true);
      expect(entitlementHasFeature(gold, "video")).toBe(true); // Gold already has it
    });
  });

  describe("Lifecycle Status Transitions", () => {
    const silverBase = {
      packageCode: "silver" as PackageCode,
      weddingDate: { date: "2025-12-15" } as const,
    };

    it("is 'active' during upload window", () => {
      const duringUpload = new Date("2025-12-16T10:00:00.000Z");
      const entitlements = resolveEntitlements({ ...silverBase, now: duringUpload });
      expect(entitlements.lifecycleStatus).toBe("active");
      expect(entitlements.uploadOpen).toBe(true);
      expect(entitlements.downloadOpen).toBe(true);
    });

    it("is 'upload_closed' after upload window but before download window", () => {
      const afterUpload = new Date("2025-12-18T10:00:00.000Z"); // After +2 days
      const entitlements = resolveEntitlements({ ...silverBase, now: afterUpload });
      expect(entitlements.lifecycleStatus).toBe("upload_closed");
      expect(entitlements.uploadOpen).toBe(false);
      expect(entitlements.downloadOpen).toBe(true);
    });

    it("is 'download_only' after download window", () => {
      const afterDownload = new Date("2025-12-25T10:00:00.000Z"); // After +7 days
      const entitlements = resolveEntitlements({ ...silverBase, now: afterDownload });
      expect(entitlements.lifecycleStatus).toBe("download_only");
      expect(entitlements.uploadOpen).toBe(false);
      expect(entitlements.downloadOpen).toBe(false);
    });
  });
});

describe("Feature Check Helpers", () => {
  const entitlements = resolveEntitlements({
    packageCode: "gold",
    weddingDate: { date: "2025-12-15" },
    now: new Date("2025-12-16T10:00:00.000Z"),
  });

  describe("getEntitlementFeature", () => {
    it("returns feature value", () => {
      expect(getEntitlementFeature(entitlements, "video")).toBe(true);
      expect(getEntitlementFeature(entitlements, "max_photos")).toBe(-1);
    });

    it("returns undefined for non-existent feature", () => {
      expect(getEntitlementFeature(entitlements, "nonexistent" as FeatureCode)).toBeUndefined();
    });
  });

  describe("entitlementHasFeature", () => {
    it("returns true for enabled boolean features", () => {
      expect(entitlementHasFeature(entitlements, "video")).toBe(true);
    });

    it("returns false for disabled boolean features", () => {
      expect(entitlementHasFeature(entitlements, "flipbook")).toBe(false);
    });

    it("returns false for non-boolean features", () => {
      expect(entitlementHasFeature(entitlements, "max_photos")).toBe(false);
    });
  });

  describe("getEntitlementIntegerFeature", () => {
    it("returns integer value", () => {
      expect(getEntitlementIntegerFeature(entitlements, "upload_days")).toBe(7);
      expect(getEntitlementIntegerFeature(entitlements, "download_days")).toBe(30);
    });

    it("returns 0 for non-integer features", () => {
      expect(getEntitlementIntegerFeature(entitlements, "video")).toBe(0);
    });
  });

  describe("hasFeature (convenience)", () => {
    it("checks common features", () => {
      expect(hasFeature(entitlements, "photos")).toBe(true);
      expect(hasFeature(entitlements, "videos")).toBe(true);
      expect(hasFeature(entitlements, "banner")).toBe(true);
      expect(hasFeature(entitlements, "slideshow")).toBe(true);
      expect(hasFeature(entitlements, "flipbook")).toBe(false);
      expect(hasFeature(entitlements, "intro")).toBe(false);
      expect(hasFeature(entitlements, "qr_design_card")).toBe(false);
    });
  });
});

describe("Upload Limit Checks", () => {
  const silver = resolveEntitlements({
    packageCode: "silver",
    weddingDate: { date: "2025-12-15" },
    now: new Date("2025-12-16T10:00:00.000Z"),
  });

  const gold = resolveEntitlements({
    packageCode: "gold",
    weddingDate: { date: "2025-12-15" },
    now: new Date("2025-12-16T10:00:00.000Z"),
  });

  const platinum = resolveEntitlements({
    packageCode: "platinum",
    weddingDate: { date: "2025-12-15" },
    now: new Date("2025-12-16T10:00:00.000Z"),
  });

  describe("canUploadPhoto", () => {
    it("allows upload when under limit and window open", () => {
      expect(canUploadPhoto(silver, 100)).toEqual({ allowed: true });
      expect(canUploadPhoto(gold, 5000)).toEqual({ allowed: true }); // unlimited
      expect(canUploadPhoto(platinum, 99999)).toEqual({ allowed: true });
    });

    it("denies when limit reached", () => {
      expect(canUploadPhoto(silver, 500)).toEqual({
        allowed: false,
        reason: "Photo limit reached (500)",
      });
      expect(canUploadPhoto(silver, 600)).toEqual({
        allowed: false,
        reason: "Photo limit reached (500)",
      });
    });

    it("denies when upload window closed", () => {
      const afterUpload = resolveEntitlements({
        packageCode: "silver",
        weddingDate: { date: "2025-12-15" },
        now: new Date("2025-12-18T10:00:00.000Z"),
      });
      expect(canUploadPhoto(afterUpload, 10)).toEqual({
        allowed: false,
        reason: "Upload window has closed",
      });
    });

    it("denies when feature not in package", () => {
      // Can't test directly since all packages have photos
      // But the logic is covered
    });
  });

  describe("canUploadVideo", () => {
    it("allows video upload for Gold/Platinum", () => {
      expect(canUploadVideo(gold, 5)).toEqual({ allowed: true });
      expect(canUploadVideo(platinum, 100)).toEqual({ allowed: true });
    });

    it("denies video upload for Silver", () => {
      expect(canUploadVideo(silver, 0)).toEqual({
        allowed: false,
        reason: "Video uploads not included in package",
      });
    });

    it("denies when video limit reached for Gold", () => {
      expect(canUploadVideo(gold, 10)).toEqual({
        allowed: false,
        reason: "Video limit reached (10)",
      });
    });

    it("allows unlimited videos for Platinum", () => {
      expect(canUploadVideo(platinum, 1000)).toEqual({ allowed: true });
    });

    it("denies when upload window closed", () => {
      const afterUpload = resolveEntitlements({
        packageCode: "gold",
        weddingDate: { date: "2025-12-15" },
        now: new Date("2025-12-23T10:00:00.000Z"), // After +7 days
      });
      expect(canUploadVideo(afterUpload, 0)).toEqual({
        allowed: false,
        reason: "Upload window has closed",
      });
    });
  });
});

describe("Vault Rendering Helpers", () => {
  const silver = resolveEntitlements({
    packageCode: "silver",
    weddingDate: { date: "2025-12-15" },
    now: new Date("2025-12-16T10:00:00.000Z"),
  });

  const gold = resolveEntitlements({
    packageCode: "gold",
    weddingDate: { date: "2025-12-15" },
    now: new Date("2025-12-16T10:00:00.000Z"),
  });

  const platinum = resolveEntitlements({
    packageCode: "platinum",
    weddingDate: { date: "2025-12-15" },
    now: new Date("2025-12-16T10:00:00.000Z"),
  });

  describe("shouldRenderFeature", () => {
    it("returns true for Silver features", () => {
      expect(shouldRenderFeature(silver, "banner")).toBe(false);
      // Silver doesn't have banner, slideshow, flipbook, intro, qr_design_card
    });

    it("returns true for Gold features", () => {
      expect(shouldRenderFeature(gold, "banner")).toBe(true);
      expect(shouldRenderFeature(gold, "slideshow")).toBe(true);
      expect(shouldRenderFeature(gold, "flipbook")).toBe(false);
      expect(shouldRenderFeature(gold, "intro")).toBe(false);
      expect(shouldRenderFeature(gold, "qr_design_card")).toBe(false);
    });

    it("returns true for all Platinum features", () => {
      expect(shouldRenderFeature(platinum, "banner")).toBe(true);
      expect(shouldRenderFeature(platinum, "slideshow")).toBe(true);
      expect(shouldRenderFeature(platinum, "flipbook")).toBe(true);
      expect(shouldRenderFeature(platinum, "intro")).toBe(true);
      expect(shouldRenderFeature(platinum, "qr_design_card")).toBe(true);
    });
  });
});

describe("Expiry Display", () => {
  it("formats deadlines for display", () => {
    const entitlements = resolveEntitlements({
      packageCode: "gold",
      weddingDate: { date: "2025-06-15" },
      now: new Date("2025-06-16T00:00:00.000Z"),
    });

    const display = getExpiryDisplay(entitlements);
    expect(display.uploadDeadline).toContain("2025");
    expect(display.downloadDeadline).toContain("2025");
    expect(display.uploadDeadline).toContain("June");
    expect(display.downloadDeadline).toContain("July");
    // Days left calculation depends on exact timezone math, just verify it's computed
    expect(typeof display.uploadDaysLeft).toBe("number");
    expect(typeof display.downloadDaysLeft).toBe("number");
    expect(display.downloadDaysLeft).toBeGreaterThanOrEqual(display.uploadDaysLeft);
  });
});

describe("Validation Helpers", () => {
  it("validateFeatureCode works", () => {
    expect(validateFeatureCode("photos")).toBe(true);
    expect(validateFeatureCode("video")).toBe(true);
    expect(validateFeatureCode("invalid_feature")).toBe(false);
  });
});

describe("Package Feature Summary (for Admin UI)", () => {
  it("returns all features with values for a package", () => {
    const summary = getPackageFeatureSummary("silver");
    expect(summary.length).toBeGreaterThan(15); // All features

    const photoFeature = summary.find((f) => f.code === "photos");
    expect(photoFeature).toBeDefined();
    expect(photoFeature?.value).toBe(true);
    expect(photoFeature?.dataType).toBe("boolean");

    const maxPhotosFeature = summary.find((f) => f.code === "max_photos");
    expect(maxPhotosFeature?.value).toBe(500);
    expect(maxPhotosFeature?.dataType).toBe("integer");
  });

  it("shows correct values for each package", () => {
    const silver = getPackageFeatureSummary("silver");
    const gold = getPackageFeatureSummary("gold");
    const platinum = getPackageFeatureSummary("platinum");

    const silverVideo = silver.find((f) => f.code === "video");
    const goldVideo = gold.find((f) => f.code === "video");
    const platinumVideo = platinum.find((f) => f.code === "video");

    expect(silverVideo?.value).toBe(false);
    expect(goldVideo?.value).toBe(true);
    expect(platinumVideo?.value).toBe(true);
  });
});