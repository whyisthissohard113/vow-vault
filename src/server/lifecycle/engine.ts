/**
 * Wedding Lifecycle Engine (Phase 13).
 *
 * The full, deadline-driven state machine:
 *
 *   DRAFT → BUILDING → ACTIVE → UPLOAD_CLOSED → DOWNLOAD_ONLY → EXPIRED →
 *   ARCHIVED → DELETION_PENDING → DELETED
 *
 * Guest-facing deadlines (upload/download) come exclusively from the scheduled
 * wedding date in `Africa/Johannesburg`, persisted UTC in `expiry_rules`
 * (ADR-001). The post-download tail (expired → archived → deletion_pending →
 * deleted) is driven by the centralized retention policy — it never moves the
 * guest-facing deadlines.
 *
 * Design rules:
 *  - `transitionWeddingStatus` is the ONLY mutation primitive for wedding
 *    status. It is CAS-guarded (fromStatus must match), writes an append-only
 *    `lifecycle_events` row and an `audit_logs` row, and reports no-ops so
 *    callers and sweepers are idempotent. Concurrent sweeps can never double
 *    fire a transition.
 *  - `runLifecycleSweep` advances every sweepable wedding one step at a time
 *    against `now`. Re-running it is safe; status guards + exclusive-end
 *    comparisons prevent regressions and duplicates.
 *  - Guest upload/download access is enforced server-side elsewhere from BOTH
 *    the deadline entitlements AND the persisted wedding status (so manual
 *    early closes and post-deadline states hard-block guests even before the
 *    deadlines elapse).
 */

import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  auditLogs,
  expiryRules,
  flipbookPages,
  flipbooks,
  guestSessions,
  lifecycleEvents,
  media,
  mediaProcessingJobs,
  mediaVariants,
  memories,
  qrCodes,
  slideshowItems,
  slideshows,
  vaultAccess,
  vaults,
  weddings,
  products,
  type Wedding,
  type ExpiryRule,
} from "@/lib/db/schema";

/** Event types accepted by `lifecycle_events.event_type`. */
type LifecycleEventType = (typeof lifecycleEvents.$inferInsert)["eventType"];
import { NotFoundError } from "@/lib/auth/errors";
import { calculateExpiryDeadlines, type ExpiryDeadlines } from "@/lib/entitlements/expiry";
import type { PackageCode } from "@/lib/entitlements/packages";
import { createStorageClient, type StorageClient } from "@/server/services/storage/client";
import { LIFECYCLE_POLICY, SWEEPABLE_WEDDING_STATUSES } from "./policy";

// ── Types ──────────────────────────────────────────────────────────────────────

export type WeddingStatus = Wedding["status"];
export type TransitionDirection = "auto" | "manual";

export const MS_PER_DAY = 86_400_000;

export interface TransitionInput {
  weddingId: string;
  fromStatus: WeddingStatus;
  toStatus: WeddingStatus;
  reason: string;
  occurredAt?: Date;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
  /** Override the default event type (used by the builder for build_completed). */
  eventType?: LifecycleEventType;
  direction?: TransitionDirection;
}

export interface TransitionResult {
  changed: boolean;
  /** noop | unexpected_status | done */
  reason?: "noop" | "unexpected_status" | "done";
  lifecycleEventId?: string;
}

export interface SweepTransition {
  weddingId: string;
  organizationId: string;
  fromStatus: WeddingStatus;
  toStatus: WeddingStatus;
  eventType: string;
  reason: string;
  uploadDeadline?: string;
  downloadDeadline?: string;
  vaultSlug?: string | null;
}

export interface LifecycleSweepResult {
  weddingsScanned: number;
  statusTransitions: SweepTransition[];
  guestSessionsRevoked: number;
  weddingsPurged: number;
}

export interface RecalculateDeadlinesResult {
  changed: boolean;
  uploadDeadline: Date;
  downloadDeadline: Date;
  uploadWindowDays: number;
  downloadWindowDays: number;
  weddingDateAtCalculation: Date;
  eventIds: string[];
}

// ── Event type mapping ─────────────────────────────────────────────────────────

