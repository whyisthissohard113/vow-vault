"use client";

/**
 * Tooltip — accessible hover/focus tooltip.
 *
 * Appears on hover and keyboard focus, hidden on blur. The tooltip is linked
 * to its trigger via `aria-describedby`, so screen readers announce the label.
 */

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  label: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}

export function Tooltip({ label, children, side = "top", className }: TooltipProps) {
  const id = useId();

  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-30 w-max max-w-60 -translate-x-1/2 rounded-lg border border-line bg-brand-ink px-3 py-1.5 text-center text-xs font-medium text-ivory opacity-0 shadow-[var(--shadow-soft)] transition-opacity duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        {label}
      </span>
    </span>
  );
}