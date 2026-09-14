/**
 * Public Vault service — guest-safe read model for `/w/[slug]` and the
 * unauthenticated guest flows (session creation, media downloads).
 *
 * SECURITY REQUIREMENTS:
 *  - Only `published` + `isPublic` vaults with a live wedding resolve.
 *  - The DTO is guest-safe: it never contains internal UUIDs (media.id,
 *    vault.id, wedding.id, organizationId), storage keys, sha256 hashes or
 *    uploaded-by/guest-session IDs.
 *  - Feature gating uses `shouldRenderFeature` / `entitlementHasFeature`;
 *    nothing outside the package is rendered.
 *  - Download windows are re-checked server-side BEFORE signing URLs; the
 *    client clock is never trusted.
 *  - Guests address media exclusively by opaque public id.
 */

import { sql, eq, and, isNull, gte, desc, inArray } from "drizzle-orm";
import QRCode from "qrcode";

import { db } from "@/lib/db";
import {
  media,
  mediaVariants,
  vaults,
  weddings,
  weddingSettings,
  products,
  guestSessions,
  slideshows,
  flipbooks,
} from "@/lib/db/schema";
import { NotFoundError, ForbiddenError, RateLimitError } from "@/lib/auth/errors";
import {
  shouldRenderFeature,
  entitlementHasFeature,
  getExpiryDisplay,
  BUSINESS_TIMEZONE,
  type ResolvedEntitlements,
  type PackageCode,
} from "@/lib/entitlements";
import {
  createGuestSession,
} from "@/server/services/guest-sessions";
import {
  getSignedDownloadUrl,
  resolveEntitlementsForWedding,
  type DownloadVariant,
  type SignedDownloadResult,
} from "@/server/services/media-service";
import {
  GUEST_UPLOAD_ALLOWED_WEDDING_STATUSES,
  GUEST_DOWNLOAD_ALLOWED_WEDDING_STATUSES,
} from "@/server/lifecycle/policy";
import { isImageMime, isVideoMime } from "@/server/services/storage/mime";
import type { StorageClient } from "@/server/services/storage/client";

// ── Constants ─────────────────────────────────────────────────────────────────

export const GUEST_SESSION_IP_THROTTLE_LIMIT = 20;
export const GUEST_SESSION_IP_THROTTLE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ── Guest-safe DTOs ───────────────────────────────────────────────────────────

export type PublicMediaKind = "photo" | "video";

export interface PublicVaultMediaItem {
  publicId: string;
  contentType: string;
  kind: PublicMediaKind;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  /** Signed thumbnail render (images/videos with a thumbnail variant). */
  thumbnailUrl?: string;
  /** Signed preview render (images with a preview variant). */
  previewUrl?: string;
  /** Signed full render: `full` variant for images, `original` for videos. */
  fullUrl?: string;
  filename: string;
}

export interface PublicVaultBanner {
  publicId: string;
  contentType: string;
  kind: PublicMediaKind;
  width?: number | null;
  height?: number | null;
  fullUrl?: string;
  filename: string;
}

export interface PublicVaultIntro {
  publicId: string;
  contentType: string;
  kind: PublicMediaKind;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  fullUrl?: string;
  filename: string;
}

export interface PublicVaultDTO {
  slug: string;
  title: string;
  /** Calendar DATE only (`YYYY-MM-DD`); guests never get time-of-day. */
  weddingDateISO: string;
  /** Formatted date in Africa/Johannesburg (en-ZA locale). */
  weddingDateDisplayJNB: string;
  partnerOneName: string | null;
  partnerTwoName: string | null;
  themeColor: string;
  accentColor: string;
  coupleStory: string | null;
  customMessage: string | null;
  isGuestUploadAllowed: boolean;
  uploadDeadlineDisplay: string;
  downloadDeadlineDisplay: string;
  uploadDaysLeft: number;
  downloadDaysLeft: number;
  uploadOpen: boolean;
  downloadOpen: boolean;
  lifecycleStatus: string;
  packageCode: PackageCode;
  gallery: PublicVaultMediaItem[];
  banner: PublicVaultBanner | null;
  intro: PublicVaultIntro | null;
  slideshowTitle: string | null;
  flipbookTitle: string | null;
  qrImageDataUrl: string;
  /** Media currently being processed (uploaded/processing status). */
  processingCount: number;
  /** Media that failed processing. */
  failedCount: number;
}

