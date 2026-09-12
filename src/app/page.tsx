import Link from "next/link";

import {
  IconArrowRight,
  IconBrand,
  IconCamera,
  IconHeart,
  IconQr,
  IconUsers,
} from "@/components/icons";
import { PACKAGE_METADATA } from "@/lib/entitlements/packages";
import { formatCurrency } from "@/lib/format";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <div className="flex items-center gap-2">
          <IconBrand className="h-7 w-7 text-rose-500" />
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Wedding Memory Vault
          </span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-zinc-50 dark:text-zinc-900"
          >
            Create account
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Every wedding&apos;s memories,{" "}
            <span className="text-rose-500">one beautiful vault</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
            Create a private gallery for a couple&apos;s photos and videos, let
            guests share their own moments straight from the celebration, and
            hand out QR cards that open it all.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Create your first vault
              <IconArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#packages"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-zinc-300 px-6 text-sm font-medium text-zinc-700 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              See packages
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-16 sm:grid-cols-3 sm:px-6">
          <div className="rounded-2xl p-6">
            <IconHeart className="h-8 w-8 text-rose-500" />
            <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Personal vault
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              A private gallery for the couple&apos;s photos and videos, styled
              to match their day — from banner to intro.
            </p>
          </div>
          <div className="rounded-2xl p-6">
            <IconUsers className="h-8 w-8 text-rose-500" />
            <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Guest moments
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Guests upload their photos and videos to one safe place, with
              upload windows that close when the honeymoon is over.
            </p>
          </div>
          <div className="rounded-2xl p-6">
            <IconQr className="h-8 w-8 text-rose-500" />
            <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              QR cards
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Platinum design cards guests scan at the venue to open the vault
              and start sharing.
            </p>
          </div>
        </div>
      </section>

      {/* Packages */}
      <section id="packages" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Simple pricing
          </h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            One-time packages per wedding, in South African Rand.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {PACKAGE_METADATA.map((pkg) => (
            <div
              key={pkg.code}
              className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {pkg.name}
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {pkg.description}
              </p>
              <p className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {formatCurrency(pkg.priceCents, pkg.currency)}
              </p>
              <Link
                href="/register"
                className="mt-6 inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <IconCamera className="h-5 w-5 text-zinc-400" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Wedding Memory Vault
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Built for wedding companies and the couples they serve.
          </p>
        </div>
      </footer>
    </div>
  );
}