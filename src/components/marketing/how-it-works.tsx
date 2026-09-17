/**
 * HowItWorks — the three-step journey. Used on the homepage (summary) and the
 * /how-it-works page (with extra lifecycle content).
 */

import Link from "next/link";
import { HOW_IT_WORKS_STEPS } from "@/content/howItWorks";
import { IconArrowRight } from "@/components/icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";

interface HowItWorksProps {
  showLink?: boolean;
}

export function HowItWorks({ showLink = false }: HowItWorksProps) {
  return (
    <section id="how-it-works" className="container-page py-20 sm:py-24">
      <SectionHeading
        eyebrow="How it works"
        title="Three things happen. You do one of them."
        lead="Your guests do the rest without being asked twice."
        align="center"
      />

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {HOW_IT_WORKS_STEPS.map((step) => (
          <Reveal key={step.number} delay={120 * Number(step.number[1])}>
            <div className="card-soft relative h-full overflow-hidden p-8">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-4 -top-6 font-display text-[7rem] font-semibold leading-none text-blush"
              >
                {step.number}
              </span>
              <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand font-display text-sm font-semibold text-accent-glow">
                {step.number}
              </span>
              <h3 className="relative mt-5 font-display text-xl font-semibold tracking-tight text-ink">
                {step.title}
              </h3>
              <p className="relative mt-2 text-sm font-semibold text-accent-deep">{step.lead}</p>
              <p className="relative mt-3 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      {showLink ? (
        <div className="mt-12 text-center">
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-2 text-sm font-semibold text-accent-deep transition-colors hover:text-ink"
          >
            See the full journey — before, during, after, forever
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </section>
  );
}