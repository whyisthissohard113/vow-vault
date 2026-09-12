import Link from "next/link";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import {
  IconArrowRight,
  IconBrand,
  IconCamera,
  IconDownload,
  IconHeart,
  IconLock,
  IconPhoto,
  IconQr,
  IconSparkle,
  IconUsers,
} from "@/components/icons";
import { PACKAGE_METADATA } from "@/lib/entitlements/packages";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    number: "01",
    title: "Create your vault",
    body: "Name the wedding, pick a package and theme, and your private vault is ready — with its own unique QR code in about two minutes.",
  },
  {
    number: "02",
    title: "Guests scan the card",
    body: "Print the QR design card or share the link. Each guest points their phone at it — no app, no account, no group to join.",
  },
  {
    number: "03",
    title: "Relive it all, together",
    body: "Photos and videos land in the gallery as they're taken. You keep everything in full quality until the download window closes.",
  },
];

const INSIDE = [
  {
    icon: IconQr,
    title: "A QR code for every vault",
    body: "Print it, project it, or pop it in the invitations — Platinum design cards included.",
  },
  {
    icon: IconUsers,
    title: "Every guest, no limits",
    body: "120 people or 1 200 — nobody creates an account, nobody installs anything.",
  },
  {
    icon: IconPhoto,
    title: "Live, shared gallery",
    body: "Photos appear in the vault as guests upload them — speeches, dance floor, quiet moments.",
  },
  {
    icon: IconLock,
    title: "Private & secure",
    body: "Vaults are hidden from search engines, media links are signed, and windows are enforced server-side.",
  },
  {
    icon: IconDownload,
    title: "Full quality, on time",
    body: "Guests download originals — no compression — inside a download window set for each package.",
  },
  {
    icon: IconSparkle,
    title: "Styled to match the day",
    body: "Theme colours on every package, custom banner on Gold, intro and flipbook on Platinum.",
  },
];

const FAQ_ITEMS = [
  {
    q: "How do guests add their photos and videos?",
    a: "Guests open the vault link (from the QR card or a text) and tap Upload. Photos and videos are processed server-side and appear in the gallery — no app and no account needed.",
  },
  {
    q: "Why choose this over a WhatsApp group?",
    a: "WhatsApp compresses photos, half the guests never join, and memories get buried under hundreds of messages. Vaults keep originals in full quality, work for anyone with a phone camera, and stay sorted in one private album.",
  },
  {
    q: "How long do uploads and downloads stay open?",
    a: "Windows are calculated from the wedding date in Africa/Johannesburg. Silver: 2 upload / 7 download days. Gold: 7 / 30. Platinum: 7 / 90.",
  },
  {
    q: "Is the vault really private?",
    a: "Yes. Vaults are noindex by default, internal IDs are never exposed, all media URLs are signed with short TTLs, and access requires the unique vault link.",
  },
  {
    q: "Can we customise how it looks?",
    a: "Every package supports custom theme and accent colours. Gold adds a custom banner, and Platinum adds an intro video, an interactive flipbook, and branded QR design cards.",
  },
];

const HERO_POLAROIDS = [
  {
    caption: "The speeches",
    gradient: "from-rose-200 via-rose-100 to-amber-100",
    chip: <IconHeart className="h-5 w-5 text-rose-brand" />,
  },
  {
    caption: "The dance floor",
    gradient: "from-sky-200 via-rose-100 to-amber-100",
    chip: <IconCamera className="h-5 w-5 text-sky-600" />,
  },
  {
    caption: "Grandma's candids",
    gradient: "from-amber-200 via-rose-100 to-sky-100",
    chip: <IconPhoto className="h-5 w-5 text-amber-600" />,
  },
];

