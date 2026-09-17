"use client";

/**
 * FaqAccordion — marketing FAQ that wraps the Accordion primitive with
 * the content-layer { q, a } shape. Optional `category` grouping.
 */

import {
  Accordion,
  type AccordionItemData,
} from "@/components/ui/accordion";
import type { FaqQuestion } from "@/content/faqs";

interface FaqAccordionProps {
  items: readonly FaqQuestion[];
  /** Limit to the first N items (homepage uses a subset). */
  limit?: number;
}

export function FaqAccordion({ items, limit }: FaqAccordionProps) {
  const visible = limit ? items.slice(0, limit) : items;

  const mapped: AccordionItemData[] = visible.map((item, index) => ({
    id: `faq-${index}`,
    question: (
      <span className="flex items-start gap-3">
        <span className="shrink-0 rounded-md bg-blush px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-deep">
          {item.category}
        </span>
        <span>{item.q}</span>
      </span>
    ),
    answer: item.a,
  }));

  return <Accordion items={mapped} defaultOpenIndex={0} marker="plus" />;
}