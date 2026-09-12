import Link from "next/link";
import Image from "next/image";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { IconArrowRight } from "@/components/icons";
import { PACKAGE_METADATA } from "@/lib/entitlements/packages";
import { formatCurrency } from "@/lib/format";

export default function Examples() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <section className="container-page py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-brand">Real examples</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
            See the packages in practice
          </h1>
          <p className="mx-auto mt-5 text-lg text-stone-600">
            Each example showcases the vault design, gallery style and features
            available at that tier.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {PACKAGE_METADATA.map((pkg) => (
            <Link
              key={pkg.code}
              href={`/examples/${pkg.code}`}
              className="group card-soft overflow-hidden border border-stone-200/70 bg-white transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-sand">
                <Image
                  src="/placeholder-wedding.svg"
                  alt={`${pkg.name} wedding example`}
                  fill
                  unoptimized
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(min-width: 768px) 33vw, 100vw"
                />
              </div>
              <div className="p-6">
                <h2 className="font-display text-xl font-semibold text-stone-900">{pkg.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{pkg.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-stone-900">
                    {formatCurrency(pkg.priceCents, pkg.currency)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-rose-brand">
                    View example
                    <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="rounded-3xl bg-stone-900 px-8 py-16 text-center sm:px-16">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Find the right package for your couple
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-stone-300">
            From Silver&apos;s basic gallery to Platinum&apos;s premium experience, there&apos;s a
            package for every wedding budget and vision.
          </p>
          <Link href="/pricing" className="btn-primary mt-8 h-12">
            <span>View all packages</span>
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}