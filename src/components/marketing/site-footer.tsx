import Link from "next/link";

import { IconBrand } from "@/components/icons";
import { FOOTER_COLUMNS, SOCIAL_LINKS } from "@/content/navigation";
import { SITE_NAME, SITE_DESCRIPTION } from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-ivory-deep">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-accent-glow">
              <IconBrand className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-ink">
              {SITE_NAME}
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">{SITE_DESCRIPTION}</p>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {SOCIAL_LINKS.map((social) => (
              <li key={social.label}>
                <Link
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-muted transition-colors hover:text-ink"
                >
                  {social.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <div key={column.title}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-faint">{column.title}</p>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.label + link.href}>
                  <Link href={link.href} className="text-sm text-muted transition-colors hover:text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 sm:flex-row">
          <p className="text-xs text-faint">
            © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
          <p className="text-xs text-faint">
            Demo marketing site — all testimonials and stats are fictional.
          </p>
        </div>
      </div>
    </footer>
  );
}