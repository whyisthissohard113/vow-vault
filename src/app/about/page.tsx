import Link from "next/link";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import {
  IconArrowRight,
  IconCamera,
  IconLock,
  IconQr,
  IconSparkle,
  IconUsers,
} from "@/components/icons";

const STEPS = [
  {
    title: "Create the vault",
    body: "Set up a private gallery styled for the couple in minutes — names, date, banner, colours.",
    icon: IconSparkle,
  },
  {
    title: "Guests upload",
    body: "Guests scan the QR card at the venue and upload photos and videos straight from their phones.",
    icon: IconQr,
  },
  {
    title: "Share & enjoy",
    body: "Everyone browses the shared memories, downloads their favourites and relives the day.",
    icon: IconCamera,
  },
];

const FEATURES = [
  {
    title: "A private vault",
    body: "One private gallery for the couple's photos and videos, styled to match their day.",
    icon: IconLock,
  },
  {
    title: "Guest moments",
    body: "Guests upload into one safe place, with upload windows that close after the honeymoon.",
    icon: IconUsers,
  },
  {
    title: "QR cards",
    body: "Platinum design cards guests scan at the venue. Gold and Silver include standard QR codes.",
    icon: IconQr,
  },
];

export default function About() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <section className="container-page py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-brand">About</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
            A premium platform for
            <span className="block text-rose-brand">wedding memories</span>
          </h1>
          <p className="mx-auto mt-5 text-lg text-stone-600">
            Create a private, elegantly designed gallery for a couple&apos;s photos and videos.
            Let guests share their own moments straight from the celebration, and hand
            out QR cards that open the vault instantly.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/pricing"
              className="btn-primary h-12"
            >
              <span>View packages</span>
              <IconArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#features"
              className="inline-flex h-12 items-center justify-center rounded-full border border-stone-300 px-6 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-900 hover:text-white"
            >
              Learn more
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="features" className="bg-sand/60 py-16 sm:py-20">
        <div className="container-page">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-brand">How it works</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-stone-900">
              Three steps to a full album
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="card-soft bg-white p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-soft text-rose-brand">
                  <step.icon className="h-6 w-6" />
                </div>
                <p className="mt-5 text-xs font-bold uppercase tracking-widest text-stone-400">
                  Step {i + 1}
                </p>
                <h3 className="mt-1 font-display text-lg font-semibold text-stone-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container-page py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-brand">What&apos;s inside</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-stone-900">
            Built for wedding companies and the couples they serve
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card-soft border border-stone-200/70 bg-white p-8">
              <feature.icon className="h-8 w-8 text-rose-brand" />
              <h3 className="mt-4 font-display text-lg font-semibold text-stone-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-page pb-20">
        <div className="rounded-3xl bg-stone-900 px-8 py-16 text-center sm:px-16">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Ready to start sharing memories?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-stone-300">
            Create your first vault in under five minutes. No credit card required
            to get started.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/pricing" className="btn-primary h-12">
              <span>See pricing plans</span>
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