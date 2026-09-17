import type { Metadata } from "next";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Pricing } from "@/components/marketing/pricing";
import { FinalCta } from "@/components/marketing/final-cta";
import { ExampleCard, TierExampleCard, type TierCardData } from "@/components/examples/example-card";
import { EXAMPLES, TIER_SHOWCASES } from "@/content/examples";
import { TIER_DEMOS } from "@/lib/examples/tier-demos";
import { SITE_NAME } from "@/content/site";

export const metadata: Metadata = {
  title: `Example Vaults — ${SITE_NAME}`,
  description:
    "Explore real-feeling wedding vaults and experience what your guests will see on the big day. Six fictional themed weddings, plus the Silver, Gold and Platinum package experiences.",
  alternates: { canonical: "/examples" },
};

const TIER_CARDS: TierCardData[] = [
  {
    tier: "silver",
    label: "Silver",
    tagline: TIER_SHOWCASES.silver.tagline,
    highlights: ["Photo gallery", "Guest uploads", "QR access", "Custom colours"],
  },
  {
    tier: "gold",
    label: "Gold",
    tagline: TIER_SHOWCASES.gold.tagline,
    highlights: ["Video", "Live slideshow", "Custom banner", "Unlimited photos*"],
  },
  {
    tier: "platinum",
    label: "Platinum",
    tagline: TIER_SHOWCASES.platinum.tagline,
    highlights: ["Intro media", "Flipbook", "QR design cards", "90-day downloads"],
  },
];

export default function ExamplesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      {/* Page hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ background: "radial-gradient(60% 55% at 50% 0%, rgba(176,141,87,0.16), transparent 72%)" }}
        />
        <div className="container-page relative pb-10 pt-16 sm:pt-20">
          <div className="mx-auto max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent-deep">
              Examples
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              See Vow Vault in action
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              Explore real-feeling wedding vaults and experience what your guests will see on the
              big day. Every couple, venue, guest and memory below is fictional demo data — but
              every interaction is the real product feel.
            </p>
            <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-line-soft px-4 py-1.5 text-xs font-medium text-faint">
              No real photos · no real couples · nothing uploaded or stored
            </p>
          </div>
        </div>
      </section>

      {/* Six themed demo vaults */}
      <section id="examples" className="container-page py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent-deep">
              Six themed vaults
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Pick a wedding style to explore
            </h2>
          </div>
          <p className="max-w-sm text-sm text-muted">
            Each opens as a full-screen, interactive vault — open any memory, add a photo, leave a
            message.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {EXAMPLES.map((wedding) => (
            <ExampleCard key={wedding.id} wedding={wedding} />
          ))}
        </div>
      </section>

      {/* Package experiences */}
      <section className="border-y border-line-soft bg-ivory-deep/60">
        <div className="container-page py-12 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent-deep">
                Silver · Gold · Platinum
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Explore each package as a real vault
              </h2>
            </div>
            <p className="max-w-sm text-sm text-muted">
              Same product, different capabilities — exactly as the real packages ship. Capability
              gates come from the canonical feature list.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {TIER_DEMOS.map((demo) => (
              <TierExampleCard
                key={demo.slug}
                data={TIER_CARDS.find((card) => card.tier.toLowerCase() === demo.slug) ?? TIER_CARDS[0]}
                wedding={demo.wedding}
              />
            ))}
          </div>

          <p className="mt-6 text-xs text-faint">
            *Unlimited is an entitlement, not an absence of fair-use safeguards.
          </p>
        </div>
      </section>

      <Pricing />

      <FinalCta />

      <SiteFooter />
    </div>
  );
}