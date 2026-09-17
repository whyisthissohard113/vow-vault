"use client";

/**
 * ExampleVault — the full-screen, interactive demo vault.
 *
 * This is the real product experience for a fictional wedding: hero, section
 * navigation, gallery + lightbox, guest upload, guestbook, video, slideshow,
 * QR (scannable, public-route only), Platinum intro, flipbook, QR design
 * switcher and download demo.
 *
 * Every capability is gated by `getDemoCapabilities(tier)`, which is derived
 * from the canonical package definitions — the demo can never show a feature
 * the real package does not include. All interactions are local to this
 * browser session and are explicitly labelled as demonstrations.
 */

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import type {
  DemoGuestbookEntry,
  DemoPackageTier,
  WeddingDemo,
} from "@/content/examples";
import {
  describeCapabilities,
  getDemoCapabilities,
} from "@/lib/examples/capabilities";
import {
  demoVaultPath,
  getDemoVideos,
  toVaultMemories,
  type VaultMemory,
} from "@/lib/examples/demo-derive";
import { getVaultTheme, vaultStyleVars } from "@/lib/examples/vault-themes";
import { useReducedMotion } from "@/components/ui/use-reduced-motion";
import { Flipbook } from "@/components/wedding/flipbook";
import { IconArrowRight, IconCheck, IconLock, IconSparkle } from "@/components/icons";
import { cn } from "@/lib/utils";

import { useDemoQrDataUrl } from "./demo-qr";
import { DemoNotice } from "./demo-notice";
import { VaultHero } from "./vault-hero";
import { VaultNavigation } from "./vault-navigation";
import { VaultGallery } from "./vault-gallery";
import { VaultUpload } from "./vault-upload";
import { Guestbook } from "./guestbook";
import { MemorySlideshow } from "./memory-slideshow";
import { DemoVideoPlayer } from "./video-player";
import { QRCodeCard } from "./qr-code-card";
import { QrDesignSwitcher } from "./theme-switcher";
import { DownloadDemo } from "./download-demo";
import { PlatinumIntro } from "./vault-intro";
import { PackageFeatureGate } from "./package-feature-gate";
import type { VaultSection } from "./vault-types";

const TIERS: DemoPackageTier[] = ["Silver", "Gold", "Platinum"];

interface UpgradeGate {
  title: string;
  copy: string;
  cta: string;
}

/** Only the features the *next* tier unlocks, so the upsell stays honest. */
const UPGRADE_GATES: Record<DemoPackageTier, UpgradeGate[]> = {
  Silver: [
    {
      title: "Guest video uploads",
      copy: "Gold adds guest video (speeches, first dances, the send-off) alongside photos.",
      cta: "See Gold",
    },
    {
      title: "Live memory slideshow",
      copy: "Gold can play every new guest photo on a live slideshow as the day unfolds.",
      cta: "See Gold",
    },
    {
      title: "Custom banner image",
      copy: "Gold opens the vault with a full-width banner image in your wedding colours.",
      cta: "See Gold",
    },
  ],
  Gold: [
    {
      title: "Intro experience",
      copy: "Platinum opens the vault with an intro film or image before the gallery.",
      cta: "See Platinum",
    },
    {
      title: "Interactive flipbook",
      copy: "Platinum turns the same memories into a page-flip keepsake guests can browse.",
      cta: "See Platinum",
    },
    {
      title: "Custom QR design cards",
      copy: "Platinum prints custom QR cards with your names, colours and a personal message.",
      cta: "See Platinum",
    },
    {
      title: "90-day download window",
      copy: "Platinum keeps downloads open for 90 days after the wedding date.",
      cta: "See Platinum",
    },
  ],
  Platinum: [],
};

