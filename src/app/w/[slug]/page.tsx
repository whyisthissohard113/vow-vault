import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";

import {
  resolvePublicVaultBySlug,
  type PublicVaultDTO,
} from "@/server/services/public-vault";
import { GuestUploadCard } from "./_components/GuestUploadCard";
import { GalleryGrid } from "./_components/GalleryGrid";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Public Vault page — `/w/[slug]`.
 *
 * Server-rendered with `force-dynamic`: upload/download windows and presigned
 * display URLs are time-sensitive, so the page must never be cached statically.
 * Vaults default to `noindex` (spec requirement); never expose internal ids.
 *
 * Feature tier mapping (Silver ⊂ Gold ⊂ Platinum):
 *  - Silver: photos, guest_uploads, names_date, optional_colours, QR, gallery
 *  - Gold: banner, video, slideshow
 *  - Platinum: intro, flipbook, qr_design_card, extended download window
 */

export const dynamic = "force-dynamic";

interface VaultPageParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: VaultPageParams): Promise<Metadata> {
  const { slug } = await params;
  try {
    const data = await resolvePublicVaultBySlug(slug);
    if ("archived" in data) {
      return {
        title: `${data.title} | Wedding Memory Vault`,
        robots: { index: false, follow: false },
      };
    }
    const couple = [data.partnerOneName, data.partnerTwoName].filter(Boolean).join(" & ");
    return {
      title: `${data.title || couple || "Our Wedding"} | Wedding Memory Vault`,
      description:
        data.customMessage ??
        data.coupleStory ??
        `Share your memories from our wedding on ${data.weddingDateDisplayJNB}.`,
      robots: { index: false, follow: true },
    };
  } catch {
    return {
      title: "Wedding Memory Vault",
      robots: { index: false, follow: false },
    };
  }
}

export default async function PublicVaultPage({ params }: VaultPageParams) {
  const { slug } = await params;

  let data;
  try {
    data = await resolvePublicVaultBySlug(slug);
  } catch {
    notFound();
  }

  if ("archived" in data) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold text-stone-900">
            {data.title}
          </h1>
          <p className="mt-3 text-stone-600">
            This wedding vault has been archived. The collection is no longer
            accepting new memories or sharing content.
          </p>
        </div>
      </main>
    );
  }

  return <VaultView dto={data} />;
}

// ── Server-side layout ─────────────────────────────────────────────────────────

/**
 * Inline object for CSS custom properties (theme/accent). Intersection with
 * React's CSSProperties is required so vendor/custom `--*` tokens type-check.
 */
type ThemeGradientStyle = CSSProperties & {
  "--theme-color": string;
  "--accent-color": string;
};

function themeGradientStyle(
  themeColor: string,
  accentColor: string,
): ThemeGradientStyle {
  return {
    "--theme-color": themeColor,
    "--accent-color": accentColor,
  };
}

function VaultView({ dto }: { dto: PublicVaultDTO }) {
  const couple =
    [dto.partnerOneName, dto.partnerTwoName].filter(Boolean).join(" & ") ||
    dto.title ||
    "Our Wedding";

  const themeColor = dto.themeColor ?? "#8B5E3C";
  const accentColor = dto.accentColor ?? "#D4AF37";

  return (
    <main className="flex min-h-screen flex-1 flex-col bg-background">
      {/* Premium banner section */}
      <BannerSection
        dto={dto}
        couple={couple}
        themeColor={themeColor}
        accentColor={accentColor}
      />

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-display font-semibold tracking-tight text-stone-900 sm:text-5xl">
            {couple}
          </h1>
          <p className="mt-3 text-lg text-stone-600">
            {dto.weddingDateDisplayJNB}
          </p>
          {dto.customMessage ? (
            <p className="mx-auto mt-6 max-w-2xl text-stone-700">
              {dto.customMessage}
            </p>
          ) : null}
          {dto.coupleStory ? (
            <p className="mx-auto mt-3 max-w-2xl text-stone-600">
              {dto.coupleStory}
            </p>
          ) : null}
        </header>

        {/* Intro media (feature-gated) */}
        {dto.intro?.fullUrl ? (
          <IntroSection dto={dto} />
        ) : (
          <IntroPlaceholder themeColor={themeColor} accentColor={accentColor} />
        )}

        {/* QR display + upload card */}
        <QROverlaySection
          dto={dto}
          couple={couple}
          isGuestUploadAllowed={dto.isGuestUploadAllowed}
          uploadDeadlineDisplay={dto.uploadDeadlineDisplay}
        />

        {/* Deadline summary */}
        <DeadlineSummary dto={dto} />

        {/* Feature gated asset teasers */}
        <AssetTeasersSection dto={dto} />

        {/* Gallery */}
        <GallerySection dto={dto} />

        <footer className="mt-16 text-center text-xs text-stone-400">
          {couple} Wedding Memory Vault
        </footer>
      </div>
    </main>
  );
}

