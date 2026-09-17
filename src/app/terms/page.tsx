import type { Metadata } from "next";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SITE_NAME } from "@/content/site";

export const metadata: Metadata = {
  title: `Terms of Service — ${SITE_NAME}`,
  description: "The terms that apply to using Vow Vault.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="container-narrow flex-1 py-16 sm:py-24">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">Terms of Service</h1>
        <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-faint">Placeholder</p>
        <div className="mt-8 space-y-5 text-sm leading-relaxed text-muted sm:text-base">
          <p>
            This is a placeholder terms page for the Vow Vault marketing site. It will be replaced with
            the full terms before the product launches publicly.
          </p>
          <p>
            Key principles already reflected in the product: one-time package pricing, upload and
            download windows enforced server-side, fair-use safeguards applied to all &quot;unlimited&quot;
            entitlements, and tenant isolation for every vault.
          </p>
          <p>Last updated: September 2026.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}