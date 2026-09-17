/**
 * DemoNotice — a consistent, visible marker for demo behaviour.
 *
 * Every interactive example clearly states that it is a fictional demo and
 * that nothing is uploaded, saved or sent to a server. Demos are allowed;
 * deception is not.
 */

import type { ReactNode } from "react";

import { IconSparkle } from "@/components/icons";
import { cn } from "@/lib/utils";

export function DemoNotice({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "inline-flex items-start gap-2 rounded-2xl border border-dashed px-3.5 py-2 text-xs leading-relaxed",
        className,
      )}
      style={{ borderColor: "color-mix(in srgb, var(--vault-accent, currentColor) 45%, transparent)" }}
    >
      <IconSparkle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
