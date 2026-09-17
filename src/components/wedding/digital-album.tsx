"use client";

/**
 * DigitalAlbum — premium album mock with spreads (desktop) and single-page
 * swipeable view (mobile). Cover → spreads → back cover. Local demo imagery.
 */

import { useMemo, useState } from "react";
import type { WeddingDemo, DemoImage } from "./types";
import { DemoArtwork } from "./demo-artwork";
import { cn } from "@/lib/utils";

function spreadPages(images: DemoImage[]): DemoImage[][] {
  const spreads: DemoImage[][] = [];
  for (let i = 0; i < images.length; i += 2) {
    spreads.push(images.slice(i, i + 2));
  }
  return spreads;
}

export function DigitalAlbum({
  wedding,
  className,
}: {
  wedding: WeddingDemo;
  className?: string;
}) {
  const spreads = useMemo(() => spreadPages(wedding.gallery), [wedding.gallery]);
  const [pageIndex, setPageIndex] = useState(0);
  const total = 2 + spreads.length; // cover + spreads + back
  const isFirst = pageIndex === 0;
  const isLast = pageIndex === total - 1;

  function prev() {
    if (!isFirst) setPageIndex((p) => p - 1);
  }
  function next() {
    if (!isLast) setPageIndex((p) => p + 1);
  }

  return (
    <div className={cn("overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-card)]", className)}>
      {/* Spine hint */}
      <div className="flex items-center justify-between border-b border-line-soft bg-ivory px-5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent-deep">
          Digital Album
        </p>
        <span className="text-xs font-semibold text-muted">
          {isFirst ? "Cover" : isLast ? "End" : `${pageIndex} / ${total - 2}`}
        </span>
      </div>

      {/* Page area */}
      <div
        className={cn(
          "flex min-h-[24rem] items-center justify-center overflow-hidden bg-ivory",
          !isFirst && !isLast ? "bg-surface" : "",
        )}
      >
        {/* Cover */}
        {isFirst ? (
          <div className="flex h-[24rem] w-full flex-col items-center justify-center p-6 text-center sm:h-[28rem]">
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-30"
              style={{ background: `linear-gradient(135deg, ${wedding.colors.theme}, ${wedding.colors.accent})` }}
            />
            <div className="relative z-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-accent-deep">
                {wedding.title}
              </p>
              <h4 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                {wedding.coupleNames}
              </h4>
              <p className="mt-2 text-sm text-muted">{wedding.dateLabel} · {wedding.venue}</p>
            </div>
          </div>
        ) : isLast ? (
          <div className="flex h-[24rem] w-full flex-col items-center justify-center p-6 text-center sm:h-[28rem]">
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-20"
              style={{ background: `linear-gradient(135deg, ${wedding.colors.accent}, ${wedding.colors.theme})` }}
            />
            <div className="relative z-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-faint">
                The End
              </p>
              <h4 className="mt-2 font-display text-xl font-semibold text-ink">
                Thank you for being part of our day
              </h4>
              <p className="mt-1 text-sm text-muted">{wedding.coupleNames}</p>
            </div>
          </div>
        ) : (
          /* Spreads */
          <>
            {/* Desktop: two images side by side */}
            <div className="hidden h-[24rem] w-full sm:flex sm:h-[28rem]">
              {spreads[pageIndex - 1]?.map((image) => (
                <div key={image.id} className="relative flex-1 overflow-hidden border-line">
                  <DemoArtwork image={image} className="h-full w-full" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-ink/70 to-transparent px-4 pb-3 pt-8 text-left text-xs font-medium text-ivory">
                    {image.caption}
                  </span>
                </div>
              ))}
            </div>
            {/* Mobile: single image */}
            <div className="flex h-[24rem] w-full sm:hidden">
              {spreads[pageIndex - 1]?.map((image) => (
                <div key={image.id} className="relative flex-1 overflow-hidden border-r border-line">
                  <DemoArtwork image={image} className="h-full w-full" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-ink/70 to-transparent px-4 pb-3 pt-8 text-left text-xs font-medium text-ivory">
                    {image.caption}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between border-t border-line-soft bg-surface px-5 py-3">
        <button
          type="button"
          onClick={prev}
          disabled={isFirst}
          aria-label="Previous page"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-blush disabled:opacity-40"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <div className="flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === pageIndex ? "w-5 bg-accent" : "w-1.5 bg-line",
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={next}
          disabled={isLast}
          aria-label="Next page"
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