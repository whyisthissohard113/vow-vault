/**
 * BeforeDuringAfter — the lifecycle motif: BEFORE → DURING (LIVE) → AFTER →
 * FOREVER. Used on the home page and the how-it-works page.
 */

import { LIFECYCLE_PHASES } from "@/content/howItWorks";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

export function BeforeDuringAfter() {
  return (
    <section id="journey" className="container-page py-20 sm:py-24">
      <SectionHeading
        eyebrow="The journey"
        title="Your memories don't end at midnight."
        lead="Vow Vault lives with your celebration — before the day, live during it, and long after with everything preserved."
      />

      <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {LIFECYCLE_PHASES.map((phase, index) => (
          <Reveal key={phase.id} delay={120 * index}>
            <article
              className={cn(
                "relative h-full rounded-3xl border p-7",
                phase.id === "during"
                  ? "border-accent/50 bg-brand text-ivory shadow-[var(--shadow-card)]"
                  : "card-soft",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                    phase.id === "during" ? "bg-accent text-brand-ink" : "bg-blush text-accent-deep",
                  )}
                >
                  {phase.label}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "font-display text-sm font-semibold",
                    phase.id === "during" ? "text-accent-glow" : "text-faint",
                  )}
                >
                  0{index + 1}
                </span>
              </div>
              <h3
                className={cn(
                  "mt-5 font-display text-xl font-semibold tracking-tight",
                  phase.id === "during" ? "text-ivory" : "text-ink",
                )}
              >
                {phase.title}
              </h3>
              <p
                className={cn(
                  "mt-3 text-sm leading-relaxed",
                  phase.id === "during" ? "text-ivory/80" : "text-muted",
                )}
              >
                {phase.body}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}