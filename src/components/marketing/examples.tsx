/**
 * ExamplesShowcase — grid of the six themed demo vaults. Opens the per-theme
 * example page.
 */

import Link from "next/link";
import { EXAMPLES } from "@/content/examples";
import { DemoArtwork } from "@/components/wedding/demo-artwork";
import { SectionHeading } from "@/components/ui/section-heading";
import { IconArrowRight, IconHeart } from "@/components/icons";

export function ExamplesShowcase() {
  return (
    <section id="examples" className="container-page py-20 sm:py-24">
      <SectionHeading
        eyebrow="Examples"
        title="Six ways to fall in love with your memory"
        lead="Fictional demo couples, real product experience. Pick a theme and explore the vault each one would have — every image is local demo artwork."
      />

      <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {EXAMPLES.map((example) => {
          const cover = example.gallery[1] ?? example.gallery[0];
          return (
            <Link
              key={example.id}
              href={`/examples/${example.id}`}
              className="group card-soft overflow-hidden transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card)]"
            >
              <div className="relative overflow-hidden">
                <DemoArtwork image={cover} className="aspect-[4/3] w-full transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-ink/75 to-transparent px-4 pb-3 pt-10">
                  <p className="font-display text-lg font-semibold text-ivory">{example.coupleNames}</p>
                  <p className="text-xs text-ivory/80">{example.dateLabel} · {example.venue}</p>
                </div>
                <span className="absolute right-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-bold text-accent-deep">
                  {example.packageTier}
                </span>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: example.colors.theme }}
                    aria-hidden="true"
                  />
                  <p className="text-sm font-semibold text-ink">{example.theme}</p>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{example.story}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-faint">
                    <IconHeart className="h-3.5 w-3.5 text-accent-deep" />
                    {example.gallery.length} sample memories
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent-deep">
                    Explore
                    <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}