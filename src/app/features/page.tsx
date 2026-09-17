import type { Metadata } from "next";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Features } from "@/components/marketing/features";
import { Comparison } from "@/components/marketing/comparison";
import { Pricing } from "@/components/marketing/pricing";
import { FinalCta } from "@/components/marketing/final-cta";
import { SectionHeading } from "@/components/ui/section-heading";
import { SITE_NAME } from "@/content/site";

export const metadata: Metadata = {
  title: `Features — ${SITE_NAME}`,
  description:
    "QR guest uploads, unlimited photos, video memories, live slideshow, digital guestbook, album, flipbook and custom QR cards — everything inside every Vow Vault.",
  alternates: { canonical: "/features" },
};

export default function FeaturesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <section className="container-page pb-10 pt-16 sm:pt-20">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            as="h1"
            eyebrow="Features"
            title="Everything your wedding memory could need"
            lead="Ten core experiences — from the QR code on your tables to the flipbook you keep forever. Every package includes the private vault itself; higher tiers unlock more of the story."
          />
        </div>
      </section>

      <Features />

      <Comparison />

      <Pricing />

      <FinalCta />

      <SiteFooter />
    </div>
  );
}