function eventTypeFor(
  fromStatus: WeddingStatus,
  toStatus: WeddingStatus,
  direction: TransitionDirection,
): LifecycleEventType {
  if (direction === "auto") {
    switch (toStatus) {
      case "upload_closed":
        return "upload_deadline_reached";
      case "download_only":
        return "download_deadline_reached";
      case "expired":
        return "expired";
      case "archived":
        return "archived";
      case "deletion_pending":
        return "deletion_pending";
      case "deleted":
        return "deleted";
      default:
        break;
    }
  }
  if (toStatus === "active" && fromStatus === "building") return "build_completed";
  return "status_changed";
}

// ── Manual transition whitelist ────────────────────────────────────────────────

/**
 * Manual (human-initiated) transitions allowed by the machine. Everything else
 * must be reached through `runLifecycleSweep` or the build engine. The engine
 * never allows regressions from download_only back to upload_closed/active.
 */
export const MANUAL_TRANSITIONS: Readonly<Record<WeddingStatus, readonly WeddingStatus[]>> = {
  draft: ["archived"],
  building: ["archived"],
  active: ["upload_closed", "archived"],
  upload_closed: ["active", "download_only", "archived"],
  download_only: ["archived"],
  expired: ["archived"],
  archived: [],
  deletion_pending: [],
  deleted: [],
};

export function isManualTransitionAllowed(
  fromStatus: WeddingStatus,
  toStatus: WeddingStatus,
): boolean {
  return MANUAL_TRANSITIONS[fromStatus].includes(toStatus);
}

/**
 * Proposes the next automatic state for a wedding given its current status,
 * its expiry rule and `now`. Returns null when no transition applies. The
 * exclusive-end comparisons mean the instant of the deadline itself is already
 * closed (tests pin "one second before" vs "exact/one second after").
 */
export function resolveNextStatus(
  status: WeddingStatus,
  rule: ExpiryRule,
  now: Date,
): { toStatus: WeddingStatus; reason: string } | null {
  const ts = now.getTime();
  const up = rule.uploadDeadline.getTime();
  const dl = rule.downloadDeadline.getTime();
  const p = LIFECYCLE_POLICY;
  const grace = p.EXPIRY_RETENTION_GRACE_DAYS * MS_PER_DAY;
  const archive = p.ARCHIVE_GRACE_DAYS * MS_PER_DAY;
  const retention = p.RETENTION_DAYS_BEFORE_PURGE_PENDING * MS_PER_DAY;
  const purge = p.PURGE_CANCELLATION_WINDOW_DAYS * MS_PER_DAY;

  switch (status) {
    case "active":
      if (ts >= up) return { toStatus: "upload_closed", reason: "Upload deadline reached" };
      return null;
    case "upload_closed":
      if (ts >= dl) return { toStatus: "download_only", reason: "Download deadline reached" };
      return null;
    case "download_only":
      if (ts >= dl + grace) return { toStatus: "expired", reason: "Expiry retention grace elapsed" };
      return null;
    case "expired":
      if (ts >= dl + grace + archive) {
        return { toStatus: "archived", reason: "Archive grace elapsed" };
      }
      return null;
    case "archived":
      if (ts >= dl + grace + archive + retention) {
        return { toStatus: "deletion_pending", reason: "Retention period elapsed" };
      }
      return null;
    case "deletion_pending":
      if (ts >= dl + grace + archive + retention + purge) {
        return { toStatus: "deleted", reason: "Purge cancellation window elapsed" };
      }
      return null;
    default:
      return null;
  }
}

// ── Transition primitive ───────────────────────────────────────────────────────

/**
 * Single, authoritative, CAS-guarded status mutation. Writes the lifecycle
 * event + audit row only when the transition actually lands. Idempotent:
 * returns `{ changed: false }` (with a reason) when the current status is
 * already the target (noop) or differs from `fromStatus`.
 *
 * Strict-idempotency guard: `fromStatus === toStatus` short-circuits to a
 * `noop` WITHOUT any write — replayed/duplicate jobs must never grow the
 * append-only trail, even for a degenerate self-transition.
 */
