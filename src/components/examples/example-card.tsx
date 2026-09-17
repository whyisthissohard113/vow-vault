/**
 * ExampleCard / TierExampleCard — the public `/examples` entry cards.
 *
 * These are deliberately CTAs, not the experience: each card links into a
 * fully interactive demo vault via a prominent "OPEN VAULT" call to action.
 */

import Link from "next/link";

import { DemoArtwork } from "@/components/wedding/demo-artwork";
import { IconArrowRight, IconHeart } from "@/components/icons";
import type { WeddingDemo } from "@/content/examples";

export function ExampleCard({ wedding }: { wedding: WeddingDemo }) {
  const cover = wedding.gallery[1] ?? wedding.gallery[0];

  return (
    <Link
      href={`/examples/${wedding.id}`}
      className="group card-soft flex flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card)]"
    >
      <div className="relative overflow-hidden">
        <DemoArtwork
          image={cover}
          className="aspect-[4/3] w-full transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-ink/80 to-transparent px-4 pb-3 pt-12">
          <p className="font-display text-lg font-semibold text-ivory">{wedding.coupleNames}</p>
          <p className="text-xs text-ivory/80">
            {wedding.dateLabel} · {wedding.venue}
          </p>
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-bold text-accent-deep">
          {wedding.packageTier}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: wedding.colors.theme }}
            aria-hidden="true"
          />
          <p className="text-sm font-semibold text-ink">{wedding.theme}</p>
        </div>
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted">{wedding.story}</p>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line-soft pt-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-faint">
            <IconHeart className="h-3.5 w-3.5 text-accent-deep" />
            {wedding.gallery.length} sample memories
          </span>
          <span className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-xs font-bold uppercase tracking-wider text-ivory transition-colors group-hover:bg-brand-soft">
            Open Vault
            <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export interface TierCardData {
  tier: "silver" | "gold" | "platinum";
  label: string;
  tagline: string;
  highlights: string[];
}

export function TierExampleCard({
  data,
  wedding,
}: {
  data: TierCardData;
  wedding: WeddingDemo;
}) {
  const cover = wedding.gallery[0];

  return (
    <Link
      href={`/examples/${data.tier}`}
      className="group card-soft flex flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card)]"
    >
      <div className="relative overflow-hidden">
        <DemoArtwork
          image={cover}
          className="aspect-[16/9] w-full transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-brand-ink/45" aria-hidden="true" />
        <div className="absolute inset-0 flex flex-col justify-center px-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-accent-glow">
            {data.label} package
          </p>
          <p className="mt-1 font-display text-2xl font-semibold text-ivory">{wedding.coupleNames}</p>
          <p className="text-xs text-ivory/80">
            {wedding.dateLabel} · {wedding.venue}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-sm leading-relaxed text-muted">{data.tagline}</p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {data.highlights.map((item) => (
            <li
              key={item}
              className="rounded-full bg-blush px-2.5 py-1 text-[11px] font-semibold text-accent-deep"
            >
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end border-t border-line-soft pt-4">
          <span className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-xs font-bold uppercase tracking-wider text-ivory transition-colors group-hover:bg-brand-soft">
            Open {data.label} Vault
            <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
