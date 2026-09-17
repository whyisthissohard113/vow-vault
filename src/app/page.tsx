import type { Metadata } from "next";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { HeroVisual } from "@/components/marketing/hero";
import { TrustBar } from "@/components/marketing/trust-bar";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ProductDemo } from "@/components/marketing/product-demo";
import { BeforeDuringAfter } from "@/components/marketing/before-during-after";
import { Features } from "@/components/marketing/features";
import { ExamplesShowcase } from "@/components/marketing/examples";
import { Pricing } from "@/components/marketing/pricing";
import { Testimonials } from "@/components/marketing/testimonials";
import { FaqSection } from "@/components/marketing/faq-section";
import { WeddingCompanyCta } from "@/components/marketing/wedding-company-cta";
import { FinalCta } from "@/components/marketing/final-cta";
import { IconQr, IconArrowRight, IconSparkle } from "@/components/icons";
import { SITE_NAME, SITE_DESCRIPTION, PRIMARY_CTA, SECONDARY_CTA, SITE_URL } from "@/content/site";
import { EXAMPLES } from "@/content/examples";

export const metadata: Metadata = {
  title: `${SITE_NAME} — Your wedding day. Captured by everyone. Preserved forever.`,
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE_NAME} — your private wedding memory vault`,
    description: SITE_DESCRIPTION,
    url: `${SITE_URL}/`,
    type: "website",
    siteName: SITE_NAME,
  },
};

export default function Home() {
  const featuredWedding = EXAMPLES[0];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(58%_46%_at_50%_0%,rgba(176,141,87,0.14),transparent_72%)]"
        />
        <div className="container-page relative grid items-center gap-16 pb-20 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent-deep shadow-[var(--shadow-soft)]">
              <IconSparkle className="h-3.5 w-3.5" />
              The private wedding memory vault
            </div>
            <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl lg:leading-[1.08]">
              Your guests took the photos.
              <span className="mt-2 block italic text-accent-deep">Now they&apos;re all yours.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Put a QR card on the tables. Guests scan it and their photos, videos and
              messages land straight in your private vault — at original quality, from any
              phone, with no app.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={PRIMARY_CTA.href}
                className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-brand px-8 text-sm font-semibold text-ivory shadow-[var(--shadow-soft)] transition-all hover:bg-brand-soft"
              >
                {PRIMARY_CTA.label}
                <IconArrowRight className="h-4 w-4" />
              </a>
              <a
                href={SECONDARY_CTA.href}
                className="inline-flex h-13 items-center justify-center rounded-full border border-line px-8 text-sm font-semibold text-ink transition-colors hover:bg-blush"
              >
                {SECONDARY_CTA.label}
              </a>
            </div>
            <p className="mt-8 flex items-center gap-2 text-sm text-faint">
              <IconQr className="h-4 w-4 text-accent-deep" />
              No app. No guest accounts. No compression.
            </p>
          </div>

          <HeroVisual className="pb-8" />
        </div>
      </section>

      {/* ── Social proof ─────────────────────────────────────────────────── */}
      <TrustBar />

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <HowItWorks showLink />

      {/* ── Interactive product demo ─────────────────────────────────────── */}
      <ProductDemo wedding={featuredWedding} />

      {/* ── Journey ──────────────────────────────────────────────────────── */}
      <BeforeDuringAfter />

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <Features />

      {/* ── Examples ─────────────────────────────────────────────────────── */}
      <ExamplesShowcase />

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <Pricing />

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <Testimonials />

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <FaqSection limit={5} />

      {/* ── For wedding companies ────────────────────────────────────────── */}
      <WeddingCompanyCta />

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <FinalCta />

      <SiteFooter />
    </div>
  );
}