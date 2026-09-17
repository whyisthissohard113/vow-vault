"use client";

/**
 * Tabs — accessible tablist primitive.
 *
 * WAI-ARIA tabs pattern: arrow keys move/activate tabs, Home/End jump to
 * first/last. `aria-selected` + `tabindex=-1` roving focus. Panels are
 * labelled by their trigger.
 */

import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultIndex?: number;
  ariaLabel: string;
  className?: string;
  /** Class applied to each tab trigger. */
  tabClassName?: string;
  /** Class applied to the active tab trigger. */
  activeTabClassName?: string;
  /** Wraps content */
  panelClassName?: string;
}

export function Tabs({
  items,
  defaultIndex = 0,
  ariaLabel,
  className,
  tabClassName,
  activeTabClassName,
  panelClassName,
}: TabsProps) {
  const [active, setActive] = useState(
    Math.min(Math.max(defaultIndex, 0), items.length - 1),
  );
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let next = active;
    if (event.key === "ArrowRight") next = (active + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (active - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;

    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  const activeId = items[active]?.id ?? "";

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex flex-wrap items-center gap-1"
      >
        {items.map((item, index) => {
          const selected = index === active;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              id={`${baseId}-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={onKeyDown}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep",
                selected
                  ? cn("bg-brand text-ivory", activeTabClassName)
                  : "bg-transparent text-muted hover:bg-blush hover:text-ink",
                tabClassName,
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        key={activeId}
        id={`${baseId}-panel-${activeId}`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${activeId}`}
        tabIndex={0}
        className={cn("mt-6 focus-visible:outline-none", panelClassName)}
      >
        {items[active]?.content}
      </div>
    </div>
  );
}