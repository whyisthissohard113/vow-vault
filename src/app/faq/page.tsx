import Link from "next/link";

import { IconWedding } from "@/components/icons";

export default function Faq() {
  const faqs = [
    {
      q: "How much does the Wedding Memory Vault cost?",
      a: "Packages are one-time charges per wedding, starting at R599 for Silver up to R1099 for Platinum. All prices are in South African Rand (ZAR).",
    },
    {
      q: "How do guests upload photos and videos?",
      a: "Guests scan the QR code on their card (or receive it via text/email) and open the vault on their phone. They can then tap 'Upload' to select photos or videos from their gallery. Photos appear in the gallery after processing, and videos are converted for web viewing.",
    },
    {
      q: "How long do uploads and downloads remain open?",
      a: "Upload and download windows are calculated from the wedding date based on the package purchased. Silver: 2 days upload / 7 days download after the wedding. Gold: 7 days upload / 30 days download. Platinum: 7 days upload / 90 days download. All dates are calculated in Africa/Johannesburg timezone.",
    },
    {
      q: "Can guests download their photos and videos?",
      a: "Yes, depending on the package. Silver guests can download individual photos. Gold and Platinum guests can download the full gallery and videos within their download window. Download URLs are signed and expire after the window closes.",
    },
    {
      q: "Is the vault private and secure?",
      a: "Yes. Each vault is private to the couple and their guests. Access is via the unique QR code or vault URL. Internal IDs are never exposed; all media links are signed with short TTLs. The vault defaults to noindex to prevent search engines from indexing private content.",
    },
    {
      q: "What happens after the download window closes?",
      a: "After the download window closes, the vault remains accessible for viewing the shared memories, but downloading is no longer available. The vault can be archived, keeping the memories preserved but locked.",
    },
    {
      q: "Can we customise the vault's look?",
      a: "Yes. All packages allow custom theme and accent colours. Gold and Platinum additionally include a custom banner image. Platinum includes QR design cards with custom branding, colors, and a personalized message.",
    },
    {
      q: "Do guests need to create an account to upload?",
      a: "No. Guest uploads are anonymous — guests just enter their name (optional) and upload photos or videos. The upload is scoped to the wedding's vault only.",
    },
    {
      q: "Can we integrate the vault into our wedding website?",
      a: "Yes. The vault URL can be embedded or linked from any wedding website. The vault is responsive and works on mobile, tablet, and desktop. QR cards are also available as a printable design.",
    },
  ];

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
            Frequently asked questions
          </h1>
          <p className="mx-auto mt-6 text-lg text-zinc-600 dark:text-zinc-400">
            Answers to common questions about the Wedding Memory Vault platform.
          </p>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <dl className="space-y-3">
            {faqs.map((faq, index) => (
              <div key={index} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
                <div
                  className="p-6 cursor-pointer flex justify-between items-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => {}}
                >
                  <span>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {faq.q}
                    </p>
                    <svg
                      className="h-4 w-4 transition-transform duration-300"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </div>
                <div className="p-6 py-0 text-sm text-zinc-500 dark:text-zinc-400">
                  {faq.a}
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Contact Form */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 bg-zinc-900 dark:bg-zinc-950">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-white mb-4">
            Get in touch
          </h2>
          <p className="mx-auto mt-4 text-lg text-zinc-400 dark:text-zinc-50 max-w-xl">
            Have another question? We&apos;d love to hear from you. Fill out the form
            below and we&apos;ll get back to you within 2 business days.
          </p>
          <form className="mt-8 space-y-4" onSubmit={async (e) => e.preventDefault()}>
            <div>
              <label className="block text-sm font-medium text-zinc-400 dark:text-zinc-50 mb-2">
                Name
              </label>
              <input
                type="text"
                required
                className="w-full rounded-lg border border-zinc-500 dark:border-zinc-400 px-4 py-3 text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-zinc-300"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 dark:text-zinc-50 mb-2">
                Email
              </label>
              <input
                type="email"
                required
                className="w-full rounded-lg border border-zinc-500 dark:border-zinc-400 px-4 py-3 text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-zinc-300"
                placeholder="you@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 dark:text-zinc-50 mb-2">
                Message
              </label>
              <textarea
                rows={4}
                required
                className="w-full resize-none rounded-lg border border-zinc-500 dark:border-zinc-400 px-4 py-3 text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-zinc-300"
                placeholder="Your message..."
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Send message
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </form>
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