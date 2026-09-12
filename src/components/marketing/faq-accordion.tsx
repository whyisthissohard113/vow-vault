"use client";

/**
 * FaqAccordion — accessible animated FAQ accordion shared by the marketing
 * pages. Client component; the data stays with the caller.
 */

import { useState } from "react";

export interface FaqItem {
  q: string;
  a: string;
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <dl className="space-y-3">
      {items.map((item, index) => {
        const open = openIndex === index;
        return (
          <div key={item.q} className="card-soft overflow-hidden">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenIndex(open ? null : index)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-sand/60"
            >
              <dt className="font-display text-base font-semibold text-stone-900">
                {item.q}
              </dt>
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-soft text-rose-brand transition-transform duration-300 ${open ? "rotate-45" : ""}`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </button>
            {open ? (
              <dd className="px-6 pb-5 text-sm leading-relaxed text-stone-600">{item.a}</dd>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}