/**
 * PricingCard — one package card. Prices are sourced from the content layer,
 * which pulls from the canonical entitlements module.
 */

import Link from "next/link";
import { IconArrowRight, IconCheck } from "@/components/icons";
import type { PackageMarketing } from "@/content/packages";
import { cn } from "@/lib/utils";

export function PricingCard({
  pkg,
  featured = false,
}: {
  pkg: PackageMarketing;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-3xl p-8",
        featured
          ? "bg-brand text-ivory shadow-[var(--shadow-float)] ring-1 ring-accent/40"
          : "card-soft",
      )}
    >
      {pkg.badge ? (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-ivory shadow-[var(--shadow-gold)]">
          {pkg.badge}
        </span>
      ) : null}

      <p className={cn("text-xs font-bold uppercase tracking-[0.2em]", featured ? "text-accent-glow" : "text-accent-deep")}>
        {pkg.name}
      </p>
      <h3 className={cn("mt-2 font-display text-2xl font-semibold tracking-tight", featured ? "text-ivory" : "text-ink")}>
        {pkg.emotionalTitle}
      </h3>
      <p className={cn("mt-2 text-sm leading-relaxed", featured ? "text-ivory/75" : "text-muted")}>
        {pkg.emotionalBlurb}
      </p>

      <p className="mt-6 flex items-baseline gap-2">
        <span className={cn("font-display text-4xl font-semibold tracking-tight", featured ? "text-ivory" : "text-ink")}>
          {pkg.priceLabel}
        </span>
        <span className={cn("text-sm", featured ? "text-ivory/60" : "text-faint")}>once per wedding</span>
      </p>

      <ul className="mt-7 space-y-3 border-t pt-6" style={{ borderColor: featured ? "rgba(250,246,239,0.15)" : undefined }}>
        {pkg.highlights.map((highlight) => (
          <li key={highlight} className="flex items-start gap-2.5 text-sm">
            <IconCheck className={cn("mt-0.5 h-4 w-4 shrink-0", featured ? "text-accent-glow" : "text-accent-deep")} />
            <span className={cn(featured ? "text-ivory/85" : "text-muted")}>{highlight}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        <Link
          href={`/examples/${pkg.code}`}
          className={cn(
            "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all",
            featured
              ? "bg-accent text-brand-ink hover:bg-accent-glow"
              : "border border-line text-ink hover:border-brand hover:bg-brand hover:text-ivory",
          )}
        >
          {pkg.ctaLabel}
          <IconArrowRight className="h-4 w-4" />
        </Link>
        <p className={cn("mt-3 text-center text-xs", featured ? "text-ivory/55" : "text-faint")}>
          view the real {pkg.name} vault example
        </p>
      </div>
    </div>
  );
}