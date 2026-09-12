import Link from "next/link";

import { IconBrand } from "@/components/icons";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/#inside", label: "What's inside" },
      { href: "/#packages", label: "Pricing" },
      { href: "/examples", label: "Example vaults" },
      { href: "/about", label: "About" },
    ],
  },
  {
    title: "Couples & guests",
    links: [
      { href: "/faq", label: "FAQ" },
      { href: "/examples/silver", label: "Silver vault" },
      { href: "/examples/gold", label: "Gold vault" },
      { href: "/examples/platinum", label: "Platinum vault" },
    ],
  },
  {
    title: "For wedding companies",
    links: [
      { href: "/register", label: "Create an account" },
      { href: "/login", label: "Sign in" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "#", label: "Privacy policy" },
      { href: "#", label: "Terms of service" },
      { href: "#", label: "Data safety" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-stone-200/80 bg-white">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-brand">
              <IconBrand className="h-4 w-4 text-white" />
            </span>
            <span className="font-display text-base font-semibold text-stone-900">
              Wedding Memory Vault
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-stone-500">
            Private, beautiful wedding memory vaults — built for wedding
            companies and the couples they serve.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              {column.title}
            </p>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-stone-600 transition-colors hover:text-stone-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-stone-200/80">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 sm:flex-row">
          <p className="text-xs text-stone-400">
            © {new Date().getFullYear()} Wedding Memory Vault. All rights reserved.
          </p>
          <p className="text-xs text-stone-400">
            Made with <span className="text-rose-brand">♥</span> for wedding days.
          </p>
        </div>
      </div>
    </footer>
  );
}