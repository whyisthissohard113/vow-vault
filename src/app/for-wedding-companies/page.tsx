import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { FinalCta } from "@/components/marketing/final-cta";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { GuestUpload } from "@/components/wedding/guest-upload";
import { QRPreview } from "@/components/wedding/qr-preview";
import {
  IconArrowRight,
  IconBrand,
  IconCard,
  IconCheck,
  IconTemplate,
  IconUsers,
  IconWedding,
} from "@/components/icons";
import { SITE_NAME } from "@/content/site";
import { EXAMPLES } from "@/content/examples";

export const metadata: Metadata = {
  title: `For Wedding Companies — ${SITE_NAME}`,
  description:
    "Vow Vault is built for wedding planners, venues, photographers and coordinators — offer a private, branded memory vault to every couple you serve.",
  alternates: { canonical: "/for-wedding-companies" },
};

const AUDIENCES = [
  {
    icon: IconWedding,
    title: "Wedding planners",
    body: "Give every couple a polished keepsake as part of your package — managed from one dashboard, delivered in minutes.",
  },
  {
    icon: IconCard,
    title: "Venues & estates",
    body: "Let couples leave with something they'll open for years. The vault becomes part of your venue's story.",
  },
  {
    icon: IconUsers,
    title: "Photographers",
    body: "Collect every guest photo alongside your own — and give couples the full picture of the day, not just the curated set.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Create an account",
    body: "One account for your whole business. Add your logo, colours and company name once.",
  },
  {
    number: "02",
    title: "Invite couples",
    body: "Create a branded vault for each couple in minutes. They pick a package, pay once, and it's theirs.",
  },
  {
    number: "03",
    title: "Manage from one dashboard",
    body: "See every client vault, monitor uploads and stay involved — all under your own brand.",
  },
];

export default function ForWeddingCompaniesPage() {
  const wedding = EXAMPLES[4]; // boho — Gold

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <section className="container-page pb-14 pt-16 sm:pt-20">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            as="h1"
            eyebrow="For wedding companies"
            title="Offer a memory vault to every couple you serve"
            lead="Vow Vault is built for planners, venues, photographers and coordinators. Give each couple their own branded private vault — managed from one dashboard, with your logo and your colours."
          />
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-7 text-sm font-semibold text-ivory transition-colors hover:bg-brand-soft"
            >
              Create an account
              <IconArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-12 items-center justify-center rounded-full border border-line px-7 text-sm font-semibold text-ink transition-colors hover:bg-blush"
            >
              Talk to us about partnerships
            </Link>
          </div>
        </div>
      </section>

      {/* Audiences */}
      <section className="border-y border-line-soft bg-ivory-deep/60">
        <div className="container-page py-16 sm:py-20">
          <div className="grid gap-6 md:grid-cols-3">
            {AUDIENCES.map((audience, index) => (
              <Reveal key={audience.title} delay={100 * index}>
                <article className="card-soft h-full p-8">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-accent-glow">
                    <audience.icon className="h-6 w-6" />
                  </span>
                  <h2 className="mt-5 font-display text-xl font-semibold tracking-tight text-ink">{audience.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{audience.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works for companies */}
      <section className="container-page py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <SectionHeading
            eyebrow="For your business"
            title="Three steps to being everywhere couples remember"
            lead="The whole platform works invisibly behind your brand — couples never need to learn a new tool."
          />
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="card-soft p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand font-display text-sm font-semibold text-accent-glow">
                {step.number}
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold tracking-tight text-ink">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Partners */}
      <section id="partners" className="border-y border-line-soft bg-ivory-deep/60">
        <div className="container-page grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-deep">Partners</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              A partner program, not just a link.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Partners get a dedicated onboarding, preferred pricing on the packages they offer, and
              co-branded materials for their couples. The vaults you create carry your identity — your
              logo, your colours, your name — with Vow Vault running invisibly behind it.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Dedicated partner onboarding & support",
                "Preferred package pricing for your couples",
                "Co-branded QR cards and welcome materials",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-muted">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-deep" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* White label */}
          <div id="white-label" className="card-soft p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-accent-glow">
              <IconTemplate className="h-6 w-6" />
            </span>
            <h3 className="mt-5 font-display text-xl font-semibold tracking-tight text-ink">White label</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              For established brands, the vaults you offer can carry completely your own name and
              design. Your couples see your product — the full Vow Vault platform works invisibly
              behind it. Contact us with your requirements and we&apos;ll scope it together.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent-deep transition-colors hover:text-ink"
            >
              Ask about white-label
              <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Guest proof visual */}
      <section className="container-page py-16 sm:py-20">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_24rem] lg:gap-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-deep">What your couples get</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              A gift they&apos;ll open on every anniversary.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
              The QR card your guests scan, the upload screen they instantly understand, the gallery
              that fills live — and long after, the vault that stays. That&apos;s the memory gift your
              company becomes known for.
            </p>
            <div className="mt-6 flex items-start gap-3 text-sm text-muted">
              <IconBrand className="mt-0.5 h-5 w-5 shrink-0 text-accent-deep" />
              Demo imagery shown — the real product experience.
            </div>
          </div>
          <div className="space-y-4" aria-hidden="true">
            <div className="card-soft p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-faint">Your branded QR card</p>
              <div className="mt-4">
                <QRPreview wedding={wedding} compact />
              </div>
            </div>
            <div className="card-soft p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-faint">The guest upload moment</p>
              <div className="mt-4">
                <GuestUpload wedding={wedding} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <FinalCta />

      <SiteFooter />
    </div>
  );
}