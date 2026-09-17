/**
 * Contract tests for the demo-vault capability projection.
 *
 * The vault shell renders sections from `getDemoCapabilities(tier)`, which is
 * derived from the canonical `PACKAGE_FEATURES` — the same source the server
 * uses to gate real vaults. These tests assert the projection never drifts
 * from the product definition (Silver never gets videos/slideshow/banner,
 * Gold never gets intro/flipbook/design cards, Platinum gates everything it
 * claims).
 */

import { describe, it, expect } from "vitest";

import { PACKAGE_FEATURES, PackageCode } from "@/lib/entitlements/packages";
import {
  describeCapabilities,
  getDemoCapabilities,
} from "@/lib/examples/capabilities";

const TIER_TO_CODE = {
  Silver: PackageCode.SILVER,
  Gold: PackageCode.GOLD,
  Platinum: PackageCode.PLATINUM,
} as const;

describe("getDemoCapabilities — sections match the canonical packages", () => {
  for (const [tier, code] of Object.entries(TIER_TO_CODE)) {
    it(`${tier} mirrors the canonical ${code} feature definition`, () => {
      const caps = getDemoCapabilities(tier as "Silver" | "Gold" | "Platinum");
      const features = PACKAGE_FEATURES[code];

      expect(caps.code).toBe(code);
      expect(caps.photos).toBe(features.photos === true);
      expect(caps.uploads).toBe(features.guest_uploads === true);
      expect(caps.videos).toBe(features.video === true);
      expect(caps.slideshow).toBe(features.slideshow === true);
      expect(caps.banner).toBe(features.banner === true);
      expect(caps.introMedia).toBe(features.intro === true);
      expect(caps.flipbook).toBe(features.flipbook === true);
      expect(caps.qrDesignCards).toBe(features.qr_design_card === true);
      expect(caps.maxPhotos).toBe(
        typeof features.max_photos === "number" ? features.max_photos : 0,
      );
      expect(caps.maxVideos).toBe(
        typeof features.max_videos === "number" ? features.max_videos : 0,
      );
      expect(caps.uploadDays).toBe(
        typeof features.upload_days === "number" ? features.upload_days : 0,
      );
      expect(caps.downloadDays).toBe(
        typeof features.download_days === "number" ? features.download_days : 0,
      );
    });
  }

  it("Silver keeps the entry-level vault honest", () => {
    const caps = getDemoCapabilities("Silver");
    expect(caps.uploads).toBe(true); // guest photo uploads
    expect(caps.videos).toBe(false);
    expect(caps.slideshow).toBe(false);
    expect(caps.banner).toBe(false);
    expect(caps.introMedia).toBe(false);
    expect(caps.flipbook).toBe(false);
    expect(caps.qrDesignCards).toBe(false);
    expect(caps.maxPhotos).toBe(500);
    expect(caps.uploadDays).toBe(2);
    expect(caps.downloadDays).toBe(7);
    expect(caps.downloads).toBe("limited");
  });

  it("Gold adds video, slideshow and banner — but not Platinum keepsakes", () => {
    const caps = getDemoCapabilities("Gold");
    expect(caps.videos).toBe(true);
    expect(caps.slideshow).toBe(true);
    expect(caps.banner).toBe(true);
    expect(caps.introMedia).toBe(false);
    expect(caps.flipbook).toBe(false);
    expect(caps.qrDesignCards).toBe(false);
    expect(caps.unlimitedPhotos).toBe(true);
    expect(caps.maxVideos).toBe(10);
    expect(caps.uploadDays).toBe(7);
    expect(caps.downloadDays).toBe(30);
  });

  it("Platinum advertises every keepsake it actually ships", () => {
    const caps = getDemoCapabilities("Platinum");
    expect(caps.introMedia).toBe(true);
    expect(caps.flipbook).toBe(true);
    expect(caps.qrDesignCards).toBe(true);
    expect(caps.unlimitedVideos).toBe(true);
    expect(caps.maxVideos).toBe(-1);
    expect(caps.downloadDays).toBe(90);
    expect(caps.downloads).toBe("extended");
  });
});

describe("describeCapabilities — About panel text stays product-accurate", () => {
  it("Silver quotes its fair-use limits", () => {
    const lines = describeCapabilities(getDemoCapabilities("Silver"));
    expect(lines).toContain("Up to 500 photo uploads");
    expect(lines).toContain("Uploads open 2 days after the wedding");
    expect(lines).toContain("Downloads open for 7 days");
    expect(lines.some((line) => line.includes("Guest video uploads"))).toBe(false);
  });

  it("Gold quotes video + unlimited photo entitlements", () => {
    const lines = describeCapabilities(getDemoCapabilities("Gold"));
    expect(lines).toContain("Guest video uploads (up to 10)");
    expect(lines).toContain("Unlimited photo uploads (fair-use safeguards apply)");
    expect(lines.some((line) => line.includes("Custom QR design cards"))).toBe(false);
  });

  it("Platinum lists intro, flipbook, QR design cards and 90-day downloads", () => {
    const lines = describeCapabilities(getDemoCapabilities("Platinum"));
    expect(lines).toContain("Intro experience before the vault");
    expect(lines).toContain("Interactive digital flipbook");
    expect(lines).toContain("Custom QR design cards");
    expect(lines).toContain("Downloads open for 90 days");
  });
});