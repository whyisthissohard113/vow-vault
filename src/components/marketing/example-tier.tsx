/**
 * ExampleTier — the per-tier showcase page (Silver / Gold / Platinum).
 *
 * Content comes from `content/examples.ts` (TIER_SHOWCASES); the QR preview
 * and guest-upload visuals are rendered from a matching fictional wedding
 * demo. No real images, no storage access.
 */

import Link from "next/link";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { IconArrowRight, IconCheck, IconSparkle } from "@/components/icons";
import { TIER_SHOWCASES, EXAMPLES } from "@/content/examples";
import { TierDemo } from "@/components/wedding/tier-demo";

const TIER_WEDDING: Record<"silver" | "gold" | "platinum", (typeof EXAMPLES)[number]> = {
  silver: EXAMPLES[1], // modern-minimal — Silver
  gold: EXAMPLES[0], // classic-romance — Gold
  platinum: EXAMPLES[3], // luxury — Platinum
};

export function ExampleTier({ tier }: { tier: "silver" | "gold" | "platinum" }) {
  const showcase = TIER_SHOWCASES[tier];
  const wedding = TIER_WEDDING[tier];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <section className="container-page py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent-deep">{showcase.kicker}</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            {showcase.name}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted">{showcase.tagline}</p>
        </div>
      </section>

      {/* Feature cards */}
      <section className="container-page pb-16 sm:pb-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {showcase.features.map((feature) => (
              <div key={feature.title} className="card-soft p-6">
                <IconCheck className="h-5 w-5 text-accent-deep" />
                <h2 className="mt-3 font-display text-base font-semibold tracking-tight text-ink">{feature.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive, package-exact demo */}
      <section className="container-page pb-16 sm:pb-20" id="demo">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent-deep">
            Live {showcase.name} demo
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Try {showcase.name} with your own details
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Enter your names, date and venue below — the vault updates live. Then act
            like a guest: upload a real photo{wedding.packageTier === "Silver" ? "" : " or video"} from your
            device, leave a message, and explore every feature this package includes —
            exactly as it ships, gated by the real {showcase.name} feature list.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-6xl">
          <TierDemo tier={tier} wedding={wedding} introBody={showcase.uploadBody} bullets={showcase.bullets} />
        </div>
      </section>

      {/* CTA band */}
      <section className="container-page py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl bg-brand-ink px-8 py-16 text-center sm:px-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgba(176,141,87,0.25),transparent_70%)]"
          />
          <IconSparkle className="relative mx-auto h-6 w-6 text-accent-glow" />
          <h2 className="relative mt-4 font-display text-3xl font-semibold tracking-tight text-ivory sm:text-4xl">
            {showcase.ctaTitle}
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-base text-ivory/75 sm:text-lg">{showcase.ctaBody}</p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={showcase.ctaHref}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-bold text-brand-ink shadow-[var(--shadow-gold)] transition-colors hover:bg-accent-glow"
            >
              {showcase.ctaLabel}
              <IconArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-full border border-ivory/25 px-7 text-sm font-semibold text-ivory transition-colors hover:bg-ivory hover:text-brand-ink"
            >
              Create your vault
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}