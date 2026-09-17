"use client";

/**
 * PlatinumIntro — the optional intro experience shown before the Platinum
 * vault. The visitor can enter immediately or skip; the chosen state is stored
 * for the current browser session so the intro is not shown repeatedly.
 */

import { useEffect, useState } from "react";

import type { WeddingDemo } from "@/content/examples";
import { DemoArtwork } from "@/components/wedding/demo-artwork";
import { IconPlay, IconSparkle } from "@/components/icons";
import { cn } from "@/lib/utils";

export function PlatinumIntro({
  wedding,
  display,
  onEnter,
}: {
  wedding: WeddingDemo;
  display: boolean;
  onEnter: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const artwork = wedding.gallery[1] ?? wedding.gallery[0];

  return (
    <div
      className={cn(
        "fixed inset-0 z-[90] flex items-center justify-center bg-brand-ink transition-opacity duration-700",
        mounted ? "opacity-100" : "opacity-0",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={`${wedding.coupleNames} intro`}
    >
      <div className="absolute inset-0" aria-hidden="true">
        <DemoArtwork image={artwork} className="h-full w-full" />
        <div className="absolute inset-0 bg-brand-ink/70" />
      </div>

      <div className="relative mx-4 flex max-w-xl flex-col items-center gap-4 px-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-ivory/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-accent-glow">
          <IconSparkle className="h-3.5 w-3.5" />
          Intro media · demo
        </span>

        <h2 className={cn("text-4xl font-semibold tracking-tight text-ivory sm:text-5xl", display ? "font-display" : "")}>
          {wedding.coupleNames}
        </h2>
        <p className="text-base text-ivory/85">{wedding.dateLabel}</p>
        <p className="text-sm text-ivory/70">{wedding.venue}</p>

        <p className="mt-2 max-w-md text-sm leading-relaxed text-ivory/70">
          Platinum vaults open with an intro film or image before the gallery. This demonstration
          uses the same wedding artwork.
        </p>

        <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onEnter}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-7 text-sm font-bold uppercase tracking-wider text-brand-ink shadow-[var(--shadow-gold)] transition-transform hover:scale-[1.03]"
          >
            <IconPlay className="h-4 w-4" />
            Enter the vault
          </button>
          <button
            type="button"
            onClick={onEnter}
            className="text-sm font-semibold text-ivory/70 underline-offset-4 transition-colors hover:text-ivory hover:underline"
          >
            Skip intro
          </button>
        </div>
      </div>
    </div>
  );
}