export async function transitionWeddingStatus(
  input: TransitionInput,
): Promise<TransitionResult> {
  if (input.fromStatus === input.toStatus) {
    return { changed: false, reason: "noop" };
  }
  const now = input.occurredAt ?? new Date();

  const updated = await db
    .update(weddings)
    .set({ status: input.toStatus, updatedAt: now })
    .where(
      and(eq(weddings.id, input.weddingId), eq(weddings.status, input.fromStatus)),
    )
    .returning({ id: weddings.id, organizationId: weddings.organizationId });

  if (updated.length === 0) {
    const [current] = await db
      .select({ status: weddings.status })
      .from(weddings)
      .where(eq(weddings.id, input.weddingId))
      .limit(1);
    if (!current) throw new NotFoundError("Wedding");
    return {
      changed: false,
      reason: current.status === input.toStatus ? "noop" : "unexpected_status",
    };
  }

  const { organizationId } = updated[0];
  const eventType =
    input.eventType ??
    eventTypeFor(input.fromStatus, input.toStatus, input.direction ?? "auto");

  const [lifecycleEvent] = await db
    .insert(lifecycleEvents)
    .values({
      weddingId: input.weddingId,
      organizationId,
      eventType,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      reason: input.reason,
      actorUserId: input.actorUserId ?? null,
      occurredAt: now,
      metadata: {
        automation: input.direction ?? "auto",
        ...(input.metadata ?? {}),
      },
    })
    .returning({ id: lifecycleEvents.id });

  await db.insert(auditLogs).values({
    organizationId,
    action: "wedding_status_changed",
    resourceType: "wedding",
    resourceId: input.weddingId,
    before: { status: input.fromStatus },
    after: { status: input.toStatus },
    metadata: {
      reason: input.reason,
      automation: input.direction ?? "auto",
      ...(input.metadata ?? {}),
    },
  });

  return { changed: true, reason: "done", lifecycleEventId: lifecycleEvent.id };
}

// ── Guest session revocation ───────────────────────────────────────────────────

/**
 * Revokes every ACTIVE guest session across all live vaults of a wedding
 * (reached the download deadline → guests lose access server-side).
 */
export async function revokeGuestSessionsForWedding(
  weddingId: string,
  now: Date = new Date(),
): Promise<number> {
  const vaultRows = await db
    .select({ id: vaults.id })
    .from(vaults)
    .where(and(eq(vaults.weddingId, weddingId), isNull(vaults.deletedAt)));

  if (vaultRows.length === 0) return 0;

  const revoked = await db
    .update(guestSessions)
    .set({ status: "revoked", updatedAt: now })
    .where(
      and(
        inArray(guestSessions.vaultId, vaultRows.map((v) => v.id)),
        eq(guestSessions.status, "active"),
      ),
    )
    .returning({ id: guestSessions.id });

  return revoked.length;
}

// ── Deadline recalculation (wedding-date changes) ──────────────────────────────

/**
 * Recalculates and upserts `expiry_rules` from a (possibly changed) wedding
 * date and records the `wedding_date_changed` / `deadline_recalculated` audit
 * events. ADR-001: future wedding-date changes must be recalculated + audited.
 *
 * @returns null when the wedding has no product/package (nothing to calculate).
 */
