"use client";

/**
 * SiteHeader — sticky Vow Vault marketing header.
 * Desktop nav plus an accessible mobile menu panel.
 */

import Link from "next/link";
import { useState } from "react";

import { IconBrand, IconMenu, IconClose } from "@/components/icons";
import { PRIMARY_NAV, AUTH_LINKS } from "@/content/navigation";
import { SITE_NAME, PRIMARY_CTA } from "@/content/site";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-ivory/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${SITE_NAME} home`}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-accent-glow shadow-[var(--shadow-soft)]">
            <IconBrand className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-ink">
            Vow Vault
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {PRIMARY_NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-blush hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href={AUTH_LINKS.login.href}
            className="rounded-full px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
          >
            {AUTH_LINKS.login.label}
          </Link>
          <Link
            href={AUTH_LINKS.register.href}
            className="inline-flex h-10 items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-ivory shadow-[var(--shadow-soft)] transition-all hover:bg-brand-soft"
          >
            {PRIMARY_CTA.label}
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-ink hover:bg-blush lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label="Toggle menu"
        >
          {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <nav id="mobile-nav" className="container-page border-t border-line-soft py-4 lg:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-1">
            {PRIMARY_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-blush hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-line-soft pt-3">
              <Link
                href={AUTH_LINKS.login.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "inline-flex h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-semibold text-ink transition-colors hover:bg-blush",
                )}
              >
                {AUTH_LINKS.login.label}
              </Link>
              <Link
                href={AUTH_LINKS.register.href}
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-ivory transition-colors hover:bg-brand-soft"
              >
                {PRIMARY_CTA.label}
              </Link>
            </div>
          </div>
        </nav>
      ) : null}
    </header>
  );
}