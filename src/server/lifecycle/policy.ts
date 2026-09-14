/**
 * Lifecycle policy — centralized, tunable retention/transition constants and
 * guest-access status gates for the wedding lifecycle engine (Phase 13).
 *
 * Guest-facing deadlines (upload/download windows) are ALWAYS derived from the
 * scheduled wedding date in `Africa/Johanesburg` (see ADR-001) and stored UTC in
 * `expiry_rules`. The constants below are *post-expiry retention* knobs — they
 * never shift the guest-facing deadline themselves; they only decide how long
 * the closed vault is retained in each downstream status.
 *
 * Timeline anchors for the automated tail (all exclusive-end instants):
 *   upload_closed      @ uploadDeadline
 *   download_only      @ downloadDeadline
 *   expired            @ downloadDeadline + EXPIRY_RETENTION_GRACE_DAYS
 *   archived           @ downloadDeadline + EXPIRY_RETENTION_GRACE_DAYS
 *                                     + ARCHIVE_GRACE_DAYS
 *   deletion_pending   @ downloadDeadline + ... + RETENTION_DAYS_BEFORE_PURGE_PENDING
 *   deleted            @ downloadDeadline + ... + PURGE_CANCELLATION_WINDOW_DAYS
 *
 * Manually archived vaults are anchored to the same download-deadline timeline
 * (safe default: the would-be deadline simply keeps running).
 */

import type { Wedding } from "@/lib/db/schema";

/** Wedding status values used by the guest-access gates below. */
type WeddingStatus = Wedding["status"];

export const LIFECYCLE_POLICY = {
  /** download_only → expired retention grace (days after the download deadline). */
  EXPIRY_RETENTION_GRACE_DAYS: 30,
  /** expired → archived grace (days after the `expired` transition). */
  ARCHIVE_GRACE_DAYS: 30,
  /** archived → deletion_pending retention (days after the `archived` transition). */
  RETENTION_DAYS_BEFORE_PURGE_PENDING: 365,
  /** deletion_pending → deleted cancellation/purge window (days). */
  PURGE_CANCELLATION_WINDOW_DAYS: 30,
} as const;

/**
 * Wedding statuses the automated sweep may advance. Includes every status the
 * machine can leave WITHOUT a human action — including `deletion_pending`,
 * whose purge (→ `deleted`) the sweep alone performs. Excludes `deleted`
 * (terminal tombstone) and `draft`/`building` (owned by the build engine).
 */
export const SWEEPABLE_WEDDING_STATUSES: readonly WeddingStatus[] = [
  "active",
  "upload_closed",
  "download_only",
  "expired",
  "archived",
  "deletion_pending",
];

/** Guest uploads are only authorized for `active` weddings (belt-and-braces on top of `uploadOpen`). */
export const GUEST_UPLOAD_ALLOWED_WEDDING_STATUSES: readonly WeddingStatus[] = ["active"];

/** Guest downloads are only authorized for `active`/`upload_closed` weddings (belt-and-braces on top of `downloadOpen`). */
export const GUEST_DOWNLOAD_ALLOWED_WEDDING_STATUSES: readonly WeddingStatus[] = [
  "active",
  "upload_closed",
];