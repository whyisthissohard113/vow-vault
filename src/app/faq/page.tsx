import type { Metadata } from "next";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { FinalCta } from "@/components/marketing/final-cta";
import { SectionHeading } from "@/components/ui/section-heading";
import { FAQS } from "@/content/faqs";
import { SITE_NAME } from "@/content/site";

export const metadata: Metadata = {
  title: `FAQ — ${SITE_NAME}`,
  description:
    "Answers about how guests upload, upload and download windows, privacy, customization and how wedding companies use Vow Vault.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <section className="container-page pb-12 pt-16 sm:pt-20">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            as="h1"
            eyebrow="FAQ"
            title="Frequently asked questions"
            lead="Straight answers that match the product exactly — including upload and download windows calculated from your wedding date."
          />
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="mx-auto max-w-3xl">
          <FaqAccordion items={FAQS} />
        </div>
      </section>

      <FinalCta />

      <SiteFooter />
    </div>
  );
}