export default function Home() {
  const gold = PACKAGE_METADATA.find((pkg) => pkg.code === "gold");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(225,29,72,0.08),transparent_70%)]"
        />
        <div className="container-page relative grid items-center gap-14 py-16 sm:py-24 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-rose-brand">
              <IconSparkle className="h-3.5 w-3.5" />
              Built for wedding companies
            </p>
            <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
              The photos your guests took, all in one{" "}
              <span className="italic text-rose-brand">beautiful vault</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone-600">
              Put a QR card on the tables. Guests scan it and their photos and
              videos land straight in the couple&apos;s private vault — at full
              quality, from any phone, with no app to install.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/register" className="btn-primary">
                Create your vault
                <IconArrowRight className="h-4 w-4" />
              </Link>
              <Link href="#how" className="btn-secondary">
                See how it works
              </Link>
            </div>
            <p className="mt-8 flex items-center gap-2 text-sm text-stone-500">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <IconBrand className="h-3 w-3" />
              </span>
              Trusted by wedding companies across South Africa
            </p>
          </div>

          {/* Hero visual: polaroid stack + floating QR */}
          <div className="relative mx-auto hidden w-full max-w-md sm:block" aria-hidden="true">
            <div className="polaroid rotate-[-4deg]">
              <div className={cn("flex h-52 items-center justify-center rounded-lg bg-gradient-to-br", HERO_POLAROIDS[0].gradient)}>
                {HERO_POLAROIDS[0].chip}
              </div>
              <p className="polaroid-caption">{HERO_POLAROIDS[0].caption}</p>
            </div>
            <div className="polaroid absolute -bottom-6 -left-8 w-56 rotate-3">
              <div className={cn("flex h-32 items-center justify-center rounded-lg bg-gradient-to-br", HERO_POLAROIDS[1].gradient)}>
                {HERO_POLAROIDS[1].chip}
              </div>
              <p className="polaroid-caption">{HERO_POLAROIDS[1].caption}</p>
            </div>
            <div className="polaroid absolute -right-8 -top-6 w-52 -rotate-6">
              <div className={cn("flex h-28 items-center justify-center rounded-lg bg-gradient-to-br", HERO_POLAROIDS[2].gradient)}>
                {HERO_POLAROIDS[2].chip}
              </div>
              <p className="polaroid-caption">{HERO_POLAROIDS[2].caption}</p>
            </div>
            <div className="absolute -right-12 bottom-10 flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-lg ring-1 ring-black/5">
              <IconQr className="h-5 w-5 text-stone-900" />
              <span className="text-xs font-semibold text-stone-700">Scan to upload</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof strip ───────────────────────────────────────────── */}
      <section className="border-y border-stone-200/80 bg-white">
        <div className="container-page flex flex-wrap items-center justify-center gap-x-10 gap-y-3 py-6 sm:justify-between">
          {["Receptions", "Elopements", "Backyard weddings", "Winelands venues", "Destination weddings"].map(
            (label) => (
              <span key={label} className="font-display text-sm font-medium tracking-wide text-stone-400">
                {label}
              </span>
            ),
          )}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how" className="container-page py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-brand">How it works</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            Three things happen. You do one of them.
          </h2>
          <p className="mt-4 text-stone-600">
            Your guests do the rest without being asked twice.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="card-soft p-8">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-rose-brand font-display text-sm font-semibold text-white">
                {step.number}
              </span>
              <h3 className="mt-5 font-display text-xl font-semibold text-stone-900">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What's inside ────────────────────────────────────────────────── */}
      <section id="inside" className="border-y border-stone-200/80 bg-white">
        <div className="container-page py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-brand">What&apos;s inside</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
              This is the vault your guests fill.
            </h2>
            <p className="mt-4 text-stone-600">
              Everything below is included with every package — Silver, Gold or Platinum.
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {INSIDE.map((feature) => (
              <div key={feature.title} className="card-soft p-7 transition-shadow hover:shadow-md">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-soft">
                  <feature.icon className="h-5 w-5 text-rose-brand" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-stone-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="packages" className="container-page py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-brand">The price</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            Costs less than the champagne on one table.
          </h2>
          <p className="mt-4 text-stone-600">
            One-time payment per wedding. Not per guest, not per month.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3 lg:items-stretch">
          {PACKAGE_METADATA.map((pkg) => {
            const featured = pkg.code === "gold";
            return (
              <div
                key={pkg.code}
                className={cn(
                  "relative flex flex-col rounded-3xl p-8",
                  featured
                    ? "bg-stone-900 text-white shadow-xl ring-4 ring-rose-brand/30"
                    : "card-soft bg-white",
                )}
              >
                {featured ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-rose-brand px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                    Most popular
                  </span>
                ) : null}
                <h3 className={cn("font-display text-xl font-semibold", featured ? "text-white" : "text-stone-900")}>
                  {pkg.name}
                </h3>
                <p className={cn("mt-2 text-sm", featured ? "text-stone-300" : "text-stone-600")}>
                  {pkg.description}
                </p>
                <p className="mt-6 flex items-baseline gap-2">
                  <span className={cn("font-display text-4xl font-semibold", featured ? "text-white" : "text-stone-900")}>
                    {formatCurrency(pkg.priceCents, pkg.currency)}
                  </span>
                  <span className={cn("text-sm", featured ? "text-stone-400" : "text-stone-500")}>once</span>
                </p>
                <Link
                  href="/register"
                  className={cn(
                    "mt-6 inline-flex h-11 items-center justify-center rounded-full text-sm font-semibold transition-all",
                    featured
                      ? "bg-rose-brand text-white hover:bg-rose-500"
                      : "border border-stone-300 text-stone-700 hover:border-stone-900 hover:bg-stone-900 hover:text-white",
                  )}
                >
                  Create {pkg.name} vault
                </Link>
              </div>
            );
          })}
        </div>
        {gold ? (
          <p className="mt-8 text-center text-sm text-stone-500">
            Gold includes video, slideshow, banner and unlimited photos ·{" "}
            <Link href="/pricing" className="font-semibold text-rose-brand hover:underline">
              Compare all packages
            </Link>
          </p>
        ) : null}
      </section>

      {/* ── Why not WhatsApp ─────────────────────────────────────────────── */}
      <section className="border-y border-stone-200/80 bg-white">
        <div className="container-page grid items-center gap-12 py-20 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
              Why not just a WhatsApp group?
            </h2>
            <p className="mt-3 text-lg text-stone-600">Because you&apos;ve seen how that ends.</p>
            <ul className="mt-8 space-y-4">
              {[
                "Photos come back compressed and blurry",
                "Half the guests are not in the group",
                "Everything is buried under 300 messages",
                "Grandma never figures out how to send them",
              ].map((reason) => (
                <li key={reason} className="flex items-start gap-3 text-stone-500">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </span>
                  <span className="text-sm leading-relaxed">{reason}</span>
                </li>
              ))}
            </ul>
            <ul className="mt-8 space-y-4">
              {[
                "Full original quality, every time",
                "Anyone with a phone camera can join — just scan",
                "One album, sorted, nothing to scroll past",
                "Grandma points her camera at a card. Done.",
              ].map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-stone-700">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-soft text-rose-brand">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5 9-9" />
                    </svg>
                  </span>
                  <span className="text-sm leading-relaxed">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative mx-auto hidden w-full max-w-sm sm:block">
            <div className="polaroid rotate-2">
              <div className="flex h-64 items-center justify-center rounded-lg bg-gradient-to-br from-stone-200 via-rose-100 to-amber-100">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-brand text-white">
                  <IconHeart className="h-8 w-8" />
                </span>
              </div>
              <p className="polaroid-caption">The moments you would have missed</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="container-page py-20">
        <div className="mx-auto max-w-3xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-brand">Questions</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
              Before you ask
            </h2>
          </div>
          <div className="mt-10">
            <FaqAccordion items={FAQ_ITEMS} />
          </div>
        </div>
      </section>

      {/* ── CTA band ─────────────────────────────────────────────────────── */}
      <section className="container-page pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-stone-900 px-8 py-16 text-center sm:px-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgba(225,29,72,0.35),transparent_70%)]"
          />
          <h2 className="relative font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Your guests are going to take the photos anyway.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-stone-300">
            You may as well get to see them. Create a vault in about two minutes.
          </p>
          <Link
            href="/register"
            className="btn-primary relative mt-8 bg-rose-brand hover:bg-rose-500 hover:shadow-rose-500/25"
          >
            Create your vault
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}