export interface ArchivedVaultMarker {
  archived: true;
  slug: string;
  title: string;
}

export type PublicVault = PublicVaultDTO | ArchivedVaultMarker;

export interface GuestSessionResult {
  token: string;
  expiresAt: string;
  maxUploads: number;
}

export interface CreateVaultGuestSessionInput {
  displayName?: string;
  ipAddress?: string;
}

interface LoadedVault {
  vault: typeof vaults.$inferSelect;
  wedding: typeof weddings.$inferSelect;
  settings: typeof weddingSettings.$inferSelect | null;
  entitlements: ResolvedEntitlements;
}

// ── Internal loader ───────────────────────────────────────────────────────────

/**
 * Loads a non-deleted vault with its wedding, settings and resolved
 * entitlements. No status gate here; callers decide draft vs archived vs
 * published semantics.
 */
async function loadVault(slug: string): Promise<LoadedVault> {
  const [row] = await db
    .select({
      vault: vaults,
      wedding: weddings,
      settings: weddingSettings,
      product: products,
    })
    .from(vaults)
    .leftJoin(weddings, eq(vaults.weddingId, weddings.id))
    .leftJoin(weddingSettings, eq(weddings.id, weddingSettings.weddingId))
    .leftJoin(products, eq(weddings.productId, products.id))
    .where(and(eq(vaults.slug, slug), isNull(vaults.deletedAt)))
    .limit(1);

  if (!row) throw new NotFoundError("Vault");
  if (!row.wedding) throw new NotFoundError("Vault");

  const entitlements = await resolveEntitlementsForWedding(
    row.wedding.id,
    row.vault.organizationId,
  );

  return {
    vault: row.vault,
    wedding: row.wedding,
    settings: row.settings ?? null,
    entitlements,
  };
}

/** Resolves a published, public, non-deleted vault for guest flows. */
async function resolvePublishedVault(slug: string): Promise<LoadedVault> {
  const loaded = await loadVault(slug);
  if (loaded.vault.status !== "published" || !loaded.vault.isPublic) {
    throw new NotFoundError("Vault");
  }
  if (loaded.wedding.deletedAt) throw new NotFoundError("Vault");
  return loaded;
}

// ── Public vault read model ───────────────────────────────────────────────────

/**
 * Resolves the guest-safe public vault DTO by slug.
 * - Draft vaults / deleted vaults / deleted weddings → NotFoundError.
 * - Archived vaults → `{ archived: true, slug, title }` marker (page renders
 *   an archived notice instead of 404).
 */
export async function resolvePublicVaultBySlug(slug: string): Promise<PublicVault> {
  let loaded: LoadedVault;
  try {
    loaded = await loadVault(slug);
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    throw error;
  }

  if (loaded.vault.status === "archived") {
    const couple = [
      loaded.wedding.partnerOneName,
      loaded.wedding.partnerTwoName,
    ]
      .filter(Boolean)
      .join(" & ");
    return {
      archived: true,
      slug,
      title: loaded.vault.title ?? (couple || "Our Wedding Vault"),
    };
  }

  if (loaded.vault.status !== "published" || !loaded.vault.isPublic) {
    throw new NotFoundError("Vault");
  }
  if (loaded.wedding.deletedAt) throw new NotFoundError("Vault");

  return buildPublicVaultDTO(loaded);
}

