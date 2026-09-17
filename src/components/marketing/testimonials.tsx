"use client";

/**
 * Testimonials — carousel of demo couple stories. Every entry is fictional and
 * flagged `demo: true` in content, with a visible disclaimer here.
 */

import { Carousel } from "@/components/ui/carousel";
import { TESTIMONIALS } from "@/content/testimonials";
import { SectionHeading } from "@/components/ui/section-heading";
import { IconHeart } from "@/components/icons";

export function Testimonials() {
  return (
    <section id="stories" className="border-y border-line-soft bg-blush/50">
      <div className="container-page py-20 sm:py-24">
        <SectionHeading
          eyebrow="Couple stories"
          title="The day, from every guest's eyes"
          lead="Demo stories from fictional couples — shown here to illustrate exactly how couples describe their Vow Vault experience."
        />

        <div className="mt-14">
          <Carousel
            ariaLabel="Couple testimonials"
            items={TESTIMONIALS.map((item) => (
              <figure
                key={item.id}
                className="card-soft mx-1 flex h-full flex-col p-8"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand font-display text-sm font-semibold text-accent-glow">
                    {item.initials}
                  </span>
                  <span
                    className="rounded-full bg-blush px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-deep"
                    aria-label="Fictional demo couple"
                  >
                    Demo — fictional
                  </span>
                </div>
                <blockquote className="mt-6 font-display text-xl leading-relaxed text-ink">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 flex items-end justify-between border-t border-line-soft pt-4">
                  <div>
                    <p className="font-semibold text-ink">{item.names}</p>
                    <p className="text-sm text-faint">
                      {item.weddingType} · {item.location}
                    </p>
                  </div>
                  <IconHeart className="h-4 w-4 text-accent-deep" />
                </figcaption>
              </figure>
            ))}
          />
        </div>

        <p className="mt-6 text-center text-xs text-faint">
          All testimonials on this site are fictional demo content created to show the product.
        </p>
      </div>
    </section>
  );
}