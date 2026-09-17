/**
 * Demo capabilities for the interactive `/examples` vaults.
 *
 * These flags are DERIVED from the canonical package definitions in
 * `@/lib/entitlements/packages` — the same source the server uses to gate real
 * vaults. The marketing demo can therefore never advertise a capability the
 * real package does not include (Silver never gains video/slideshow/banner,
 * Gold never gains the intro/flipbook/QR design card, etc.).
 *
 * This is a presentation projection only; it does not redefine the canonical
 * contract.
 */

import {
  PACKAGE_FEATURES,
  PackageCode,
} from "@/lib/entitlements/packages";
import type { DemoPackageTier } from "@/content/examples";

export interface DemoCapabilities {
  /** Display tier label. */
  tier: DemoPackageTier;
  /** Canonical package code. */
  code: PackageCode;
  /** Photo gallery + guest photo upload. */
  photos: boolean;
  /** Guest photo uploads. */
  uploads: boolean;
  /** Guest video uploads + video gallery + video player. */
  videos: boolean;
  /** Live / memory slideshow. */
  slideshow: boolean;
  /** Banner image hero treatment. */
  banner: boolean;
  /** Platinum intro experience before the vault. */
  introMedia: boolean;
  /** Interactive digital flipbook. */
  flipbook: boolean;
  /** Custom-designed QR cards. */
  qrDesignCards: boolean;
  /** Guestbook messages (every package). */
  guestbook: boolean;
  /** QR access (every package). */
  qr: boolean;
  /** Download window class. */
  downloads: "limited" | "extended";
  /** Fair-use limits; -1 means unlimited entitlement. */
  maxPhotos: number;
  maxVideos: number;
  /** Expiry windows (from the canonical product definition). */
  uploadDays: number;
  downloadDays: number;
  unlimitedPhotos: boolean;
  unlimitedVideos: boolean;
}

const TIER_TO_CODE: Record<DemoPackageTier, PackageCode> = {
  Silver: PackageCode.SILVER,
  Gold: PackageCode.GOLD,
  Platinum: PackageCode.PLATINUM,
};

export function getDemoCapabilities(tier: DemoPackageTier): DemoCapabilities {
  const code = TIER_TO_CODE[tier];
  const features = PACKAGE_FEATURES[code];

  return {
    tier,
    code,
    photos: features.photos === true,
    uploads: features.guest_uploads === true,
    videos: features.video === true,
    slideshow: features.slideshow === true,
    banner: features.banner === true,
    introMedia: features.intro === true,
    flipbook: features.flipbook === true,
    qrDesignCards: features.qr_design_card === true,
    guestbook: true,
    qr: features.custom_qr === true,
    downloads: code === PackageCode.PLATINUM ? "extended" : "limited",
    maxPhotos: typeof features.max_photos === "number" ? features.max_photos : 0,
    maxVideos: typeof features.max_videos === "number" ? features.max_videos : 0,
    uploadDays: typeof features.upload_days === "number" ? features.upload_days : 0,
    downloadDays: typeof features.download_days === "number" ? features.download_days : 0,
    unlimitedPhotos: features.unlimited_photos === true,
    unlimitedVideos: features.unlimited_videos === true,
  };
}

/** Human-readable, product-accurate capability summary for the About panel. */
export function describeCapabilities(caps: DemoCapabilities): string[] {
  const lines: string[] = [
    "Photo gallery with guest uploads",
    "Couple names, wedding date & custom colours",
    "QR access for every guest (no app, no accounts)",
    "Guestbook messages",
  ];

  if (caps.videos) {
    lines.push(
      caps.unlimitedVideos
        ? "Unlimited guest video uploads (fair-use safeguards apply)"
        : `Guest video uploads (up to ${caps.maxVideos})`,
    );
  }
  if (caps.slideshow) lines.push("Live memory slideshow");
  if (caps.banner) lines.push("Custom banner image");
  if (caps.introMedia) lines.push("Intro experience before the vault");
  if (caps.flipbook) lines.push("Interactive digital flipbook");
  if (caps.qrDesignCards) lines.push("Custom QR design cards");

  lines.push(
    caps.unlimitedPhotos
      ? "Unlimited photo uploads (fair-use safeguards apply)"
      : `Up to ${caps.maxPhotos} photo uploads`,
  );
  lines.push(`Uploads open ${caps.uploadDays} day${caps.uploadDays === 1 ? "" : "s"} after the wedding`);
  lines.push(`Downloads open for ${caps.downloadDays} days`);

  return lines;
}
