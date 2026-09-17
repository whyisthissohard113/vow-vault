"use client";

/**
 * Flipbook — interactive 3D page-flip album.
 *
 * Desktop: two-page spread with a realistic rotateY page-flip animation.
 * Mobile: single-page swipe with a subtle translateX transition.
 * Touch swipe support, keyboard navigation, reduced-motion handling.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { WeddingDemo, DemoImage } from "./types";
import { DemoArtwork } from "./demo-artwork";
import { useReducedMotion } from "@/components/ui/use-reduced-motion";
import { cn } from "@/lib/utils";

interface Spread {
  id: number;
  left: DemoImage | null;
  right: DemoImage | null;
}

function buildSpreads(images: DemoImage[]): Spread[] {
  const spreads: Spread[] = [];
  for (let i = 0; i < images.length; i += 2) {
    spreads.push({
      id: spreads.length,
      left: images[i] ?? null,
      right: images[i + 1] ?? null,
    });
  }
  return spreads;
}

const FLIP_DURATION_MS = 620;

export function Flipbook({
  wedding,
  className,
}: {
  wedding: WeddingDemo;
  className?: string;
}) {
  const spreads = useMemo(() => buildSpreads(wedding.gallery), [wedding.gallery]);
  const total = spreads.length;
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"next" | "prev">("next");
  const [isMobile, setIsMobile] = useState(false);
  const reduced = useReducedMotion();
  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect mobile after mount and keep it current across resizes
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const flip = useCallback(
    (direction: "next" | "prev") => {
      if (isFlipping || reduced) {
        if (direction === "next" && spreadIndex < total - 1) setSpreadIndex((p) => p + 1);
        if (direction === "prev" && spreadIndex > 0) setSpreadIndex((p) => p - 1);
        return;
      }
      setIsFlipping(true);
      setFlipDirection(direction);
      window.setTimeout(() => {
        if (direction === "next") setSpreadIndex((p) => Math.min(p + 1, total - 1));
        else setSpreadIndex((p) => Math.max(p - 1, 0));
        setIsFlipping(false);
      }, FLIP_DURATION_MS);
    },
    [isFlipping, reduced, spreadIndex, total],
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      flip("next");
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      flip("prev");
    }
  }

  const containerStyle: CSSProperties = {
    perspective: "1200px",
    transformStyle: "preserve-3d",
  };

  const flipDuration = reduced ? "0ms" : `${FLIP_DURATION_MS}ms`;
  const flipEasing = "cubic-bezier(0.4, 0, 0.2, 1)";

  return (
    <div className={cn("overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-card)]", className)}>
      <div className="flex items-center justify-between border-b border-line-soft bg-ivory px-5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent-deep">
          Digital Flipbook
        </p>
        <span className="text-xs font-semibold text-muted">
          {spreadIndex + 1} / {total}
        </span>
      </div>

      <div
        ref={containerRef}
        role="group"
        aria-label={`${wedding.coupleNames} flipbook, page ${spreadIndex + 1} of ${total}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null) return;
          const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
          if (Math.abs(delta) > 48) {
            flip(delta < 0 ? "next" : "prev");
          }
          touchStartX.current = null;
        }}
        className="relative cursor-pointer select-none"
        style={containerStyle}
        onClick={(event) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          const x = event.clientX - rect.left;
          flip(x < rect.width / 2 ? "prev" : "next");
        }}
      >
        {/* Book body */}
        <div className="mx-auto my-6 flex max-w-3xl items-center justify-center overflow-hidden sm:my-10 sm:gap-px" style={{ transformStyle: "preserve-3d" }}>
          {isMobile ? (
            /* ── Mobile: single page ── */
            <div className="relative h-[20rem] w-full">
              {/* Arriving page (behind) */}
              {!reduced && isFlipping ? (
                <div
                  className="absolute inset-0 bg-surface"
                  style={{
                    transform: `rotateY(${flipDirection === "next" ? "180deg" : "-180deg"})`,
                    backfaceVisibility: "hidden",
                    transformOrigin: flipDirection === "next" ? "right center" : "left center",
                  }}
                >
                  {spreads[spreadIndex]?.left ? (
                    <DemoArtwork image={spreads[spreadIndex].left!} className="h-full w-full" />
                  ) : (
                    <div className="h-full w-full bg-ivory" />
                  )}
                </div>
              ) : null}
              {/* Current page */}
              <div
                className="absolute inset-0"
                style={{
                  transform: isFlipping
                    ? `rotateY(${flipDirection === "next" ? "-180deg" : "180deg"})`
                    : "rotateY(0deg)",
                  backfaceVisibility: "hidden",
                  transformOrigin: flipDirection === "next" ? "left center" : "right center",
                  transition: `transform ${flipDuration} ${flipEasing}`,
                }}
              >
                {spreads[spreadIndex]?.left ? (
                  <DemoArtwork image={spreads[spreadIndex].left!} className="h-full w-full" />
                ) : (
                  <div className="h-full w-full bg-ivory" />
                )}
              </div>
            </div>
          ) : (
            /* ── Desktop: two-page spread ── */
            <div className="flex h-[22rem] w-full items-stretch" style={{ transformStyle: "preserve-3d" }}>
              {/* Left page (static, front) */}
              <div className="relative w-1/2 overflow-hidden bg-surface">
                {spreads[spreadIndex]?.left ? (
                  <DemoArtwork image={spreads[spreadIndex].left!} className="h-full w-full" />
                ) : (
                  <div className="h-full w-full bg-ivory" />
                )}
              </div>

              {/* Right page (animates on flip) */}
              <div
                className="relative z-10 w-1/2 overflow-hidden bg-surface"
                style={{
                  transformStyle: "preserve-3d",
                  transform: isFlipping
                    ? `rotateY(${flipDirection === "next" ? "-180deg" : "180deg"})`
                    : "rotateY(0deg)",
                  transformOrigin: flipDirection === "next" ? "left center" : "right center",
                  transition: `transform ${flipDuration} ${flipEasing}`,
                  backfaceVisibility: "hidden",
                }}
              >
                {spreads[spreadIndex]?.right ? (
                  <DemoArtwork image={spreads[spreadIndex].right!} className="h-full w-full" />
                ) : (
                  <div className="h-full w-full bg-ivory" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Page-turn hints */}
        {!isFlipping && (
          <>
            {spreadIndex > 0 ? (
              <span aria-hidden="true" className="pointer-events-none absolute bottom-6 left-2 rounded-full bg-surface/80 px-3 py-1 text-[11px] font-semibold text-ink shadow-[var(--shadow-soft)] transition-opacity sm:left-4">
                &larr; Turn left
              </span>
            ) : null}
            {spreadIndex < total - 1 ? (
              <span aria-hidden="true" className="pointer-events-none absolute bottom-6 right-2 rounded-full bg-surface/80 px-3 py-1 text-[11px] font-semibold text-ink shadow-[var(--shadow-soft)] transition-opacity sm:right-4">
                Turn right &rarr;
              </span>
            ) : null}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between border-t border-line-soft bg-surface px-5 py-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            flip("prev");
          }}
          disabled={spreadIndex === 0}
          aria-label="Previous spread"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-blush disabled:opacity-40"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <p className="text-xs font-semibold text-muted">
          Pages {spreadIndex * 2 + 1}–{Math.min(spreadIndex * 2 + 2, wedding.gallery.length)} of {wedding.gallery.length}
        </p>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            flip("next");
          }}
          disabled={spreadIndex === total - 1}
          aria-label="Next spread"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-blush disabled:opacity-40"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}