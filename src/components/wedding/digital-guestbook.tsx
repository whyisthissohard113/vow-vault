"use client";

/**
 * DigitalGuestbook — visual guestbook mock. Cycles through the demo couple's
 * guest messages with avatar, name, message and a timestamp. Reduced-motion
 * users get instant transitions.
 */

import { useEffect, useState } from "react";
import type { WeddingDemo } from "./types";
import { DemoInitials } from "./demo-artwork";
import { IconHeart } from "@/components/icons";
import { useReducedMotion } from "@/components/ui/use-reduced-motion";
import { cn } from "@/lib/utils";

export function DigitalGuestbook({
  wedding,
  className,
  autoAdvanceMs = 4200,
}: {
  wedding: WeddingDemo;
  className?: string;
  autoAdvanceMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const entries = wedding.guestbook;

  useEffect(() => {
    if (paused || reduced) return;
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % entries.length);
    }, autoAdvanceMs);
    return () => window.clearInterval(timer);
  }, [paused, reduced, autoAdvanceMs, entries.length]);

  const entry = entries[index];
  const initials = entry.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8",
        className,
      )}
    >
      {/* Decorative quote marks */}
      <div aria-hidden="true" className="absolute -top-3 right-5 font-display text-[7rem] leading-none text-blush">
        &rdquo;
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent-deep">
          Digital Guestbook
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blush px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-ink">
          <IconHeart className="h-3 w-3 text-accent-deep" />
          {entries.length} messages
        </span>
      </div>

      <div
        key={entry.id}
        className={cn(
          "mt-6 min-h-[13rem] transition-opacity duration-500",
          reduced ? "transition-none" : "",
        )}
      >
        <div className="flex items-center gap-3">
          <DemoInitials initials={initials} className="h-12 w-12 text-sm" palette={["#efe4ce", "#b08d57"]} />
          <div>
            <p className="font-display text-lg font-semibold text-ink">{entry.name}</p>
            <p className="text-xs text-faint">{entry.moment}</p>
          </div>
        </div>
        <blockquote className="mt-4 font-display text-xl leading-relaxed text-ink sm:text-2xl">
          &ldquo;{entry.message}&rdquo;
        </blockquote>
        <p className="mt-4 text-xs font-medium uppercase tracking-widest text-faint">
          Added to the {wedding.coupleNames} vault
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-line-soft pt-4">
        <button
          type="button"
          onClick={() => {
            setPaused(true);
            setIndex((value) => (value - 1 + entries.length) % entries.length);
          }}
          aria-label="Previous message"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-blush"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <div className="flex items-center gap-2" role="tablist" aria-label="Guestbook messages">
          {entries.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show message from ${item.name}`}
              onClick={() => {
                setPaused(true);
                setIndex(i);
              }}
              className={cn(
                "h-2 rounded-full transition-all",
                i === index ? "w-7 bg-accent" : "w-2 bg-line hover:bg-accent/50",
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setPaused(true);
            setIndex((value) => (value + 1) % entries.length);
          }}
          aria-label="Next message"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-blush"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}