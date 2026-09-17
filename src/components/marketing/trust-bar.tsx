/**
 * TrustBar — development-placeholder statistics strip.
 *
 * `stats.ts` marks every figure as a development placeholder. This component
 * renders the "placeholder" note below the numbers so the marketing site
 * never presents unverified claims as real social proof.
 */

import { TRUST_BAR } from "@/content/stats";

export function TrustBar() {
  return (
    <section className="border-y border-line-soft bg-surface/70">
      <div className="container-page py-8">
        <p className="text-center text-xs font-bold uppercase tracking-[0.22em] text-faint">
          {TRUST_BAR.eyebrow}
        </p>
        <dl className="mt-5 grid grid-cols-3 gap-4">
          {TRUST_BAR.items.map((item) => (
            <div key={item.id} className="text-center">
              <dt className="sr-only">{item.label}</dt>
              <dd className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {item.value.toLocaleString("en-ZA")}
                <span className="text-accent-deep">{item.suffix}</span>
              </dd>
              <dd className="mt-1 text-xs font-medium uppercase tracking-wider text-faint sm:text-sm">
                {item.label}
              </dd>
            </div>
          ))}
        </dl>
        {TRUST_BAR.isDevelopmentPlaceholder ? (
          <p className="mt-4 text-center text-[11px] text-faint/80">
            Development placeholder — fictional figures for the demo site.
          </p>
        ) : null}
      </div>
    </section>
  );
}