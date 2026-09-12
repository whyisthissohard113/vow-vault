import Link from "next/link";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { IconArrowRight, IconCheck } from "@/components/icons";
import {
  PACKAGE_METADATA,
  packageHasUnlimited,
  getPackageFairUseLimit,
} from "@/lib/entitlements/packages";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const DETAILS: Record<string, { vault: string; upload: string; download: string }> = {
  silver: {
    vault: "Photo gallery · guest uploads · names & date · optional colours",
    upload: "2 days after the wedding",
    download: "7 days after the wedding",
  },
  gold: {
    vault: "Silver + video · slideshow · custom banner · unlimited photos",
    upload: "7 days after the wedding",
    download: "30 days after the wedding",
  },
  platinum: {
    vault: "Gold + intro · flipbook · QR design cards · extended download",
    upload: "7 days after the wedding",
    download: "90 days after the wedding",
  },
};

export default function Pricing() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <section className="container-page py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-brand">The price</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
            Choose your package
          </h1>
          <p className="mx-auto mt-5 text-lg text-stone-600">
            One-time packages per wedding, in South African Rand. All prices include
            our vault experience with guest uploads and QR codes.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3 lg:items-stretch">
          {PACKAGE_METADATA.map((pkg) => {
            const featured = pkg.code === "gold";
            const details = DETAILS[pkg.code];
            const unlimited = packageHasUnlimited(pkg.code, "photos");
            const photoLimit = getPackageFairUseLimit(pkg.code, "photos");
            return (
              <div
                key={pkg.code}
                className={cn(
                  "relative flex flex-col rounded-3xl p-8",
                  featured
                    ? "bg-stone-900 text-white shadow-xl ring-4 ring-rose-brand/30"
                    : "card-soft bg-white",
                )}
              >
                {featured ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-rose-brand px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                    Most popular
                  </span>
                ) : null}

                <h2 className={cn("font-display text-xl font-semibold", featured ? "text-white" : "text-stone-900")}>
                  {pkg.name}
                </h2>
                <p className={cn("mt-2 text-sm leading-relaxed", featured ? "text-stone-300" : "text-stone-600")}>
                  {pkg.description}
                </p>

                <p className="mt-6 flex items-baseline gap-2">
                  <span className={cn("font-display text-4xl font-semibold", featured ? "text-white" : "text-stone-900")}>
                    {formatCurrency(pkg.priceCents, pkg.currency)}
                  </span>
                  <span className={cn("text-sm", featured ? "text-stone-400" : "text-stone-500")}>once</span>
                </p>

                <dl className={cn("mt-8 space-y-5 border-t pt-6", featured ? "border-stone-700" : "border-stone-100")}>
                  <div>
                    <dt className={cn("text-xs font-semibold uppercase tracking-wider", featured ? "text-stone-400" : "text-stone-400")}>
                      What&apos;s included
                    </dt>
                    <dd className={cn("mt-2 text-sm leading-relaxed", featured ? "text-stone-300" : "text-stone-600")}>
                      {details.vault}
                    </dd>
                  </div>
                  <div>
                    <dt className={cn("text-xs font-semibold uppercase tracking-wider", featured ? "text-stone-400" : "text-stone-400")}>
                      Photos
                    </dt>
                    <dd className={cn("mt-2 text-sm", featured ? "text-stone-300" : "text-stone-600")}>
                      {unlimited ? "Unlimited (fair use)" : `Up to ${photoLimit}`}
                    </dd>
                  </div>
                  <div>
                    <dt className={cn("text-xs font-semibold uppercase tracking-wider", featured ? "text-stone-400" : "text-stone-400")}>
                      Uploads stay open
                    </dt>
                    <dd className={cn("mt-2 text-sm", featured ? "text-stone-300" : "text-stone-600")}>{details.upload}</dd>
                  </div>
                  <div>
                    <dt className={cn("text-xs font-semibold uppercase tracking-wider", featured ? "text-stone-400" : "text-stone-400")}>
                      Downloads stay open
                    </dt>
                    <dd className={cn("mt-2 text-sm", featured ? "text-stone-300" : "text-stone-600")}>{details.download}</dd>
                  </div>
                </dl>

                <div className="mt-auto pt-8">
                  <Link
                    href={pkg.code === "platinum" ? "/examples/platinum" : pkg.code === "gold" ? "/examples/gold" : "/examples/silver"}
                    className={cn(
                      "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all",
                      featured
                        ? "bg-rose-brand text-white hover:bg-rose-500"
                        : "border border-stone-300 text-stone-700 hover:border-stone-900 hover:bg-stone-900 hover:text-white",
                    )}
                  >
                    View {pkg.name} example
                    <IconArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-10 flex items-center justify-center gap-2 text-sm text-stone-500">
          <IconCheck className="h-4 w-4 text-rose-brand" />
          Every package includes a private vault, QR code and guest uploads.
        </p>
      </section>

      <SiteFooter />
    </div>
  );
}