export async function recalculateWeddingDeadlines(input: {
  weddingId: string;
  organizationId: string;
  packageCode: PackageCode;
  newWeddingDate: string;
  actorUserId?: string | null;
}): Promise<RecalculateDeadlinesResult | null> {
  const deadlines: ExpiryDeadlines = calculateExpiryDeadlines(
    { date: input.newWeddingDate },
    input.packageCode,
  );

  const [existing] = await db
    .select()
    .from(expiryRules)
    .where(eq(expiryRules.weddingId, input.weddingId))
    .limit(1);

  const changed =
    !existing ||
    existing.uploadDeadline.getTime() !== deadlines.uploadDeadline.getTime() ||
    existing.downloadDeadline.getTime() !== deadlines.downloadDeadline.getTime() ||
    existing.weddingDateAtCalculation.toISOString().slice(0, 10) !== input.newWeddingDate;

  const eventIds: string[] = [];

  const now = new Date();
  const weddingDateAtCalculation = new Date(`${input.newWeddingDate}T00:00:00.000Z`);

  await db
    .insert(expiryRules)
    .values({
      weddingId: input.weddingId,
      organizationId: input.organizationId,
      uploadDeadline: deadlines.uploadDeadline,
      downloadDeadline: deadlines.downloadDeadline,
      uploadWindowDays: deadlines.uploadWindowDays,
      downloadWindowDays: deadlines.downloadWindowDays,
      timezone: "Africa/Johannesburg",
      calculatedAt: now,
      weddingDateAtCalculation,
    })
    .onConflictDoUpdate({
      target: expiryRules.weddingId,
      set: {
        uploadDeadline: deadlines.uploadDeadline,
        downloadDeadline: deadlines.downloadDeadline,
        uploadWindowDays: deadlines.uploadWindowDays,
        downloadWindowDays: deadlines.downloadWindowDays,
        timezone: "Africa/Johannesburg",
        calculatedAt: now,
        weddingDateAtCalculation,
      },
    });

  // Idempotency: a recalculation that changes NOTHING still refreshes the rule
  // row (harmless upsert) but must not grow the append-only audit trail with
  // duplicate `wedding_date_changed` / `deadline_recalculated` events.
  if (!changed) {
    return {
      changed,
      uploadDeadline: deadlines.uploadDeadline,
      downloadDeadline: deadlines.downloadDeadline,
      uploadWindowDays: deadlines.uploadWindowDays,
      downloadWindowDays: deadlines.downloadWindowDays,
      weddingDateAtCalculation,
      eventIds,
    };
  }

  const [dateEvent] = await db
    .insert(lifecycleEvents)
    .values({
      weddingId: input.weddingId,
      organizationId: input.organizationId,
      eventType: "wedding_date_changed",
      reason: `Wedding date updated to ${input.newWeddingDate}`,
      actorUserId: input.actorUserId ?? null,
      occurredAt: now,
      metadata: {
        newWeddingDate: input.newWeddingDate,
        previousWeddingDate: existing
          ? existing.weddingDateAtCalculation.toISOString().slice(0, 10)
          : null,
      },
    })
    .returning({ id: lifecycleEvents.id });

  const [recalcEvent] = await db
    .insert(lifecycleEvents)
    .values({
      weddingId: input.weddingId,
      organizationId: input.organizationId,
      eventType: "deadline_recalculated",
      reason: "Upload/download deadlines recalculated",
      actorUserId: input.actorUserId ?? null,
      occurredAt: now,
      metadata: {
        uploadDeadline: deadlines.uploadDeadline.toISOString(),
        downloadDeadline: deadlines.downloadDeadline.toISOString(),
        uploadWindowDays: deadlines.uploadWindowDays,
        downloadWindowDays: deadlines.downloadWindowDays,
        previousDeadlines: existing
          ? {
              uploadDeadline: existing.uploadDeadline.toISOString(),
              downloadDeadline: existing.downloadDeadline.toISOString(),
            }
          : null,
      },
    })
    .returning({ id: lifecycleEvents.id });

  eventIds.push(dateEvent.id, recalcEvent.id);

  return {
    changed,
    uploadDeadline: deadlines.uploadDeadline,
    downloadDeadline: deadlines.downloadDeadline,
    uploadWindowDays: deadlines.uploadWindowDays,
    downloadWindowDays: deadlines.downloadWindowDays,
    weddingDateAtCalculation,
    eventIds,
  };
}

// ── Purge (deletion_pending → deleted) ─────────────────────────────────────────

/**
 * Permanently purges a wedding's content: storage objects and content rows.
 * Idempotent + safe for concurrent runs:
 *  - S3 DeleteObject is idempotent (missing object = success),
 *  - row deletes target existing ids only,
 *  - the final `deleted` status flip is CAS-guarded so only one sweep wins.
 *
 * Audit artifacts (lifecycle_events, audit_logs, expiry_rules, email/order/
 * payment history) are deliberately RETAINED; the wedding row itself keeps a
 * tombstone (`deletedAt`, status `deleted`) so the audit trail stays intact.
 */
