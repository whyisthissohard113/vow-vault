/**
 * Package-specific file-size limits.
 *
 * Fair-use technical control per MASTER_SPEC and AGENTS.md ("Unlimited" is an
 * entitlement, not a licence to remove technical safeguards):
 *  - photos ≤ 25 MB for Silver/Gold/Platinum
 *  - videos ≤ 250 MB for Gold & Platinum (Silver has no video entitlement)
 */

import type { ResolvedEntitlements } from "@/lib/entitlements";
import { entitlementHasFeature } from "@/lib/entitlements";
import { MediaSizeExceededError } from "@/lib/auth/errors";

export const PHOTO_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
export const VIDEO_MAX_BYTES = 250 * 1024 * 1024; // 250 MB

export type MediaKind = "photo" | "video";

export interface UploadLimits {
  maxPhotoBytes: number;
  maxVideoBytes: number;
}

/**
 * Resolves per-package upload size limits from resolved entitlements.
 * Video is only available to packages with the `video` feature enabled.
 */
export function getUploadLimits(entitlements: ResolvedEntitlements): UploadLimits {
  const videoEnabled = entitlementHasFeature(entitlements, "video");
  return {
    maxPhotoBytes: PHOTO_MAX_BYTES,
    maxVideoBytes: videoEnabled ? VIDEO_MAX_BYTES : 0,
  };
}

/**
 * Rejects uploads whose declared size exceeds the package limit.
 * Throws `MediaSizeExceededError` (HTTP 400-family) when over the limit.
 */
export function enforceSizeLimit(
  sizeBytes: number,
  limits: UploadLimits,
  kind: MediaKind,
): void {
  const limit = kind === "photo" ? limits.maxPhotoBytes : limits.maxVideoBytes;

  if (sizeBytes > limit) {
    const mb = (limit / (1024 * 1024)).toFixed(0);
    throw new MediaSizeExceededError(
      `${kind} exceeds the ${mb} MB size limit (${sizeBytes} bytes)`,
    );
  }
}