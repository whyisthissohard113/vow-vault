import type { Metadata } from "next";

import { ExampleVault } from "@/components/examples/example-vault";
import { getTierDemo } from "@/lib/examples/tier-demos";
import { SITE_NAME } from "@/content/site";

const demo = getTierDemo("platinum");

export const metadata: Metadata = {
  title: `Platinum Package Demo Vault — ${SITE_NAME}`,
  description:
    "The Platinum package as a real-feeling vault: intro experience, gallery, guest uploads, slideshow, flipbook, QR design cards and the 90-day download demo — gated by the real Platinum feature list.",
  alternates: { canonical: "/examples/platinum" },
};

export default function PlatinumExample() {
  return <ExampleVault wedding={demo.wedding} tier={demo.tier} mode="tier" />;
}