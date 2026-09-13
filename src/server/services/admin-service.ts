/**
 * Platform Admin Service — Phase 12.
 *
 * Server-authoritative read/list/detail queries and lifecycle write actions for
 * the Platform Admin console. Every function in this file is a server-only
 * module; it is called by API routes (guarded by withAuth + withTenant +
 * withPermission) and by (admin) server components directly.
 *
 * Invariants:
 *  - Every write action validates the target exists, refuses dangerous or
 *    non-safe transitions (returns `changed:false` + `reason` WITHOUT writing
 *    an audit row), performs a CAS-style update from the observed state, and
 *    THEN records an immutable audit_logs row (actor, before, after, ip, UA).
 *  - Retry actions preserve idempotency anchors (idempotency_key is never
 *    changed) and only touch FAILED jobs; sent/completed/pending jobs are
 *    never mutated.
 *  - Never returns password hashes, raw guest tokens, storage credentials or
 *    private internal IDs to clients; internal UUIDs are exposed ONLY inside
 *    this admin surface (brief explicitly exempts the admin console).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { and, count, desc, eq, ilike, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  auditLogs,
  buildJobs,
  buildJobSteps,
  customers,
  emailJobs,
  expiryRules,
  guestSessions,
  lifecycleEvents,
  media,
  mediaProcessingJobs,
  mediaVariants,
  orderItems,
  orders,
  organizationMembers,
  organizations,
  payments,
  products,
  users,
  vaults,
  weddings,
} from "@/lib/db/schema";
import type { OrganizationRole } from "@/lib/auth/roles";
import { NotFoundError } from "@/lib/auth/errors";
import { BUSINESS_TIMEZONE } from "@/lib/entitlements/expiry";
import { getWorkerStatus as getBuildWorkerStatus } from "@/server/services/build-worker";
import { isMediaWorkerRunning } from "@/server/services/media-worker";
import { isEmailWorkerRunning } from "@/server/services/email-worker";
import { retryBuild, getBuildStatus } from "@/server/services/build-engine";
import { retryProcessingJobs } from "@/server/services/media-service";
import { storageEnabled, tryGetStorageConfig } from "@/server/services/storage/config";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AdminContext {
  /** Authenticated user's UUID (actor for audit rows). */
  userId: string;
  /** The user's platform role. */
  role: OrganizationRole;
  /** Always true for platform users; kept for parity with TenantContext. */
  isPlatformUser: boolean;
}

export interface AdminRequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface AdminList<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  organizationId?: string;
  status?: string;
}

export interface WriteResult {
  changed: boolean;
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  auditId?: string;
}

// ── Shared validation helpers ──────────────────────────────────────────────────

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isUuid(value: string | undefined | null): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Throws NotFoundError for non-UUID ids so routes map them to 404, not 500. */
function requireUuid(id: string | undefined, resource: string): string {
  if (!isUuid(id)) throw new NotFoundError(resource);
  return id;
}

function clampPage(page: number | undefined): number {
  const p = Number.isFinite(page) ? page! : 1;
  return Math.max(1, Math.floor(p));
}

function clampPageSize(size: number | undefined): number {
  const s = Number.isFinite(size) ? size! : 25;
  return Math.min(100, Math.max(1, Math.floor(s)));
}

function toDateString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

/**
 * Records an immutable audit_logs row for every successful write.
 * @returns the newly created audit log id.
 */
async function recordAudit(
  ctx: AdminContext,
  meta: AdminRequestMeta,
  entry: {
    organizationId?: string | null;
    action: string;
    resourceType: string;
    resourceId: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
  },
): Promise<string> {
  const [row] = await db
    .insert(auditLogs)
    .values({
      organizationId: entry.organizationId ?? null,
      actorUserId: ctx.userId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      before: entry.before ?? null,
      after: entry.after ?? null,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
      metadata: entry.metadata ?? null,
    })
    .returning({ id: auditLogs.id });

  if (!row) throw new Error("Failed to write audit log");
  return row.id;
}

function warnNoOp(action: string, id: string, reason: string): void {
  console.warn(`[AdminService] ${action}(${id}) no-op: ${reason}`);
}

// ── Platform health ────────────────────────────────────────────────────────────

export interface MigrationState {
  trackingTable: boolean;
  declaredTags: string[];
  appliedTags: string[];
  upToDate: boolean;
  note?: string;
}

export interface PlatformHealth {
  database: { ok: boolean; latencyMs: number; error?: string };
  migrations: MigrationState;
  workers: {
    build: { isRunning: boolean; activeJobs: number; maxConcurrent: number };
    media: { isRunning: boolean };
    email: { isRunning: boolean };
  };
  queues: {
    build: { pending: number; processing: number; failed: number; completed: number };
    media: { pending: number; processing: number; failed: number; completed: number };
    email: { pending: number; sending: number; sent: number; failed: number; cancelled: number };
    stale: { build: number; media: number; email: number };
  };
  time: { utc: string; johannesburg: string; timezone: string };
  generatedAt: string;
}

async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = process.hrtime.bigint();
  try {
    await db.execute(sql`select 1`);
    const latencyMs = Number(process.hrtime.bigint() - start) / 1e6;
    return { ok: true, latencyMs: Math.round(latencyMs * 100) / 100 };
  } catch (error) {
    const latencyMs = Number(process.hrtime.bigint() - start) / 1e6;
    return {
      ok: false,
      latencyMs: Math.round(latencyMs * 100) / 100,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readMigrationState(): Promise<MigrationState> {
  let declaredTags: string[] = [];
  try {
    const journalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json");
    const raw = await readFile(journalPath, "utf8");
    const journal = JSON.parse(raw) as { entries?: Array<{ tag?: string; hash?: string }> };
    declaredTags = (journal.entries ?? []).map((e) => e.tag ?? "unknown").filter(Boolean);
  } catch (error) {
    return {
      trackingTable: false,
      declaredTags: [],
      appliedTags: [],
      upToDate: false,
      note: `Could not read drizzle journal: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Drizzle-kit tracking table may live in schema `drizzle` or `public`.
  let appliedTags: string[] = [];
  let trackingTable = false;
  try {
    const tables = (await db.execute(
      sql`select table_schema from information_schema.tables where table_name = '__drizzle_migrations'`,
    )) as unknown as Array<{ table_schema: string }>;

    if (tables.length > 0) {
      trackingTable = true;
      const schema = tables[0]!.table_schema;
      const rows = (await db.execute(
        sql.raw(`select hash from "${schema}"."__drizzle_migrations"`),
      )) as unknown as Array<{ hash: string }>;
      const appliedHashes = new Set(rows.map((r) => r.hash));

      try {
        const journalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json");
        const raw = await readFile(journalPath, "utf8");
        const journal = JSON.parse(raw) as { entries?: Array<{ tag?: string; hash?: string }> };
        appliedTags = (journal.entries ?? [])
          .filter((e) => e.hash && appliedHashes.has(e.hash))
          .map((e) => e.tag ?? "unknown");
      } catch {
        appliedTags = [];
      }
    }
  } catch (error) {
    return {
      trackingTable,
      declaredTags,
      appliedTags,
      upToDate: false,
      note: `Migration tracking lookup failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  return {
    trackingTable,
    declaredTags,
    appliedTags,
    upToDate: trackingTable
      ? declaredTags.length > 0 &&
        declaredTags.every((tag) => appliedTags.includes(tag))
      : false,
    note: trackingTable
      ? undefined
      : "No __drizzle_migrations tracking table found (schema likely applied via `db:push`).",
  };
}

async function queueCountsForBuild(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: buildJobs.status, n: count() })
    .from(buildJobs)
    .groupBy(buildJobs.status);
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = asNumber(row.n);
  return counts;
}

async function queueCountsForMedia(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: mediaProcessingJobs.status, n: count() })
    .from(mediaProcessingJobs)
    .groupBy(mediaProcessingJobs.status);
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = asNumber(row.n);
  return counts;
}

async function queueCountsForEmail(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: emailJobs.status, n: count() })
    .from(emailJobs)
    .groupBy(emailJobs.status);
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = asNumber(row.n);
  return counts;
}

