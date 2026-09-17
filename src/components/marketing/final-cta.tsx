/**
 * FinalCta — the dark conversion band at the end of marketing pages.
 */

import Link from "next/link";
import { IconArrowRight, IconHeart } from "@/components/icons";
import { PRIMARY_CTA } from "@/content/site";
import { Reveal } from "@/components/ui/reveal";

export function FinalCta() {
  return (
    <section className="container-page pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-brand-ink px-6 py-16 text-center sm:px-16 sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_70%_at_50%_0%,rgba(176,141,87,0.28),transparent_72%)]"
          />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-accent-glow">
              <IconHeart className="h-3.5 w-3.5" />
              Ready when you are
            </span>
            <h2 className="mx-auto mt-6 max-w-2xl font-display text-3xl font-semibold tracking-tight text-ivory sm:text-4xl lg:text-5xl">
              Your guests are going to take the photos anyway.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ivory/70">
              You may as well get to see them. Create a vault in about two minutes — no
              app, no guest accounts, no technical skills.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={PRIMARY_CTA.href}
                className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-accent px-8 text-sm font-bold text-brand-ink shadow-[var(--shadow-gold)] transition-all hover:bg-accent-glow"
              >
                {PRIMARY_CTA.label}
                <IconArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/examples"
                className="inline-flex h-13 items-center justify-center rounded-full border border-ivory/25 px-8 text-sm font-semibold text-ivory transition-colors hover:bg-ivory hover:text-brand-ink"
              >
                Explore example vaults
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}