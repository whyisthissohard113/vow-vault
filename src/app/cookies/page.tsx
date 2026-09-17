import type { Metadata } from "next";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SITE_NAME } from "@/content/site";

export const metadata: Metadata = {
  title: `Cookie Policy — ${SITE_NAME}`,
  description: "How Vow Vault uses cookies.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="container-narrow flex-1 py-16 sm:py-24">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">Cookie Policy</h1>
        <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-faint">Placeholder</p>
        <div className="mt-8 space-y-5 text-sm leading-relaxed text-muted sm:text-base">
          <p>
            This is a placeholder cookie policy for the Vow Vault marketing site. It will be replaced
            with the full policy before launch.
          </p>
          <p>
            The marketing site uses only essential cookies for sessions and preferences; no tracking
            or advertising cookies are currently served.
          </p>
          <p>Last updated: September 2026.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}