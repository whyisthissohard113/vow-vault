/**
 * Features — the 10 core features grid. Maps `FeatureIconKey` from
 * `content/features.ts` to the shared icon set.
 */

import {
  IconQr,
  IconPhoto,
  IconPlay,
  IconEye,
  IconLock,
  IconHeart,
  IconCamera,
  IconTemplate,
  IconCard,
  IconSparkle,
} from "@/components/icons";
import { FEATURES, type FeatureIconKey } from "@/content/features";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";

const ICONS: Record<FeatureIconKey, typeof IconQr> = {
  qr: IconQr,
  "unlimited-photos": IconPhoto,
  video: IconPlay,
  slideshow: IconEye,
  lock: IconLock,
  guestbook: IconHeart,
  album: IconCamera,
  flipbook: IconTemplate,
  "qr-cards": IconCard,
  "custom-page": IconSparkle,
};

export function Features() {
  return (
    <section id="features" className="border-y border-line-soft bg-ivory-deep/60">
      <div className="container-page py-20 sm:py-24">
        <SectionHeading
          eyebrow="What's inside"
          title="The vault your guests fill"
          lead="Every experience below is part of the product — from the QR code on your tables to the flipbook you keep forever."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const Icon = ICONS[feature.icon];
            return (
              <Reveal key={feature.id} delay={80 * (index % 3)}>
                <article className="card-soft group h-full p-7 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-accent-glow transition-colors group-hover:bg-accent-deep group-hover:text-ivory">
                      <Icon className="h-6 w-6" />
                    </span>
                    {feature.tierBadge ? (
                      <span className="rounded-full bg-blush px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-deep">
                        {feature.tierBadge}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold tracking-tight text-ink">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-accent-deep">{feature.short}</p>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{feature.long}</p>
                  {feature.example ? (
                    <p className="mt-4 rounded-xl bg-blush/60 px-3.5 py-2.5 text-xs leading-relaxed text-muted">
                      <span className="font-semibold text-ink">For example — </span>
                      {feature.example}
                    </p>
                  ) : null}
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}