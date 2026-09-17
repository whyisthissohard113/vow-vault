/**
 * FaqSection — marketing FAQ block with a "still curious" link.
 * Shared by the home page and /faq.
 */

import Link from "next/link";
import { FAQS } from "@/content/faqs";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { SectionHeading } from "@/components/ui/section-heading";
import { IconArrowRight } from "@/components/icons";

interface FaqSectionProps {
  limit?: number;
}

export function FaqSection({ limit }: FaqSectionProps) {
  return (
    <section id="faq" className="container-page py-20 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.7fr] lg:gap-16">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Questions"
            title="Before you ask"
            lead="Everything you need to know about Vow Vault. Answers match the product exactly — including upload and download windows."
          />
          <Link
            href="/faq"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent-deep transition-colors hover:text-ink"
          >
            Read all the FAQs
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <FaqAccordion items={FAQS} limit={limit} />
      </div>
    </section>
  );
}