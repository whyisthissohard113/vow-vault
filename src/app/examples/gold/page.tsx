import type { Metadata } from "next";

import { ExampleVault } from "@/components/examples/example-vault";
import { getTierDemo } from "@/lib/examples/tier-demos";
import { SITE_NAME } from "@/content/site";

const demo = getTierDemo("gold");

export const metadata: Metadata = {
  title: `Gold Package Demo Vault — ${SITE_NAME}`,
  description:
    "The Gold package as a real-feeling vault: photo gallery, guest photo + video uploads, live slideshow, custom banner and guestbook — gated by the real Gold feature list.",
  alternates: { canonical: "/examples/gold" },
};

export default function GoldExample() {
  return <ExampleVault wedding={demo.wedding} tier={demo.tier} mode="tier" />;
}