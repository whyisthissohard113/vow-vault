import Link from "next/link";

import { PACKAGE_METADATA } from "@/lib/entitlements/packages";
import { formatCurrency } from "@/lib/format";
import { IconWedding } from "@/components/icons";

export default function Pricing() {
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
            href="/about"
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            About
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-5xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl">
            Choose your package
          </h1>
          <p className="mx-auto mt-6 text-lg text-zinc-600 dark:text-zinc-400">
            One-time packages per wedding, in South African Rand. All packages include
            our premium vault experience with guest uploads and QR cards.
          </p>
        </div>
      </section>

      {/* Package Comparison */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-10">
            Package comparison
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {PACKAGE_METADATA.map((pkg) => (
              <div
                key={pkg.code}
                className="rounded-2xl border border-zinc-300 bg-white p-8 dark:border-zinc-700 dark:bg-zinc-900 shadow-sm transition-all duration-300 hover:border-zinc-600"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {pkg.name}
                  </h3>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {pkg.priceCents / 100}{" "}{pkg.currency}
                  </span>
                </div>

                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
                  {pkg.description}
                </p>

                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Vault features
                    </dt>
                    <dd className="text-sm text-zinc-500 dark:text-zinc-400">
                      {pkg.code === "platinum"
                        ? "Silver + Gold + intro + flipbook + QR design cards + extended download (90 days)"
                        : pkg.code === "gold"
                          ? "Silver + video + slideshow + banner + unlimited photos"
                          : "Photo gallery + guest uploads + names & date + optional colours"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Upload limit
                    </dt>
                    <dd className="text-sm text-zinc-500 dark:text-zinc-400">
                      {-1 === -1 ? "Unlimited" : "500 photos"} {(pkg.code === "gold" || pkg.code === "platinum") ? "+ videos included" : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Download window
                    </dt>
                    <dd className="text-sm text-zinc-500 dark:text-zinc-400">
                      {(pkg.code === "platinum" ? "90 days" : pkg.code === "gold" ? "30 days" : "7 days")} after wedding date
                    </dd>
                  </div>
                </dl>

                <div className="mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-900">
                  <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    One-time charge (per wedding)
                  </h4>
                  <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatCurrency(pkg.priceCents, pkg.currency)}
                  </p>
                </div>

                <div className="mt-6">
                  <Link
                    href={pkg.code === "platinum" ? "/examples/platinum" : pkg.code === "gold" ? "/examples/gold" : "/examples/silver"}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    View example
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 bg-zinc-900 dark:bg-zinc-950">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-white mb-4">
            Start sharing memories today
          </h2>
          <p className="mx-auto mt-4 text-lg text-zinc-400 dark:text-zinc-50 max-w-xl">
            Create a private gallery for a couple&apos;s photos and videos. Let guests share
            their moments straight from the celebration with QR cards.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Create account
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="#packages"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-zinc-300 px-6 text-sm font-medium text-zinc-300 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              View packages
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