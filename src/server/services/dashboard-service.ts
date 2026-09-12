/**
 * Dashboard Service — tenant-scoped read models for the authenticated
 * wedding-company dashboard (`/dashboard` route group).
 *
 * SECURITY INVARIANTS:
 *  - Every function takes `organizationId` explicitly and filters every query
 *    by it. No client-supplied org ids are ever trusted; callers resolve the
 *    tenant via `requireTenant()` in server components / API guards.
 *  - Media rows expose ONLY `publicId` (+ display metadata) to clients —
 *    internal UUIDs, storage keys, sha256 hashes and guest/uploader ids are
 *    never passed to the browser.
 *  - QR rows expose `publicId` for public destinations **and** the internal
 *    `id` — the id is required by the existing authenticated admin API routes
 *    (`/api/qr/[id]`, `/api/qr/[id]/card`); it is never used on guest surfaces.
 *  - Where a widget has no backend data yet (e.g. support tickets) we return
 *    an empty list instead of fabricating data.
 *
 * This module is server-side only (`@/lib/db` requires DATABASE_URL).
 */

import { eq, and, isNull, isNotNull, desc, count, gte, lt, gt, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  buildJobs,
  buildJobSteps,
  customers,
  expiryRules,
  guestSessions,
  media,
  orders,
  organizationMembers,
  organizations,
  payments,
  products,
  qrCodes,
  users,
  vaults,
  weddingSettings,
  weddings,
} from "@/lib/db/schema";
import { isVideoMime } from "@/server/services/storage/mime";
import { BUSINESS_TIMEZONE } from "@/lib/entitlements/expiry";

// ── DTO types (guest-safe where applicable) ───────────────────────────────────

export interface ExpiringWedding {
  /** Internal wedding UUID (authenticated dashboard surface only). */
  weddingId: string;
  slug: string;
  partnerOne: string | null;
  partnerTwo: string | null;
  /** Calendar date YYYY-MM-DD. */
  weddingDate: string | null;
  /** UTC ISO timestamps of the exclusive-end deadlines. */
  uploadDeadline: string;
  downloadDeadline: string;
  packageCode: string;
  /** Calendar days until the download deadline (0 when passed). */
  daysLeft: number;
}

export interface DashboardOverview {
  weddings: number;
  active: number;
  building: number;
  draft: number;
  mediaCountThisMonth: number;
  guestUploads: number;
  totalGuests: number;
  expiringSoon: ExpiringWedding[];
}

export interface WeddingListItem {
  weddingId: string;
  code: string;
  name: string;
  partnerOneName: string | null;
  partnerTwoName: string | null;
  status: string;
  weddingDate: string | null;
  packageCode: string | null;
  packageName: string | null;
  customerName: string;
  customerEmail: string;
  slug: string | null;
  vaultStatus: string | null;
  mediaCount: number;
  guestSessionCount: number;
  qrCodeCount: number;
  createdAt: string;
}

export interface MediaListItem {
  /** Opaque public id — the ONLY identifier exposed for guest-facing links. */
  publicId: string;
  filename: string;
  contentType: string;
  status: string;
  sizeBytes: number;
  kind: "photo" | "video";
  createdAt: string;
}

export interface QrListItem {
  /** Internal UUID required by the authenticated admin QR mutation APIs. */
  id: string;
  publicId: string;
  status: string;
  targetUrl: string | null;
  generatedAt: string;
  expiresAt: string | null;
  weddingSlug: string | null;
  weddingName: string;
  /** Product/package code for feature gating (e.g. qr_design_card). */
  packageCode: string | null;
}

