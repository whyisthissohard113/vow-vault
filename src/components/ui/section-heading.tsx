/**
 * SectionHeading — consistent marketing section header: eyebrow + serif title +
 * lead paragraph. Server-safe (no hooks).
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "center" | "left";
  className?: string;
  as?: "h1" | "h2" | "h3";
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "center",
  className,
  as: Tag = "h2",
}: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <div className={cn(centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl", className)}>
      {eyebrow ? (
        <p
          className={cn(
            "flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-accent-deep",
            centered && "justify-center",
          )}
        >
          <span aria-hidden="true" className="h-px w-8 bg-accent/60" />
          {eyebrow}
          <span aria-hidden="true" className="h-px w-8 bg-accent/60" />
        </p>
      ) : null}
      <Tag
        className={cn(
          "mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl lg:text-[2.75rem] lg:leading-[1.12]",
          centered && "text-balance",
        )}
      >
        {title}
      </Tag>
      {lead ? (
        <p
          className={cn(
            "mt-5 text-base leading-relaxed text-muted sm:text-lg",
            centered && "mx-auto max-w-2xl text-pretty",
          )}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}