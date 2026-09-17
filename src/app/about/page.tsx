import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { FinalCta } from "@/components/marketing/final-cta";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { IconArrowRight, IconHeart, IconQr, IconUsers } from "@/components/icons";
import { SITE_NAME } from "@/content/site";

export const metadata: Metadata = {
  title: `About — ${SITE_NAME}`,
  description:
    "Vow Vault is the private digital vault for your wedding memory — built for wedding companies and the couples they serve.",
  alternates: { canonical: "/about" },
};

const VALUES = [
  {
    icon: IconQr,
    title: "Radically simple",
    body: "Guests scan and upload. No app, no accounts, no instructions longer than a sentence. If your gran can do it, it's simple enough.",
  },
  {
    icon: IconHeart,
    title: "Made for the moment",
    body: "The day only happens once. Our windows, live slideshow and digital keepsakes are tuned for the pace of a wedding — not an enterprise dashboard.",
  },
  {
    icon: IconUsers,
    title: "Private by design",
    body: "Vaults are noindex, media links are signed and short-lived, and guest access needs the unique vault link. Your memories stay yours.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <section className="container-page pb-14 pt-16 sm:pt-20">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            as="h1"
            eyebrow="About Vow Vault"
            title="A premium platform for wedding memories"
            lead="Vow Vault is one private, beautifully designed digital vault for an entire wedding day — with guest uploads, live slideshows, guestbooks and keepsakes like the flipbook. Built for wedding companies and the couples they serve."
          />
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/packages"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-7 text-sm font-semibold text-ivory transition-colors hover:bg-brand-soft"
            >
              View packages
              <IconArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/examples"
              className="inline-flex h-12 items-center justify-center rounded-full border border-line px-7 text-sm font-semibold text-ink transition-colors hover:bg-blush"
            >
              Explore example vaults
            </Link>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-y border-line-soft bg-ivory-deep/60">
        <div className="container-page py-16 sm:py-20">
          <div className="grid gap-6 md:grid-cols-3">
            {VALUES.map((value, index) => (
              <Reveal key={value.title} delay={100 * index}>
                <article className="card-soft h-full p-8">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-accent-glow">
                    <value.icon className="h-6 w-6" />
                  </span>
                  <h2 className="mt-5 font-display text-xl font-semibold tracking-tight text-ink">{value.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{value.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* What we believe */}
      <section className="container-page py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            The best photos of your wedding were taken by people who love you.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
            Photographers capture the story of the day beautifully — but they can&apos;t be at every table,
            every dance circle and every quiet tear. Vow Vault collects the other thousands of moments,
            so the complete memory of your day lives in one private place.
          </p>
          <p className="mt-6 text-sm text-faint">
            All demo content on this site (couples, testimonials, stats) is fictional and created to
            show the product.
          </p>
        </div>
      </section>

      <FinalCta />

      <SiteFooter />
    </div>
  );
}