/*────── Server-side section components ───────────────────────────────────────*/

/**
 * Premium banner section with feature-gated rendering.
 * Silver: no banner (solid background with theme color)
 * Gold: banner image if uploaded + signed URL available
 * Platinum: banner with optional video overlay
 */
function BannerSection({
  dto,
  couple,
  themeColor,
  accentColor,
}: {
  dto: PublicVaultDTO;
  couple: string;
  themeColor: string;
  accentColor: string;
}) {
  const bannerUrl = dto.banner?.fullUrl;

  return (
    <section className="relative overflow-hidden mb-12">
      {bannerUrl ? (
        <div className="rounded-2xl mb-6 overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
          <Image
            src={bannerUrl}
            alt={`${couple} banner`}
            fill
            unoptimized
            priority
            sizes="100vw"
            className="object-cover transition-opacity duration-500 hover:opacity-90"
          />
          {dto.banner?.kind === "video" && (
            <div
              className="absolute bottom-0 left-0 right-0 bg-black/60 p-4 text-white text-sm font-medium"
            >
              Video preview
            </div>
          )}
        </div>
      ) : (
        <div
          className="rounded-2xl bg-gradient-to-br from-[var(--theme-color)] to-[var(--accent-color)] mb-6"
          style={themeGradientStyle(themeColor, accentColor)}
        >
          <div className="h-64 sm:h-80 p-6 text-center text-white">
            <h2 className="text-2xl font-bold mb-2">Celebrate Love</h2>
            <p className="opacity-90">Our wedding story</p>
          </div>
        </div>
      )}

      {/* Banner overlay decorations */}
      <div
        className="absolute top-0 right-0 h-64 w-64 rotate-6 overflow-hidden rounded-full bg-[var(--accent-color)] opacity-20"
      />
    </section>
  );
}

/**
 * Intro media section or placeholder.
 */
function IntroSection({ dto }: { dto: PublicVaultDTO }) {
  const intro = dto.intro;
  if (!intro?.fullUrl) return null;

  const isVideo = intro.kind === "video";

  return isVideo ? (
    <section className="mt-8">
      <video
        src={intro.fullUrl}
        controls
        className="mx-auto max-h-[70vh] w-full max-w-3xl rounded-2xl bg-black"
      />
    </section>
  ) : (
    <section className="mt-8">
      <div className="relative mx-auto h-64 w-full sm:h-80 rounded-2xl overflow-hidden bg-black">
        <Image
          src={intro.fullUrl}
          alt="Intro"
          fill
          unoptimized
          sizes="(min-width: 768px) 48rem, 100vw"
          className="object-cover transition-opacity duration-500 hover:opacity-90"
        />
      </div>
    </section>
  );
}

/**
 * Placeholder intro when no media is uploaded yet.
 */
function IntroPlaceholder({
  themeColor,
  accentColor,
}: {
  themeColor: string;
  accentColor: string;
}) {
  return (
    <section className="mt-8 rounded-2xl bg-gradient-to-br from-[var(--theme-color)] to-[var(--accent-color)] mb-6" style={themeGradientStyle(themeColor, accentColor)}>
      <div className="h-64 sm:h-80 p-6 flex items-center justify-center text-white">
        <svg
          className="w-12 h-12 opacity-50 mb-2"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 7v6l4 2" />
        </svg>
        <p className="text-sm">Intro media coming soon</p>
      </div>
    </section>
  );
}

