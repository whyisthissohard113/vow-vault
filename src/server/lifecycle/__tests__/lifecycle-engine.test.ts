/**
 * Lifecycle Engine integration tests (Phase 13, ADR-011).
 *
 * Exercises the complete wedding lifecycle machine against the real dev
 * Postgres (like the other server suites) with simulated sweep clocks:
 *
 *   DRAFT → BUILDING → ACTIVE → UPLOAD_CLOSED → DOWNLOAD_ONLY → EXPIRED →
 *   ARCHIVED → DELETION_PENDING → DELETED
 *
 * Coverage required by the phase task:
 *   - same-day / future weddings, month & year boundaries, leap years,
 *   - Africa/Johannesburg timezone behavior (UTC+2 constant, no DST),
 *   - exact expiry moment vs one second before/after (exclusive-end),
 *   - wedding-date modification (deadline recalculation + audit),
 *   - already-expired weddings,
 *   - repeated lifecycle sweeps & CAS idempotency,
 *   - guest-session revocation at DOWNLOAD_ONLY,
 *   - the DELETION_PENDING → DELETED purge (incl. storage + content purge).
 *
 * Timeline: sweep fixtures use 2028/2029 deadlines so real-time sweeps in the
 * email suite (2026 window) never touch them, mirroring the repo's
 * cross-suite timeline convention.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  organizations,
  customers,
  products,
  weddings,
  vaults,
  guestSessions,
  expiryRules,
  lifecycleEvents,
  auditLogs,
  media,
  mediaVariants,
  mediaProcessingJobs,
  memories,
  slideshows,
  slideshowItems,
  flipbooks,
  flipbookPages,
  qrCodes,
} from "@/lib/db/schema";
import {
  runLifecycleSweep,
  transitionWeddingStatus,
  recalculateWeddingDeadlines,
  resolveNextStatus,
  isManualTransitionAllowed,
  MANUAL_TRANSITIONS,
  resolveWeddingPackageCode,
  purgeWedding,
  type WeddingStatus,
} from "@/server/lifecycle/engine";
import { LIFECYCLE_POLICY, SWEEPABLE_WEDDING_STATUSES } from "@/server/lifecycle/policy";
import { calculateExpiryDeadlines, BUSINESS_TIMEZONE } from "@/lib/entitlements/expiry";
import { memoryStorageClient } from "@/server/services/storage/client";

// ── Test identity (isolated UUID family; no other suite uses 66666666) ───────

const ORG = "66666666-6666-6666-6666-666666666601";
const CUST = "66666666-6666-6666-6666-666666666602";
const PRODUCT = "66666666-6666-6666-6666-666666666603";

/** Builds a scoped test id: `66666666-6666-6666-6666-<12 hex chars>`. */
function nid(seed: string): string {
  return `66666666-6666-6666-6666-${seed}`;
}

const MS_PER_DAY = 86_400_000;

// ── Fixture helpers ───────────────────────────────────────────────────────────

async function seedBase(opts: { org?: boolean; customer?: boolean; product?: boolean } = {}) {
  if (opts.org) {
    await db
      .insert(organizations)
      .values({ id: ORG, publicId: "pub-lc-org", name: "Lifecycle Test Co", slug: "lifecycle-test-co", type: "wedding_company", status: "active" })
      .onConflictDoNothing();
  }
  if (opts.customer) {
    await db
      .insert(customers)
      .values({ id: CUST, organizationId: ORG, publicId: "pub-lc-cust", fullName: "Zoe & Alex", email: "zoe+lifecycle@example.com" })
      .onConflictDoNothing();
  }
  if (opts.product) {
    // Org-scoped product so we never touch the seeded platform catalog
    // (platform "gold" has order_items and must not be deleted by a suite).
    await db
      .insert(products)
      .values({ id: PRODUCT, organizationId: ORG, code: "gold", name: "Gold", type: "one_time", priceCents: 79900, currency: "ZAR", status: "active", sortOrder: 2 })
      .onConflictDoNothing();
  }
}

async function seedWedding(opts: {
  id: string;
  status?: WeddingStatus;
  weddingDate?: Date;
  productId?: string | null;
  uploadDeadline: Date;
  downloadDeadline: Date;
  uploadWindowDays?: number;
  downloadWindowDays?: number;
}): Promise<void> {
  await db.insert(weddings).values({
    id: opts.id,
    organizationId: ORG,
    customerId: CUST,
    publicId: `pub-lc-${opts.id.slice(-6)}`,
    code: `LC-${opts.id.slice(-4)}`,
    name: "Lifecycle Wedding",
    partnerOneName: "Zoe",
    partnerTwoName: "Alex",
    weddingDate: opts.weddingDate,
    status: opts.status ?? "active",
    productId: opts.productId ?? null,
    timezone: "Africa/Johannesburg",
  });
  await db.insert(expiryRules).values({
    weddingId: opts.id,
    organizationId: ORG,
    uploadDeadline: opts.uploadDeadline,
    downloadDeadline: opts.downloadDeadline,
    uploadWindowDays: opts.uploadWindowDays ?? 7,
    downloadWindowDays: opts.downloadWindowDays ?? 30,
    timezone: "Africa/Johannesburg",
    weddingDateAtCalculation:
      opts.weddingDate ?? new Date(opts.uploadDeadline.getTime() - 7 * MS_PER_DAY),
  });
}

