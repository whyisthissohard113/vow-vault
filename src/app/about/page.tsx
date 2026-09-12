import Link from "next/link";

import { IconWedding } from "@/components/icons";

export default function About() {
  return (
    <div className="flex flex-1 bg-zinc-50 dark:bg-zinc-950 min-h-screen">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <div className="flex items-center gap-2">
          <IconWedding className="h-7 w-7 text-zinc-500" />
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Wedding Memory Vault
          </span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            Home
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            Pricing
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-5xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl">
            A premium platform for
          </h1>
          <h1 className="text-5xl font-semibold tracking-tight text-rose-500 sm:text-6xl">
            wedding memories
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
            Create a private, elegantly designed gallery for a couple&apos;s photos and videos.
            Let guests share their own moments straight from the celebration, and hand
            out QR cards that open the vault instantly.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-zinc-50 dark:text-zinc-900"
            >
              View packages
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="#features"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-zinc-300 px-6 text-sm font-medium text-zinc-600 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Learn more
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="features" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-6">
            How it works
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="h-12 w-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v2l7 8 7-8v2H3z" />
                  <path d="M3 9v6c3 5 9 8 9 8v1h-2v-5.586a1 1 0 0 0-.293-.724l-7-4a1 1 0 0 0-.795-.408H3z" />
                  <line x1="3" y1="3" x2="21" y2="3" />
                  <line x1="3" y1="11" x2="21" y2="11" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-zinc-900 dark:text-zinc-500 mb-2">Create a vault</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Set up a private gallery for the couple&apos;s photos and videos in minutes.
              </p>
            </div>
            <div className="rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="h-12 w-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-zinc-900 dark:text-zinc-500 mb-2">Guests upload</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Guests scan QR cards at the venue and upload photos and videos directly
                to the vault from their phones.
              </p>
            </div>
            <div className="rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="h-12 w-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="m17 8-5-5-5 5" />
                  <path d="M12 3v12" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-zinc-900 dark:text-zinc-500 mb-2">Share & enjoy</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Guests browse the shared memories, download what they want, and keep
                the wedding magic alive forever.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-16 sm:grid-cols-3 sm:px-6">
          <div className="rounded-2xl p-6">
            <svg className="h-8 w-8 text-zinc-500 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9" rx="1.5" />
              <rect x="14" y="3" width="7" height="5" rx="1.5" />
              <rect x="14" y="12" width="7" height="9" rx="1.5" />
              <rect x="3" y="16" width="7" height="5" rx="1.5" />
            </svg>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Personal vault</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              A private gallery for the couple&apos;s photos and videos, styled to match
              their day — from banner to intro.
            </p>
          </div>
          <div className="rounded-2xl p-6">
            <svg className="h-8 w-8 text-zinc-500 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Guest moments</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Guests upload their photos and videos to one safe place, with upload
              windows that close when the honeymoon is over.
            </p>
          </div>
          <div className="rounded-2xl p-6">
            <svg className="h-8 w-8 text-zinc-500 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3z" />
              <path d="M21 14h.01" />
              <path d="M14 21h.01" />
              <path d="M21 17v4h-4" />
            </svg>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">QR cards</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Platinum design cards guests scan at the venue to open the vault and
              start sharing. Gold and Silver include standard QR codes.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 bg-zinc-900 dark:bg-zinc-950">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-white mb-4">
            Ready to start sharing memories?
          </h2>
          <p className="mx-auto mt-4 text-lg text-zinc-400 dark:text-zinc-50 max-w-xl">
            Create your first vault in under five minutes. No credit card required
            to get started.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-zinc-50 dark:text-zinc-900"
            >
              See pricing plans
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-zinc-300 px-6 text-sm font-medium text-zinc-300 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Create account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <IconWedding className="h-5 w-5 text-zinc-400" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Wedding Memory Vault
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Built for wedding companies and the couples they serve.
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-600">
            {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}