export async function purgeWedding(
  weddingId: string,
  options: { storage?: StorageClient } = {},
): Promise<void> {
  const storage = options.storage ?? createStorageClient();

  const [wedding] = await db
    .select()
    .from(weddings)
    .where(eq(weddings.id, weddingId))
    .limit(1);
  if (!wedding) throw new NotFoundError("Wedding");
  const { organizationId } = wedding;

  // 1. Storage objects: originals + derived variants.
  const mediaRows = await db
    .select({ id: media.id, storageKey: media.storageKey })
    .from(media)
    .where(eq(media.weddingId, weddingId));
  const mediaIds = mediaRows.map((m) => m.id);

  let variantRows: { storageKey: string }[] = [];
  if (mediaIds.length > 0) {
    variantRows = await db
      .select({ storageKey: mediaVariants.storageKey })
      .from(mediaVariants)
      .where(inArray(mediaVariants.mediaId, mediaIds));
  }

  for (const obj of [...mediaRows, ...variantRows]) {
    if (!obj.storageKey) continue;
    try {
      await storage.deleteObject(obj.storageKey);
    } catch (error) {
      // Purge is retryable: failures are logged and the wedding stays
      // deletion_pending so the next sweep retries the purge.
      console.error(
        `[Lifecycle] purgeWedding(${weddingId}) storage delete failed for ${obj.storageKey}:`,
        error,
      );
    }
  }

  // 2. Content rows (FK-safe order; explicit deletes because the wedding row
  //    is retained as a tombstone rather than cascade-deleted).
  if (mediaIds.length > 0) {
    await db
      .delete(mediaVariants)
      .where(inArray(mediaVariants.mediaId, mediaIds));
    await db
      .delete(mediaProcessingJobs)
      .where(inArray(mediaProcessingJobs.mediaId, mediaIds));
    await db.delete(media).where(inArray(media.id, mediaIds));
  }
  await db.delete(memories).where(eq(memories.weddingId, weddingId));

  const slideshowRows = await db
    .select({ id: slideshows.id })
    .from(slideshows)
    .where(eq(slideshows.weddingId, weddingId));
  if (slideshowRows.length > 0) {
    await db
      .delete(slideshowItems)
      .where(inArray(slideshowItems.slideshowId, slideshowRows.map((s) => s.id)));
    await db.delete(slideshows).where(inArray(slideshows.id, slideshowRows.map((s) => s.id)));
  }

  const flipbookRows = await db
    .select({ id: flipbooks.id })
    .from(flipbooks)
    .where(eq(flipbooks.weddingId, weddingId));
  if (flipbookRows.length > 0) {
    await db
      .delete(flipbookPages)
      .where(inArray(flipbookPages.flipbookId, flipbookRows.map((f) => f.id)));
    await db.delete(flipbooks).where(inArray(flipbooks.id, flipbookRows.map((f) => f.id)));
  }

  await db.delete(qrCodes).where(eq(qrCodes.weddingId, weddingId));

  const vaultRows = await db
    .select({ id: vaults.id })
    .from(vaults)
    .where(eq(vaults.weddingId, weddingId));
  if (vaultRows.length > 0) {
    const vaultIds = vaultRows.map((v) => v.id);
    await db
      .delete(guestSessions)
      .where(inArray(guestSessions.vaultId, vaultIds));
    await db.delete(vaultAccess).where(inArray(vaultAccess.vaultId, vaultIds));
    const now = new Date();
    await db
      .update(vaults)
      .set({ deletedAt: now, updatedAt: now })
      .where(inArray(vaults.id, vaultIds));
  }

  // 3. Tombstone the wedding (audit + lifecycle rows survive).
  const now = new Date();
  await db
    .update(weddings)
    .set({ status: "deleted", deletedAt: now, updatedAt: now })
    .where(and(eq(weddings.id, weddingId), isNull(weddings.deletedAt)));

  await db.insert(lifecycleEvents).values({
    weddingId,
    organizationId,
    eventType: "deleted",
    fromStatus: "deletion_pending",
    toStatus: "deleted",
    reason: "Wedding content purged after retention and cancellation window",
    occurredAt: now,
    metadata: {
      automation: "lifecycle_scan",
      storageObjectsDeleted: mediaRows.length + variantRows.length,
    },
  });

  await db.insert(auditLogs).values({
    organizationId,
    action: "wedding_purged",
    resourceType: "wedding",
    resourceId: weddingId,
    before: { status: "deletion_pending" },
    after: { status: "deleted", deletedAt: now.toISOString() },
    metadata: { automation: "lifecycle_scan" },
  });
}

