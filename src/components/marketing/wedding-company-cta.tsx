/**
 * WeddingCompanyCta — the "for wedding companies" conversion band.
 * Used on the home page and the /for-wedding-companies page.
 */

import Link from "next/link";
import { IconArrowRight, IconUsers, IconWedding } from "@/components/icons";
import { Reveal } from "@/components/ui/reveal";

export function WeddingCompanyCta() {
  return (
    <section className="container-page pb-20">
      <Reveal>
        <div className="grid items-center gap-8 rounded-3xl border border-line bg-surface p-8 shadow-[var(--shadow-soft)] sm:p-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-deep">
              For wedding companies
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Offer a memory vault to every couple you serve.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              Planners, venues, photographers and coordinators can give each couple their own
              branded private vault — managed from one dashboard, with your logo and your colours.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/for-wedding-companies"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-ivory transition-colors hover:bg-brand-soft"
              >
                For wedding companies
                <IconArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register"
                className="inline-flex h-11 items-center rounded-full border border-line px-6 text-sm font-semibold text-ink transition-colors hover:bg-blush"
              >
                Create an account
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3" aria-hidden="true">
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl border border-line bg-ivory p-4">
                <IconUsers className="h-5 w-5 text-accent-deep" />
                <p className="mt-3 font-display text-lg font-semibold text-ink">One dashboard</p>
                <p className="text-xs text-muted">Every client vault in one place.</p>
              </div>
              <div className="rounded-2xl border border-line bg-ivory p-4">
                <IconWedding className="h-5 w-5 text-accent-deep" />
                <p className="mt-3 font-display text-lg font-semibold text-ink">Your brand</p>
                <p className="text-xs text-muted">Logo, colours, your name.</p>
              </div>
            </div>
            <div className="flex flex-col justify-end gap-3">
              <div className="rounded-2xl border border-line bg-ivory p-4">
                <p className="font-display text-lg font-semibold text-ink">Invite couples</p>
                <p className="text-xs text-muted">They get their vault in minutes.</p>
              </div>
              <div className="rounded-2xl bg-brand p-4 text-ivory">
                <p className="font-display text-lg font-semibold text-accent-glow">A gift they keep</p>
                <p className="text-xs text-ivory/70">Memories, for life.</p>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}