export function ExampleVault({
  wedding,
  tier,
  mode,
}: {
  wedding: WeddingDemo;
  tier: DemoPackageTier;
  mode: "theme" | "tier";
}) {
  const caps = useMemo(() => getDemoCapabilities(tier), [tier]);
  const theme = getVaultTheme(wedding.id);
  const reduced = useReducedMotion();
  const qrDataUrl = useDemoQrDataUrl(demoVaultPath(wedding));

  const [memories, setMemories] = useState<VaultMemory[]>(() => toVaultMemories(wedding));
  const [guestbookEntries, setGuestbookEntries] = useState<DemoGuestbookEntry[]>(() => [
    ...wedding.guestbook,
  ]);
  const [active, setActive] = useState<VaultSection>("memories");
  const [recentUpload, setRecentUpload] = useState(false);
  const introKey = `vv-demo-intro-seen:${wedding.id}:${tier}`;
  const [introActive, setIntroActive] = useState(caps.introMedia);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  // Hydration-safe sessionStorage sync for the Platinum intro: returning
  // visitors skip it for this browser session. useSyncExternalStore reads the
  // stored value without an effect, and the overlay switches off after
  // hydration without flashing.
  const subscribeToStorage = useCallback((callback: () => void) => {
    window.addEventListener("storage", callback);
    return () => window.removeEventListener("storage", callback);
  }, []);
  const introSeenSnapshot = useCallback(() => {
    try {
      return window.sessionStorage.getItem(introKey) === "1";
    } catch {
      return false;
    }
  }, [introKey]);
  const introSeen = useSyncExternalStore(
    subscribeToStorage,
    introSeenSnapshot,
    () => false,
  );

  const videos = useMemo(
    () => (caps.videos ? getDemoVideos(wedding) : []),
    [caps.videos, wedding],
  );

  const sections = useMemo(() => {
    const list: VaultSection[] = [];
    if (caps.photos) list.push("memories");
    if (caps.videos) list.push("videos");
    list.push("guestbook");
    if (caps.uploads) list.push("upload");
    list.push("about");
    return list;
  }, [caps]);

  const activeSection = sections.includes(active) ? active : sections[0];

  function enterVault() {
    try {
      window.sessionStorage.setItem(introKey, "1");
    } catch {
      /* ignore */
    }
    setIntroActive(false);
  }

  function selectSection(section: VaultSection) {
    setActive(section);
    requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({
        block: "start",
        behavior: reduced ? "auto" : "smooth",
      });
    });
  }

  function addMemory(memory: VaultMemory) {
    setMemories((previous) => [memory, ...previous]);
    setRecentUpload(true);
  }

  function addGuestbookEntry(entry: DemoGuestbookEntry) {
    setGuestbookEntries((previous) => [entry, ...previous]);
  }

  const counts: Partial<Record<VaultSection, number>> = {
    memories: memories.length,
    videos: videos.length,
    guestbook: guestbookEntries.length,
  };

  return (
    <div
      className="vault-root min-h-screen"
      style={vaultStyleVars(theme)}
      data-vault-theme={theme.id}
      data-vault-display={theme.display ? "serif" : "sans"}
    >
      {/* Background texture */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 vault-texture" />

      <div className="relative">
        {/* Demo chrome */}
        <div className="border-b vault-line" style={{ background: "color-mix(in srgb, var(--vault-surface) 78%, transparent)" }}>
          <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-3 px-3 sm:px-6">
            <Link
              href="/examples"
              className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors vault-muted hover:text-[var(--vault-ink)]"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
              All examples
            </Link>

            <p className="hidden truncate text-xs font-medium vault-muted sm:block">
              {wedding.coupleNames} · {tier} demo vault
            </p>

            {mode === "tier" ? (
              <div className="flex items-center gap-0.5" role="group" aria-label="Switch package demo">
                {TIERS.map((option) => (
                  <Link
                    key={option}
                    href={`/examples/${option.toLowerCase()}`}
                    aria-current={option === tier ? "page" : undefined}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors sm:px-3",
                      option === tier
                        ? "vault-accent-bg"
                        : "vault-muted hover:text-[var(--vault-ink)]",
                    )}
                  >
                    {option}
                  </Link>
                ))}
              </div>
            ) : (
              <Link
                href={`/examples/${tier.toLowerCase()}`}
                className="inline-flex items-center gap-1 text-xs font-semibold transition-colors vault-accent hover:underline"
              >
                See the {tier} package vault
                <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>

        <VaultHero
          wedding={wedding}
          theme={theme}
          banner={caps.banner}
          tierLabel={tier}
          onExplore={() => selectSection("memories")}
        />

        <VaultNavigation
          sections={sections}
          active={activeSection}
          onSelect={selectSection}
          counts={counts}
        />

        <div ref={sectionRef} className="mx-auto w-full max-w-6xl scroll-mt-16 px-3 py-10 sm:px-6 sm:py-14">
          {activeSection === "memories" ? (
            <div className="space-y-12">
              <VaultGallery
                memories={memories}
                coupleNames={wedding.coupleNames}
                onRequestUpload={caps.uploads ? () => selectSection("upload") : undefined}
                uploadLabel="Add your photos"
              />
              {caps.slideshow ? (
                <div>
                  <h2 className="font-display text-2xl font-semibold tracking-tight vault-ink sm:text-3xl">
                    Live slideshow
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm vault-muted">
                    Gold and Platinum vaults can play the gallery on a loop at the reception — new
                    guest uploads appear as they arrive.
                  </p>
                  <div className="mt-5">
                    <MemorySlideshow memories={memories} coupleNames={wedding.coupleNames} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeSection === "videos" ? (
            <div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-semibold tracking-tight vault-ink sm:text-3xl">
                    Videos
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm vault-muted">
                    {caps.unlimitedVideos
                      ? "Unlimited guest video entitlement (fair-use safeguards still apply) — speeches, first dances and the send-off."
                      : `Up to ${caps.maxVideos} guest video clips, alongside the photo gallery.`}
                  </p>
                </div>
                <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest vault-accent-soft vault-accent">
                  {videos.length} demo videos
                </span>
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                {videos.map((video) => (
                  <DemoVideoPlayer key={video.id} video={video} />
                ))}
              </div>

              <div className="mt-6">
                <DemoNotice className="vault-muted">
                  Demo video placeholders — no real customer footage is stored or streamed. In a
                  real Gold or Platinum vault, guest clips would play here.
                </DemoNotice>
              </div>
            </div>
          ) : null}

          {activeSection === "guestbook" ? (
            <Guestbook
              entries={guestbookEntries}
              onAdd={addGuestbookEntry}
              coupleNames={wedding.coupleNames}
            />
          ) : null}

          {activeSection === "upload" ? (
            <div className="space-y-6">
              <VaultUpload onAdd={addMemory} coupleNames={wedding.coupleNames} />
              {recentUpload ? (
                <div className="flex flex-wrap items-center gap-3 border border-dashed p-4 vault-radius vault-line">
                  <IconCheck className="h-4 w-4 vault-accent" aria-hidden="true" />
                  <p className="text-sm vault-muted">Your demo photo is now in the gallery.</p>
                  <button
                    type="button"
                    onClick={() => selectSection("memories")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-bold vault-accent-bg"
                  >
                    View in Memories
                    <IconArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeSection === "about" ? (
            <div className="space-y-12">
              {/* Story + package capability summary */}
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div>
                  <h2 className="font-display text-2xl font-semibold tracking-tight vault-ink sm:text-3xl">
                    About this vault
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed vault-muted">{wedding.story}</p>
                  <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-widest vault-muted">Wedding date</dt>
                      <dd className="mt-0.5 font-semibold vault-ink">{wedding.dateLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-widest vault-muted">Venue</dt>
                      <dd className="mt-0.5 font-semibold vault-ink">{wedding.venue}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-widest vault-muted">Style</dt>
                      <dd className="mt-0.5 font-semibold vault-ink">{wedding.theme}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-widest vault-muted">Palette</dt>
                      <dd className="mt-0.5 flex items-center gap-2 font-semibold vault-ink">
                        <span
                          className="h-3.5 w-3.5 rounded-full"
                          style={{ background: wedding.colors.theme }}
                          aria-hidden="true"
                        />
                        {wedding.colors.label}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-6">
                    <DemoNotice className="vault-muted">
                      Fictional demo wedding: {wedding.coupleNames} and every memory shown are
                      illustrative. No real photos, couples, venues or guest data are used.
                    </DemoNotice>
                  </div>
                </div>

                <div className="border p-6 vault-radius vault-line vault-surface">
                  <div className="flex items-center gap-2">
                    <IconSparkle className="h-4 w-4 vault-accent" aria-hidden="true" />
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] vault-accent">
                      What the {tier} package includes
                    </p>
                  </div>
                  <ul className="mt-4 space-y-2.5">
                    {describeCapabilities(caps).map((line) => (
                      <li key={line} className="flex items-start gap-2 text-sm vault-muted">
                        <IconCheck className="mt-0.5 h-4 w-4 shrink-0 vault-accent" aria-hidden="true" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/packages"
                    className="mt-5 inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-bold transition-transform hover:scale-[1.02] vault-accent-bg"
                  >
                    Compare all packages
                    <IconArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Locked features for this tier */}
              {UPGRADE_GATES[tier].length > 0 ? (
                <div>
                  <div className="flex items-center gap-2">
                    <IconLock className="h-4 w-4 vault-muted" aria-hidden="true" />
                    <h2 className="font-display text-2xl font-semibold tracking-tight vault-ink sm:text-3xl">
                      Not in {tier} yet
                    </h2>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm vault-muted">
                    These features belong to the next package up. Nothing here is simulated as
                    active — the gate is real.
                  </p>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {UPGRADE_GATES[tier].map((gate) => (
                      <PackageFeatureGate
                        key={gate.title}
                        title={gate.title}
                        copy={gate.copy}
                        ctaLabel={gate.cta}
                        href="/packages"
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {/* QR access (every package) */}
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-tight vault-ink sm:text-3xl">
                  QR guest access
                </h2>
                <p className="mt-1 max-w-2xl text-sm vault-muted">
                  Every package includes a scannable QR code. This is the same access a guest gets
                  on the day.
                </p>
                <div className="mt-5">
                  <QRCodeCard
                    wedding={wedding}
                    qrDataUrl={qrDataUrl}
                    display={theme.display}
                    onOpenVault={() => selectSection("memories")}
                  />
                </div>
              </div>

              {/* Platinum keepsakes */}
              {caps.qrDesignCards ? (
                <div className="border-t pt-10 vault-line">
                  <h2 className="font-display text-2xl font-semibold tracking-tight vault-ink sm:text-3xl">
                    Platinum QR design cards
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm vault-muted">
                    Platinum couples choose how their printed QR cards look. Pick a style and the
                    live preview updates.
                  </p>
                  <div className="mt-6">
                    <QrDesignSwitcher wedding={wedding} qrDataUrl={qrDataUrl} />
                  </div>
                </div>
              ) : null}

              {caps.flipbook ? (
                <div className="border-t pt-10 vault-line">
                  <h2 className="font-display text-2xl font-semibold tracking-tight vault-ink sm:text-3xl">
                    Interactive flipbook
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm vault-muted">
                    Platinum presents the same memories as a page-flip keepsake. Turn the pages —
                    keyboard, touch and click are all supported.
                  </p>
                  <div className="mt-6">
                    <Flipbook wedding={wedding} />
                  </div>
                  <p className="mt-3 text-[11px] vault-muted">
                    Demo keepsake built from this fictional wedding&apos;s sample memories.
                  </p>
                </div>
              ) : null}

              {caps.downloads === "extended" ? (
                <div className="border-t pt-10 vault-line">
                  <h2 className="font-display text-2xl font-semibold tracking-tight vault-ink sm:text-3xl">
                    Download the vault
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm vault-muted">
                    Platinum keeps the download window open for {caps.downloadDays} days after the
                    wedding date. Try the demonstration below.
                  </p>
                  <div className="mt-6">
                    <DownloadDemo downloadDays={caps.downloadDays} coupleNames={wedding.coupleNames} />
                  </div>
                </div>
              ) : null}

              {/* Tier CTA */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-8 vault-line">
                <p className="text-sm vault-muted">
                  This is the {tier} experience for a fictional couple. Want it for your wedding?
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/register"
                    className="inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-bold vault-accent-bg"
                  >
                    Create your vault
                    <IconArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/examples"
                    className="inline-flex h-11 items-center rounded-full border px-6 text-sm font-semibold transition-colors vault-line vault-ink vault-hover-accent"
                  >
                    Explore more examples
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <footer className="border-t vault-line">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-3 py-8 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 vault-muted">
            <p>
              {wedding.coupleNames} · {tier} demo vault — fictional data for demonstration only.
            </p>
            <p>Vow Vault · interactive example</p>
          </div>
        </footer>
      </div>

      {introActive && caps.introMedia && !introSeen ? (
        <PlatinumIntro wedding={wedding} display={theme.display} onEnter={enterVault} />
      ) : null}
    </div>
  );
}
