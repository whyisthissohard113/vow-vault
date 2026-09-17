import type { Metadata } from "next";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { BeforeDuringAfter } from "@/components/marketing/before-during-after";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCta } from "@/components/marketing/final-cta";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { DEMO_STEPS } from "@/content/howItWorks";
import { EXAMPLES } from "@/content/examples";
import { GuestUpload } from "@/components/wedding/guest-upload";
import { QRPreview } from "@/components/wedding/qr-preview";
import { SITE_NAME } from "@/content/site";

export const metadata: Metadata = {
  title: `How It Works — ${SITE_NAME}`,
  description:
    "Create a vault in two minutes, share your QR code, and watch every guest's photos and videos land in one private place — at original quality.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  const wedding = EXAMPLES[2]; // garden-wedding — Gold

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <section className="container-page pb-10 pt-16 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading
            as="h1"
            eyebrow="How it works"
            title="From two minutes of setup to a lifetime of memories"
            lead="Vow Vault is deliberately simple: create, share, collect, relive. Your guests do the heavy lifting — you just enjoy the result."
          />
        </div>
      </section>

      {/* Four demo steps with visuals */}
      <section className="container-page pb-20">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_24rem] lg:gap-14">
          <ol className="space-y-8">
            {DEMO_STEPS.map((step, index) => (
              <Reveal key={step.id} delay={80 * index}>
                <li className="relative flex gap-5">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand font-display text-sm font-semibold text-accent-glow"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-deep">{step.label}</p>
                    <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                      {step.title}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">{step.body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>

          {/* Visual column */}
          <div className="space-y-4" aria-hidden="true">
            <div className="card-soft p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-faint">The QR card your guests see</p>
              <div className="mt-4">
                <QRPreview wedding={wedding} compact />
              </div>
            </div>
            <div className="card-soft p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-faint">What happens next — guest upload</p>
              <div className="mt-4">
                <GuestUpload wedding={wedding} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <BeforeDuringAfter />

      <FaqSection limit={4} />

      <FinalCta />

      <SiteFooter />
    </div>
  );
}