import Link from "next/link";
import Image from "next/image";

import { PACKAGE_METADATA } from "@/lib/entitlements/packages";
import { formatCurrency } from "@/lib/format";
import { IconWedding } from "@/components/icons";

export default function Examples() {
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
            Real wedding examples
          </h1>
          <p className="mx-auto mt-6 text-lg text-zinc-600 dark:text-zinc-400">
            See how different packages look in practice. Each example showcases the
            vault design, gallery style, and features available at that tier.
          </p>
        </div>
      </section>

      {/* Examples Grid */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-3 gap-6 sm:grid-cols-2">
          {PACKAGE_METADATA.map((pkg) => (
            <Link
              key={pkg.code}
              href={`/examples/${pkg.code}`}
              className="group rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 transition-colors duration-300"
            >
              <Image
                src="/placeholder-wedding.jpg"
                alt={`${pkg.name} wedding example`}
                fill
                unoptimized
                className="aspect-[4/3] object-cover transition-transform duration-500 group:hover:scale-105"
                sizes="(min-width: 768px) 50vw, 100vw"
              />
              <div className="p-6">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {pkg.name}
                </h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {pkg.description}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {formatCurrency(pkg.priceCents, pkg.currency)}
                  </span>
                  <svg className="h-4 w-4 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 bg-zinc-900 dark:bg-zinc-950">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-white mb-4">
            Find the right package for your couple
          </h2>
          <p className="mx-auto mt-4 text-lg text-zinc-400 dark:text-zinc-50 max-w-xl">
            From Silver&apos;s basic gallery to Platinum&apos;s premium experience, there&apos;s a
            package for every wedding budget and vision.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-zinc-50 dark:text-zinc-900"
            >
              View all packages
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
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