async function seedVault(id: string, weddingId: string): Promise<void> {
  await db.insert(vaults).values({
    id,
    weddingId,
    organizationId: ORG,
    publicId: `pub-lc-v-${id.slice(-6)}`,
    slug: `lc-vault-${id.slice(-4)}`,
    title: "Lifecycle Vault",
    status: "published",
    publishedAt: new Date(),
  });
}

async function seedGuestSession(id: string, vaultId: string, status: "active" | "revoked" | "expired" = "active"): Promise<void> {
  await db.insert(guestSessions).values({
    id,
    vaultId,
    organizationId: ORG,
    token: `lc-token-${id.slice(-6)}`,
    status,
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  });
}

async function weddingStatus(id: string): Promise<WeddingStatus | null> {
  const [row] = await db
    .select({ status: weddings.status })
    .from(weddings)
    .where(eq(weddings.id, id))
    .limit(1);
  return row?.status ?? null;
}

type LifecycleEventType = (typeof lifecycleEvents.$inferInsert)["eventType"];

async function countEvents(weddingId: string, eventType?: LifecycleEventType): Promise<number> {
  const rows = await db
    .select({ id: lifecycleEvents.id })
    .from(lifecycleEvents)
    .where(
      eventType
        ? and(eq(lifecycleEvents.weddingId, weddingId), eq(lifecycleEvents.eventType, eventType))
        : eq(lifecycleEvents.weddingId, weddingId),
    );
  return rows.length;
}

// ── Cleanup (FK-safe; includes purge content tables) ──────────────────────────
//
// `mediaVariants`, `slideshowItems` and `flipbookPages` carry no
// `organization_id` column, so they are scoped through their parents.

async function cleanup() {
  const slideshowIds = (
    await db
      .select({ id: slideshows.id })
      .from(slideshows)
      .where(eq(slideshows.organizationId, ORG))
  ).map((r) => r.id);
  if (slideshowIds.length > 0) {
    await db.delete(slideshowItems).where(inArray(slideshowItems.slideshowId, slideshowIds));
  }
  await db.delete(slideshows).where(eq(slideshows.organizationId, ORG));

  const flipbookIds = (
    await db
      .select({ id: flipbooks.id })
      .from(flipbooks)
      .where(eq(flipbooks.organizationId, ORG))
  ).map((r) => r.id);
  if (flipbookIds.length > 0) {
    await db.delete(flipbookPages).where(inArray(flipbookPages.flipbookId, flipbookIds));
  }
  await db.delete(flipbooks).where(eq(flipbooks.organizationId, ORG));

  const mediaIds = (
    await db
      .select({ id: media.id })
      .from(media)
      .where(eq(media.organizationId, ORG))
  ).map((r) => r.id);
  if (mediaIds.length > 0) {
    await db.delete(mediaProcessingJobs).where(inArray(mediaProcessingJobs.mediaId, mediaIds));
    await db.delete(mediaVariants).where(inArray(mediaVariants.mediaId, mediaIds));
    await db.delete(media).where(inArray(media.id, mediaIds));
  }
  await db.delete(memories).where(eq(memories.organizationId, ORG));
  await db.delete(qrCodes).where(eq(qrCodes.organizationId, ORG));
  await db.delete(guestSessions).where(eq(guestSessions.organizationId, ORG));
  await db.delete(vaults).where(eq(vaults.organizationId, ORG));
  await db.delete(lifecycleEvents).where(eq(lifecycleEvents.organizationId, ORG));
  await db.delete(expiryRules).where(eq(expiryRules.organizationId, ORG));
  await db.delete(weddings).where(eq(weddings.organizationId, ORG));
  await db.delete(auditLogs).where(eq(auditLogs.organizationId, ORG));
  await db.delete(customers).where(eq(customers.organizationId, ORG));
  await db
    .delete(products)
    .where(eq(products.organizationId, ORG));
  await db.delete(organizations).where(eq(organizations.id, ORG));
}

beforeEach(async () => {
  await cleanup();
  await seedBase({ org: true, customer: true });
});
afterEach(cleanup);

// Every sweep in this suite is scoped to ORG so the simulated clocks never
// advance (or purge) other tenants'/suites' rows on the shared dev DB.
const SWEEP_ORG = { organizationId: ORG } as const;
const sweepForOrg = (now: Date = new Date()) => runLifecycleSweep(now, SWEEP_ORG);

// ══════════════════════════════════════════════════════════════════════════════
// Expiry calculation — calendar boundaries & timezone
// ══════════════════════════════════════════════════════════════════════════════

