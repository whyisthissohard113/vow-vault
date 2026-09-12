import type { ReactNode } from "react";

import { IconBrand, IconCamera, IconHeart, IconLock, IconQr } from "@/components/icons";
import Link from "next/link";

const PANEL_POINTS = [
  { icon: IconCamera, text: "Guests upload straight from their phones" },
  { icon: IconQr, text: "One scan opens the vault at the venue" },
  { icon: IconHeart, text: "Every photo and video in one private gallery" },
  { icon: IconLock, text: "Upload & download windows are enforced by us" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <aside className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-stone-900 p-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-rose-brand/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-gold/20 blur-3xl"
        />

        <Link href="/" className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-brand text-white">
            <IconBrand className="h-6 w-6" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">Wedding Memory Vault</span>
        </Link>

        <div className="relative">
          <h2 className="max-w-md font-display text-4xl font-semibold leading-tight tracking-tight">
            Every guest&apos;s photos,
            <span className="block text-rose-brand">one beautiful vault.</span>
          </h2>
          <ul className="mt-10 space-y-5">
            {PANEL_POINTS.map((point) => (
              <li key={point.text} className="flex items-center gap-4 text-stone-300">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <point.icon className="h-5 w-5 text-rose-brand" />
                </span>
                <span className="text-sm">{point.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-stone-500">
          Built for wedding companies and the couples they serve.
        </p>
      </aside>

      {/* Form column */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <Link href="/" className="mb-10 flex items-center gap-2 lg:hidden">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-brand text-white">
            <IconBrand className="h-6 w-6" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-stone-900">
            Wedding Memory Vault
          </span>
        </Link>

        <div className="w-full max-w-md card-soft bg-white p-8 shadow-sm sm:p-10">{children}</div>

        <p className="mt-8 text-xs text-stone-500">
          Need help?{" "}
          <Link href="/faq" className="font-semibold text-rose-brand hover:underline">
            Read the FAQ
          </Link>
        </p>
      </main>
    </div>
  );
}