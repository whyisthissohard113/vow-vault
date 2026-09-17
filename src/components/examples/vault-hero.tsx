"use client";

/**
 * VaultHero — the couple hero/banner at the top of an interactive demo vault.
 *
 * Gold+ packages get the full-bleed "banner image" treatment; Silver uses a
 * cleaner split composition. Each theme supplies its own typography, radius
 * and surfaces via `vaultStyleVars()` on the vault root.
 */

import type { WeddingDemo } from "@/content/examples";
import type { VaultTheme } from "@/lib/examples/vault-themes";
import { DemoArtwork } from "@/components/wedding/demo-artwork";
import { IconArrowRight, IconSparkle } from "@/components/icons";
import { cn } from "@/lib/utils";

export function VaultHero({
  wedding,
  theme,
  banner,
  tierLabel,
  onExplore,
}: {
  wedding: WeddingDemo;
  theme: VaultTheme;
  /** Gold+ vaults demonstrate the custom banner treatment. */
  banner: boolean;
  tierLabel: string;
  onExplore: () => void;
}) {
  const cover = wedding.gallery[0];
  const displayClass = theme.display ? "font-display" : "";
  const useBanner = banner || theme.hero === "banner";

  const meta = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="vault-muted">{wedding.dateLabel}</span>
      <span aria-hidden="true" className="vault-muted">
        ·
      </span>
      <span className="vault-muted">{wedding.venue}</span>
    </div>
  );

  const badges = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full vault-accent-soft px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] vault-accent">
        {tierLabel} demo vault
      </span>
      <span className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] vault-muted vault-line">
        Demo wedding · fictional couple
      </span>
      {banner ? (
        <span className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] vault-muted vault-line">
          Custom banner image
        </span>
      ) : null}
    </div>
  );

  const exploreButton = (
    <button
      type="button"
      onClick={onExplore}
      className="inline-flex h-12 items-center gap-2 rounded-full vault-accent-bg px-7 text-sm font-bold uppercase tracking-wider shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.03]"
    >
      Explore Memories
      <IconArrowRight className="h-4 w-4" />
    </button>
  );

  if (useBanner) {
    return (
      <header className="relative overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <DemoArtwork image={cover} className="h-full w-full" />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, color-mix(in srgb, ${theme.bg} 55%, transparent), color-mix(in srgb, ${theme.bg} 88%, transparent))`,
            }}
          />
        </div>
        <div className="relative mx-auto flex min-h-[26rem] w-full max-w-6xl flex-col items-center justify-center gap-5 px-6 py-20 text-center sm:min-h-[30rem]">
          {badges}
          <h1 className={cn("text-4xl font-semibold tracking-tight vault-ink sm:text-6xl", displayClass)}>
            {wedding.coupleNames}
          </h1>
          <p className={cn("text-lg vault-accent", displayClass)}>{wedding.theme}</p>
          {meta}
          <div className="mt-2">{exploreButton}</div>
        </div>
      </header>
    );
  }

  return (
    <header className="relative overflow-hidden">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col items-start gap-5">
          {badges}
          <h1 className={cn("text-4xl font-semibold tracking-tight vault-ink sm:text-5xl", displayClass)}>
            {wedding.coupleNames}
          </h1>
          <p className={cn("text-lg vault-accent", displayClass)}>{wedding.theme}</p>
          {meta}
          {exploreButton}
        </div>
        <div className="relative mx-auto w-full max-w-md">
          <DemoArtwork
            image={cover}
            className="aspect-[4/5] w-full vault-radius shadow-[var(--shadow-card)]"
          />
          <span className="absolute -bottom-3 left-4 inline-flex items-center gap-1.5 rounded-full vault-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest vault-muted shadow-[var(--shadow-soft)]">
            <IconSparkle className="h-3 w-3 vault-accent" aria-hidden="true" />
            Private demo vault
          </span>
        </div>
      </div>
    </header>
  );
}
