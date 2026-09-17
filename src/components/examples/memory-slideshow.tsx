"use client";

/**
 * MemorySlideshow — Gold+ auto-playing memory slideshow.
 *
 * Previous / Next / Play / Pause, a working progress bar, and automatic
 * rotation through the demo gallery. Auto-advance is disabled when the user
 * prefers reduced motion until they explicitly press play.
 */

import { useEffect, useState } from "react";

import type { VaultMemory } from "@/lib/examples/demo-derive";
import { useReducedMotion } from "@/components/ui/use-reduced-motion";
import { MemoryVisual } from "./memory-visual";

export function MemorySlideshow({
  memories,
  coupleNames,
  autoPlayMs = 3200,
}: {
  memories: VaultMemory[];
  coupleNames: string;
  autoPlayMs?: number;
}) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [manualPlay, setManualPlay] = useState(false);
  const total = memories.length;

  // Handles the (impossible in practice) case of a shrinking collection
  // without an effect: the displayed index is always clamped into range.
  const safeIndex = total > 0 ? Math.min(index, total - 1) : 0;

  const auto = playing && total > 1 && (!reduced || manualPlay);

  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % total);
    }, autoPlayMs);
    return () => window.clearInterval(timer);
  }, [auto, autoPlayMs, total]);

  if (total === 0) return null;
  const current = memories[safeIndex];

  function go(delta: number) {
    setIndex((value) => (value + delta + total) % total);
  }

  function toggle() {
    setManualPlay(true);
    setPlaying((value) => !value);
  }

  return (
    <section aria-label="Memory slideshow">
      <div className="overflow-hidden border vault-radius vault-line vault-surface">
        <div className="relative aspect-video w-full overflow-hidden">
          <MemoryVisual memory={current} className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-4 pt-14 vault-scrim">
            <p className="font-display text-lg font-semibold vault-ink">{current.caption}</p>
            <p className="text-xs vault-muted">
              {coupleNames} — demo slideshow memory {index + 1} of {total}
            </p>
          </div>
          <span className="absolute left-3 top-3 rounded-full bg-brand-ink/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-ivory">
            Slideshow · demo
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 vault-line">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous slide"
            className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors vault-line vault-ink vault-hover-accent"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <button
            type="button"
            onClick={toggle}
            className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-transform hover:scale-[1.02] vault-accent-bg"
          >
            {playing ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 7 5.5Z" />
              </svg>
            )}
            {playing ? "Pause" : "Play"}
          </button>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
              {memories.map((memory, dotIndex) => (
                <span
                  key={memory.id}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: dotIndex === index ? "1.4rem" : "0.375rem",
                    background:
                      dotIndex === index
                        ? "var(--vault-accent)"
                        : "color-mix(in srgb, var(--vault-muted) 45%, transparent)",
                  }}
                />
              ))}
            </div>
            <span className="text-xs font-semibold tabular-nums vault-muted">
              {index + 1} / {total}
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next slide"
              className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors vault-line vault-ink vault-hover-accent"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {reduced && !manualPlay ? (
        <p className="mt-2 text-xs vault-muted">
          Auto-play is paused because your device requests reduced motion. Press Play to start it.
        </p>
      ) : null}
    </section>
  );
}
