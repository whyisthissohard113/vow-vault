"use client";

/**
 * SiteHeader — sticky marketing header used on every public page.
 * Same container width on all pages keeps the chrome aligned.
 */

import Link from "next/link";
import { useState } from "react";

import { IconBrand, IconMenu } from "@/components/icons";

const NAV_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#inside", label: "What's inside" },
  { href: "/#packages", label: "Pricing" },
  { href: "/examples", label: "Examples" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-white/80 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2" aria-label="Wedding Memory Vault home">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-brand">
            <IconBrand className="h-5 w-5 text-white" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-stone-900">
            Wedding Memory Vault
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-sand hover:text-stone-900"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:text-stone-900"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="ml-2 inline-flex h-10 items-center justify-center rounded-full bg-stone-900 px-5 text-sm font-semibold text-white transition-all hover:bg-rose-brand"
          >
            Create your vault
          </Link>
        </nav>

        <button
          type="button"
          className="rounded-lg p-2 text-stone-600 hover:bg-sand md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          <IconMenu className="h-5 w-5" />
        </button>
      </div>

      {open ? (
        <nav className="container-page border-t border-stone-200/70 py-4 md:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-sand"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-sand"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-stone-900 px-5 text-sm font-semibold text-white"
            >
              Create your vault
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}