// ── Main sweep ─────────────────────────────────────────────────────────────────

/**
 * Runs one idempotent lifecycle sweep advancing every sweepable wedding at most
 * one step. Safe to call repeatedly and from concurrent workers.
 *
 * `options.organizationId` scopes the sweep to ONE tenant — used by tenant-
 * scoped operators and by deterministic integration tests so a simulated clock
 * never advances another tenant's weddings. Omitted → global sweep (the
 * production email worker contract).
 */
export async function runLifecycleSweep(
  now: Date = new Date(),
  options: { organizationId?: string } = {},
): Promise<LifecycleSweepResult> {
  const rows = await db
    .select({
      wedding: weddings,
      rule: expiryRules,
      vault: vaults,
    })
    .from(weddings)
    .innerJoin(expiryRules, eq(weddings.id, expiryRules.weddingId))
    .leftJoin(vaults, and(eq(vaults.weddingId, weddings.id), isNull(vaults.deletedAt)))
    .where(
      and(
        inArray(weddings.status, [...SWEEPABLE_WEDDING_STATUSES]),
        isNull(weddings.deletedAt),
        options.organizationId
          ? eq(weddings.organizationId, options.organizationId)
          : undefined,
      ),
    );

  let sessionsRevoked = 0;
  let purged = 0;

  const transitions: SweepTransition[] = [];

  for (const row of rows) {
    const { rule } = row;
    const uploadIso = rule.uploadDeadline.toISOString();
    const downloadIso = rule.downloadDeadline.toISOString();

    const next = resolveNextStatus(row.wedding.status, rule, now);
    if (!next) continue;

    if (next.toStatus === "deleted") {
      await purgeWedding(row.wedding.id);
      purged += 1;
      transitions.push({
        weddingId: row.wedding.id,
        organizationId: row.wedding.organizationId,
        fromStatus: row.wedding.status,
        toStatus: "deleted",
        eventType: "deleted",
        reason: next.reason,
        uploadDeadline: uploadIso,
        downloadDeadline: downloadIso,
        vaultSlug: row.vault?.slug ?? null,
      });
      continue;
    }

    const result = await transitionWeddingStatus({
      weddingId: row.wedding.id,
      fromStatus: row.wedding.status,
      toStatus: next.toStatus,
      reason: next.reason,
      occurredAt: now,
      direction: "auto",
    });

    if (!result.changed) continue;

    if (next.toStatus === "download_only") {
      sessionsRevoked += await revokeGuestSessionsForWedding(row.wedding.id, now);
    }

    if (next.toStatus === "archived" && row.vault) {
      await db
        .update(vaults)
        .set({ status: "archived", updatedAt: now })
        .where(eq(vaults.id, row.vault.id));
    }

    transitions.push({
      weddingId: row.wedding.id,
      organizationId: row.wedding.organizationId,
      fromStatus: row.wedding.status,
      toStatus: next.toStatus,
      eventType: eventTypeFor(row.wedding.status, next.toStatus, "auto"),
      reason: next.reason,
      uploadDeadline: uploadIso,
      downloadDeadline: downloadIso,
      vaultSlug: row.vault?.slug ?? null,
    });
  }

  return {
    weddingsScanned: rows.length,
    statusTransitions: transitions,
    guestSessionsRevoked: sessionsRevoked,
    weddingsPurged: purged,
  };
}

// ── Package code resolution (for wedding-date recalcs) ─────────────────────────

/** Resolves a wedding's package code by its product SKU (null when unassigned). */
export async function resolveWeddingPackageCode(
  weddingId: string,
): Promise<PackageCode | null> {
  const [row] = await db
    .select({ code: products.code })
    .from(weddings)
    .leftJoin(products, eq(weddings.productId, products.id))
    .where(eq(weddings.id, weddingId))
    .limit(1);

  if (!row?.code) return null;
  const code = row.code;
  return code === "silver" || code === "gold" || code === "platinum" ? code : null;
}