/**
 * QR code overlay with upload CTA.
 */
function QROverlaySection({
  dto,
  couple,
  isGuestUploadAllowed,
  uploadDeadlineDisplay,
}: {
  dto: PublicVaultDTO;
  couple: string;
  isGuestUploadAllowed: boolean;
  uploadDeadlineDisplay: string;
}) {
  return (
    <section className="mt-12 grid gap-6 md:grid-cols-2 pb-8">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200 p-8 text-center shadow-sm transition-all duration-300 hover:border-gold/50">
        <Image
          src={dto.qrImageDataUrl}
          alt={`QR code for ${couple} vault`}
          width={180}
          height={180}
          unoptimized
          className="h-48 w-48 mb-4 object-contain ring-2 ring-stone-100"
        />
        <h3 className="text-xl font-medium text-stone-900 mb-2">
          Share Your Memories
        </h3>
        <p className="text-sm text-stone-500">
          Guests open this vault on their phone to upload photos
        </p>
      </div>

      {isGuestUploadAllowed ? (
        <GuestUploadCard
          slug={dto.slug}
          uploadDeadlineDisplay={uploadDeadlineDisplay}
        />
      ) : (
        <div className="rounded-2xl border border-stone-200 p-8 text-center">
          <p className="text-lg font-medium text-stone-800">
            Uploads are closed
          </p>
          <p className="mt-2 text-sm text-stone-500">
            Guest uploads closed on {uploadDeadlineDisplay}. Thank you
            for the memories already shared.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * Deadline summary bar.
 */
function DeadlineSummary({ dto }: { dto: PublicVaultDTO }) {
  return (
    <section className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-stone-600">
      <span className="rounded-full bg-sand px-4 py-1.5">
        Uploads close {dto.uploadDeadlineDisplay}
      </span>
      <span className="rounded-full bg-sand px-4 py-1.5">
        Downloads close {dto.downloadDeadlineDisplay}
      </span>
    </section>
  );
}

/**
 * Feature-gated asset teasers (Slideshow/Flipbook) with tier mapping.
 * Silver: nothing
 * Gold: Slideshow
 * Platinum: Slideshow + Flipbook
 */
function AssetTeasersSection({ dto }: { dto: PublicVaultDTO }) {
  return (
    <section className="mt-12 grid gap-4 sm:grid-cols-2">
      {dto.slideshowTitle ? (
        <div
          className="rounded-2xl border border-stone-200 p-6 shadow-sm transition-all duration-300 hover:border-gold/50"
        >
          <h2 className="text-lg font-semibold text-stone-900 mb-1">
            Slideshow
          </h2>
          <p className="mt-1 text-stone-600">
            {dto.slideshowTitle}
          </p>
          <p className="mt-2 text-sm text-stone-500">
            Auto-playing gallery of guest photos
          </p>
        </div>
      ) : null}
      {dto.flipbookTitle ? (
        <div
          className="rounded-2xl border border-stone-200 p-6 shadow-sm transition-all duration-300 hover:border-gold/50"
        >
          <h2 className="text-lg font-semibold text-stone-900 mb-1">
            Flipbook
          </h2>
          <p className="mt-1 text-stone-600">
            {dto.flipbookTitle}
          </p>
          <p className="mt-2 text-sm text-stone-500">
            Interactive page-flip photo album
          </p>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Gallery section with empty state handling.
 */
function GallerySection({ dto }: { dto: PublicVaultDTO }) {
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-display font-semibold text-stone-900 mb-6">
        Memories
      </h2>

      <GalleryGrid
        slug={dto.slug}
        items={dto.gallery}
        downloadOpen={dto.downloadOpen}
      />

      {dto.gallery.length === 0 && (
        <EmptyState
          title="No memories shared yet"
          description={`Be the first to upload a photo or video using the QR code below. Guest uploads are open until ${dto.uploadDeadlineDisplay}.`}
        />
      )}
    </section>
  );
}