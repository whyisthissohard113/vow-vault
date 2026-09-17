import type { Metadata } from "next";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Pricing } from "@/components/marketing/pricing";
import { Comparison } from "@/components/marketing/comparison";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCta } from "@/components/marketing/final-cta";
import { SectionHeading } from "@/components/ui/section-heading";
import { SITE_NAME } from "@/content/site";

export const metadata: Metadata = {
  title: `Packages & Pricing — ${SITE_NAME}`,
  description:
    "One-time packages for your wedding memory vault: Silver, Gold and Platinum. Prices in South African Rand, no per-guest or monthly fees.",
  alternates: { canonical: "/packages" },
};

export default function PackagesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <section className="container-page pb-8 pt-16 sm:pt-20">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            as="h1"
            eyebrow="Packages & pricing"
            title="Choose how much of the day you want to keep"
            lead="A one-time payment per wedding — not per guest, not per month. The vault itself is always private, always yours, always ready for your guests."
          />
        </div>
      </section>

      <Pricing />

      <Comparison />

      <FaqSection limit={6} />

      <FinalCta />

      <SiteFooter />
    </div>
  );
}