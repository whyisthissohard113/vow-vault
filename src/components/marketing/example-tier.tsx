import Link from "next/link";
import Image from "next/image";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { IconArrowRight, IconCheck } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface ExampleTierFeature {
  title: string;
  body: string;
}

interface ExampleTierProps {
  kicker: string;
  name: string;
  tagline: string;
  features: ExampleTierFeature[];
  qrSrc: string;
  qrAlt: string;
  qrBody: string;
  uploadBody: string;
  bullets: string[];
  ctaTitle: string;
  ctaBody: string;
  ctaHref: string;
  ctaLabel: string;
  featured?: boolean;
}

export function ExampleTier({
  kicker,
  name,
  tagline,
  features,
  qrSrc,
  qrAlt,
  qrBody,
  uploadBody,
  bullets,
  ctaTitle,
  ctaBody,
  ctaHref,
  ctaLabel,
  featured = false,
}: ExampleTierProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <section className="container-page py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-brand">{kicker}</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
            {name}
          </h1>
          <p className="mx-auto mt-5 text-lg text-stone-600">{tagline}</p>
        </div>
      </section>

      <section className="pb-16 sm:pb-20">
        <div className="container-page">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div key={feature.title} className="card-soft border border-stone-200/70 bg-white p-6">
                  <IconCheck className="h-5 w-5 text-rose-brand" />
                  <h2 className="mt-3 font-display text-base font-semibold text-stone-900">{feature.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-sand/60 py-16 sm:py-20">
        <div className="container-page">
          <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
            <div className="card-soft bg-white p-8">
              <h2 className="font-display text-xl font-semibold text-stone-900">QR code</h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">{qrBody}</p>
              <div
                className={cn(
                  "mt-6 flex items-center justify-center rounded-2xl bg-sand p-10",
                  featured ? "ring-2 ring-gold/40" : "border border-stone-200",
                )}
              >
                {/* Public vault URL only — no internal IDs in the payload */}
                <Image
                  src={qrSrc}
                  alt={qrAlt}
                  width={176}
                  height={176}
                  unoptimized
                  className="aspect-square object-contain"
                />
              </div>
              <p className="mt-4 text-center text-xs font-medium uppercase tracking-widest text-stone-400">
                Guest scans to open the vault
              </p>
            </div>

            <div className="card-soft bg-white p-8">
              <h2 className="font-display text-xl font-semibold text-stone-900">The guest experience</h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">{uploadBody}</p>
              <ul className="mt-5 space-y-3">
                {bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3 text-sm text-stone-700">
                    <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-rose-brand" />
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <div className="rounded-3xl bg-stone-900 px-8 py-16 text-center sm:px-16">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {ctaTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-stone-300">{ctaBody}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={ctaHref} className="btn-primary h-12">
              <span>{ctaLabel}</span>
              <IconArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-full border border-stone-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-stone-900"
            >
              Create account
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}