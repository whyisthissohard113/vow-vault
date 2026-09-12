import Link from "next/link";
import Image from "next/image";

import { IconWedding } from "@/components/icons";

export default function SilverExample() {
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
            href="/examples"
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            Examples
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-5xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl">
            Silver package
          </h1>
          <p className="mx-auto mt-6 text-lg text-zinc-600 dark:text-zinc-400">
            The essential foundation for sharing wedding memories. Photo gallery,
            guest uploads, and customisable colours.
          </p>
        </div>
      </section>

      {/* Package Features */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div className="rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-4">Photo gallery</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Share and display the couple&apos;s favorite photos from the wedding day.
              </p>
            </div>
            <div className="rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-4">Guest uploads</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Guests can upload photos via QR code. Fair-use limit of 500 photos.
              </p>
            </div>
            <div className="rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-4">
                Names & date display
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Couple names and wedding date displayed elegantly at the top of the vault.
              </p>
            </div>
            <div className="rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-4">
                Optional colours
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Customisable theme and accent colours to match the wedding palette.
              </p>
            </div>
          </dl>
        </div>
      </section>

      {/* QR & Upload Demo */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 mb-8">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-4">
              QR code demonstration
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Silver includes a standard QR code that guests can scan to open the
              vault and upload photos. The QR encodes the public vault URL only.
            </p>
            <div className="relative rounded-xl bg-zinc-100 dark:bg-zinc-800 p-8">
              <Image
                src="/placeholder-qr-sm.png"
                alt="Silver QR code"
                fill
                unoptimized
                className="center-auto max-w-48"
              />
              <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400 text-center">
                Scan to open vault
              </p>
            </div>
          </div>

          <div className="rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-4">
              Guest upload demonstration
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Guests open the vault on their phone, tap &quot;Upload&quot;, and select photos
              or videos from their gallery. Photos appear in the gallery once
              processed.
            </p>
            <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
              <li>Select photos or videos from phone</li>
              <li>Add optional captions</li>
              <li>Upload progresses in real-time</li>
              <li>Appears in gallery after processing</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 bg-zinc-900 dark:bg-zinc-950">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-white mb-4">
            Start with Silver
          </h2>
          <p className="mx-auto mt-4 text-lg text-zinc-400 dark:text-zinc-50 max-w-xl">
            The Silver package is perfect for couples who want a private photo gallery
            with guest uploads. Upgrade anytime to add video, slideshow, and more.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-zinc-50 dark:text-zinc-900"
            >
              See Gold & Platinum upgrades
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