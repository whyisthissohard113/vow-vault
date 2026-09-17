"use client";

/**
 * LiveSlideshow — functional demo slideshow with Play/Pause, Prev/Next,
 * fullscreen and a simulated "Live memories" indicator. Auto-advance respects
 * `prefers-reduced-motion` (it pauses instead of animating through frames).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { WeddingDemo } from "./types";
import { DemoArtwork } from "./demo-artwork";
import { useReducedMotion } from "@/components/ui/use-reduced-motion";
import { cn } from "@/lib/utils";

export function LiveSlideshow({
  wedding,
  className,
  autoPlayMs = 2600,
}: {
  wedding: WeddingDemo;
  className?: string;
  autoPlayMs?: number;
}) {
  const [current, setCurrent] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [playing, setPlaying] = useState(true);
  const [liveMemories, setLiveMemories] = useState(427);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const total = wedding.gallery.length;

  const advance = useCallback(
    (delta: number) => {
      setPrevious(current);
      setCurrent((value) => (value + delta + total) % total);
    },
    [current, total],
  );

  useEffect(() => {
    if (!playing || reduced) return;
    const timer = window.setInterval(() => advance(1), autoPlayMs);
    return () => window.clearInterval(timer);
  }, [playing, reduced, autoPlayMs, advance]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setLiveMemories((value) => value + Math.floor(Math.random() * 3));
    }, 7000);
    return () => window.clearInterval(tick);
  }, []);

  async function toggleFullscreen() {
    const node = containerRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await node.requestFullscreen();
      }
    } catch {
      // Fullscreen may be unavailable; the control simply no-ops.
    }
  }

  const currentImage = wedding.gallery[current];

  return (
    <div
      ref={containerRef}
      className={cn(
        "overflow-hidden rounded-3xl border border-line bg-brand-ink shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="relative aspect-video w-full">
        {previous !== null ? (
          <div className="absolute inset-0 transition-opacity duration-700 ease-[var(--ease-out-soft)] opacity-0">
            <DemoArtwork image={wedding.gallery[previous]} className="h-full w-full" />
          </div>
        ) : null}
        <div className="absolute inset-0 transition-opacity duration-700 ease-[var(--ease-out-soft)] opacity-100">
          <DemoArtwork image={currentImage} className="h-full w-full" />
        </div>

        {/* Top overlay */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-ink/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-ivory backdrop-blur">
            <span aria-hidden="true" className="h-2 w-2 animate-live-pulse rounded-full bg-red-400" />
            Live memories
          </span>
          <span className="rounded-full bg-brand-ink/70 px-3 py-1.5 text-xs font-semibold text-ivory backdrop-blur">
            {liveMemories} this hour
          </span>
        </div>

        {/* Caption */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-ink/80 to-transparent px-5 pb-4 pt-12">
          <p className="font-display text-lg font-semibold text-ivory">{currentImage.caption}</p>
          <p className="text-xs text-ivory/70">{wedding.coupleNames} — guest perspective</p>
        </div>

        {/* Progress dots */}
        <div className="absolute bottom-3 right-4 hidden gap-1.5 sm:flex" aria-hidden="true">
          {wedding.gallery.map((image, index) => (
            <span
              key={image.id}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === current ? "w-6 bg-accent-glow" : "w-1.5 bg-ivory/40",
              )}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 bg-surface px-5 py-3">
        <button
          type="button"
          onClick={() => advance(-1)}
          aria-label="Previous slide"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-blush"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          aria-label={playing ? "Pause slideshow" : "Play slideshow"}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-ivory transition-colors hover:bg-brand-soft"
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

        <div className="flex items-center gap-2">
          <span className="hidden text-xs font-semibold text-muted sm:inline">
            {current + 1} / {total}
          </span>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Toggle fullscreen"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-blush"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}