async function buildPublicVaultDTO(loaded: LoadedVault): Promise<PublicVaultDTO> {
  const { vault, wedding, settings, entitlements } = loaded;
  const orgId = vault.organizationId;

  const weddingDateISO = wedding.weddingDate
    ? wedding.weddingDate.toISOString().split("T")[0]
    : "";
  const weddingDateDisplayJNB = wedding.weddingDate
    ? new Intl.DateTimeFormat("en-ZA", {
        timeZone: BUSINESS_TIMEZONE,
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(wedding.weddingDate)
    : "Date to be announced";

  const expiryDisplay = getExpiryDisplay(entitlements);

  const gallery = await loadGallery(wedding.id, orgId, entitlements);
  const banner = await loadBanner(wedding.id, orgId, settings, entitlements);
  const intro = await loadIntro(wedding.id, orgId, settings, entitlements);
  const slideshowTitle = shouldRenderFeature(entitlements, "slideshow")
    ? await loadAssetTitle(slideshows, wedding.id)
    : null;
  const flipbookTitle = shouldRenderFeature(entitlements, "flipbook")
    ? await loadAssetTitle(flipbooks, wedding.id)
    : null;

  const qrImageDataUrl = await getQRDataUrlForSlug(vault.slug);

  // Count media in processing or failed states for the upload flow UI.
  const { processingCount, failedCount } = await loadMediaProcessingCounts(
    wedding.id,
    orgId,
  );

  return {
    slug: vault.slug,
    title: vault.title ?? `${wedding.partnerOneName ?? ""} & ${wedding.partnerTwoName ?? ""}`.trim(),
    weddingDateISO,
    weddingDateDisplayJNB,
    partnerOneName: wedding.partnerOneName,
    partnerTwoName: wedding.partnerTwoName,
    themeColor: settings?.themeColor ?? "#8B5E3C",
    accentColor: settings?.accentColor ?? "#D4AF37",
    coupleStory: settings?.coupleStory ?? null,
    customMessage: settings?.customMessage ?? null,
    isGuestUploadAllowed:
      (settings?.allowGuestUploads ?? true) &&
      entitlementHasFeature(entitlements, "guest_uploads") &&
      entitlements.uploadOpen,
    uploadDeadlineDisplay: expiryDisplay.uploadDeadline,
    downloadDeadlineDisplay: expiryDisplay.downloadDeadline,
    uploadDaysLeft: expiryDisplay.uploadDaysLeft,
    downloadDaysLeft: expiryDisplay.downloadDaysLeft,
    uploadOpen: entitlements.uploadOpen,
    downloadOpen: entitlements.downloadOpen,
    lifecycleStatus: entitlements.lifecycleStatus,
    packageCode: entitlements.packageCode,
    gallery,
    banner,
    intro,
    slideshowTitle,
    flipbookTitle,
    qrImageDataUrl,
    processingCount,
    failedCount,
  };
}

// ── Gallery / banner / intro ──────────────────────────────────────────────────

async function loadGallery(
  weddingId: string,
  organizationId: string,
  entitlements: ResolvedEntitlements,
): Promise<PublicVaultMediaItem[]> {
  const videoEnabled = entitlementHasFeature(entitlements, "video");

  const rows = await db
    .select()
    .from(media)
    .where(
      and(
        eq(media.weddingId, weddingId),
        eq(media.organizationId, organizationId),
        eq(media.status, "processed"),
        isNull(media.deletedAt),
      ),
    )
    .orderBy(desc(media.createdAt));

  const mediaRows = videoEnabled ? rows : rows.filter((r) => isImageMime(r.contentType));
  if (mediaRows.length === 0) return [];

  const variants = await db
    .select()
    .from(mediaVariants)
    .where(inArray(mediaVariants.mediaId, mediaRows.map((r) => r.id)));

  const variantMap = new Map<string, Map<string, (typeof mediaVariants.$inferSelect)>>();
  for (const v of variants) {
    let byType = variantMap.get(v.mediaId);
    if (!byType) {
      byType = new Map();
      variantMap.set(v.mediaId, byType);
    }
    byType.set(v.variantType, v);
  }

  const items: PublicVaultMediaItem[] = [];
  for (const row of mediaRows) {
    const byType = variantMap.get(row.id);
    const isVideo = isVideoMime(row.contentType);
    const item: PublicVaultMediaItem = {
      publicId: row.publicId,
      contentType: row.contentType,
      kind: isVideo ? "video" : "photo",
      width: row.width,
      height: row.height,
      durationMs: row.durationMs,
      thumbnailUrl: byType?.has("thumbnail")
        ? await trySignDownload(row.id, organizationId, "thumbnail", entitlements)
        : undefined,
      previewUrl:
        !isVideo && byType?.has("preview")
          ? await trySignDownload(row.id, organizationId, "preview", entitlements)
          : undefined,
      fullUrl: isVideo
        ? await trySignDownload(row.id, organizationId, "original", entitlements)
        : byType?.has("full")
          ? await trySignDownload(row.id, organizationId, "full", entitlements)
          : await trySignDownload(row.id, organizationId, "original", entitlements),
      filename: row.filename,
    };
    items.push(item);
  }

  return items;
}

async function loadBanner(
  weddingId: string,
  organizationId: string,
  settings: typeof weddingSettings.$inferSelect | null,
  entitlements: ResolvedEntitlements,
): Promise<PublicVaultBanner | null> {
  if (!shouldRenderFeature(entitlements, "banner")) return null;
  if (!settings?.bannerMediaId) return null;

  const row = await findSettingsMedia(weddingId, organizationId, settings.bannerMediaId);
  if (!row) return null;

  const isVideo = isVideoMime(row.contentType);
  const fullUrl =
    (await trySignDownload(row.id, organizationId, "full", entitlements)) ??
    (await trySignDownload(row.id, organizationId, "original", entitlements)) ??
    undefined;
  return {
    publicId: row.publicId,
    contentType: row.contentType,
    kind: isVideo ? "video" : "photo",
    width: row.width,
    height: row.height,
    fullUrl,
    filename: row.filename,
  };
}

async function loadIntro(
  weddingId: string,
  organizationId: string,
  settings: typeof weddingSettings.$inferSelect | null,
  entitlements: ResolvedEntitlements,
): Promise<PublicVaultIntro | null> {
  if (!shouldRenderFeature(entitlements, "intro")) return null;
  if (!settings?.introMediaId) return null;

  const row = await findSettingsMedia(weddingId, organizationId, settings.introMediaId);
  if (!row) return null;

  const isVideo = isVideoMime(row.contentType);
  const fullUrl =
    (await trySignDownload(row.id, organizationId, "full", entitlements)) ??
    (await trySignDownload(row.id, organizationId, "original", entitlements)) ??
    undefined;
  return {
    publicId: row.publicId,
    contentType: row.contentType,
    kind: isVideo ? "video" : "photo",
    width: row.width,
    height: row.height,
    durationMs: row.durationMs,
    fullUrl,
    filename: row.filename,
  };
}

async function findSettingsMedia(
  weddingId: string,
  organizationId: string,
  mediaId: string,
): Promise<(typeof media.$inferSelect) | null> {
  const [row] = await db
    .select()
    .from(media)
    .where(
      and(
        eq(media.id, mediaId),
        eq(media.weddingId, weddingId),
        eq(media.organizationId, organizationId),
        isNull(media.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function loadAssetTitle(
  table: typeof slideshows | typeof flipbooks,
  weddingId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ title: table.title })
    .from(table)
    .where(and(eq(table.weddingId, weddingId), isNull(table.deletedAt)))
    .limit(1);
  return row?.title ?? null;
}

/**
 * Media processing counts ───────────────────────────────────────────────────
 *
 * Counts media items that are in processing ("uploaded") or failed states
 * for a given wedding and organization. Used by the public vault DTO to
 * display upload progress states.
 */
async function loadMediaProcessingCounts(
  weddingId: string,
  organizationId: string,
): Promise<{ processingCount: number; failedCount: number }> {
  const [processingRow] = await db
    .select({ count: sql`count(*)`.as("count") })
    .from(media)
    .where(
      and(
        eq(media.weddingId, weddingId),
        eq(media.organizationId, organizationId),
        eq(media.status, "uploaded"),
        isNull(media.deletedAt),
      ),
    );

  const [failedRow] = await db
    .select({ count: sql`count(*)`.as("count") })
    .from(media)
    .where(
      and(
        eq(media.weddingId, weddingId),
        eq(media.organizationId, organizationId),
        eq(media.status, "failed"),
        isNull(media.deletedAt),
      ),
    );

  return {
    processingCount: Number(processingRow.count) ?? 0,
    failedCount: Number(failedRow.count) ?? 0,
  };
}

/**
 * Signs a short-TTL download URL for display. Returns undefined when the
 * download window is closed or the variant does not exist so an expired vault
 * still renders without crashing.
 */
async function trySignDownload(
  mediaId: string,
  organizationId: string,
  variant: DownloadVariant,
  entitlements: ResolvedEntitlements,
): Promise<string | undefined> {
  if (!entitlements.downloadOpen) return undefined;
  try {
    const result = await getSignedDownloadUrl(mediaId, organizationId, {
      entitlements,
      variant,
    });
    return result.url;
  } catch {
    return undefined;
  }
}

// ── QR helper ─────────────────────────────────────────────────────────────────

/**
 * PNG data URL of the QR code pointing at the ABSOLUTE public destination
 * (`{NEXT_PUBLIC_APP_URL}/w/{slug}`). Encodes only the stable public route; no
 * private data, no internal ids.
 */
export async function getQRDataUrlForSlug(slug: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return QRCode.toDataURL(`${baseUrl}/w/${slug}`, {
    errorCorrectionLevel: "M",
    width: 256,
    margin: 1,
  });
}

// ── Guest session creation ────────────────────────────────────────────────────

/**
 * Creates a scoped guest session for a published vault with a light per-IP
 * throttle (approximation of a shared rate limiter; no Redis in scope).
 * Returns the raw token exactly once; the DB stores only the SHA-256 hash.
 */
export async function createVaultGuestSession(
  slug: string,
  input: CreateVaultGuestSessionInput = {},
): Promise<GuestSessionResult> {
  const { vault, wedding, entitlements } = await resolvePublishedVault(slug);

  // Guest uploads must be inside the upload window (deadline-derived) AND the
  // explicit status belt-and-braces (policy `GUEST_UPLOAD_ALLOWED_WEDDING_STATUSES`)
  // must still admit the wedding — a mis-set status never re-opens uploads.
  if (!entitlements.uploadOpen) {
    throw new ForbiddenError("Upload window has closed");
  }

  if (!GUEST_UPLOAD_ALLOWED_WEDDING_STATUSES.includes(wedding.status)) {
    throw new ForbiddenError("Uploads are not open for this wedding");
  }

  if (input.ipAddress) {
    const since = new Date(Date.now() - GUEST_SESSION_IP_THROTTLE_WINDOW_MS);
    const recent = await db
      .select({ id: guestSessions.id })
      .from(guestSessions)
      .where(
        and(
          eq(guestSessions.ipAddress, input.ipAddress),
          gte(guestSessions.createdAt, since),
        ),
      );
    if (recent.length >= GUEST_SESSION_IP_THROTTLE_LIMIT) {
      throw new RateLimitError(
        "Too many guest sessions from this address; please try again later",
      );
    }
  }

  const created = await createGuestSession(vault.id, vault.organizationId, {
    displayName: input.displayName,
    ipAddress: input.ipAddress,
  });

  const [sessionRow] = await db
    .select({ expiresAt: guestSessions.expiresAt, maxUploads: guestSessions.maxUploads })
    .from(guestSessions)
    .where(eq(guestSessions.id, created.sessionId))
    .limit(1);

  return {
    token: created.token,
    expiresAt: sessionRow?.expiresAt.toISOString() ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    maxUploads: sessionRow?.maxUploads ?? 100,
  };
}

// ── Guest media download ──────────────────────────────────────────────────────

/**
 * Signs a short-TTL download URL for a public media id inside a published
 * vault. The window is re-checked before signing; NotFoundError for media
 * outside the vault's wedding/org, ForbiddenError once downloads close.
 */
export async function getGuestDownloadUrlForPublicMedia(
  vaultSlug: string,
  mediaPublicId: string,
  options: {
    variant?: DownloadVariant;
    disposition?: "inline" | "attachment";
    storage?: StorageClient;
  } = {},
): Promise<SignedDownloadResult> {
  const { vault, wedding, entitlements } = await resolvePublishedVault(vaultSlug);

  if (!entitlements.downloadOpen) {
    throw new ForbiddenError("Download window has closed");
  }

  // Explicit status belt-and-braces (policy
  // `GUEST_DOWNLOAD_ALLOWED_WEDDING_STATUSES`): a mis-set status never
  // re-opens downloads after the lifecycle engine has closed them.
  if (!GUEST_DOWNLOAD_ALLOWED_WEDDING_STATUSES.includes(wedding.status)) {
    throw new ForbiddenError("Downloads are not open for this wedding");
  }

  const [mediaRow] = await db
    .select()
    .from(media)
    .where(
      and(
        eq(media.publicId, mediaPublicId),
        eq(media.organizationId, vault.organizationId),
        eq(media.weddingId, vault.weddingId),
        isNull(media.deletedAt),
      ),
    )
    .limit(1);

  if (!mediaRow) throw new NotFoundError("Media");

  return getSignedDownloadUrl(mediaRow.id, vault.organizationId, {
    entitlements,
    variant: options.variant,
    responseDisposition: options.disposition,
    storage: options.storage,
  });
}