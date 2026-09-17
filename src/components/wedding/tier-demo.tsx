"use client";

/**
 * TierDemo — an interactive, package-exact demo of the Silver / Gold /
 * Platinum wedding vault.
 *
 * The vault mock is gated by the CANONICAL entitlement flags
 * (`@/lib/entitlements/packages`), so a demo can never show a feature the
 * package does not include: Silver never gains video/slideshow/banner,
 * Gold never gains the intro/flipbook/QR design card, Platinum has
 * everything — upload/download windows, fair-use limits and "unlimited"
 * entitlements all come straight from the product definition.
 *
 * The customer personalises the demo with their own details (names, date,
 * venue, accent colour, a message) via the form and can then act as a guest:
 * pick a real photo/video file from their device, write a guestbook entry,
 * toggle the live slideshow and browse the flipbook. Everything stays in the
 * browser — no storage access, SSR deterministic (no render-time randomness).
 */

import { useMemo, useState, type ChangeEvent, type CSSProperties } from "react";
import type { DemoGuestbookEntry, WeddingDemo, DemoImage } from "@/content/examples";
import {
  PackageCode,
  getPackageExpiryWindows,
  getPackageFeatures,
  getPackageIntegerFeature,
  packageHasUnlimited,
} from "@/lib/entitlements/packages";
import { LiveSlideshow } from "./live-slideshow";
import { Flipbook } from "./flipbook";
import { DemoArtwork, DemoInitials } from "./demo-artwork";
import { QrPattern } from "./qr-preview";
import { useReducedMotion } from "@/components/ui/use-reduced-motion";
import { IconCheck, IconClose, IconDownload, IconHeart, IconPlay, IconUpload } from "@/components/icons";
import { cn } from "@/lib/utils";

export type TierName = "silver" | "gold" | "platinum";

type UploadItem = { id: string; kind: "image" | "video"; url: string; label: string };
type VaultTab = "photos" | "videos" | "messages";

interface DemoPrefs {
  partnerOne: string;
  partnerTwo: string;
  venue: string;
  isoDate: string;
  dateLabel: string;
  accent: string;
  tagline: string;
}

/** Stable ISO dates matching the tier showcase wedding data (for the date input). */
const TIER_DEFAULT_DATE: Record<TierName, string> = {
  silver: "2026-05-02",
  gold: "2026-03-14",
  platinum: "2026-11-07",
};

const ACCENT_SWATCHES = ["#b08d57", "#a85f2f", "#7f9a6b", "#8f6f3f", "#2a251d", "#9b9287"];

/** Static demo baseline counts (photos already in the vault), per tier. */
const PHOTO_BASE: Record<TierName, number> = { silver: 369, gold: 529, platinum: 1146 };
const VIDEO_BASE: Record<TierName, number> = { silver: 0, gold: 5, platinum: 12 };

function formatDemoDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