export async function getPlatformHealth(): Promise<PlatformHealth> {
  const database = await pingDatabase();
  const migrations = await readMigrationState();

  const buildWorker = getBuildWorkerStatus();
  const mediaRunning = isMediaWorkerRunning();
  const emailRunning = isEmailWorkerRunning();

  // Stale = a job the workers would reclaim (stuck in a running claim state).
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
  const countStale = async (
    table: typeof buildJobs | typeof mediaProcessingJobs | typeof emailJobs,
    status: string,
  ) => {
    const rows = await db
      .select({ n: count() })
      .from(table)
      .where(and(eq(table.status, status as never), lt(table.updatedAt, staleThreshold)));
    return asNumber(rows[0]?.n);
  };

  const [buildQueue, mediaQueue, emailQueue, staleBuild, staleMedia, staleEmail] =
    await Promise.all([
      queueCountsForBuild(),
      queueCountsForMedia(),
      queueCountsForEmail(),
      countStale(buildJobs, "processing"),
      countStale(mediaProcessingJobs, "processing"),
      countStale(emailJobs, "sending"),
    ]);

  return {
    database,
    migrations,
    workers: {
      build: {
        isRunning: buildWorker.isRunning,
        activeJobs: buildWorker.activeJobs,
        maxConcurrent: buildWorker.maxConcurrent,
      },
      media: { isRunning: mediaRunning },
      email: { isRunning: emailRunning },
    },
    queues: {
      build: {
        pending: buildQueue.pending ?? 0,
        processing: buildQueue.processing ?? 0,
        failed: buildQueue.failed ?? 0,
        completed: buildQueue.completed ?? 0,
      },
      media: {
        pending: mediaQueue.pending ?? 0,
        processing: mediaQueue.processing ?? 0,
        failed: mediaQueue.failed ?? 0,
        completed: mediaQueue.completed ?? 0,
      },
      email: {
        pending: emailQueue.pending ?? 0,
        sending: emailQueue.sending ?? 0,
        sent: emailQueue.sent ?? 0,
        failed: emailQueue.failed ?? 0,
        cancelled: emailQueue.cancelled ?? 0,
      },
      stale: { build: staleBuild, media: staleMedia, email: staleEmail },
    },
    time: {
      utc: new Date().toISOString(),
      johannesburg: new Intl.DateTimeFormat("en-ZA", {
        timeZone: BUSINESS_TIMEZONE,
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date()),
      timezone: BUSINESS_TIMEZONE,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ── Storage overview ───────────────────────────────────────────────────────────

export interface StorageOverview {
  configured: boolean;
  endpoint?: string;
  bucket?: string;
  region?: string;
  forcePathStyle?: boolean;
  mediaCount: number;
  totalBytes: number;
  variantCount: number;
  lastMediaActivityAt: string | null;
  /** Set when storage is configured but no lightweight connectivity probe exists. */
  note?: string;
}

export async function getStorageOverview(): Promise<StorageOverview> {
  const config = tryGetStorageConfig();
  const configured = storageEnabled();

  const [mediaAgg, variantAgg, lastMedia] = await Promise.all([
    db
      .select({
        n: count(),
        totalBytes: sql<number>`coalesce(sum(${media.sizeBytes}), 0)`,
      })
      .from(media)
      .where(isNull(media.deletedAt)),
    db.select({ n: count() }).from(mediaVariants),
    db
      .select({ createdAt: media.createdAt })
      .from(media)
      .where(isNull(media.deletedAt))
      .orderBy(desc(media.createdAt))
      .limit(1),
  ]);

  return {
    configured,
    endpoint: config?.endpoint,
    bucket: config?.bucket,
    region: config?.region,
    forcePathStyle: config?.forcePathStyle,
    mediaCount: asNumber(mediaAgg[0]?.n),
    totalBytes: asNumber(mediaAgg[0]?.totalBytes),
    variantCount: asNumber(variantAgg[0]?.n),
    lastMediaActivityAt: lastMedia[0]?.createdAt ? lastMedia[0].createdAt.toISOString() : null,
    note: "Storage reports configuration only (no bucket-level probe available in the current client).",
  };
}

// ── Audit logs ─────────────────────────────────────────────────────────────────

export interface AuditLogListItem {
  id: string;
  organizationId: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogListQuery extends ListQuery {
  resourceType?: string;
  resourceId?: string;
  action?: string;
}

export async function listAuditLogs(query: AuditLogListQuery = {}): Promise<AdminList<AuditLogListItem>> {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);

  const conditions = [];
  if (isUuid(query.organizationId)) {
    conditions.push(eq(auditLogs.organizationId, query.organizationId));
  }
  if (isUuid(query.resourceId)) {
    conditions.push(eq(auditLogs.resourceId, query.resourceId));
  }
  if (query.resourceType) {
    conditions.push(eq(auditLogs.resourceType, query.resourceType));
  }
  if (query.action) {
    conditions.push(eq(auditLogs.action, query.action));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow, rows] = await Promise.all([
    db.select({ n: count() }).from(auditLogs).where(where),
    db
      .select({
        log: auditLogs,
        actorEmail: users.email,
        actorName: users.fullName,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.log.id,
      organizationId: row.log.organizationId,
      actorUserId: row.log.actorUserId,
      actorEmail: row.actorEmail ?? null,
      actorName: row.actorName ?? null,
      action: row.log.action,
      resourceType: row.log.resourceType,
      resourceId: row.log.resourceId,
      before: row.log.before,
      after: row.log.after,
      ipAddress: row.log.ipAddress,
      userAgent: row.log.userAgent,
      metadata: row.log.metadata,
      createdAt: row.log.createdAt.toISOString(),
    })),
    total: asNumber(totalRow[0]?.n),
    page,
    pageSize,
  };
}

// ── Organizations ──────────────────────────────────────────────────────────────

export interface OrganizationListItem {
  id: string;
  publicId: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  billingEmail: string | null;
  country: string | null;
  timezone: string;
  memberCount: number;
  weddingCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function listOrganizations(query: ListQuery = {}): Promise<AdminList<OrganizationListItem>> {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);

  const conditions = [isNull(organizations.deletedAt)];
  if (isUuid(query.organizationId)) {
    conditions.push(eq(organizations.id, query.organizationId));
  }
  if (query.status) {
    conditions.push(eq(organizations.status, query.status as never));
  }
  if (query.search) {
    const like = `%${query.search}%`;
    conditions.push(
      or(
        ilike(organizations.name, like),
        ilike(organizations.slug, like),
        ilike(organizations.billingEmail, like),
        ilike(organizations.publicId, like),
      )!,
    );
  }
  const where = and(...conditions);

  const [totalRow, rows] = await Promise.all([
    db.select({ n: count() }).from(organizations).where(where),
    db
      .select()
      .from(organizations)
      .where(where)
      .orderBy(desc(organizations.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  const countsByOrg: Record<string, { members: number; weddings: number }> = {};
  const orgIds = rows.map((o) => o.id);
  if (orgIds.length > 0) {
    const memberCounts = await db
      .select({ organizationId: organizationMembers.organizationId, n: count() })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.status, "active"),
          isNull(organizationMembers.deletedAt),
          sql`${organizationMembers.organizationId} in ${orgIds}`,
        ),
      )
      .groupBy(organizationMembers.organizationId);
    const weddingCounts = await db
      .select({ organizationId: weddings.organizationId, n: count() })
      .from(weddings)
      .where(
        and(isNull(weddings.deletedAt), sql`${weddings.organizationId} in ${orgIds}`),
      )
      .groupBy(weddings.organizationId);

    for (const id of orgIds) countsByOrg[id] = { members: 0, weddings: 0 };
    for (const c of memberCounts) {
      countsByOrg[c.organizationId] = countsByOrg[c.organizationId] ?? { members: 0, weddings: 0 };
      countsByOrg[c.organizationId]!.members = asNumber(c.n);
    }
    for (const c of weddingCounts) {
      countsByOrg[c.organizationId] = countsByOrg[c.organizationId] ?? { members: 0, weddings: 0 };
      countsByOrg[c.organizationId]!.weddings = asNumber(c.n);
    }
  }

  return {
    items: rows.map((o) => ({
      id: o.id,
      publicId: o.publicId,
      name: o.name,
      slug: o.slug,
      type: o.type,
      status: o.status,
      billingEmail: o.billingEmail,
      country: o.country,
      timezone: o.timezone,
      memberCount: countsByOrg[o.id]?.members ?? 0,
      weddingCount: countsByOrg[o.id]?.weddings ?? 0,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    })),
    total: asNumber(totalRow[0]?.n),
    page,
    pageSize,
  };
}

export interface OrganizationMemberDto {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  role: string;
  status: string;
  joinedAt: string | null;
}

export interface OrganizationDetail {
  id: string;
  publicId: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  billingEmail: string | null;
  phone: string | null;
  country: string | null;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  weddingCount: number;
  orderCount: number;
  paidRevenueCents: number;
  members: OrganizationMemberDto[];
}

export async function getOrganizationDetail(id: string): Promise<OrganizationDetail> {
  const orgId = requireUuid(id, "Organization");
  const [org] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)))
    .limit(1);
  if (!org) throw new NotFoundError("Organization");

  const [memberRows, weddingRow, revenueRow] = await Promise.all([
    db
      .select({
        member: organizationMembers,
        userEmail: users.email,
        userName: users.fullName,
      })
      .from(organizationMembers)
      .leftJoin(users, eq(organizationMembers.userId, users.id))
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          isNull(organizationMembers.deletedAt),
        ),
      )
      .orderBy(organizationMembers.sortOrder, organizationMembers.createdAt),
    db
      .select({ n: count() })
      .from(weddings)
      .where(and(eq(weddings.organizationId, orgId), isNull(weddings.deletedAt))),
    db
      .select({
        orderN: count(),
        revenue: sql<number>`coalesce(sum(${payments.amountCents}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, orgId),
          eq(payments.status, "completed"),
        ),
      ),
  ]);

  return {
    id: org.id,
    publicId: org.publicId,
    name: org.name,
    slug: org.slug,
    type: org.type,
    status: org.status,
    billingEmail: org.billingEmail,
    phone: org.phone,
    country: org.country,
    timezone: org.timezone,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
    memberCount: memberRows.length,
    weddingCount: asNumber(weddingRow[0]?.n),
    orderCount: asNumber(revenueRow[0]?.orderN),
    paidRevenueCents: asNumber(revenueRow[0]?.revenue),
    members: memberRows.map((row) => ({
      id: row.member.id,
      userId: row.member.userId,
      userEmail: row.userEmail ?? "",
      userName: row.userName ?? null,
      role: row.member.role,
      status: row.member.status,
      joinedAt: row.member.joinedAt ? row.member.joinedAt.toISOString() : null,
    })),
  };
}

// ── User detail (used by the suspend-user lifecycle within org members) ────────

export interface UserDetail {
  id: string;
  email: string;
  fullName: string | null;
  status: string;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    role: string;
    membershipStatus: string;
  }>;
}

export async function getUserDetail(id: string): Promise<UserDetail> {
  const userId = requireUuid(id, "User");
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  if (!user) throw new NotFoundError("User");

  const memberships = await db
    .select({
      organizationId: organizationMembers.organizationId,
      organizationName: organizations.name,
      role: organizationMembers.role,
      membershipStatus: organizationMembers.status,
    })
    .from(organizationMembers)
    .leftJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(
      and(
        eq(organizationMembers.userId, userId),
        isNull(organizationMembers.deletedAt),
      ),
    )
    .orderBy(organizationMembers.sortOrder);

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    memberships: memberships.map((m) => ({
      organizationId: m.organizationId,
      organizationName: m.organizationName ?? "Unknown",
      role: m.role,
      membershipStatus: m.membershipStatus,
    })),
  };
}

// ── Customers ──────────────────────────────────────────────────────────────────

export interface CustomerListItem {
  id: string;
  publicId: string;
  organizationId: string;
  organizationName: string;
  userId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  orderCount: number;
  createdAt: string;
}

export async function listCustomers(query: ListQuery = {}): Promise<AdminList<CustomerListItem>> {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);

  const conditions = [isNull(customers.deletedAt)];
  if (isUuid(query.organizationId)) {
    conditions.push(eq(customers.organizationId, query.organizationId));
  }
  if (query.search) {
    const like = `%${query.search}%`;
    conditions.push(
      or(
        ilike(customers.fullName, like),
        ilike(customers.email, like),
        ilike(customers.publicId, like),
      )!,
    );
  }
  const where = and(...conditions);

  const [totalRow, rows] = await Promise.all([
    db.select({ n: count() }).from(customers).where(where),
    db
      .select({
        c: customers,
        orgName: organizations.name,
      })
      .from(customers)
      .leftJoin(organizations, eq(customers.organizationId, organizations.id))
      .where(where)
      .orderBy(desc(customers.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  const customerIds = rows.map((r) => r.c.id);
  const orderCounts: Record<string, number> = {};
  if (customerIds.length > 0) {
    const counts = await db
      .select({ customerId: orders.customerId, n: count() })
      .from(orders)
      .where(sql`${orders.customerId} in ${customerIds}`)
      .groupBy(orders.customerId);
    for (const c of counts) orderCounts[c.customerId] = asNumber(c.n);
  }

  return {
    items: rows.map((r) => ({
      id: r.c.id,
      publicId: r.c.publicId,
      organizationId: r.c.organizationId,
      organizationName: r.orgName ?? "Unknown",
      userId: r.c.userId,
      fullName: r.c.fullName,
      email: r.c.email,
      phone: r.c.phone,
      orderCount: orderCounts[r.c.id] ?? 0,
      createdAt: r.c.createdAt.toISOString(),
    })),
    total: asNumber(totalRow[0]?.n),
    page,
    pageSize,
  };
}

export interface CustomerDetail {
  id: string;
  publicId: string;
  organizationId: string;
  organizationName: string;
  userId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  createdAt: string;
  orderCount: number;
  totalSpentCents: number;
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalCents: number;
    currency: string;
    placedAt: string | null;
    productName: string | null;
  }>;
}

export async function getCustomerDetail(id: string): Promise<CustomerDetail> {
  const customerId = requireUuid(id, "Customer");
  const [row] = await db
    .select({
      c: customers,
      orgName: organizations.name,
    })
    .from(customers)
    .leftJoin(organizations, eq(customers.organizationId, organizations.id))
    .where(and(eq(customers.id, customerId), isNull(customers.deletedAt)))
    .limit(1);
  if (!row) throw new NotFoundError("Customer");

  const [orderRows, spentRow, countRow] = await Promise.all([
    db
      .select({
        o: orders,
        productName: products.name,
      })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt))
      .limit(50),
    db
      .select({
        total: sql<number>`coalesce(sum(${orders.totalCents}), 0)`,
      })
      .from(orders)
      .where(and(eq(orders.customerId, customerId), eq(orders.status, "paid"))),
    // Parity with listCustomers: orderCount counts ALL of the customer's
    // orders (paid + unpaid); totalSpentCents remains paid-only.
    db.select({ n: count() }).from(orders).where(eq(orders.customerId, customerId)),
  ]);

  return {
    id: row.c.id,
    publicId: row.c.publicId,
    organizationId: row.c.organizationId,
    organizationName: row.orgName ?? "Unknown",
    userId: row.c.userId,
    fullName: row.c.fullName,
    email: row.c.email,
    phone: row.c.phone,
    createdAt: row.c.createdAt.toISOString(),
    orderCount: asNumber(countRow[0]?.n),
    totalSpentCents: asNumber(spentRow[0]?.total),
    orders: orderRows.map((r) => ({
      id: r.o.id,
      orderNumber: r.o.orderNumber,
      status: r.o.status,
      totalCents: r.o.totalCents,
      currency: r.o.currency,
      placedAt: r.o.placedAt ? r.o.placedAt.toISOString() : null,
      productName: r.productName,
    })),
  };
}

// ── Weddings ───────────────────────────────────────────────────────────────────

export interface WeddingListItem {
  id: string;
  organizationId: string;
  organizationName: string;
  customerId: string;
  customerName: string;
  productId: string | null;
  productName: string | null;
  publicId: string;
  code: string;
  name: string;
  partnerOneName: string | null;
  partnerTwoName: string | null;
  status: string;
  weddingDate: string | null;
  createdAt: string;
}

export async function listWeddings(query: ListQuery = {}): Promise<AdminList<WeddingListItem>> {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);

  const conditions = [isNull(weddings.deletedAt)];
  if (isUuid(query.organizationId)) {
    conditions.push(eq(weddings.organizationId, query.organizationId));
  }
  if (query.status) {
    conditions.push(eq(weddings.status, query.status as never));
  }
  if (query.search) {
    const like = `%${query.search}%`;
    conditions.push(
      or(
        ilike(weddings.code, like),
        ilike(weddings.name, like),
        ilike(weddings.partnerOneName, like),
        ilike(weddings.partnerTwoName, like),
        ilike(weddings.publicId, like),
      )!,
    );
  }
  const where = and(...conditions);

  const [totalRow, rows] = await Promise.all([
    db.select({ n: count() }).from(weddings).where(where),
    db
      .select({
        w: weddings,
        orgName: organizations.name,
        customerName: customers.fullName,
        productName: products.name,
      })
      .from(weddings)
      .leftJoin(organizations, eq(weddings.organizationId, organizations.id))
      .leftJoin(customers, eq(weddings.customerId, customers.id))
      .leftJoin(products, eq(weddings.productId, products.id))
      .where(where)
      .orderBy(desc(weddings.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.w.id,
      organizationId: r.w.organizationId,
      organizationName: r.orgName ?? "Unknown",
      customerId: r.w.customerId,
      customerName: r.customerName ?? "Unknown",
      productId: r.w.productId,
      productName: r.productName ?? null,
      publicId: r.w.publicId,
      code: r.w.code,
      name: r.w.name,
      partnerOneName: r.w.partnerOneName,
      partnerTwoName: r.w.partnerTwoName,
      status: r.w.status,
      weddingDate: toDateString(r.w.weddingDate),
      createdAt: r.w.createdAt.toISOString(),
    })),
    total: asNumber(totalRow[0]?.n),
    page,
    pageSize,
  };
}

export interface WeddingDetail {
  id: string;
  organizationId: string;
  organizationName: string;
  customerId: string;
  customerName: string;
  productId: string | null;
  productName: string | null;
  publicId: string;
  code: string;
  name: string;
  partnerOneName: string | null;
  partnerTwoName: string | null;
  status: string;
  weddingDate: string | null;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  vaults: Array<{
    id: string;
    publicId: string;
    slug: string;
    title: string | null;
    status: string;
    isPublic: boolean;
    publishedAt: string | null;
  }>;
  expiryRules: Array<{
    id: string;
    uploadDeadline: string;
    downloadDeadline: string;
    uploadWindowDays: number;
    downloadWindowDays: number;
    calculatedAt: string;
  }>;
  mediaCount: number;
  guestSessionCount: number;
  buildJobCount: number;
}

export async function getWeddingDetail(id: string): Promise<WeddingDetail> {
  const weddingId = requireUuid(id, "Wedding");
  const [row] = await db
    .select({
      w: weddings,
      orgName: organizations.name,
      customerName: customers.fullName,
      productName: products.name,
    })
    .from(weddings)
    .leftJoin(organizations, eq(weddings.organizationId, organizations.id))
    .leftJoin(customers, eq(weddings.customerId, customers.id))
    .leftJoin(products, eq(weddings.productId, products.id))
    .where(and(eq(weddings.id, weddingId), isNull(weddings.deletedAt)))
    .limit(1);
  if (!row) throw new NotFoundError("Wedding");

  const [vaultsRows, expiryRows, mediaCount, buildCount] = await Promise.all([
    db
      .select()
      .from(vaults)
      .where(and(eq(vaults.weddingId, weddingId), isNull(vaults.deletedAt)))
      .orderBy(desc(vaults.createdAt)),
    db
      .select()
      .from(expiryRules)
      .where(eq(expiryRules.weddingId, weddingId))
      .orderBy(desc(expiryRules.calculatedAt)),
    db.select({ n: count() }).from(media).where(eq(media.weddingId, weddingId)),
    db.select({ n: count() }).from(buildJobs).where(eq(buildJobs.weddingId, weddingId)),
  ]);

  const vaultIds = vaultsRows.map((v) => v.id);
  let guestSessionCount = 0;
  if (vaultIds.length > 0) {
    const [guestCount] = await db
      .select({ n: count() })
      .from(guestSessions)
      .where(sql`${guestSessions.vaultId} in ${vaultIds}`);
    guestSessionCount = asNumber(guestCount?.n);
  }

  return {
    id: row.w.id,
    organizationId: row.w.organizationId,
    organizationName: row.orgName ?? "Unknown",
    customerId: row.w.customerId,
    customerName: row.customerName ?? "Unknown",
    productId: row.w.productId,
    productName: row.productName ?? null,
    publicId: row.w.publicId,
    code: row.w.code,
    name: row.w.name,
    partnerOneName: row.w.partnerOneName,
    partnerTwoName: row.w.partnerTwoName,
    status: row.w.status,
    weddingDate: toDateString(row.w.weddingDate),
    timezone: row.w.timezone,
    createdAt: row.w.createdAt.toISOString(),
    updatedAt: row.w.updatedAt.toISOString(),
    vaults: vaultsRows.map((v) => ({
      id: v.id,
      publicId: v.publicId,
      slug: v.slug,
      title: v.title,
      status: v.status,
      isPublic: v.isPublic,
      publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
    })),
    expiryRules: expiryRows.map((e) => ({
      id: e.id,
      uploadDeadline: e.uploadDeadline.toISOString(),
      downloadDeadline: e.downloadDeadline.toISOString(),
      uploadWindowDays: e.uploadWindowDays,
      downloadWindowDays: e.downloadWindowDays,
      calculatedAt: e.calculatedAt.toISOString(),
    })),
    mediaCount: asNumber(mediaCount[0]?.n),
    guestSessionCount,
    buildJobCount: asNumber(buildCount[0]?.n),
  };
}

// ── Orders ─────────────────────────────────────────────────────────────────────

export interface OrderListItem {
  id: string;
  organizationId: string;
  organizationName: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  orderNumber: string;
  status: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  placedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export async function listOrders(query: ListQuery = {}): Promise<AdminList<OrderListItem>> {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);

  const conditions = [isNull(orders.deletedAt)];
  if (isUuid(query.organizationId)) {
    conditions.push(eq(orders.organizationId, query.organizationId));
  }
  if (query.status) {
    conditions.push(eq(orders.status, query.status as never));
  }
  if (query.search) {
    const like = `%${query.search}%`;
    conditions.push(or(ilike(orders.orderNumber, like), ilike(customers.email, like))!);
  }
  const where = and(...conditions);

  const [totalRow, rows] = await Promise.all([
    // The search WHERE may reference customers.email, so the count query must
    // carry the same join (leftJoin can never over-count: ilike(NULL) = NULL).
    db
      .select({ n: count() })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(where),
    db
      .select({
        o: orders,
        orgName: organizations.name,
        customerName: customers.fullName,
        productName: products.name,
      })
      .from(orders)
      .leftJoin(organizations, eq(orders.organizationId, organizations.id))
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .leftJoin(products, eq(orders.productId, products.id))
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.o.id,
      organizationId: r.o.organizationId,
      organizationName: r.orgName ?? "Unknown",
      customerId: r.o.customerId,
      customerName: r.customerName ?? "Unknown",
      productId: r.o.productId,
      productName: r.productName ?? "Unknown",
      orderNumber: r.o.orderNumber,
      status: r.o.status,
      subtotalCents: r.o.subtotalCents,
      discountCents: r.o.discountCents,
      totalCents: r.o.totalCents,
      currency: r.o.currency,
      placedAt: r.o.placedAt ? r.o.placedAt.toISOString() : null,
      paidAt: r.o.paidAt ? r.o.paidAt.toISOString() : null,
      createdAt: r.o.createdAt.toISOString(),
    })),
    total: asNumber(totalRow[0]?.n),
    page,
    pageSize,
  };
}

export interface OrderDetail {
  id: string;
  organizationId: string;
  organizationName: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  status: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  placedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
  }>;
  payments: Array<{
    id: string;
    provider: string;
    status: string;
    amountCents: number;
    currency: string;
    paidAt: string | null;
  }>;
}

export async function getOrderDetail(id: string): Promise<OrderDetail> {
  const orderId = requireUuid(id, "Order");
  const [row] = await db
    .select({
      o: orders,
      orgName: organizations.name,
      customerName: customers.fullName,
      customerEmail: customers.email,
    })
    .from(orders)
    .leftJoin(organizations, eq(orders.organizationId, organizations.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(eq(orders.id, orderId), isNull(orders.deletedAt)))
    .limit(1);
  if (!row) throw new NotFoundError("Order");

  const [itemsRows, paymentRows] = await Promise.all([
    db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(orderItems.createdAt),
    db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt)),
  ]);

  return {
    id: row.o.id,
    organizationId: row.o.organizationId,
    organizationName: row.orgName ?? "Unknown",
    customerId: row.o.customerId,
    customerName: row.customerName ?? "Unknown",
    customerEmail: row.customerEmail ?? "",
    orderNumber: row.o.orderNumber,
    status: row.o.status,
    subtotalCents: row.o.subtotalCents,
    discountCents: row.o.discountCents,
    totalCents: row.o.totalCents,
    currency: row.o.currency,
    placedAt: row.o.placedAt ? row.o.placedAt.toISOString() : null,
    paidAt: row.o.paidAt ? row.o.paidAt.toISOString() : null,
    cancelledAt: row.o.cancelledAt ? row.o.cancelledAt.toISOString() : null,
    createdAt: row.o.createdAt.toISOString(),
    items: itemsRows.map((i) => ({
      id: i.id,
      productName: i.productName,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
      lineTotalCents: i.lineTotalCents,
    })),
    payments: paymentRows.map((p) => ({
      id: p.id,
      provider: p.provider,
      status: p.status,
      amountCents: p.amountCents,
      currency: p.currency,
      paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    })),
  };
}

// ── Payments ───────────────────────────────────────────────────────────────────

export interface PaymentListItem {
  id: string;
  organizationId: string;
  organizationName: string;
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  provider: string;
  providerReference: string;
  status: string;
  amountCents: number;
  currency: string;
  paidAt: string | null;
  createdAt: string;
}

export async function listPayments(query: ListQuery = {}): Promise<AdminList<PaymentListItem>> {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);

  const conditions = [];
  if (isUuid(query.organizationId)) {
    conditions.push(eq(payments.organizationId, query.organizationId));
  }
  if (query.status) {
    conditions.push(eq(payments.status, query.status as never));
  }
  if (query.search) {
    const like = `%${query.search}%`;
    conditions.push(
      or(
        ilike(payments.providerReference, like),
        ilike(orders.orderNumber, like),
        ilike(customers.email, like),
      )!,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow, rows] = await Promise.all([
    // The search WHERE may reference orders.orderNumber and customers.email,
    // so the count query carries the same joins.
    db
      .select({ n: count() })
      .from(payments)
      .leftJoin(orders, eq(payments.orderId, orders.id))
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(where),
    db
      .select({
        p: payments,
        orgName: organizations.name,
        orderNumber: orders.orderNumber,
        customerEmail: customers.email,
      })
      .from(payments)
      .leftJoin(organizations, eq(payments.organizationId, organizations.id))
      .leftJoin(orders, eq(payments.orderId, orders.id))
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(where)
      .orderBy(desc(payments.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.p.id,
      organizationId: r.p.organizationId,
      organizationName: r.orgName ?? "Unknown",
      orderId: r.p.orderId,
      orderNumber: r.orderNumber ?? "Unknown",
      customerEmail: r.customerEmail ?? "",
      provider: r.p.provider,
      providerReference: r.p.providerReference,
      status: r.p.status,
      amountCents: r.p.amountCents,
      currency: r.p.currency,
      paidAt: r.p.paidAt ? r.p.paidAt.toISOString() : null,
      createdAt: r.p.createdAt.toISOString(),
    })),
    total: asNumber(totalRow[0]?.n),
    page,
    pageSize,
  };
}

export interface PaymentDetail extends PaymentListItem {
  failureReason: string | null;
  refundAmountCents: number | null;
  refundReason: string | null;
  updatedAt: string;
}

export async function getPaymentDetail(id: string): Promise<PaymentDetail> {
  const paymentId = requireUuid(id, "Payment");
  const [row] = await db
    .select({
      p: payments,
      orgName: organizations.name,
      orderNumber: orders.orderNumber,
      customerEmail: customers.email,
    })
    .from(payments)
    .leftJoin(organizations, eq(payments.organizationId, organizations.id))
    .leftJoin(orders, eq(payments.orderId, orders.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(payments.id, paymentId))
    .limit(1);
  if (!row) throw new NotFoundError("Payment");

  return {
    id: row.p.id,
    organizationId: row.p.organizationId,
    organizationName: row.orgName ?? "Unknown",
    orderId: row.p.orderId,
    orderNumber: row.orderNumber ?? "Unknown",
    customerEmail: row.customerEmail ?? "",
    provider: row.p.provider,
    providerReference: row.p.providerReference,
    status: row.p.status,
    amountCents: row.p.amountCents,
    currency: row.p.currency,
    paidAt: row.p.paidAt ? row.p.paidAt.toISOString() : null,
    createdAt: row.p.createdAt.toISOString(),
    failureReason: row.p.failureReason,
    refundAmountCents: row.p.refundAmountCents,
    refundReason: row.p.refundReason,
    updatedAt: row.p.updatedAt.toISOString(),
  };
}

// ── Vaults ─────────────────────────────────────────────────────────────────────

export interface VaultListItem {
  id: string;
  publicId: string;
  slug: string;
  organizationId: string;
  organizationName: string;
  weddingId: string;
  weddingCode: string;
  weddingName: string;
  title: string | null;
  status: string;
  isPublic: boolean;
  noIndex: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export async function listVaults(query: ListQuery = {}): Promise<AdminList<VaultListItem>> {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);

  const conditions = [isNull(vaults.deletedAt)];
  if (isUuid(query.organizationId)) {
    conditions.push(eq(vaults.organizationId, query.organizationId));
  }
  if (query.status) {
    conditions.push(eq(vaults.status, query.status as never));
  }
  if (query.search) {
    const like = `%${query.search}%`;
    conditions.push(
      or(
        ilike(vaults.slug, like),
        ilike(vaults.title, like),
        ilike(vaults.publicId, like),
        ilike(weddings.code, like),
        ilike(weddings.name, like),
      )!,
    );
  }
  const where = and(...conditions);

  const [totalRow, rows] = await Promise.all([
    // The search WHERE may reference weddings.code/name, so the count query
    // carries the same join.
    db
      .select({ n: count() })
      .from(vaults)
      .leftJoin(weddings, eq(vaults.weddingId, weddings.id))
      .where(where),
    db
      .select({
        v: vaults,
        orgName: organizations.name,
        weddingCode: weddings.code,
        weddingName: weddings.name,
      })
      .from(vaults)
      .leftJoin(organizations, eq(vaults.organizationId, organizations.id))
      .leftJoin(weddings, eq(vaults.weddingId, weddings.id))
      .where(where)
      .orderBy(desc(vaults.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.v.id,
      publicId: r.v.publicId,
      slug: r.v.slug,
      organizationId: r.v.organizationId,
      organizationName: r.orgName ?? "Unknown",
      weddingId: r.v.weddingId,
      weddingCode: r.weddingCode ?? "Unknown",
      weddingName: r.weddingName ?? "Unknown",
      title: r.v.title,
      status: r.v.status,
      isPublic: r.v.isPublic,
      noIndex: r.v.noIndex,
      publishedAt: r.v.publishedAt ? r.v.publishedAt.toISOString() : null,
      createdAt: r.v.createdAt.toISOString(),
    })),
    total: asNumber(totalRow[0]?.n),
    page,
    pageSize,
  };
}

export interface GuestSessionDto {
  id: string;
  displayName: string | null;
  status: string;
  expiresAt: string;
  lastUsedAt: string | null;
  uploadCount: number;
  maxUploads: number;
  ipAddress: string | null;
  createdAt: string;
}

export interface VaultDetail {
  id: string;
  publicId: string;
  slug: string;
  organizationId: string;
  organizationName: string;
  weddingId: string;
  weddingCode: string;
  weddingName: string;
  title: string | null;
  description: string | null;
  status: string;
  isPublic: boolean;
  noIndex: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  mediaCount: number;
  guestSessionCount: number;
  guestSessions: GuestSessionDto[];
}

export async function getVaultDetail(id: string): Promise<VaultDetail> {
  const vaultId = requireUuid(id, "Vault");
  const [row] = await db
    .select({
      v: vaults,
      orgName: organizations.name,
      weddingCode: weddings.code,
      weddingName: weddings.name,
    })
    .from(vaults)
    .leftJoin(organizations, eq(vaults.organizationId, organizations.id))
    .leftJoin(weddings, eq(vaults.weddingId, weddings.id))
    .where(and(eq(vaults.id, vaultId), isNull(vaults.deletedAt)))
    .limit(1);
  if (!row) throw new NotFoundError("Vault");

  const [mediaCount, sessionRows] = await Promise.all([
    db.select({ n: count() }).from(media).where(eq(media.weddingId, row.v.weddingId)),
    db
      .select()
      .from(guestSessions)
      .where(eq(guestSessions.vaultId, vaultId))
      .orderBy(desc(guestSessions.createdAt))
      .limit(100),
  ]);

  return {
    id: row.v.id,
    publicId: row.v.publicId,
    slug: row.v.slug,
    organizationId: row.v.organizationId,
    organizationName: row.orgName ?? "Unknown",
    weddingId: row.v.weddingId,
    weddingCode: row.weddingCode ?? "Unknown",
    weddingName: row.weddingName ?? "Unknown",
    title: row.v.title,
    description: row.v.description,
    status: row.v.status,
    isPublic: row.v.isPublic,
    noIndex: row.v.noIndex,
    publishedAt: row.v.publishedAt ? row.v.publishedAt.toISOString() : null,
    createdAt: row.v.createdAt.toISOString(),
    updatedAt: row.v.updatedAt.toISOString(),
    mediaCount: asNumber(mediaCount[0]?.n),
    guestSessionCount: sessionRows.length,
    guestSessions: sessionRows.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      status: s.status,
      expiresAt: s.expiresAt.toISOString(),
      lastUsedAt: s.lastUsedAt ? s.lastUsedAt.toISOString() : null,
      uploadCount: s.uploadCount,
      maxUploads: s.maxUploads,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

// ── Media ──────────────────────────────────────────────────────────────────────

export interface MediaListItem {
  id: string;
  publicId: string;
  organizationId: string;
  organizationName: string;
  weddingId: string;
  weddingCode: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  uploadedBy: string | null;
  guestSessionId: string | null;
  status: string;
  createdAt: string;
}

export async function listMedia(query: ListQuery = {}): Promise<AdminList<MediaListItem>> {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);

  const conditions = [isNull(media.deletedAt)];
  if (isUuid(query.organizationId)) {
    conditions.push(eq(media.organizationId, query.organizationId));
  }
  if (query.status) {
    conditions.push(eq(media.status, query.status as never));
  }
  if (query.search) {
    const like = `%${query.search}%`;
    conditions.push(
      or(
        ilike(media.filename, like),
        ilike(media.publicId, like),
        ilike(weddings.code, like),
      )!,
    );
  }
  const where = and(...conditions);

  const [totalRow, rows] = await Promise.all([
    // The search WHERE may reference weddings.code, so the count query
    // carries the same join.
    db
      .select({ n: count() })
      .from(media)
      .leftJoin(weddings, eq(media.weddingId, weddings.id))
      .where(where),
    db
      .select({
        m: media,
        orgName: organizations.name,
        weddingCode: weddings.code,
      })
      .from(media)
      .leftJoin(organizations, eq(media.organizationId, organizations.id))
      .leftJoin(weddings, eq(media.weddingId, weddings.id))
      .where(where)
      .orderBy(desc(media.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.m.id,
      publicId: r.m.publicId,
      organizationId: r.m.organizationId,
      organizationName: r.orgName ?? "Unknown",
      weddingId: r.m.weddingId,
      weddingCode: r.weddingCode ?? "Unknown",
      filename: r.m.filename,
      contentType: r.m.contentType,
      sizeBytes: r.m.sizeBytes,
      width: r.m.width,
      height: r.m.height,
      uploadedBy: r.m.uploadedBy,
      guestSessionId: r.m.guestSessionId,
      status: r.m.status,
      createdAt: r.m.createdAt.toISOString(),
    })),
    total: asNumber(totalRow[0]?.n),
    page,
    pageSize,
  };
}

export interface MediaDetail {
  id: string;
  publicId: string;
  organizationId: string;
  organizationName: string;
  weddingId: string;
  weddingCode: string;
  storageKey: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  sha256Hash: string | null;
  uploadedBy: string | null;
  guestSessionId: string | null;
  status: string;
  createdAt: string;
  variants: Array<{
    id: string;
    variantType: string;
    storageKey: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
  }>;
  processingJobs: Array<{
    id: string;
    jobType: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    errorMessage: string | null;
    startedAt: string | null;
    completedAt: string | null;
  }>;
}

export async function getMediaDetail(id: string): Promise<MediaDetail> {
  const mediaId = requireUuid(id, "Media");
  const [row] = await db
    .select({
      m: media,
      orgName: organizations.name,
      weddingCode: weddings.code,
    })
    .from(media)
    .leftJoin(organizations, eq(media.organizationId, organizations.id))
    .leftJoin(weddings, eq(media.weddingId, weddings.id))
    .where(and(eq(media.id, mediaId), isNull(media.deletedAt)))
    .limit(1);
  if (!row) throw new NotFoundError("Media");

  const [variantRows, jobRows] = await Promise.all([
    db
      .select()
      .from(mediaVariants)
      .where(eq(mediaVariants.mediaId, mediaId))
      .orderBy(mediaVariants.variantType),
    db
      .select()
      .from(mediaProcessingJobs)
      .where(eq(mediaProcessingJobs.mediaId, mediaId))
      .orderBy(mediaProcessingJobs.createdAt),
  ]);

  return {
    id: row.m.id,
    publicId: row.m.publicId,
    organizationId: row.m.organizationId,
    organizationName: row.orgName ?? "Unknown",
    weddingId: row.m.weddingId,
    weddingCode: row.weddingCode ?? "Unknown",
    storageKey: row.m.storageKey,
    filename: row.m.filename,
    contentType: row.m.contentType,
    sizeBytes: row.m.sizeBytes,
    width: row.m.width,
    height: row.m.height,
    durationMs: row.m.durationMs,
    sha256Hash: row.m.sha256Hash,
    uploadedBy: row.m.uploadedBy,
    guestSessionId: row.m.guestSessionId,
    status: row.m.status,
    createdAt: row.m.createdAt.toISOString(),
    variants: variantRows.map((v) => ({
      id: v.id,
      variantType: v.variantType,
      storageKey: v.storageKey,
      filename: v.filename,
      contentType: v.contentType,
      sizeBytes: v.sizeBytes,
      width: v.width,
      height: v.height,
    })),
    processingJobs: jobRows.map((j) => ({
      id: j.id,
      jobType: j.jobType,
      status: j.status,
      attempts: j.attempts,
      maxAttempts: j.maxAttempts,
      errorMessage: j.errorMessage,
      startedAt: j.startedAt ? j.startedAt.toISOString() : null,
      completedAt: j.completedAt ? j.completedAt.toISOString() : null,
    })),
  };
}

// ── Build jobs ─────────────────────────────────────────────────────────────────

export interface BuildJobListItem {
  id: string;
  organizationId: string;
  organizationName: string;
  weddingId: string;
  weddingCode: string;
  buildType: string;
  version: number;
  status: string;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  enqueuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export async function listBuildJobs(query: ListQuery = {}): Promise<AdminList<BuildJobListItem>> {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);

  const conditions = [];
  if (isUuid(query.organizationId)) {
    conditions.push(eq(buildJobs.organizationId, query.organizationId));
  }
  if (query.status) {
    conditions.push(eq(buildJobs.status, query.status as never));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow, rows] = await Promise.all([
    db.select({ n: count() }).from(buildJobs).where(where),
    db
      .select({
        j: buildJobs,
        orgName: organizations.name,
        weddingCode: weddings.code,
      })
      .from(buildJobs)
      .leftJoin(organizations, eq(buildJobs.organizationId, organizations.id))
      .leftJoin(weddings, eq(buildJobs.weddingId, weddings.id))
      .where(where)
      .orderBy(desc(buildJobs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.j.id,
      organizationId: r.j.organizationId,
      organizationName: r.orgName ?? "Unknown",
      weddingId: r.j.weddingId,
      weddingCode: r.weddingCode ?? "Unknown",
      buildType: r.j.buildType,
      version: r.j.version,
      status: r.j.status,
      attempts: r.j.attempts,
      maxAttempts: r.j.maxAttempts,
      errorMessage: r.j.errorMessage,
      enqueuedAt: r.j.enqueuedAt ? r.j.enqueuedAt.toISOString() : null,
      startedAt: r.j.startedAt ? r.j.startedAt.toISOString() : null,
      completedAt: r.j.completedAt ? r.j.completedAt.toISOString() : null,
      createdAt: r.j.createdAt.toISOString(),
    })),
    total: asNumber(totalRow[0]?.n),
    page,
    pageSize,
  };
}

export interface BuildJobDetail {
  id: string;
  organizationId: string;
  organizationName: string;
  weddingId: string;
  weddingCode: string;
  buildType: string;
  templateId: string | null;
  idempotencyKey: string;
  version: number;
  status: string;
  input: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  attempts: number;
  maxAttempts: number;
  enqueuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  steps: Array<{
    stepKey: string;
    stepOrder: number;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    errorMessage: string | null;
  }>;
}

export async function getBuildJobDetail(id: string): Promise<BuildJobDetail> {
  const buildJobId = requireUuid(id, "Build job");
  const [row] = await db
    .select({
      j: buildJobs,
      orgName: organizations.name,
      weddingCode: weddings.code,
    })
    .from(buildJobs)
    .leftJoin(organizations, eq(buildJobs.organizationId, organizations.id))
    .leftJoin(weddings, eq(buildJobs.weddingId, weddings.id))
    .where(eq(buildJobs.id, buildJobId))
    .limit(1);
  if (!row) throw new NotFoundError("Build job");

  const steps = await db
    .select()
    .from(buildJobSteps)
    .where(eq(buildJobSteps.buildJobId, buildJobId))
    .orderBy(buildJobSteps.stepOrder);

  return {
    id: row.j.id,
    organizationId: row.j.organizationId,
    organizationName: row.orgName ?? "Unknown",
    weddingId: row.j.weddingId,
    weddingCode: row.weddingCode ?? "Unknown",
    buildType: row.j.buildType,
    templateId: row.j.templateId,
    idempotencyKey: row.j.idempotencyKey,
    version: row.j.version,
    status: row.j.status,
    input: row.j.input,
    result: row.j.result,
    errorMessage: row.j.errorMessage,
    attempts: row.j.attempts,
    maxAttempts: row.j.maxAttempts,
    enqueuedAt: row.j.enqueuedAt ? row.j.enqueuedAt.toISOString() : null,
    startedAt: row.j.startedAt ? row.j.startedAt.toISOString() : null,
    completedAt: row.j.completedAt ? row.j.completedAt.toISOString() : null,
    createdAt: row.j.createdAt.toISOString(),
    steps: steps.map((s) => ({
      stepKey: s.stepKey,
      stepOrder: s.stepOrder,
      status: s.status,
      startedAt: s.startedAt ? s.startedAt.toISOString() : null,
      completedAt: s.completedAt ? s.completedAt.toISOString() : null,
      errorMessage: s.errorMessage,
    })),
  };
}

// ── Email jobs ─────────────────────────────────────────────────────────────────

export interface EmailJobListItem {
  id: string;
  organizationId: string;
  organizationName: string;
  weddingId: string | null;
  weddingCode: string | null;
  emailType: string;
  toEmail: string;
  status: string;
  idempotencyKey: string;
  providerMessageId: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  createdAt: string;
}

export async function listEmailJobs(query: ListQuery = {}): Promise<AdminList<EmailJobListItem>> {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);

  const conditions = [];
  if (isUuid(query.organizationId)) {
    conditions.push(eq(emailJobs.organizationId, query.organizationId));
  }
  if (query.status) {
    conditions.push(eq(emailJobs.status, query.status as never));
  }
  if (query.search) {
    const like = `%${query.search}%`;
    conditions.push(
      or(
        ilike(emailJobs.toEmail, like),
        ilike(emailJobs.idempotencyKey, like),
      )!,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow, rows] = await Promise.all([
    db.select({ n: count() }).from(emailJobs).where(where),
    db
      .select({
        j: emailJobs,
        orgName: organizations.name,
        weddingCode: weddings.code,
      })
      .from(emailJobs)
      .leftJoin(organizations, eq(emailJobs.organizationId, organizations.id))
      .leftJoin(weddings, eq(emailJobs.weddingId, weddings.id))
      .where(where)
      .orderBy(desc(emailJobs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.j.id,
      organizationId: r.j.organizationId,
      organizationName: r.orgName ?? "Unknown",
      weddingId: r.j.weddingId,
      weddingCode: r.weddingCode ?? null,
      emailType: r.j.emailType,
      toEmail: r.j.toEmail,
      status: r.j.status,
      idempotencyKey: r.j.idempotencyKey,
      providerMessageId: r.j.providerMessageId,
      scheduledAt: r.j.scheduledAt ? r.j.scheduledAt.toISOString() : null,
      sentAt: r.j.sentAt ? r.j.sentAt.toISOString() : null,
      attempts: r.j.attempts,
      maxAttempts: r.j.maxAttempts,
      errorMessage: r.j.errorMessage,
      createdAt: r.j.createdAt.toISOString(),
    })),
    total: asNumber(totalRow[0]?.n),
    page,
    pageSize,
  };
}

export interface EmailJobDetail {
  id: string;
  organizationId: string;
  organizationName: string;
  weddingId: string | null;
  weddingCode: string | null;
  emailType: string;
  toEmail: string;
  toName: string | null;
  subject: string;
  status: string;
  idempotencyKey: string;
  providerMessageId: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  createdAt: string;
}

export async function getEmailJobDetail(id: string): Promise<EmailJobDetail> {
  const emailJobId = requireUuid(id, "Email job");
  const [row] = await db
    .select({
      j: emailJobs,
      orgName: organizations.name,
      weddingCode: weddings.code,
    })
    .from(emailJobs)
    .leftJoin(organizations, eq(emailJobs.organizationId, organizations.id))
    .leftJoin(weddings, eq(emailJobs.weddingId, weddings.id))
    .where(eq(emailJobs.id, emailJobId))
    .limit(1);
  if (!row) throw new NotFoundError("Email job");

  return {
    id: row.j.id,
    organizationId: row.j.organizationId,
    organizationName: row.orgName ?? "Unknown",
    weddingId: row.j.weddingId,
    weddingCode: row.weddingCode ?? null,
    emailType: row.j.emailType,
    toEmail: row.j.toEmail,
    toName: row.j.toName,
    subject: row.j.subject,
    status: row.j.status,
    idempotencyKey: row.j.idempotencyKey,
    providerMessageId: row.j.providerMessageId,
    scheduledAt: row.j.scheduledAt ? row.j.scheduledAt.toISOString() : null,
    sentAt: row.j.sentAt ? row.j.sentAt.toISOString() : null,
    attempts: row.j.attempts,
    maxAttempts: row.j.maxAttempts,
    errorMessage: row.j.errorMessage,
    createdAt: row.j.createdAt.toISOString(),
  };
}

// ── Lifecycle events ───────────────────────────────────────────────────────────

export interface LifecycleEventListItem {
  id: string;
  organizationId: string;
  organizationName: string;
  weddingId: string;
  weddingCode: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  occurredAt: string;
}

export async function listLifecycleEvents(query: ListQuery = {}): Promise<AdminList<LifecycleEventListItem>> {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);

  const conditions = [];
  if (isUuid(query.organizationId)) {
    conditions.push(eq(lifecycleEvents.organizationId, query.organizationId));
  }
  if (query.status) {
    conditions.push(eq(lifecycleEvents.eventType, query.status as never));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow, rows] = await Promise.all([
    db.select({ n: count() }).from(lifecycleEvents).where(where),
    db
      .select({
        e: lifecycleEvents,
        orgName: organizations.name,
        weddingCode: weddings.code,
        actorEmail: users.email,
      })
      .from(lifecycleEvents)
      .leftJoin(organizations, eq(lifecycleEvents.organizationId, organizations.id))
      .leftJoin(weddings, eq(lifecycleEvents.weddingId, weddings.id))
      .leftJoin(users, eq(lifecycleEvents.actorUserId, users.id))
      .where(where)
      .orderBy(desc(lifecycleEvents.occurredAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.e.id,
      organizationId: r.e.organizationId,
      organizationName: r.orgName ?? "Unknown",
      weddingId: r.e.weddingId,
      weddingCode: r.weddingCode ?? "Unknown",
      eventType: r.e.eventType,
      fromStatus: r.e.fromStatus,
      toStatus: r.e.toStatus,
      reason: r.e.reason,
      actorUserId: r.e.actorUserId,
      actorEmail: r.actorEmail ?? null,
      occurredAt: r.e.occurredAt.toISOString(),
    })),
    total: asNumber(totalRow[0]?.n),
    page,
    pageSize,
  };
}

// ── Write actions ──────────────────────────────────────────────────────────────

/**
 * Retries a FAILED build job via the canonical build-engine path.
 * Safe no-ops: pending/processing/completed/succeeded jobs and jobs whose
 * attempts are exhausted are left untouched.
 */
export async function adminRetryBuildJob(
  id: string,
  ctx: AdminContext,
  meta: AdminRequestMeta = {},
): Promise<WriteResult> {
  const buildJobId = requireUuid(id, "Build job");
  const { job } = await getBuildStatus(buildJobId);
  if (!job) throw new NotFoundError("Build job");

  const before: Record<string, unknown> = {
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    errorMessage: job.errorMessage ?? null,
    idempotencyKey: job.idempotencyKey,
  };

  if (job.status !== "failed") {
    const reason = `Build job is '${job.status}'; only failed jobs can be retried`;
    warnNoOp("admin_retry_build_job", buildJobId, reason);
    return { changed: false, reason, before };
  }
  if (job.attempts >= job.maxAttempts) {
    const reason = "Build job has exhausted its retry budget";
    warnNoOp("admin_retry_build_job", buildJobId, reason);
    return { changed: false, reason, before };
  }

  await retryBuild(buildJobId);

  const after: Record<string, unknown> = {
    status: "pending",
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    errorMessage: null,
    idempotencyKey: job.idempotencyKey,
  };

  const auditId = await recordAudit(ctx, meta, {
    organizationId: job.organizationId,
    action: "admin_retry_build_job",
    resourceType: "build_job",
    resourceId: job.id,
    before,
    after,
    metadata: { retryReason: "admin" },
  });

  return { changed: true, before, after, auditId };
}

/**
 * Resets a FAILED email job back to `pending` with a fresh attempt budget.
 * The idempotency key is preserved so re-delivery can never double-send.
 */
export async function adminRetryEmailJob(
  id: string,
  ctx: AdminContext,
  meta: AdminRequestMeta = {},
): Promise<WriteResult> {
  const emailJobId = requireUuid(id, "Email job");
  const [job] = await db
    .select()
    .from(emailJobs)
    .where(eq(emailJobs.id, emailJobId))
    .limit(1);
  if (!job) throw new NotFoundError("Email job");

  const before: Record<string, unknown> = {
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    errorMessage: job.errorMessage ?? null,
    idempotencyKey: job.idempotencyKey,
    sentAt: job.sentAt ? job.sentAt.toISOString() : null,
  };

  if (job.status !== "failed") {
    const reason = `Email job is '${job.status}'; only failed jobs can be retried`;
    warnNoOp("admin_retry_email_job", emailJobId, reason);
    return { changed: false, reason, before };
  }
  if (job.attempts >= job.maxAttempts) {
    const reason = "Email job has exhausted its retry budget";
    warnNoOp("admin_retry_email_job", emailJobId, reason);
    return { changed: false, reason, before };
  }

  const [updated] = await db
    .update(emailJobs)
    .set({
      status: "pending",
      attempts: 0,
      errorMessage: null,
      sentAt: null,
      updatedAt: new Date(),
    })
    .where(eq(emailJobs.id, emailJobId))
    .returning({ id: emailJobs.id, status: emailJobs.status, updatedAt: emailJobs.updatedAt });

  const after: Record<string, unknown> = {
    status: updated?.status ?? "pending",
    attempts: 0,
    maxAttempts: job.maxAttempts,
    errorMessage: null,
    idempotencyKey: job.idempotencyKey,
    sentAt: null,
  };

  const auditId = await recordAudit(ctx, meta, {
    organizationId: job.organizationId,
    action: "admin_retry_email_job",
    resourceType: "email_job",
    resourceId: job.id,
    before,
    after,
    metadata: { retryReason: "admin" },
  });

  return { changed: true, before, after, auditId };
}

/**
 * Retries FAILED media processing jobs via the canonical media-service path.
 */
export async function adminRetryMediaProcessing(
  id: string,
  ctx: AdminContext,
  meta: AdminRequestMeta = {},
): Promise<WriteResult> {
  const mediaId = requireUuid(id, "Media");
  const [mediaRow] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, mediaId), isNull(media.deletedAt)))
    .limit(1);
  if (!mediaRow) throw new NotFoundError("Media");

  const failedJobs = await db
    .select({ id: mediaProcessingJobs.id })
    .from(mediaProcessingJobs)
    .where(
      and(
        eq(mediaProcessingJobs.mediaId, mediaId),
        eq(mediaProcessingJobs.status, "failed"),
      ),
    );

  const before: Record<string, unknown> = {
    mediaStatus: mediaRow.status,
    failedJobCount: failedJobs.length,
  };

  if (failedJobs.length === 0) {
    const reason = "Media has no failed processing jobs to retry";
    warnNoOp("admin_retry_media_processing", mediaId, reason);
    return { changed: false, reason, before };
  }

  const result = await retryProcessingJobs(mediaId, mediaRow.organizationId);

  const after: Record<string, unknown> = {
    mediaStatus: "processing",
    failedJobCount: 0,
    reset: result.reset,
  };

  const auditId = await recordAudit(ctx, meta, {
    organizationId: mediaRow.organizationId,
    action: "admin_retry_media_processing",
    resourceType: "media",
    resourceId: mediaRow.id,
    before,
    after,
    metadata: { reset: result.reset },
  });

  return { changed: true, before, after, auditId };
}

/**
 * Suspends an ACTIVE wedding-company organization. Platform organizations are
 * never suspendable; already-suspended/closed orgs are a safe no-op.
 */
export async function adminSuspendOrganization(
  id: string,
  ctx: AdminContext,
  meta: AdminRequestMeta = {},
): Promise<WriteResult> {
  const orgId = requireUuid(id, "Organization");
  const [org] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)))
    .limit(1);
  if (!org) throw new NotFoundError("Organization");

  const before: Record<string, unknown> = { status: org.status, type: org.type };

  if (org.type === "platform") {
    const reason = "Platform organizations cannot be suspended";
    warnNoOp("admin_suspend_organization", orgId, reason);
    return { changed: false, reason, before };
  }
  if (org.status === "closed") {
    const reason = "Closed organizations cannot be suspended";
    warnNoOp("admin_suspend_organization", orgId, reason);
    return { changed: false, reason, before };
  }
  if (org.status === "suspended") {
    const reason = "Organization is already suspended";
    warnNoOp("admin_suspend_organization", orgId, reason);
    return { changed: false, reason, before };
  }

  const [updated] = await db
    .update(organizations)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
    .returning({ id: organizations.id, status: organizations.status });

  const after: Record<string, unknown> = { status: updated?.status ?? "suspended", type: org.type };

  const auditId = await recordAudit(ctx, meta, {
    organizationId: orgId,
    action: "admin_suspend_organization",
    resourceType: "organization",
    resourceId: org.id,
    before,
    after,
  });

  return { changed: true, before, after, auditId };
}

/**
 * Restores a SUSPENDED organization to ACTIVE. Active/closed orgs are no-ops.
 */
export async function adminUnsuspendOrganization(
  id: string,
  ctx: AdminContext,
  meta: AdminRequestMeta = {},
): Promise<WriteResult> {
  const orgId = requireUuid(id, "Organization");
  const [org] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)))
    .limit(1);
  if (!org) throw new NotFoundError("Organization");

  const before: Record<string, unknown> = { status: org.status, type: org.type };

  if (org.status !== "suspended") {
    const reason = `Organization is '${org.status}'; only suspended organizations can be restored`;
    warnNoOp("admin_unsuspend_organization", orgId, reason);
    return { changed: false, reason, before };
  }

  const [updated] = await db
    .update(organizations)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
    .returning({ id: organizations.id, status: organizations.status });

  const after: Record<string, unknown> = { status: updated?.status ?? "active", type: org.type };

  const auditId = await recordAudit(ctx, meta, {
    organizationId: orgId,
    action: "admin_unsuspend_organization",
    resourceType: "organization",
    resourceId: org.id,
    before,
    after,
  });

  return { changed: true, before, after, auditId };
}

/**
 * Suspends an ACTIVE non-platform-admin user. Platform admins and the actor
 * themselves are never suspendable via this entry point.
 */
export async function adminSuspendUser(
  id: string,
  ctx: AdminContext,
  meta: AdminRequestMeta = {},
): Promise<WriteResult> {
  const userId = requireUuid(id, "User");
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  if (!user) throw new NotFoundError("User");

  const memberships = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.status, "active"),
        isNull(organizationMembers.deletedAt),
      ),
    );

  const before: Record<string, unknown> = {
    status: user.status,
    activeMembershipRoles: memberships.map((m) => m.role),
  };

  if (userId === ctx.userId) {
    const reason = "Admins cannot suspend their own account";
    warnNoOp("admin_suspend_user", userId, reason);
    return { changed: false, reason, before };
  }
  if (memberships.some((m) => m.role === "platform_admin")) {
    const reason = "Platform administrators cannot be suspended";
    warnNoOp("admin_suspend_user", userId, reason);
    return { changed: false, reason, before };
  }
  if (user.status !== "active") {
    const reason = `User is '${user.status}'; only active users can be suspended`;
    warnNoOp("admin_suspend_user", userId, reason);
    return { changed: false, reason, before };
  }

  const [updated] = await db
    .update(users)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id, status: users.status });

  const after: Record<string, unknown> = {
    status: updated?.status ?? "suspended",
    activeMembershipRoles: memberships.map((m) => m.role),
  };

  const auditId = await recordAudit(ctx, meta, {
    action: "admin_suspend_user",
    resourceType: "user",
    resourceId: user.id,
    before,
    after,
  });

  return { changed: true, before, after, auditId };
}

/**
 * Revokes an ACTIVE guest session. Expired/revoked sessions are safe no-ops.
 */
export async function adminRevokeGuestSession(
  id: string,
  ctx: AdminContext,
  meta: AdminRequestMeta = {},
): Promise<WriteResult> {
  const sessionId = requireUuid(id, "Guest session");
  const [session] = await db
    .select()
    .from(guestSessions)
    .where(eq(guestSessions.id, sessionId))
    .limit(1);
  if (!session) throw new NotFoundError("Guest session");

  const before: Record<string, unknown> = {
    status: session.status,
    displayName: session.displayName ?? null,
    expiresAt: session.expiresAt.toISOString(),
    uploadCount: session.uploadCount,
  };

  if (session.status !== "active") {
    const reason = `Guest session is '${session.status}'; only active sessions can be revoked`;
    warnNoOp("admin_revoke_guest_session", sessionId, reason);
    return { changed: false, reason, before };
  }

  const [updated] = await db
    .update(guestSessions)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(guestSessions.id, sessionId))
    .returning({ id: guestSessions.id, status: guestSessions.status });

  const after: Record<string, unknown> = {
    status: updated?.status ?? "revoked",
    displayName: session.displayName ?? null,
    expiresAt: session.expiresAt.toISOString(),
    uploadCount: session.uploadCount,
  };

  const auditId = await recordAudit(ctx, meta, {
    organizationId: session.organizationId,
    action: "admin_revoke_guest_session",
    resourceType: "guest_session",
    resourceId: session.id,
    before,
    after,
  });

  return { changed: true, before, after, auditId };
}