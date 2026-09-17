"use client";

/**
 * GalleryLightbox — full-screen memory viewer.
 *
 * Supports next / previous / close, keyboard navigation (Escape, ArrowLeft,
 * ArrowRight) and touch swipe. Focus is moved to the viewer on open and the
 * page scroll is locked while it is shown.
 */

import { useCallback, useEffect, useRef } from "react";

import type { VaultMemory } from "@/lib/examples/demo-derive";
import { MemoryVisual } from "./memory-visual";
import { IconClose } from "@/components/icons";

export function GalleryLightbox({
  memories,
  index,
  onClose,
  onIndexChange,
  coupleNames,
}: {
  memories: VaultMemory[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  coupleNames: string;
}) {
  const touchStartX = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const total = memories.length;
  const safeIndex = ((index % total) + total) % total;
  const memory = memories[safeIndex];

  const go = useCallback(
    (delta: number) => {
      if (total === 0) return;
      onIndexChange((safeIndex + delta + total) % total);
    },
    [onIndexChange, safeIndex, total],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [go, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!memory) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${coupleNames} memory ${safeIndex + 1} of ${total}`}
      className="fixed inset-0 z-[80] flex flex-col bg-brand-ink/95 backdrop-blur-sm"
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchStartX.current === null) return;
        const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
        if (Math.abs(delta) > 48) go(delta < 0 ? 1 : -1);
        touchStartX.current = null;
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold text-ivory">{coupleNames}</p>
          <p className="text-xs text-ivory/60">
            Demo memory {safeIndex + 1} of {total}
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close gallery viewer"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-ivory/10 text-ivory transition-colors hover:bg-ivory/20"
        >
          <IconClose className="h-5 w-5" />
        </button>
      </div>

      {/* Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 sm:px-16">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous memory"
          className="absolute left-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-ivory/10 text-ivory transition-colors hover:bg-ivory/20 sm:left-4"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <MemoryVisual
          memory={memory}
          priority
          className="max-h-full max-w-full rounded-2xl object-contain shadow-[var(--shadow-float)]"
        />

        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next memory"
          className="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-ivory/10 text-ivory transition-colors hover:bg-ivory/20 sm:right-4"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Caption */}
      <div className="px-4 pb-6 pt-4 text-center sm:px-6">
        <p className="font-display text-lg font-semibold text-ivory">{memory.caption}</p>
        <p className="mt-1 text-xs text-ivory/60">
          {memory.isDemoUpload
            ? `Demo upload${memory.by ? ` by ${memory.by}` : ""} — added in this browser session only`
            : "Demo artwork — not a real wedding photograph"}
        </p>
      </div>
    </div>
  );
}