const PACKAGE_LABEL: Record<TierName, string> = {
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

export function TierDemo({
  tier,
  wedding,
  introBody,
  bullets,
}: {
  tier: TierName;
  wedding: WeddingDemo;
  /** Short marketing paragraph placed under the form. */
  introBody: string;
  /** How-the-demo-works list placed under the introduction. */
  bullets: string[];
}) {
  const code =
    tier === "silver"
      ? PackageCode.SILVER
      : tier === "gold"
        ? PackageCode.GOLD
        : PackageCode.PLATINUM;

  const features = useMemo(() => getPackageFeatures(code), [code]);
  const hasVideo = features.video === true;
  const hasSlideshow = features.slideshow === true;
  const hasBanner = features.banner === true;
  const hasIntro = features.intro === true;
  const hasFlipbook = features.flipbook === true;
  const qrDesignCard = features.qr_design_card === true;
  const photoLimit = getPackageIntegerFeature(code, "max_photos");
  const videoLimit = getPackageIntegerFeature(code, "max_videos");
  const { uploadDays, downloadDays } = getPackageExpiryWindows(code);
  const photosUnlimited = packageHasUnlimited(code, "photos");
  const videosUnlimited = packageHasUnlimited(code, "videos");

  const defaultPrefs = (): DemoPrefs => ({
    partnerOne: wedding.couple[0],
    partnerTwo: wedding.couple[1],
    venue: wedding.venue,
    isoDate: TIER_DEFAULT_DATE[tier],
    dateLabel: wedding.dateLabel,
    accent: wedding.colors.accent,
    tagline: "Thank you for being part of our day",
  });

  const [prefs, setPrefs] = useState<DemoPrefs>(defaultPrefs);
  const [tab, setTab] = useState<VaultTab>("photos");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [messages, setMessages] = useState<readonly DemoGuestbookEntry[]>(wedding.guestbook);
  const [draftName, setDraftName] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [phase, setPhase] = useState<"intro" | "playing" | "live">(hasIntro ? "intro" : "live");
  const reduced = useReducedMotion();

  const coupleNames = `${prefs.partnerOne} & ${prefs.partnerTwo}`.replace(/\s*&\s*/g, " & ").trim();
  const packageName = PACKAGE_LABEL[tier];

  const personalizedWedding = useMemo<WeddingDemo>(
    () => ({ ...wedding, coupleNames, dateLabel: prefs.dateLabel, venue: prefs.venue }),
    [wedding, coupleNames, prefs.dateLabel, prefs.venue],
  );

  const totalPhotos = PHOTO_BASE[tier] + uploads.filter((item) => item.kind === "image").length;
  const totalVideos = VIDEO_BASE[tier] + uploads.filter((item) => item.kind === "video").length;

  function onPickFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const accepted: UploadItem[] = [];
    for (const [index, file] of files.entries()) {
      const isVideo = file.type.startsWith("video/");
      if (isVideo && !hasVideo) {
        setNotice("Videos are part of Gold and Platinum — this Silver demo accepts photos only.");
        continue;
      }
      accepted.push({
        id: `up-${Date.now()}-${index}`,
        kind: isVideo ? "video" : "image",
        url: URL.createObjectURL(file),
        label: file.name.replace(/\.[^.]+$/, "") || (isVideo ? "Guest clip" : "Guest capture"),
      });
    }
    if (accepted.length > 0) {
      setUploads((prev) => [...prev, ...accepted]);
      setTab(accepted.some((item) => item.kind === "video") ? "videos" : "photos");
      setNotice(null);
    }
    event.target.value = "";
  }

  function addMessage() {
    const name = draftName.trim();
    const message = draftMessage.trim();
    if (!name || !message) return;
    setMessages((prev) => [{ id: `msg-${Date.now()}`, name, message, moment: "Just now" }, ...prev]);
    setDraftMessage("");
    setNotice("Your message was added to the guestbook.");
  }

  function startIntro() {
    setPhase("playing");
    if (reduced) {
      setPhase("live");
      return;
    }
    window.setTimeout(() => setPhase("live"), 2600);
  }

  const accentStyle = { "--demo-accent": prefs.accent } as CSSProperties;

  const included: string[] = [
    "Photo gallery",
    "Guest uploads via QR code",
    `Couple names & wedding date`,
    "Custom theme & accent colours",
    photosUnlimited
      ? "Unlimited photo uploads (fair-use still applies)"
      : `Up to ${photoLimit} photos (fair-use limit)`,
    ...(hasVideo ? [videosUnlimited ? "Unlimited guest videos" : `Up to ${videoLimit} guest videos`] : []),
    ...(hasSlideshow ? ["Live slideshow"] : []),
    ...(hasBanner ? ["Custom banner image"] : []),
    ...(hasIntro ? ["Intro video / image"] : []),
    ...(hasFlipbook ? ["Interactive flipbook"] : []),
    ...(qrDesignCard ? ["Custom QR design cards"] : []),
    `Uploads open ${uploadDays} days after the wedding`,
    `Downloads open for ${downloadDays} days`,
  ];

  const notIncluded: string[] = [
    ...(hasVideo ? [] : ["Video uploads"]),
    ...(hasSlideshow ? [] : ["Live slideshow"]),
    ...(hasBanner ? [] : ["Custom banner"]),
    ...(hasIntro ? [] : ["Intro media"]),
    ...(hasFlipbook ? [] : ["Interactive flipbook"]),
    ...(qrDesignCard ? [] : ["Custom QR design cards"]),
  ];

  return (
    <>
      {/* ── Personalisation + live vault ─────────────────────────────────── */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)]">
        {/* Form */}
        <form
          className="card-soft p-6 sm:p-7"
          onSubmit={(event) => event.preventDefault()}
          aria-label={`Try ${packageName} with your details`}
        >
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent-deep">
            Try it with your details
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
            Build your {packageName} demo
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{introBody}</p>

          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${tier}-p1`} className="text-xs font-semibold text-muted">
                  Partner one
                </label>
                <input
                  id={`${tier}-p1`}
                  value={prefs.partnerOne}
                  onChange={(event) => setPrefs((p) => ({ ...p, partnerOne: event.target.value }))}
                  className="mt-1.5 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-accent"
                  placeholder="Emma"
                  maxLength={40}
                />
              </div>
              <div>
                <label htmlFor={`${tier}-p2`} className="text-xs font-semibold text-muted">
                  Partner two
                </label>
                <input
                  id={`${tier}-p2`}
                  value={prefs.partnerTwo}
                  onChange={(event) => setPrefs((p) => ({ ...p, partnerTwo: event.target.value }))}
                  className="mt-1.5 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-accent"
                  placeholder="James"
                  maxLength={40}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${tier}-date`} className="text-xs font-semibold text-muted">
                  Wedding date
                </label>
                <input
                  id={`${tier}-date`}
                  type="date"
                  value={prefs.isoDate}
                  onChange={(event) =>
                    setPrefs((p) => ({
                      ...p,
                      isoDate: event.target.value,
                      dateLabel: formatDemoDate(event.target.value || p.isoDate),
                    }))
                  }
                  className="mt-1.5 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-accent"
                />
              </div>
              <div>
                <label htmlFor={`${tier}-venue`} className="text-xs font-semibold text-muted">
                  Venue
                </label>
                <input
                  id={`${tier}-venue`}
                  value={prefs.venue}
                  onChange={(event) => setPrefs((p) => ({ ...p, venue: event.target.value }))}
                  className="mt-1.5 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-accent"
                  placeholder="The venue"
                  maxLength={60}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted">Accent colour</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Array.from(new Set([prefs.accent, ...ACCENT_SWATCHES])).map((swatch) => {
                  const active = swatch.toLowerCase() === prefs.accent.toLowerCase();
                  return (
                    <button
                      key={swatch}
                      type="button"
                      aria-label={`Use accent ${swatch}`}
                      aria-pressed={active}
                      onClick={() => setPrefs((p) => ({ ...p, accent: swatch }))}
                      className={cn(
                        "h-8 w-8 rounded-full ring-2 ring-offset-2 transition-transform",
                        active ? "ring-accent scale-105" : "ring-transparent hover:scale-105",
                      )}
                      style={{ backgroundColor: swatch }}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor={`${tier}-tagline`} className="text-xs font-semibold text-muted">
                {qrDesignCard ? "Message for the QR design card" : "Vault message"}
              </label>
              <textarea
                id={`${tier}-tagline`}
                value={prefs.tagline}
                onChange={(event) => setPrefs((p) => ({ ...p, tagline: event.target.value }))}
                rows={2}
                maxLength={140}
                className="mt-1.5 w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPrefs(defaultPrefs())}
              className="text-xs font-semibold text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              Reset to the demo couple
            </button>
            <span className="text-[11px] text-faint">Updates live</span>
          </div>

          <ul className="mt-6 space-y-2 border-t border-line-soft pt-5">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5 text-xs leading-relaxed text-muted">
                <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-deep" />
                {bullet}
              </li>
            ))}
          </ul>
        </form>

        {/* Live vault mock */}
        <div className="min-w-0 overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-card)]">
          <div className="border-b border-line-soft px-6 pb-5 pt-6" style={accentStyle}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: "var(--demo-accent)" }}>
                    Wedding Vault
                  </p>
                  <span className="rounded-full bg-blush px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-deep">
                    {packageName}
                  </span>
                </div>
                <h3 className="mt-1 truncate font-display text-2xl font-semibold tracking-tight text-ink">
                  {coupleNames}
                </h3>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {prefs.dateLabel} · {prefs.venue || "The venue"}
                </p>
                {prefs.tagline.trim() ? (
                  <p className="mt-1.5 max-w-md text-xs italic leading-relaxed text-faint">
                    &ldquo;{prefs.tagline.trim()}&rdquo;
                  </p>
                ) : null}
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-ivory px-2.5 py-1 text-[11px] font-semibold text-muted">
                  <IconUpload className="h-3 w-3 text-accent-deep" />
                  Uploads open {uploadDays} days after the wedding
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDownloaded(true)}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
                  downloaded ? "bg-emerald-50 text-emerald-700" : "bg-brand text-ivory hover:bg-brand-soft",
                )}
              >
                {downloaded ? <IconCheck className="h-4 w-4" /> : <IconDownload className="h-4 w-4" />}
                {downloaded ? "Download window active" : `Download for ${downloadDays} days`}
              </button>
            </div>
          </div>

          {hasBanner ? (
            <div className="relative h-28 overflow-hidden sm:h-36">
              <DemoArtwork image={wedding.gallery[1]} className="h-full w-full" />
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{ background: `linear-gradient(115deg, ${prefs.accent}40, transparent 62%)` }}
              />
              <span className="absolute bottom-3 left-4 rounded-full bg-brand-ink/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-ivory backdrop-blur">
                Custom banner image
              </span>
            </div>
          ) : null}

          {hasIntro && phase !== "live" ? (
            <div className="relative aspect-video overflow-hidden">
              <DemoArtwork image={wedding.gallery[1]} className="h-full w-full" />
              <div aria-hidden="true" className="absolute inset-0 bg-brand-ink/55" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <span className="rounded-full bg-accent/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-accent-glow">
                  Platinum intro media
                </span>
                {phase === "intro" ? (
                  <>
                    <p className="max-w-sm font-display text-xl font-semibold text-ivory">
                      {coupleNames}
                    </p>
                    <button
                      type="button"
                      onClick={startIntro}
                      className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-sm font-bold text-brand-ink shadow-[var(--shadow-gold)] transition-transform hover:scale-105"
                    >
                      <IconPlay className="h-4 w-4" />
                      Play the intro
                    </button>
                    <p className="text-xs text-ivory/70">The vault opens after the introduction.</p>
                  </>
                ) : (
                  <>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ivory/15 text-ivory" aria-hidden="true">
                      <IconPlay className="h-5 w-5" />
                    </span>
                    <div className="h-1.5 w-48 overflow-hidden rounded-full bg-ivory/25" role="progressbar" aria-label="Playing intro">
                      <span className="block h-full animate-[demo-progress_2.6s_ease-out_forwards] rounded-full bg-accent-glow" />
                    </div>
                    <p className="text-xs text-ivory/70">Playing your intro…</p>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {/* Tabs */}
          <div role="tablist" aria-label={`${coupleNames} vault sections`} className="flex gap-1 overflow-x-auto border-b border-line-soft px-6">
            {(
              [
                { id: "photos", label: "Photos" },
                ...(hasVideo ? ([{ id: "videos", label: "Videos" }] as const) : []),
                { id: "messages", label: "Messages" },
              ] as const
            ).map((item) => {
              const selected = tab === item.id;
              const badge =
                item.id === "photos"
                  ? photosUnlimited
                    ? totalPhotos.toLocaleString()
                    : `${totalPhotos.toLocaleString()} of ${photoLimit.toLocaleString()}`
                  : item.id === "videos"
                    ? videosUnlimited
                      ? totalVideos.toLocaleString()
                      : `${totalVideos.toLocaleString()} of ${videoLimit.toLocaleString()}`
                    : messages.length.toLocaleString();
              return (
                <button
                  key={item.id}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "-mb-px inline-flex h-12 shrink-0 items-center border-b-2 px-3 text-sm font-semibold transition-colors",
                    selected ? "text-ink" : "border-transparent text-muted hover:text-ink",
                  )}
                  style={selected ? ({ borderColor: "var(--demo-accent)" } as CSSProperties) : undefined}
                >
                  {item.label}
                  <span className="ml-2 rounded-full bg-blush px-2 py-0.5 text-[11px] font-bold text-accent-deep">
                    {badge}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-6">
            {tab === "photos" ? (
              <div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {uploads
                    .filter((item) => item.kind === "image")
                    .map((item) => (
                      <figure key={item.id} className="group relative overflow-hidden rounded-xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.url}
                          alt={item.label}
                          className="aspect-square w-full object-cover"
                        />
                        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-ink/70 to-transparent px-3 pb-2 pt-8 text-left text-[11px] font-medium text-ivory">
                          {item.label} · you
                        </figcaption>
                      </figure>
                    ))}
                  {wedding.gallery.slice(0, 9).map((image: DemoImage) => (
                    <figure key={image.id} className="group relative overflow-hidden rounded-xl">
                      <DemoArtwork image={image} className="aspect-square w-full transition-transform duration-500 group-hover:scale-105" />
                      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-ink/70 to-transparent px-3 pb-2 pt-8 text-left text-[11px] font-medium text-ivory opacity-0 transition-opacity group-hover:opacity-100">
                        {image.caption}
                      </figcaption>
                    </figure>
                  ))}
                </div>

                {notice ? (
                  <p role="status" className="mt-4 rounded-xl border border-accent/40 bg-blush px-3 py-2 text-xs font-medium text-accent-deep">
                    {notice}
                  </p>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
                  <p className="text-xs text-faint">
                    {photosUnlimited
                      ? "Unlimited photos — technical fair-use still applies."
                      : `${totalPhotos.toLocaleString()} of ${photoLimit.toLocaleString()} photos used on Silver.`}
                  </p>
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-ivory transition-colors hover:bg-brand-soft">
                    <IconUpload className="h-4 w-4" />
                    Add your {hasVideo ? "photos or videos" : "photos"}
                    <input
                      type="file"
                      multiple
                      accept={hasVideo ? "image/*,video/*" : "image/*"}
                      onChange={onPickFiles}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {tab === "videos" && hasVideo ? (
              <div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {uploads
                    .filter((item) => item.kind === "video")
                    .map((item) => (
                      <div key={item.id} className="overflow-hidden rounded-2xl border border-line">
                        <video src={item.url} controls preload="metadata" className="aspect-video w-full bg-brand-ink" />
                        <p className="px-4 py-3 text-sm font-medium text-ink">{item.label} · you</p>
                      </div>
                    ))}
                  {[0, 1].map((index) => {
                    const image = wedding.gallery[(index + 1) % wedding.gallery.length];
                    return (
                      <div key={index} className="overflow-hidden rounded-2xl border border-line">
                        <div className="relative">
                          <DemoArtwork image={image} className="aspect-video w-full" />
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface/90 text-ink shadow-[var(--shadow-card)]">
                              <IconPlay className="h-5 w-5" />
                            </span>
                          </span>
                          <span className="absolute bottom-2 right-2 rounded-md bg-brand-ink/70 px-1.5 py-0.5 text-[10px] font-semibold text-ivory">
                            {index === 0 ? "0:18" : "0:42"}
                          </span>
                        </div>
                        <p className="px-4 py-3 text-sm font-medium text-ink">
                          {index === 0 ? `Guest clip — ${image.caption.toLowerCase()}` : wedding.videoTitle ?? "Guest clip"}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {notice ? (
                  <p role="status" className="mt-4 rounded-xl border border-accent/40 bg-blush px-3 py-2 text-xs font-medium text-accent-deep">
                    {notice}
                  </p>
                ) : null}
                <p className="mt-5 border-t border-line-soft pt-4 text-xs text-faint">
                  {videosUnlimited
                    ? "Unlimited videos — technical fair-use still applies."
                    : `Up to ${videoLimit} videos on Gold (fair-use limit).`}
                </p>
              </div>
            ) : null}

            {tab === "messages" ? (
              <div>
                <ul className="space-y-3">
                  {messages.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-3 rounded-2xl border border-line-soft bg-ivory p-4">
                      <DemoInitials
                        initials={entry.name
                          .split(" ")
                          .slice(0, 2)
                          .map((part) => part.charAt(0))
                          .join("")}
                        className="h-10 w-10 text-xs"
                        palette={[prefs.accent, "#8f6f3f"]}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <p className="text-sm font-semibold text-ink">{entry.name}</p>
                          <p className="text-[11px] text-faint">{entry.moment}</p>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-muted">{entry.message}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 rounded-2xl border border-line-soft bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent-deep">
                      <IconHeart className="h-3.5 w-3.5" />
                      Leave a message
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr]">
                    <input
                      aria-label="Your name"
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      placeholder="Your name"
                      maxLength={60}
                      className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-accent"
                    />
                    <input
                      aria-label="Your message"
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      placeholder="Write a message to the couple…"
                      maxLength={280}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") addMessage();
                      }}
                      className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-accent"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-[11px] text-faint">Guest names & messages — part of every package.</p>
                    <button
                      type="button"
                      onClick={addMessage}
                      disabled={!draftName.trim() || !draftMessage.trim()}
                      className="inline-flex h-9 items-center rounded-full bg-brand px-4 text-xs font-bold text-ivory transition-colors hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Add to guestbook
                    </button>
                  </div>
                  {notice ? (
                    <p role="status" className="mt-3 rounded-xl border border-accent/40 bg-blush px-3 py-2 text-xs font-medium text-accent-deep">
                      {notice}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Slideshow (Gold+) / Flipbook (Platinum) ───────────────────────── */}
      {hasSlideshow || hasFlipbook ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {hasSlideshow ? (
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-accent-deep">
                Live slideshow — plays as guests upload
              </p>
              <LiveSlideshow wedding={personalizedWedding} />
            </div>
          ) : null}
          {hasFlipbook ? (
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-accent-deep">
                Interactive flipbook keepsake
              </p>
              <Flipbook wedding={personalizedWedding} />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── QR card ──────────────────────────────────────────────────────── */}
      <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-2">
        <div className="card-soft flex flex-col justify-between p-6 sm:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent-deep">
              Guest QR code — every package
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold text-ink">
              {qrDesignCard ? "A custom QR design card" : "The guest QR card"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {qrDesignCard
                ? "Platinum cards carry the couple's branding, colours and a personal message — printed as PNG or PDF."
                : "Guests scan the QR (it encodes only the public vault URL) and land straight on the upload page."}
            </p>
          </div>
          <div className="mt-5">
            <QRDemoCard
              dotColor={prefs.accent}
              coupleNames={coupleNames}
              dateLabel={prefs.dateLabel}
              tagline={qrDesignCard ? prefs.tagline : undefined}
              custom={qrDesignCard}
            />
          </div>
        </div>

        <div className="card-soft flex flex-col justify-center gap-4 p-6 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent-deep">
            What a guest does
          </p>
          <ul className="space-y-3">
            {[
              "Scan the QR card on the table with their phone camera.",
              "The public vault opens — no login, no app to install.",
              `They pick photos${hasVideo ? " or videos" : ""} from their phone, straight into the vault.`,
              "The upload processes and appears in the gallery in seconds.",
            ].map((step) => (
              <li key={step} className="flex items-start gap-3 text-sm leading-relaxed text-muted">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blush text-[11px] font-bold text-accent-deep" aria-hidden="true">
                  <IconCheck className="h-3.5 w-3.5" />
                </span>
                {step}
              </li>
            ))}
          </ul>
          <p className="text-xs text-faint">
            Note: the QR pattern above is decorative — it never encodes a real
            vault address, and this demo never touches storage.
          </p>
        </div>
      </div>

      {/* ── Exactly-the-package checklist ─────────────────────────────────── */}
      <div className="mt-8 rounded-3xl border border-line bg-ivory-deep/50 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent-deep">
              Exactly the {packageName} package
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
              What this demo includes
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Gated by the real {packageName} entitlement list — nothing more, nothing less. Fair-use
              limits and upload/download windows match the actual product.
            </p>
          </div>
        </div>

        <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {included.map((item) => (
            <li key={item} className="flex items-start gap-2.5 rounded-xl border border-line-soft bg-surface px-3.5 py-2.5 text-sm font-medium text-ink">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface/60 p-5">
          {notIncluded.length > 0 ? (
            <>
              <p className="text-xs font-bold uppercase tracking-widest text-faint">
                Not part of {packageName}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {notIncluded.map((item) => (
                  <li key={item} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ivory px-3 py-1.5 text-xs font-semibold text-muted">
                    <IconClose className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-faint">
                Compare the packages to see what these unlock — or try the interactive demo for each tier.
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-emerald-700">
              Every single {packageName} feature is present in this demo — including unlimited entitlements
              (technical fair-use still applies).
            </p>
          )}
        </div>
      </div>
    </>
  );
}

/** Small branded QR card preview (basic for all tiers, "design card" for Platinum). */
function QRDemoCard({
  coupleNames,
  dateLabel,
  dotColor,
  tagline,
  custom,
}: {
  coupleNames: string;
  dateLabel: string;
  dotColor: string;
  tagline?: string;
  custom: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-line",
        custom ? "ring-2" : "",
      )}
      style={custom ? ({ "--demo-accent": dotColor } as CSSProperties) : undefined}
    >
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${dotColor}, ${dotColor}88)` }} />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-ink">{coupleNames}</p>
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-muted">{dateLabel}</p>
        </div>
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <div className="flex shrink-0 items-center justify-center rounded-xl bg-ivory p-3" style={{ border: `1px solid ${dotColor}33` }}>
          <QrPattern seed={coupleNames.toLowerCase()} label={`Decorative QR for ${coupleNames}`} className="h-20 w-20 text-brand" />
        </div>
        <div className="min-w-0">
          {custom && tagline?.trim() ? (
            <p className="font-display text-sm font-semibold leading-snug text-ink">&ldquo;{tagline.trim()}&rdquo;</p>
          ) : (
            <p className="text-xs leading-relaxed text-muted">Scan to open the vault and share your photos{` `}
              of {coupleNames}.</p>
          )}
          {custom ? (
            <span className="mt-2 inline-flex rounded-full bg-blush px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-accent-deep">
              Custom design · PNG / PDF
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}