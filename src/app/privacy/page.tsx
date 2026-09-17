import type { Metadata } from "next";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SITE_NAME } from "@/content/site";

export const metadata: Metadata = {
  title: `Privacy Policy — ${SITE_NAME}`,
  description: "How Vow Vault handles personal data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="container-narrow flex-1 py-16 sm:py-24">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">Privacy Policy</h1>
        <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-faint">Placeholder</p>
        <div className="mt-8 space-y-5 text-sm leading-relaxed text-muted sm:text-base">
          <p>
            This is a placeholder privacy policy for the Vow Vault marketing site. It will be replaced
            with the full policy before the product launches publicly.
          </p>
          <p>
            In short: guest uploads are scoped to each wedding vault, media links are signed and
            time-limited, vaults are hidden from search engines, and we never expose storage
            credentials or internal IDs to guests.
          </p>
          <p>Last updated: September 2026.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}