export interface BuildStepListItem {
  stepKey: string;
  stepOrder: number;
  status: string;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface BuildJobListItem {
  id: string;
  status: string;
  buildType: string;
  version: number;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  enqueuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  steps: BuildStepListItem[];
}

export interface WeddingDetail {
  weddingId: string;
  code: string;
  name: string;
  partnerOneName: string | null;
  partnerTwoName: string | null;
  status: string;
  weddingDate: string | null;
  timezone: string;
  customer: {
    id: string;
    publicId: string;
    fullName: string;
    email: string;
    phone: string | null;
  } | null;
  package: {
    id: string;
    code: string;
    name: string;
    priceCents: number;
    currency: string;
  } | null;
  vault: {
    slug: string;
    status: string;
    isPublic: boolean;
    publishedAt: string | null;
  } | null;
  settings: {
    themeColor: string;
    accentColor: string;
    coupleStory: string | null;
    customMessage: string | null;
    allowGuestUploads: boolean;
  } | null;
  expiry: {
    uploadDeadline: string;
    downloadDeadline: string;
    uploadWindowDays: number;
    downloadWindowDays: number;
  } | null;
  media: MediaListItem[];
  qrCodes: QrListItem[];
  buildJobs: BuildJobListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListItem {
  /** Internal customer UUID (used for the authenticated detail page). */
  customerId: string;
  publicId: string;
  fullName: string;
  email: string;
  phone: string | null;
  orderCount: number;
  weddingCount: number;
  createdAt: string;
}

export interface CustomerDetail {
  customerId: string;
  publicId: string;
  fullName: string;
  email: string;
  phone: string | null;
  createdAt: string;
  weddings: Array<{
    weddingId: string;
    code: string;
    name: string;
    status: string;
    weddingDate: string | null;
    packageCode: string | null;
    slug: string | null;
  }>;
  orders: Array<{
    orderId: string;
    orderNumber: string;
    status: string;
    totalCents: number;
    currency: string;
    placedAt: string | null;
    productName: string | null;
  }>;
}

export interface OrderListItem {
  orderId: string;
  orderNumber: string;
  status: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  placedAt: string | null;
  paidAt: string | null;
  customerName: string;
  customerEmail: string;
  productName: string | null;
  packageCode: string | null;
  /** Best-known payment status across the order's payment attempts. */
  paymentStatus: string | null;
}

export interface PaymentListItem {
  paymentId: string;
  provider: string;
  status: string;
  amountCents: number;
  currency: string;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
  orderNumber: string;
  customerName: string;
}

export interface ProfileMembership {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: string;
  status: string;
  joinedAt: string | null;
}

export interface ProfileData {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string;
  memberships: ProfileMembership[];
}

export interface OrganizationSummary {
  id: string;
  publicId: string;
  name: string;
  slug: string;
}

export interface SupportTicketListItem {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function toISO(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function calendarDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().split("T")[0] : null;
}

function daysLeftUntil(deadline: Date, now: Date = new Date()): number {
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function mediaKind(contentType: string): "photo" | "video" {
  return isVideoMime(contentType) ? "video" : "photo";
}

function buildMediaListItem(row: typeof media.$inferSelect): MediaListItem {
  return {
    publicId: row.publicId,
    filename: row.filename,
    contentType: row.contentType,
    status: row.status,
    sizeBytes: row.sizeBytes,
    kind: mediaKind(row.contentType),
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Overview ─────────────────────────────────────────────────────────────────

export async function getDashboardOverview(
  organizationId: string,
): Promise<DashboardOverview> {
  const now = new Date();
  const startOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const soonWindow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [weddingRow, activeRow, buildingRow, draftRow, mediaMonthRow, guestUploadRow, guestCountRow] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(weddings)
        .where(
          and(
            eq(weddings.organizationId, organizationId),
            isNull(weddings.deletedAt),
          ),
        ),
      db
        .select({ value: count() })
        .from(weddings)
        .where(
          and(
            eq(weddings.organizationId, organizationId),
            eq(weddings.status, "active"),
            isNull(weddings.deletedAt),
          ),
        ),
      db
        .select({ value: count() })
        .from(weddings)
        .where(
          and(
            eq(weddings.organizationId, organizationId),
            eq(weddings.status, "building"),
            isNull(weddings.deletedAt),
          ),
        ),
      db
        .select({ value: count() })
        .from(weddings)
        .where(
          and(
            eq(weddings.organizationId, organizationId),
            eq(weddings.status, "draft"),
            isNull(weddings.deletedAt),
          ),
        ),
      db
        .select({ value: count() })
        .from(media)
        .where(
          and(
            eq(media.organizationId, organizationId),
            gte(media.createdAt, startOfMonth),
            isNull(media.deletedAt),
          ),
        ),
      db
        .select({ value: count() })
        .from(media)
        .where(
          and(
            eq(media.organizationId, organizationId),
            isNotNull(media.guestSessionId),
            isNull(media.deletedAt),
          ),
        ),
      db
        .select({ value: count() })
        .from(guestSessions)
        .where(eq(guestSessions.organizationId, organizationId)),
    ]);

  // Expiring soon: download deadline within the next 30 days and not yet passed.
  const expiringRows = await db
    .select({
      weddingId: weddings.id,
      slug: vaults.slug,
      partnerOne: weddings.partnerOneName,
      partnerTwo: weddings.partnerTwoName,
      weddingDate: weddings.weddingDate,
      uploadDeadline: expiryRules.uploadDeadline,
      downloadDeadline: expiryRules.downloadDeadline,
      packageCode: products.code,
    })
    .from(weddings)
    .leftJoin(vaults, eq(vaults.weddingId, weddings.id))
    .leftJoin(products, eq(weddings.productId, products.id))
    .leftJoin(expiryRules, eq(expiryRules.weddingId, weddings.id))
    .where(
      and(
        eq(weddings.organizationId, organizationId),
        isNull(weddings.deletedAt),
        gt(expiryRules.downloadDeadline, now),
        lt(expiryRules.downloadDeadline, soonWindow),
      ),
    )
    .orderBy(desc(expiryRules.downloadDeadline));

  const expiringSoon: ExpiringWedding[] = expiringRows
    .filter((row) => row.uploadDeadline && row.downloadDeadline)
    .map((row) => ({
      weddingId: row.weddingId,
      slug: row.slug ?? "",
      partnerOne: row.partnerOne,
      partnerTwo: row.partnerTwo,
      weddingDate: calendarDate(row.weddingDate),
      uploadDeadline: row.uploadDeadline!.toISOString(),
      downloadDeadline: row.downloadDeadline!.toISOString(),
      packageCode: row.packageCode ?? "silver",
      daysLeft: daysLeftUntil(row.downloadDeadline!, now),
    }));

  return {
    weddings: weddingRow[0]?.value ?? 0,
    active: activeRow[0]?.value ?? 0,
    building: buildingRow[0]?.value ?? 0,
    draft: draftRow[0]?.value ?? 0,
    mediaCountThisMonth: mediaMonthRow[0]?.value ?? 0,
    guestUploads: guestUploadRow[0]?.value ?? 0,
    totalGuests: guestCountRow[0]?.value ?? 0,
    expiringSoon,
  };
}

// ── Weddings ─────────────────────────────────────────────────────────────────

export async function listWeddings(
  organizationId: string,
): Promise<WeddingListItem[]> {
  const rows = await db
    .select({
      weddingId: weddings.id,
      code: weddings.code,
      name: weddings.name,
      partnerOneName: weddings.partnerOneName,
      partnerTwoName: weddings.partnerTwoName,
      status: weddings.status,
      weddingDate: weddings.weddingDate,
      packageCode: products.code,
      packageName: products.name,
      customerName: customers.fullName,
      customerEmail: customers.email,
      slug: vaults.slug,
      vaultStatus: vaults.status,
      createdAt: weddings.createdAt,
    })
    .from(weddings)
    .leftJoin(customers, eq(weddings.customerId, customers.id))
    .leftJoin(products, eq(weddings.productId, products.id))
    .leftJoin(vaults, eq(vaults.weddingId, weddings.id))
    .where(
      and(
        eq(weddings.organizationId, organizationId),
        isNull(weddings.deletedAt),
      ),
    )
    .orderBy(desc(weddings.createdAt));

  if (rows.length === 0) return [];

  const weddingIds = rows.map((r) => r.weddingId);

  const [mediaCounts, guestCounts, qrCounts] = await Promise.all([
    db
      .select({ weddingId: media.weddingId, value: count() })
      .from(media)
      .where(
        and(
          eq(media.organizationId, organizationId),
          inArray(media.weddingId, weddingIds),
          isNull(media.deletedAt),
        ),
      )
      .groupBy(media.weddingId),
    db
      .select({ weddingId: vaults.weddingId, value: count() })
      .from(guestSessions)
      .innerJoin(vaults, eq(guestSessions.vaultId, vaults.id))
      .where(
        and(
          eq(guestSessions.organizationId, organizationId),
          inArray(vaults.weddingId, weddingIds),
        ),
      )
      .groupBy(vaults.weddingId),
    db
      .select({ weddingId: qrCodes.weddingId, value: count() })
      .from(qrCodes)
      .where(
        and(
          eq(qrCodes.organizationId, organizationId),
          inArray(qrCodes.weddingId, weddingIds),
          isNull(qrCodes.deletedAt),
        ),
      )
      .groupBy(qrCodes.weddingId),
  ]);

  const mediaMap = new Map(mediaCounts.map((r) => [r.weddingId, r.value]));
  const guestMap = new Map(guestCounts.map((r) => [r.weddingId, r.value]));
  const qrMap = new Map(qrCounts.map((r) => [r.weddingId, r.value]));

  return rows.map((row) => ({
    weddingId: row.weddingId,
    code: row.code,
    name: row.name,
    partnerOneName: row.partnerOneName,
    partnerTwoName: row.partnerTwoName,
    status: row.status,
    weddingDate: calendarDate(row.weddingDate),
    packageCode: row.packageCode ?? null,
    packageName: row.packageName ?? null,
    customerName: row.customerName ?? "",
    customerEmail: row.customerEmail ?? "",
    slug: row.slug ?? null,
    vaultStatus: row.vaultStatus ?? null,
    mediaCount: mediaMap.get(row.weddingId) ?? 0,
    guestSessionCount: guestMap.get(row.weddingId) ?? 0,
    qrCodeCount: qrMap.get(row.weddingId) ?? 0,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getWeddingDetail(
  organizationId: string,
  weddingId: string,
): Promise<WeddingDetail | null> {
  const [row] = await db
    .select({
      wedding: weddings,
      customer: customers,
      product: products,
      vault: vaults,
    })
    .from(weddings)
    .leftJoin(customers, eq(weddings.customerId, customers.id))
    .leftJoin(products, eq(weddings.productId, products.id))
    .leftJoin(vaults, eq(vaults.weddingId, weddings.id))
    .where(
      and(
        eq(weddings.id, weddingId),
        eq(weddings.organizationId, organizationId),
        isNull(weddings.deletedAt),
      ),
    )
    .limit(1);

  if (!row) return null;

  // NOTE: wedding_settings has no organization_id column. It is scoped by the
  // weddingId; the parent wedding row is already verified org-scoped above.
  const [settingsRows, expiryRows, mediaRows, qrRows, buildJobRows] =
    await Promise.all([
      db
        .select()
        .from(weddingSettings)
        .where(eq(weddingSettings.weddingId, weddingId))
        .limit(1),
      db
        .select()
        .from(expiryRules)
        .where(
          and(
            eq(expiryRules.weddingId, weddingId),
            eq(expiryRules.organizationId, organizationId),
          ),
        )
        .limit(1),
      db
        .select()
        .from(media)
        .where(
          and(
            eq(media.weddingId, weddingId),
            eq(media.organizationId, organizationId),
            isNull(media.deletedAt),
          ),
        )
        .orderBy(desc(media.createdAt))
        .limit(200),
      db
        .select()
        .from(qrCodes)
        .where(
          and(
            eq(qrCodes.weddingId, weddingId),
            eq(qrCodes.organizationId, organizationId),
            isNull(qrCodes.deletedAt),
          ),
        )
        .orderBy(desc(qrCodes.generatedAt)),
      db
        .select()
        .from(buildJobs)
        .where(
          and(
            eq(buildJobs.weddingId, weddingId),
            eq(buildJobs.organizationId, organizationId),
          ),
        )
        .orderBy(desc(buildJobs.createdAt))
        .limit(20),
    ]);

  const settingsRow = settingsRows[0] ?? null;
  const expiryRow = expiryRows[0] ?? null;

  // Build job steps for the loaded jobs.
  let buildJobsWithSteps: BuildJobListItem[] = [];
  if (buildJobRows.length > 0) {
    const buildJobIds = buildJobRows.map((j) => j.id);
    const steps = await db
      .select()
      .from(buildJobSteps)
      .where(inArray(buildJobSteps.buildJobId, buildJobIds))
      .orderBy(buildJobSteps.stepOrder);

    const stepsByJob = new Map<string, BuildStepListItem[]>();
    for (const s of steps) {
      const list = stepsByJob.get(s.buildJobId) ?? [];
      list.push({
        stepKey: s.stepKey,
        stepOrder: s.stepOrder,
        status: s.status,
        errorMessage: s.errorMessage,
        startedAt: toISO(s.startedAt),
        completedAt: toISO(s.completedAt),
      });
      stepsByJob.set(s.buildJobId, list);
    }

    buildJobsWithSteps = buildJobRows.map((job) => ({
      id: job.id,
      status: job.status,
      buildType: job.buildType,
      version: job.version,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      errorMessage: job.errorMessage,
      enqueuedAt: toISO(job.enqueuedAt),
      startedAt: toISO(job.startedAt),
      completedAt: toISO(job.completedAt),
      steps: stepsByJob.get(job.id) ?? [],
    }));
  }

  const qrList: QrListItem[] = qrRows.map((qr) => ({
    id: qr.id,
    publicId: qr.publicId,
    status: qr.status,
    targetUrl: qr.targetUrl,
    generatedAt: qr.generatedAt.toISOString(),
    expiresAt: toISO(qr.expiresAt),
    weddingSlug: row.vault?.slug ?? null,
    weddingName: row.wedding.name,
    packageCode: row.product?.code ?? null,
  }));

  return {
    weddingId: row.wedding.id,
    code: row.wedding.code,
    name: row.wedding.name,
    partnerOneName: row.wedding.partnerOneName,
    partnerTwoName: row.wedding.partnerTwoName,
    status: row.wedding.status,
    weddingDate: calendarDate(row.wedding.weddingDate),
    timezone: row.wedding.timezone,
    customer: row.customer
      ? {
          id: row.customer.id,
          publicId: row.customer.publicId,
          fullName: row.customer.fullName,
          email: row.customer.email,
          phone: row.customer.phone,
        }
      : null,
    package: row.product
      ? {
          id: row.product.id,
          code: row.product.code,
          name: row.product.name,
          priceCents: row.product.priceCents,
          currency: row.product.currency,
        }
      : null,
    vault: row.vault
      ? {
          slug: row.vault.slug,
          status: row.vault.status,
          isPublic: row.vault.isPublic,
          publishedAt: toISO(row.vault.publishedAt),
        }
      : null,
    settings: settingsRow
      ? {
          themeColor: settingsRow.themeColor,
          accentColor: settingsRow.accentColor,
          coupleStory: settingsRow.coupleStory,
          customMessage: settingsRow.customMessage,
          allowGuestUploads: settingsRow.allowGuestUploads,
        }
      : null,
    expiry: expiryRow
      ? {
          uploadDeadline: expiryRow.uploadDeadline.toISOString(),
          downloadDeadline: expiryRow.downloadDeadline.toISOString(),
          uploadWindowDays: expiryRow.uploadWindowDays,
          downloadWindowDays: expiryRow.downloadWindowDays,
        }
      : null,
    media: mediaRows.map((m) => buildMediaListItem(m)),
    qrCodes: qrList,
    buildJobs: buildJobsWithSteps,
    createdAt: row.wedding.createdAt.toISOString(),
    updatedAt: row.wedding.updatedAt.toISOString(),
  };
}

// ── Customers ─────────────────────────────────────────────────────────────────

export async function listCustomers(
  organizationId: string,
): Promise<CustomerListItem[]> {
  const rows = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.organizationId, organizationId),
        isNull(customers.deletedAt),
      ),
    )
    .orderBy(desc(customers.createdAt));

  if (rows.length === 0) return [];

  const customerIds = rows.map((r) => r.id);

  const [orderCounts, weddingCounts] = await Promise.all([
    db
      .select({ customerId: orders.customerId, value: count() })
      .from(orders)
      .where(
        and(
          eq(orders.organizationId, organizationId),
          inArray(orders.customerId, customerIds),
          isNull(orders.deletedAt),
        ),
      )
      .groupBy(orders.customerId),
    db
      .select({ customerId: weddings.customerId, value: count() })
      .from(weddings)
      .where(
        and(
          eq(weddings.organizationId, organizationId),
          inArray(weddings.customerId, customerIds),
          isNull(weddings.deletedAt),
        ),
      )
      .groupBy(weddings.customerId),
  ]);

  const orderMap = new Map(orderCounts.map((r) => [r.customerId, r.value]));
  const weddingMap = new Map(
    weddingCounts.map((r) => [r.customerId, r.value]),
  );

  return rows.map((row) => ({
    customerId: row.id,
    publicId: row.publicId,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    orderCount: orderMap.get(row.id) ?? 0,
    weddingCount: weddingMap.get(row.id) ?? 0,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getCustomerDetail(
  organizationId: string,
  customerId: string,
): Promise<CustomerDetail | null> {
  const [customer] = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.organizationId, organizationId),
        isNull(customers.deletedAt),
      ),
    )
    .limit(1);

  if (!customer) return null;

  const [weddingRows, orderRows] = await Promise.all([
    db
      .select({
        weddingId: weddings.id,
        code: weddings.code,
        name: weddings.name,
        status: weddings.status,
        weddingDate: weddings.weddingDate,
        packageCode: products.code,
        slug: vaults.slug,
      })
      .from(weddings)
      .leftJoin(products, eq(weddings.productId, products.id))
      .leftJoin(vaults, eq(vaults.weddingId, weddings.id))
      .where(
        and(
          eq(weddings.customerId, customerId),
          eq(weddings.organizationId, organizationId),
          isNull(weddings.deletedAt),
        ),
      )
      .orderBy(desc(weddings.createdAt)),
    db
      .select({
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        totalCents: orders.totalCents,
        currency: orders.currency,
        placedAt: orders.placedAt,
        productName: products.name,
      })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .where(
        and(
          eq(orders.customerId, customerId),
          eq(orders.organizationId, organizationId),
          isNull(orders.deletedAt),
        ),
      )
      .orderBy(desc(orders.placedAt)),
  ]);

  return {
    customerId: customer.id,
    publicId: customer.publicId,
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone,
    createdAt: customer.createdAt.toISOString(),
    weddings: weddingRows.map((w) => ({
      weddingId: w.weddingId,
      code: w.code,
      name: w.name,
      status: w.status,
      weddingDate: calendarDate(w.weddingDate),
      packageCode: w.packageCode,
      slug: w.slug,
    })),
    orders: orderRows.map((o) => ({
      orderId: o.orderId,
      orderNumber: o.orderNumber,
      status: o.status,
      totalCents: o.totalCents,
      currency: o.currency,
      placedAt: toISO(o.placedAt),
      productName: o.productName,
    })),
  };
}

// ── Orders & Payments ─────────────────────────────────────────────────────────

const PAYMENT_STATUS_PRIORITY: Record<string, number> = {
  completed: 4,
  processing: 3,
  pending: 2,
  failed: 1,
  refunded: 0,
};

function pickBestPaymentStatus(rows: Array<string>): string | null {
  if (rows.length === 0) return null;
  const best = rows.reduce<string>(
    (acc, status) =>
      (PAYMENT_STATUS_PRIORITY[status] ?? 0) >
      (PAYMENT_STATUS_PRIORITY[acc] ?? 0)
        ? status
        : acc,
    "",
  );
  return best === "" ? null : best;
}

export async function listOrders(
  organizationId: string,
): Promise<OrderListItem[]> {
  const rows = await db
    .select({
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      subtotalCents: orders.subtotalCents,
      discountCents: orders.discountCents,
      totalCents: orders.totalCents,
      currency: orders.currency,
      placedAt: orders.placedAt,
      paidAt: orders.paidAt,
      customerName: customers.fullName,
      customerEmail: customers.email,
      productName: products.name,
      packageCode: products.code,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(products, eq(orders.productId, products.id))
    .where(
      and(
        eq(orders.organizationId, organizationId),
        isNull(orders.deletedAt),
      ),
    )
    .orderBy(desc(orders.placedAt))
    .limit(300);

  if (rows.length === 0) return [];

  const orderIds = rows.map((r) => r.orderId);

  const paymentRows = await db
    .select({ orderId: payments.orderId, status: payments.status })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        inArray(payments.orderId, orderIds),
      ),
    );

  const paymentByOrder = new Map<string, string[]>();
  for (const p of paymentRows) {
    const list = paymentByOrder.get(p.orderId) ?? [];
    list.push(p.status);
    paymentByOrder.set(p.orderId, list);
  }

  return rows.map((row) => ({
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    status: row.status,
    subtotalCents: row.subtotalCents,
    discountCents: row.discountCents,
    totalCents: row.totalCents,
    currency: row.currency,
    placedAt: toISO(row.placedAt),
    paidAt: toISO(row.paidAt),
    customerName: row.customerName ?? "Unknown customer",
    customerEmail: row.customerEmail ?? "",
    productName: row.productName ?? null,
    packageCode: row.packageCode ?? null,
    paymentStatus:
      pickBestPaymentStatus(paymentByOrder.get(row.orderId) ?? []) ??
      (row.status === "paid" ? "completed" : null),
  }));
}

export async function listPayments(
  organizationId: string,
): Promise<PaymentListItem[]> {
  const rows = await db
    .select({
      paymentId: payments.id,
      provider: payments.provider,
      status: payments.status,
      amountCents: payments.amountCents,
      currency: payments.currency,
      failureReason: payments.failureReason,
      paidAt: payments.paidAt,
      createdAt: payments.createdAt,
      orderNumber: orders.orderNumber,
      customerName: customers.fullName,
    })
    .from(payments)
    .leftJoin(orders, eq(payments.orderId, orders.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(payments.organizationId, organizationId))
    .orderBy(desc(payments.createdAt))
    .limit(300);

  return rows.map((row) => ({
    paymentId: row.paymentId,
    provider: row.provider,
    status: row.status,
    amountCents: row.amountCents,
    currency: row.currency,
    failureReason: row.failureReason,
    paidAt: toISO(row.paidAt),
    createdAt: row.createdAt.toISOString(),
    orderNumber: row.orderNumber ?? "",
    customerName: row.customerName ?? "Unknown customer",
  }));
}

// ── Media ────────────────────────────────────────────────────────────────────

export async function listMedia(
  organizationId: string,
  weddingId?: string,
): Promise<MediaListItem[]> {
  const conditions = [
    eq(media.organizationId, organizationId),
    isNull(media.deletedAt),
  ];
  if (weddingId) {
    conditions.push(eq(media.weddingId, weddingId));
  }

  const rows = await db
    .select()
    .from(media)
    .where(and(...conditions))
    .orderBy(desc(media.createdAt))
    .limit(500);

  return rows.map((r) => buildMediaListItem(r));
}

// ── QR codes ─────────────────────────────────────────────────────────────────

export async function listQrCodes(
  organizationId: string,
): Promise<QrListItem[]> {
  const rows = await db
    .select({
      qr: qrCodes,
      slug: vaults.slug,
      weddingName: weddings.name,
      packageCode: products.code,
    })
    .from(qrCodes)
    .leftJoin(vaults, eq(qrCodes.vaultId, vaults.id))
    .leftJoin(weddings, eq(qrCodes.weddingId, weddings.id))
    .leftJoin(products, eq(weddings.productId, products.id))
    .where(
      and(
        eq(qrCodes.organizationId, organizationId),
        isNull(qrCodes.deletedAt),
      ),
    )
    .orderBy(desc(qrCodes.generatedAt))
    .limit(300);

  return rows.map((row) => ({
    id: row.qr.id,
    publicId: row.qr.publicId,
    status: row.qr.status,
    targetUrl: row.qr.targetUrl,
    generatedAt: row.qr.generatedAt.toISOString(),
    expiresAt: toISO(row.qr.expiresAt),
    weddingSlug: row.slug ?? null,
    weddingName: row.weddingName ?? "Wedding",
    packageCode: row.packageCode ?? null,
  }));
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<ProfileData | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!user) return null;

  const memberships = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      role: organizationMembers.role,
      status: organizationMembers.status,
      joinedAt: organizationMembers.joinedAt,
    })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id),
    )
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.status, "active"),
        isNull(organizationMembers.deletedAt),
      ),
    )
    .orderBy(organizationMembers.sortOrder);

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    createdAt: user.createdAt.toISOString(),
    memberships: memberships.map((m) => ({
      organizationId: m.organizationId,
      organizationName: m.organizationName,
      organizationSlug: m.organizationSlug,
      role: m.role,
      status: m.status,
      joinedAt: toISO(m.joinedAt),
    })),
  };
}

// ── Organization summary (for the dashboard shell) ────────────────────────────

export async function getOrganizationSummary(
  organizationId: string,
): Promise<OrganizationSummary | null> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(
      and(
        eq(organizations.id, organizationId),
        isNull(organizations.deletedAt),
      ),
    )
    .limit(1);
  if (!org) return null;
  return {
    id: org.id,
    publicId: org.publicId,
    name: org.name,
    slug: org.slug,
  };
}

// ── Support tickets (documented stub) ────────────────────────────────────────

/**
 * Support tickets are not yet implemented (no `support_tickets` table exists).
 * The Support/Admin worker will introduce the table and this read model.
 * Returns an empty list so the dashboard never fabricates data.
 */
export async function listSupportTickets(): Promise<SupportTicketListItem[]> {
  return [];
}

// ── Timezone formatting helper (display only) ─────────────────────────────────

/** Formats a UTC deadline for display in the business timezone. */
export function formatDeadline(
  isoValue: string | null | undefined,
): string {
  if (!isoValue) return "—";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}