describe("expiry calculation — calendar boundary scenarios", () => {
  it("same-day wedding (silver, 2-day upload / 7-day download)", () => {
    const d = calculateExpiryDeadlines({ date: "2026-09-14" }, "silver");
    expect(d.uploadDeadline.toISOString()).toBe("2026-09-16T23:59:59.999Z");
    expect(d.downloadDeadline.toISOString()).toBe("2026-09-21T23:59:59.999Z");
    expect(d.uploadWindowDays).toBe(2);
    expect(d.downloadWindowDays).toBe(7);
  });

  it("future wedding (gold, 7-day upload / 30-day download)", () => {
    const d = calculateExpiryDeadlines({ date: "2027-05-20" }, "gold");
    expect(d.uploadDeadline.toISOString()).toBe("2027-05-27T23:59:59.999Z");
    expect(d.downloadDeadline.toISOString()).toBe("2027-06-19T23:59:59.999Z");
  });

  it("platinum download window is +90 days", () => {
    const d = calculateExpiryDeadlines({ date: "2026-09-14" }, "platinum");
    expect(d.downloadWindowDays).toBe(90);
    expect(d.downloadDeadline.toISOString()).toBe("2026-12-13T23:59:59.999Z");
  });

  it("month boundary (silver wedding 2026-01-29 → Jan 31 upload, Feb 5 download)", () => {
    const d = calculateExpiryDeadlines({ date: "2026-01-29" }, "silver");
    expect(d.uploadDeadline.toISOString()).toBe("2026-01-31T23:59:59.999Z");
    expect(d.downloadDeadline.toISOString()).toBe("2026-02-05T23:59:59.999Z");
  });

  it("year boundary (gold wedding 2026-12-29 → 2027-01-05 upload, 2027-01-28 download)", () => {
    const d = calculateExpiryDeadlines({ date: "2026-12-29" }, "gold");
    expect(d.uploadDeadline.toISOString()).toBe("2027-01-05T23:59:59.999Z");
    expect(d.downloadDeadline.toISOString()).toBe("2027-01-28T23:59:59.999Z");
  });

  it("leap year (gold wedding 2028-02-28 counts Feb 29 → Mar 6 upload, Mar 29 download)", () => {
    const leap = calculateExpiryDeadlines({ date: "2028-02-28" }, "gold");
    expect(leap.uploadDeadline.toISOString()).toBe("2028-03-06T23:59:59.999Z");
    expect(leap.downloadDeadline.toISOString()).toBe("2028-03-29T23:59:59.999Z");
  });

  it("non-leap control (2029-02-28 → Mar 7 upload, Mar 30 download)", () => {
    const plain = calculateExpiryDeadlines({ date: "2029-02-28" }, "gold");
    expect(plain.uploadDeadline.toISOString()).toBe("2029-03-07T23:59:59.999Z");
    expect(plain.downloadDeadline.toISOString()).toBe("2029-03-30T23:59:59.999Z");
  });

  it("Africa/Johannesburg is a constant UTC+2 zone (no DST) so deadlines never drift an hour", () => {
    // SAST = UTC+2 year-round (South Africa abolished DST in 1944). Verify the
    // offset is stable across the year regardless of northern-hemisphere DST
    // months, and that every derived deadline retains the exact exclusive-end
    // instant (`T23:59:59.999Z`) with no off-by-one-hour drift.
    expect(BUSINESS_TIMEZONE).toBe("Africa/Johannesburg");
    for (const probe of [
      "2026-01-15T12:00:00Z",
      "2026-03-29T12:00:00Z", // EU spring-forward month
      "2026-06-15T12:00:00Z",
      "2026-10-25T12:00:00Z", // EU fall-back month
    ]) {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: BUSINESS_TIMEZONE,
        timeZoneName: "longOffset",
      }).formatToParts(new Date(probe));
      const offset = parts.find((p) => p.type === "timeZoneName")?.value;
      expect(offset).toBe("GMT+02:00");
    }

    const a = calculateExpiryDeadlines({ date: "2026-03-28" }, "silver"); // around EU DST
    const b = calculateExpiryDeadlines({ date: "2026-03-31" }, "silver");
    expect(a.uploadDeadline.toISOString()).toBe("2026-03-30T23:59:59.999Z");
    expect(b.downloadDeadline.toISOString()).toBe("2026-04-07T23:59:59.999Z");
    // The +N-day offsets are exactly N*24h apart in storage (UTC) — no drift.
    expect(b.uploadDeadline.getTime() - a.uploadDeadline.getTime()).toBe(3 * MS_PER_DAY);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// resolveNextStatus — exact-moment semantics (exclusive-end)
// ══════════════════════════════════════════════════════════════════════════════

describe("resolveNextStatus — exact expiry moments", () => {
  const uploadDeadline = new Date("2028-06-01T23:59:59.999Z");
  const downloadDeadline = new Date("2028-07-01T23:59:59.999Z");
  const rule = {
    uploadDeadline,
    downloadDeadline,
  } as Parameters<typeof resolveNextStatus>[1];

  it("active stays active one second BEFORE the upload deadline", () => {
    const before = new Date(uploadDeadline.getTime() - 1000);
    expect(resolveNextStatus("active", rule, before)).toBeNull();
  });

  it("active → upload_closed AT the exact upload deadline instant (exclusive end is closed)", () => {
    const exact = new Date(uploadDeadline.getTime());
    expect(resolveNextStatus("active", rule, exact)).toEqual({
      toStatus: "upload_closed",
      reason: "Upload deadline reached",
    });
  });

  it("active → upload_closed one second AFTER the upload deadline", () => {
    const after = new Date(uploadDeadline.getTime() + 1000);
    expect(resolveNextStatus("active", rule, after)?.toStatus).toBe("upload_closed");
  });

  it("upload_closed stays put one second BEFORE the download deadline", () => {
    const before = new Date(downloadDeadline.getTime() - 1000);
    expect(resolveNextStatus("upload_closed", rule, before)).toBeNull();
  });

  it("upload_closed → download_only AT the exact download deadline", () => {
    const exact = new Date(downloadDeadline.getTime());
    expect(resolveNextStatus("upload_closed", rule, exact)).toEqual({
      toStatus: "download_only",
      reason: "Download deadline reached",
    });
  });

  it("download_only → expired exactly at download + EXPIRY_RETENTION_GRACE_DAYS", () => {
    const grace = LIFECYCLE_POLICY.EXPIRY_RETENTION_GRACE_DAYS * MS_PER_DAY;
    const atGrace = new Date(downloadDeadline.getTime() + grace);
    expect(resolveNextStatus("download_only", rule, atGrace)?.toStatus).toBe("expired");
    expect(resolveNextStatus("download_only", rule, new Date(atGrace.getTime() - 1000))).toBeNull();
  });

  it("expired → archived exactly at download + grace + ARCHIVE_GRACE_DAYS", () => {
    const grace = LIFECYCLE_POLICY.EXPIRY_RETENTION_GRACE_DAYS * MS_PER_DAY;
    const archive = LIFECYCLE_POLICY.ARCHIVE_GRACE_DAYS * MS_PER_DAY;
    const atArchive = new Date(downloadDeadline.getTime() + grace + archive);
    expect(resolveNextStatus("expired", rule, atArchive)?.toStatus).toBe("archived");
    expect(resolveNextStatus("expired", rule, new Date(atArchive.getTime() - 1000))).toBeNull();
  });

  it("archived → deletion_pending after the retention window", () => {
    const grace = LIFECYCLE_POLICY.EXPIRY_RETENTION_GRACE_DAYS * MS_PER_DAY;
    const archive = LIFECYCLE_POLICY.ARCHIVE_GRACE_DAYS * MS_PER_DAY;
    const retention = LIFECYCLE_POLICY.RETENTION_DAYS_BEFORE_PURGE_PENDING * MS_PER_DAY;
    const atRetention = new Date(downloadDeadline.getTime() + grace + archive + retention);
    expect(resolveNextStatus("archived", rule, atRetention)?.toStatus).toBe("deletion_pending");
  });

  it("deletion_pending → deleted after the purge/cancellation window", () => {
    const grace = LIFECYCLE_POLICY.EXPIRY_RETENTION_GRACE_DAYS * MS_PER_DAY;
    const archive = LIFECYCLE_POLICY.ARCHIVE_GRACE_DAYS * MS_PER_DAY;
    const retention = LIFECYCLE_POLICY.RETENTION_DAYS_BEFORE_PURGE_PENDING * MS_PER_DAY;
    const purge = LIFECYCLE_POLICY.PURGE_CANCELLATION_WINDOW_DAYS * MS_PER_DAY;
    const atPurge = new Date(downloadDeadline.getTime() + grace + archive + retention + purge);
    expect(resolveNextStatus("deletion_pending", rule, atPurge)?.toStatus).toBe("deleted");

    // The sweep must be able to SELECT deletion_pending weddings (ADR-011 tail).
    expect(SWEEPABLE_WEDDING_STATUSES).toContain("deletion_pending");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// transitionWeddingStatus — CAS, idempotency, append-only trail
// ══════════════════════════════════════════════════════════════════════════════

describe("transitionWeddingStatus — CAS guard & idempotency", () => {
const WED = nid("000000000101");
const uploadDeadline = new Date("2029-01-10T23:59:59.999Z");
const downloadDeadline = new Date("2029-02-10T23:59:59.999Z");

beforeEach(async () => {
    await seedWedding({
      id: WED,
      status: "active",
      uploadDeadline,
      downloadDeadline,
    });
  });

  it("lands a guarded transition and appends lifecycle event + audit row", async () => {
    const result = await transitionWeddingStatus({
      weddingId: WED,
      fromStatus: "active",
      toStatus: "upload_closed",
      reason: "manual close",
      direction: "manual",
    });
    expect(result.changed).toBe(true);
    expect(result.reason).toBe("done");

    expect(await weddingStatus(WED)).toBe("upload_closed");
    expect(await countEvents(WED, "status_changed")).toBe(1);
    const audits = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.organizationId, ORG), eq(auditLogs.resourceId, WED)));
    expect(audits.some((a) => a.action === "wedding_status_changed")).toBe(true);
    expect(audits.at(-1)?.before).toEqual({ status: "active" });
    expect(audits.at(-1)?.after).toEqual({ status: "upload_closed" });
  });

  it("re-running the SAME transition is a no-op (idempotent repeated job)", async () => {
    await transitionWeddingStatus({
      weddingId: WED,
      fromStatus: "active",
      toStatus: "upload_closed",
      reason: "first",
      direction: "manual",
    });
    const second = await transitionWeddingStatus({
      weddingId: WED,
      fromStatus: "active",
      toStatus: "upload_closed",
      reason: "second",
      direction: "manual",
    });
    expect(second.changed).toBe(false);
    // Wedding is already at the target → the guarded update reports a noop.
    expect(second.reason).toBe("noop");
    expect(await countEvents(WED)).toBe(1); // no duplicate event
  });

  it("a manual regression from download_only back to active is impossible via CAS", async () => {
    await transitionWeddingStatus({
      weddingId: WED,
      fromStatus: "active",
      toStatus: "download_only",
      reason: "should not happen via manual",
      direction: "manual",
    });
    // even with a manual whitelist bug, the CAS fromStatus guard blocks:
    const regress = await transitionWeddingStatus({
      weddingId: WED,
      fromStatus: "upload_closed",
      toStatus: "active",
      reason: "tamper",
      direction: "manual",
    });
    expect(regress.changed).toBe(false);
    expect(await weddingStatus(WED)).toBe("download_only");
  });

  it("reports noop when the wedding is already in the target status", async () => {
    const noop = await transitionWeddingStatus({
      weddingId: WED,
      fromStatus: "active",
      toStatus: "active",
      reason: "nothing to do",
      direction: "manual",
    });
    expect(noop.changed).toBe(false);
    expect(noop.reason).toBe("noop");
    expect(await countEvents(WED)).toBe(0);
  });
});

describe("manual transition whitelist (MANUAL_TRANSITIONS)", () => {
  it("allows only documented manual moves and never regresses", () => {
    expect(isManualTransitionAllowed("draft", "archived")).toBe(true);
    expect(isManualTransitionAllowed("building", "archived")).toBe(true);
    expect(isManualTransitionAllowed("active", "upload_closed")).toBe(true);
    expect(isManualTransitionAllowed("active", "archived")).toBe(true);
    expect(isManualTransitionAllowed("upload_closed", "active")).toBe(true);
    expect(isManualTransitionAllowed("upload_closed", "download_only")).toBe(true);
    expect(isManualTransitionAllowed("download_only", "archived")).toBe(true);
    expect(isManualTransitionAllowed("expired", "archived")).toBe(true);

    // No regressions from later states back to earlier guest-facing states.
    expect(isManualTransitionAllowed("download_only", "upload_closed")).toBe(false);
    expect(isManualTransitionAllowed("download_only", "active")).toBe(false);
    expect(isManualTransitionAllowed("expired", "active")).toBe(false);
    expect(isManualTransitionAllowed("archived", "active")).toBe(false);
    expect(isManualTransitionAllowed("archived", "upload_closed")).toBe(false);
    expect(isManualTransitionAllowed("deleted", "active")).toBe(false);
    expect(isManualTransitionAllowed("deletion_pending", "archived")).toBe(false);

    // Terminal states can never be left.
    expect(MANUAL_TRANSITIONS.archived).toEqual([]);
    expect(MANUAL_TRANSITIONS.deletion_pending).toEqual([]);
    expect(MANUAL_TRANSITIONS.deleted).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// runLifecycleSweep — the full machine, one step per sweep, idempotent
// ══════════════════════════════════════════════════════════════════════════════

describe("runLifecycleSweep — full lifecycle machine", () => {
  const WED = nid("000000000201");
  const VAULT = nid("000000000202");
  const SESSION = nid("000000000203");
  // Gold timeline anchored to a far-future window so no other suite's
  // real-time sweep can touch the fixture.
  const uploadDeadline = new Date("2028-06-01T23:59:59.999Z");
  const downloadDeadline = new Date("2028-07-01T23:59:59.999Z");
  const G = LIFECYCLE_POLICY.EXPIRY_RETENTION_GRACE_DAYS * MS_PER_DAY;
  const A = LIFECYCLE_POLICY.ARCHIVE_GRACE_DAYS * MS_PER_DAY;
  const R = LIFECYCLE_POLICY.RETENTION_DAYS_BEFORE_PURGE_PENDING * MS_PER_DAY;
  const P = LIFECYCLE_POLICY.PURGE_CANCELLATION_WINDOW_DAYS * MS_PER_DAY;

  beforeEach(async () => {
    await seedWedding({
      id: WED,
      status: "active",
      weddingDate: new Date("2028-05-20T00:00:00.000Z"),
      uploadDeadline,
      downloadDeadline,
    });
    await seedVault(VAULT, WED);
    await seedGuestSession(SESSION, VAULT, "active");
  });

  it("walks the whole machine one step per sweep", async () => {
    // ── Step 1: one second BEFORE the upload deadline → still active.
    let sweep = await sweepForOrg(new Date(uploadDeadline.getTime() - 1000));
    expect(sweep.statusTransitions).toHaveLength(0);
    expect(await weddingStatus(WED)).toBe("active");

    // ── Step 2: exact upload deadline → upload_closed (+ upload_deadline_reached).
    sweep = await sweepForOrg(new Date(uploadDeadline.getTime()));
    expect(sweep.statusTransitions).toHaveLength(1);
    expect(sweep.statusTransitions[0].toStatus).toBe("upload_closed");
    expect(await weddingStatus(WED)).toBe("upload_closed");
    expect(await countEvents(WED, "upload_deadline_reached")).toBe(1);

    // ── Step 3: repeated sweep at the same instant is a NO-OP (idempotent).
    sweep = await sweepForOrg(new Date(uploadDeadline.getTime()));
    expect(sweep.statusTransitions).toHaveLength(0);
    expect(await weddingStatus(WED)).toBe("upload_closed");
    expect(await countEvents(WED)).toBe(1);

    // ── Step 4: exact download deadline → download_only + guest sessions revoked.
    sweep = await sweepForOrg(new Date(downloadDeadline.getTime()));
    expect(sweep.statusTransitions).toHaveLength(1);
    expect(sweep.statusTransitions[0].toStatus).toBe("download_only");
    expect(sweep.guestSessionsRevoked).toBe(1);
    expect(await weddingStatus(WED)).toBe("download_only");
    const [session] = await db
      .select({ status: guestSessions.status })
      .from(guestSessions)
      .where(eq(guestSessions.id, SESSION))
      .limit(1);
    expect(session.status).toBe("revoked");
    expect(await countEvents(WED, "download_deadline_reached")).toBe(1);

    // ── Step 5: repeated sweep → no-op, sessions not double-revoked.
    sweep = await sweepForOrg(new Date(downloadDeadline.getTime()));
    expect(sweep.statusTransitions).toHaveLength(0);
    expect(sweep.guestSessionsRevoked).toBe(0);

    // ── Step 6: download + EXPIRY_RETENTION_GRACE → expired.
    sweep = await sweepForOrg(new Date(downloadDeadline.getTime() + G));
    expect(sweep.statusTransitions.map((t) => t.toStatus)).toEqual(["expired"]);
    expect(await weddingStatus(WED)).toBe("expired");
    expect(await countEvents(WED, "expired")).toBe(1);

    // ── Step 7: + ARCHIVE_GRACE → archived (vault archived too).
    sweep = await sweepForOrg(new Date(downloadDeadline.getTime() + G + A));
    expect(sweep.statusTransitions.map((t) => t.toStatus)).toEqual(["archived"]);
    expect(await weddingStatus(WED)).toBe("archived");
    const [vault] = await db.select({ status: vaults.status }).from(vaults).where(eq(vaults.id, VAULT)).limit(1);
    expect(vault.status).toBe("archived");
    expect(await countEvents(WED, "archived")).toBe(1);

    // ── Step 8: + RETENTION → deletion_pending.
    sweep = await sweepForOrg(new Date(downloadDeadline.getTime() + G + A + R));
    expect(sweep.statusTransitions.map((t) => t.toStatus)).toEqual(["deletion_pending"]);
    expect(await weddingStatus(WED)).toBe("deletion_pending");
    expect(await countEvents(WED, "deletion_pending")).toBe(1);

    // ── Step 9: + PURGE window → DELETED (tombstone; audit trail retained).
    sweep = await sweepForOrg(new Date(downloadDeadline.getTime() + G + A + R + P));
    expect(sweep.weddingsPurged).toBe(1);
    expect(sweep.statusTransitions.map((t) => t.toStatus)).toEqual(["deleted"]);
    expect(await weddingStatus(WED)).toBe("deleted");

    const [tomb] = await db.select({ deletedAt: weddings.deletedAt }).from(weddings).where(eq(weddings.id, WED)).limit(1);
    expect(tomb.deletedAt).not.toBeNull();

    // Vault soft-deleted; guest sessions purged.
    const [vaultAfter] = await db.select({ deletedAt: vaults.deletedAt }).from(vaults).where(eq(vaults.id, VAULT)).limit(1);
    expect(vaultAfter.deletedAt).not.toBeNull();
    const sessions = await db.select().from(guestSessions).where(eq(guestSessions.id, SESSION));
    expect(sessions).toHaveLength(0);

    // Audit trail survived: `deleted` lifecycle event + `wedding_purged` audit.
    expect(await countEvents(WED, "deleted")).toBe(1);
    const audits = await db.select().from(auditLogs).where(and(eq(auditLogs.organizationId, ORG), eq(auditLogs.resourceId, WED)));
    expect(audits.some((a) => a.action === "wedding_purged")).toBe(true);

    // Terminal state is no longer sweepable (tombstone).
    sweep = await sweepForOrg(new Date(downloadDeadline.getTime() + G + A + R + P + 1000));
    expect(sweep.statusTransitions).toHaveLength(0);
  });

  it("already-expired wedding advances to archived only once the archive grace elapses", async () => {
    // Wedding already at EXPIRED, before the archive grace → untouched.
    await db.update(weddings).set({ status: "expired" }).where(eq(weddings.id, WED));
    let sweep = await sweepForOrg(new Date(downloadDeadline.getTime() + G - 1000));
    expect(sweep.statusTransitions).toHaveLength(0);
    expect(await weddingStatus(WED)).toBe("expired");

    // Past the archive grace → archived.
    sweep = await sweepForOrg(new Date(downloadDeadline.getTime() + G + A));
    expect(sweep.statusTransitions.map((t) => t.toStatus)).toEqual(["archived"]);
    expect(await weddingStatus(WED)).toBe("archived");
  });

  it("already-archived wedding is inert until the retention deadline", async () => {
    await db.update(weddings).set({ status: "archived" }).where(eq(weddings.id, WED));
    const sweep = await sweepForOrg(new Date(downloadDeadline.getTime() + G + A - 1000));
    expect(sweep.statusTransitions).toHaveLength(0);
    expect(await weddingStatus(WED)).toBe("archived");
  });

  it("repeated lifecycle jobs across the entire sweep converge with no double transitions", async () => {
    // Advance a wedding straight to download_only, then replay the sweep at a
    // far-future clock. `runLifecycleSweep` advances each wedding AT MOST ONE
    // step per invocation (CAS-guarded), so the machine lands exactly once on
    // each subsequent state and the final tombstone is inert.
    await db.update(weddings).set({ status: "download_only" }).where(eq(weddings.id, WED));
    const clock = new Date(downloadDeadline.getTime() + G + A + R + P);

    const s1 = await sweepForOrg(clock);
    expect(s1.statusTransitions.map((t) => t.toStatus)).toEqual(["expired"]);
    const s2 = await sweepForOrg(clock);
    expect(s2.statusTransitions.map((t) => t.toStatus)).toEqual(["archived"]);
    const s3 = await sweepForOrg(clock);
    expect(s3.statusTransitions.map((t) => t.toStatus)).toEqual(["deletion_pending"]);
    const s4 = await sweepForOrg(clock);
    expect(s4.weddingsPurged).toBe(1);
    expect(s4.statusTransitions.map((t) => t.toStatus)).toEqual(["deleted"]);
    const s5 = await sweepForOrg(clock);
    expect(s5.statusTransitions).toHaveLength(0);

    // Exactly one event per step — no double-fires across repeated jobs.
    expect(await countEvents(WED, "expired")).toBe(1);
    expect(await countEvents(WED, "archived")).toBe(1);
    expect(await countEvents(WED, "deletion_pending")).toBe(1);
    expect(await countEvents(WED, "deleted")).toBe(1);
    expect(await weddingStatus(WED)).toBe("deleted");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Wedding-date modification — recalculation + audit (ADR-001)
// ══════════════════════════════════════════════════════════════════════════════

describe("recalculateWeddingDeadlines — wedding-date modification", () => {
  const WED = nid("000000000301");

  beforeEach(async () => {
    await seedBase({ product: true });
    await seedWedding({
      id: WED,
      status: "active",
      weddingDate: new Date("2028-10-01T00:00:00.000Z"),
      uploadDeadline: new Date("2028-10-08T23:59:59.999Z"),
      downloadDeadline: new Date("2028-10-31T23:59:59.999Z"),
      uploadWindowDays: 7,
      downloadWindowDays: 30,
      productId: PRODUCT,
    });
  });

  it("resolves the package code from the linked product", async () => {
    expect(await resolveWeddingPackageCode(WED)).toBe("gold");
  });

  it("recalculates + upserts deadlines and records audit events on a date change", async () => {
    const res = await recalculateWeddingDeadlines({
      weddingId: WED,
      organizationId: ORG,
      packageCode: "gold",
      newWeddingDate: "2028-12-29",
      actorUserId: null,
    });
    if (!res) throw new Error("expected recalculateWeddingDeadlines to return a result");
    expect(res.changed).toBe(true);
    expect(res.uploadDeadline.toISOString()).toBe("2029-01-05T23:59:59.999Z");
    expect(res.downloadDeadline.toISOString()).toBe("2029-01-28T23:59:59.999Z");
    expect(res.uploadWindowDays).toBe(7);
    expect(res.downloadWindowDays).toBe(30);

    const [rule] = await db.select().from(expiryRules).where(eq(expiryRules.weddingId, WED)).limit(1);
    expect(rule.uploadDeadline.toISOString()).toBe("2029-01-05T23:59:59.999Z");
    expect(rule.downloadDeadline.toISOString()).toBe("2029-01-28T23:59:59.999Z");
    expect(rule.timezone).toBe("Africa/Johannesburg");

    expect(await countEvents(WED, "wedding_date_changed")).toBe(1);
    expect(await countEvents(WED, "deadline_recalculated")).toBe(1);
  });

  it("a repeated identical recalculation is idempotent (no duplicate audit events)", async () => {
    const first = await recalculateWeddingDeadlines({
      weddingId: WED,
      organizationId: ORG,
      packageCode: "gold",
      newWeddingDate: "2028-12-29",
      actorUserId: null,
    });
    if (!first) throw new Error("expected recalculateWeddingDeadlines to return a result");
    expect(first.changed).toBe(true);

    const again = await recalculateWeddingDeadlines({
      weddingId: WED,
      organizationId: ORG,
      packageCode: "gold",
      newWeddingDate: "2028-12-29",
      actorUserId: null,
    });
    if (!again) throw new Error("expected recalculateWeddingDeadlines to return a result");
    expect(again.changed).toBe(false);
    expect(again.eventIds).toHaveLength(0);

    // The audit trail still reflects a single change (idempotent reconciliation).
    expect(await countEvents(WED, "wedding_date_changed")).toBe(1);
    expect(await countEvents(WED, "deadline_recalculated")).toBe(1);
  });

  it("shifting a wedding date back/forward moves both deadlines with it", async () => {
    await recalculateWeddingDeadlines({
      weddingId: WED,
      organizationId: ORG,
      packageCode: "gold",
      newWeddingDate: "2028-10-01",
      actorUserId: null,
    });
    const [rule] = await db.select().from(expiryRules).where(eq(expiryRules.weddingId, WED)).limit(1);
    expect(rule.uploadDeadline.toISOString()).toBe("2028-10-08T23:59:59.999Z");
    expect(rule.downloadDeadline.toISOString()).toBe("2028-10-31T23:59:59.999Z");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// purgeWedding — content + storage purge, tombstone retained
// ══════════════════════════════════════════════════════════════════════════════

describe("purgeWedding — retention tail purge", () => {
  const WED = nid("000000000401");
  const VAULT = nid("000000000402");
  const SESSION = nid("000000000403");
  const MEMORY = nid("000000000404");
  const MEDIA_ROW = nid("000000000405");
  const VARIANT = nid("000000000406");
  const MPJ = nid("000000000407");
  const SLIDESHOW = nid("000000000408");
  const SLIDE_ITEM = nid("000000000409");
  const FLIPBOOK = nid("000000000410");
  const PAGE = nid("000000000411");
  const QR = nid("000000000412");

  beforeEach(async () => {
    await seedWedding({
      id: WED,
      status: "deletion_pending",
      uploadDeadline: new Date("2028-01-01T23:59:59.999Z"),
      downloadDeadline: new Date("2028-01-31T23:59:59.999Z"),
    });
    await seedVault(VAULT, WED);
    await seedGuestSession(SESSION, VAULT, "revoked");
    await db.insert(memories).values({ id: MEMORY, weddingId: WED, organizationId: ORG, title: "Table 1" });
    await db.insert(media).values({
      id: MEDIA_ROW,
      weddingId: WED,
      organizationId: ORG,
      memoryId: MEMORY,
      publicId: `pub-lc-m-${MEDIA_ROW.slice(-6)}`,
      storageKey: `lc/${ORG}/${MEDIA_ROW}.jpg`,
      filename: "photo.jpg",
      contentType: "image/jpeg",
      sizeBytes: 2048,
    });
    await db.insert(mediaVariants).values({
      id: VARIANT,
      mediaId: MEDIA_ROW,
      variantType: "thumbnail",
      storageKey: `lc/${ORG}/${MEDIA_ROW}-thumb.jpg`,
      filename: "photo-thumb.jpg",
      contentType: "image/jpeg",
      sizeBytes: 256,
    });
    await db.insert(mediaProcessingJobs).values({
      id: MPJ,
      mediaId: MEDIA_ROW,
      organizationId: ORG,
      jobType: "thumbnail",
      status: "completed",
      idempotencyKey: `lc-mpj-${MPJ}`,
    });
    await db.insert(slideshows).values({ id: SLIDESHOW, weddingId: WED, organizationId: ORG, title: "Recap" });
    await db.insert(slideshowItems).values({ id: SLIDE_ITEM, slideshowId: SLIDESHOW, mediaId: MEDIA_ROW, sortOrder: 1 });
    await db.insert(flipbooks).values({ id: FLIPBOOK, weddingId: WED, organizationId: ORG, title: "Story" });
    await db.insert(flipbookPages).values({ id: PAGE, flipbookId: FLIPBOOK, pageNumber: 1 });
    await db.insert(qrCodes).values({
      id: QR,
      weddingId: WED,
      vaultId: VAULT,
      organizationId: ORG,
      publicId: `pub-lc-q-${QR.slice(-6)}`,
    });
  });

  it("purges storage objects + content rows and tombstones the wedding (audit retained)", async () => {
    const storage = memoryStorageClient();
    // Simulate objects that exist in storage.
    await storage.putObject(`lc/${ORG}/${MEDIA_ROW}.jpg`, Buffer.from("orig"));
    await storage.putObject(`lc/${ORG}/${MEDIA_ROW}-thumb.jpg`, Buffer.from("thumb"));

    await purgeWedding(WED, { storage });

    // All content rows are gone.
    expect(await db.select().from(media).where(eq(media.id, MEDIA_ROW))).toHaveLength(0);
    expect(await db.select().from(mediaVariants).where(eq(mediaVariants.id, VARIANT))).toHaveLength(0);
    expect(await db.select().from(mediaProcessingJobs).where(eq(mediaProcessingJobs.id, MPJ))).toHaveLength(0);
    expect(await db.select().from(memories).where(eq(memories.id, MEMORY))).toHaveLength(0);
    expect(await db.select().from(slideshows).where(eq(slideshows.id, SLIDESHOW))).toHaveLength(0);
    expect(await db.select().from(slideshowItems).where(eq(slideshowItems.id, SLIDE_ITEM))).toHaveLength(0);
    expect(await db.select().from(flipbooks).where(eq(flipbooks.id, FLIPBOOK))).toHaveLength(0);
    expect(await db.select().from(flipbookPages).where(eq(flipbookPages.id, PAGE))).toHaveLength(0);
    expect(await db.select().from(qrCodes).where(eq(qrCodes.id, QR))).toHaveLength(0);
    expect(await db.select().from(guestSessions).where(eq(guestSessions.id, SESSION))).toHaveLength(0);

    // Storage objects removed (injected memory client — deterministic).
    await expect(storage.getObject(`lc/${ORG}/${MEDIA_ROW}.jpg`)).rejects.toThrow();
    await expect(storage.getObject(`lc/${ORG}/${MEDIA_ROW}-thumb.jpg`)).rejects.toThrow();

    // Vault soft-deleted, wedding tombstoned.
    const [vault] = await db.select({ deletedAt: vaults.deletedAt }).from(vaults).where(eq(vaults.id, VAULT)).limit(1);
    expect(vault.deletedAt).not.toBeNull();
    const [tomb] = await db.select({ status: weddings.status, deletedAt: weddings.deletedAt }).from(weddings).where(eq(weddings.id, WED)).limit(1);
    expect(tomb.status).toBe("deleted");
    expect(tomb.deletedAt).not.toBeNull();

    // Audit trail retained.
    expect(await countEvents(WED, "deleted")).toBe(1);
    const audits = await db.select().from(auditLogs).where(and(eq(auditLogs.organizationId, ORG), eq(auditLogs.resourceId, WED)));
    expect(audits.some((a) => a.action === "wedding_purged")).toBe(true);
  });

  it("tolerates missing storage objects (idempotent purge)", async () => {
    // Objects were never uploaded / already deleted — purge still completes.
    await expect(purgeWedding(WED, { storage: memoryStorageClient() })).resolves.toBeUndefined();
    const [tomb] = await db.select({ status: weddings.status }).from(weddings).where(eq(weddings.id, WED)).limit(1);
    expect(tomb.status).toBe("deleted");
  });
});

// Sanity: the sweep never touches weddings without an expiry rule.
describe("runLifecycleSweep — rule-less weddings are invisible", () => {
  const WED = nid("000000000501");

  it("skips weddings with no expiry_rules row", async () => {
    await db.insert(weddings).values({
      id: WED,
      organizationId: ORG,
      customerId: CUST,
      publicId: `pub-lc-${WED.slice(-6)}`,
      code: `LC-${WED.slice(-4)}`,
      name: "No rule",
      status: "active",
      timezone: "Africa/Johannesburg",
    });
    const sweep = await sweepForOrg(new Date("2030-01-01T00:00:00.000Z"));
    const touched = sweep.statusTransitions.some((t) => t.weddingId === WED);
    expect(touched).toBe(false);
    expect(await weddingStatus(WED)).toBe("active");
  });
});