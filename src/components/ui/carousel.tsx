"use client";

/**
 * Carousel — accessible, swipe-friendly indexed carousel.
 *
 * Each slide is a `role="group"` with `aria-roledescription="slide"` and a
 * labelled live region announces the current slide. Prev/Next buttons and
 * optional dots; touch swipes navigate on touch devices. Reduced-motion users
 * get instant slide changes (no transition).
 */

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/components/ui/use-reduced-motion";

export interface CarouselProps {
  items: ReactNode[];
  ariaLabel: string;
  className?: string;
  showDots?: boolean;
  /** Auto-advance interval in ms; disable with 0. */
  autoAdvanceMs?: number;
  /** Custom prev control label. */
  prevLabel?: string;
  /** Custom next control label. */
  nextLabel?: string;
}

export function Carousel({
  items,
  ariaLabel,
  className,
  showDots = true,
  autoAdvanceMs = 0,
  prevLabel = "Previous slide",
  nextLabel = "Next slide",
}: CarouselProps) {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const reduced = useReducedMotion();
  const total = items.length;

  function goTo(index: number) {
    setActive(((index % total) + total) % total);
  }

  useEffect(() => {
    if (autoAdvanceMs <= 0 || reduced) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % total);
    }, autoAdvanceMs);
    return () => window.clearInterval(timer);
  }, [autoAdvanceMs, reduced, total]);

  return (
    <div className={className}>
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={ariaLabel}
        className="relative"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null) return;
          const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
          if (Math.abs(delta) > 48) {
            goTo(active + (delta < 0 ? 1 : -1));
          }
          touchStartX.current = null;
        }}
      >
        <div aria-live="polite" className="sr-only">
          Slide {active + 1} of {total}
        </div>

        <div className="overflow-hidden">
          <div
            className={cn(
              "flex",
              reduced ? "transition-none" : "transition-transform duration-500 ease-[var(--ease-out-soft)]",
            )}
            style={{ transform: `translateX(-${active * 100}%)` }}
          >
            {items.map((item, index) => (
              <div
                key={index}
                role="group"
                aria-roledescription="slide"
                aria-label={`Slide ${index + 1} of ${total}`}
                className="w-full shrink-0"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => goTo(active - 1)}
          aria-label={prevLabel}
          className="absolute -left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-[var(--shadow-soft)] transition-colors hover:bg-blush sm:flex"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => goTo(active + 1)}
          aria-label={nextLabel}
          className="absolute -right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-[var(--shadow-soft)] transition-colors hover:bg-blush sm:flex"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      {showDots ? (
        <div className="mt-6 flex items-center justify-center gap-2" role="tablist" aria-label={`${ariaLabel} navigation`}>
          {items.map((_, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={`Go to slide ${index + 1}`}
              onClick={() => goTo(index)}
              className={cn(
                "h-2.5 rounded-full transition-all",
                index === active
                  ? "w-8 bg-accent"
                  : "w-2.5 bg-line hover:bg-accent/50",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}