/**
 * PackageFeatureGate — the tasteful upgrade prompt shown where a package does
 * not include a feature. This keeps the examples useful as sales tools while
 * never presenting a locked capability as active.
 */

import Link from "next/link";

import { IconArrowRight, IconLock } from "@/components/icons";

export function PackageFeatureGate({
  title,
  copy,
  ctaLabel,
  href,
  className,
}: {
  title: string;
  copy: string;
  ctaLabel: string;
  href: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden border border-dashed p-6 text-center vault-radius vault-line vault-surface ${className ?? ""}`}
    >
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full vault-accent-soft vault-accent">
        <IconLock className="h-5 w-5" />
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold tracking-tight vault-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed vault-muted">{copy}</p>
      <Link
        href={href}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-bold uppercase tracking-wider transition-transform hover:scale-[1.02] vault-accent-bg"
      >
        {ctaLabel}
        <IconArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
