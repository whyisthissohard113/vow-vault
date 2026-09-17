/**
 * Pricing — the three packages section, with prices sourced from the content
 * layer (which reads from the canonical entitlements module).
 */

import Link from "next/link";
import { PACKAGES } from "@/content/packages";
import { SectionHeading } from "@/components/ui/section-heading";
import { PricingCard } from "@/components/marketing/pricing-card";
import { IconArrowRight, IconCheck, IconQr } from "@/components/icons";

export function Pricing() {
  const gold = PACKAGES.find((pkg) => pkg.code === "gold");
  return (
    <section id="packages" className="container-page py-20 sm:py-24">
      <SectionHeading
        eyebrow="Packages"
        title="Costs less than the champagne on one table."
        lead="One-time payment per wedding — not per guest, not per month. Same vault experience, three levels of keepsake."
      />

      <div className="mt-16 grid gap-6 md:grid-cols-3 lg:items-stretch">
        {PACKAGES.map((pkg) => (
          <PricingCard key={pkg.code} pkg={pkg} featured={pkg.code === "gold"} />
        ))}
      </div>

      {gold ? (
        <p className="mt-10 flex flex-wrap items-center justify-center gap-2 text-center text-sm text-muted">
          <IconCheck className="h-4 w-4 text-accent-deep" />
          Every package includes a private vault, QR code and guest uploads.
          <Link href="/packages" className="inline-flex items-center gap-1 font-semibold text-accent-deep transition-colors hover:text-ink">
            Compare all features
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </p>
      ) : null}

      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-faint">
        <IconQr className="h-4 w-4" />
        All prices in South African Rand (ZAR). No hidden fees.
      </div>
    </section>
  );
}