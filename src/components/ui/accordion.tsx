"use client";

/**
 * Accordion — accessible, animated disclosure primitive.
 *
 * WAI-ARIA: each trigger is a button with `aria-expanded` + `aria-controls`;
 * each panel is a region labelled by its trigger. Panels animate open/closed
 * with the grid-rows technique; the global reduced-motion media query
 * collapses the transition in globals.css.
 */

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface AccordionItemData {
  id: string;
  question: ReactNode;
  answer: ReactNode;
}

export interface AccordionProps {
  items: AccordionItemData[];
  /** Index of the item open by default. */
  defaultOpenIndex?: number | null;
  className?: string;
  /** Render a marker on the right edge of each trigger (defaults to +/×). */
  marker?: "plus" | "chevron";
}

export function Accordion({
  items,
  defaultOpenIndex = 0,
  className,
  marker = "plus",
}: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpenIndex);
  const baseId = useId();

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item, index) => {
        const open = openIndex === index;
        const buttonId = `${baseId}-trigger-${index}`;
        const panelId = `${baseId}-panel-${index}`;

        return (
          <div
            key={item.id}
            className={cn(
              "overflow-hidden rounded-2xl border bg-surface transition-colors",
              open ? "border-accent/40 shadow-[var(--shadow-soft)]" : "border-line hover:border-accent/30",
            )}
          >
            <h3 className="m-0">
              <button
                id={buttonId}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-deep"
              >
                <span className="font-display text-base font-semibold text-ink sm:text-lg">
                  {item.question}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm transition-transform duration-300",
                    open
                      ? "rotate-45 bg-accent text-white"
                      : "bg-blush text-accent-deep",
                  )}
                >
                  {marker === "plus" ? (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  ) : (
                    <svg className={cn("h-4 w-4 transition-transform duration-300", open && "rotate-180")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  )}
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={cn(
                "grid transition-[grid-template-rows] duration-300 ease-[var(--ease-out-soft)]",
                open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="px-6 pb-6 text-sm leading-relaxed text-muted sm:text-base">
                  {item.answer}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}