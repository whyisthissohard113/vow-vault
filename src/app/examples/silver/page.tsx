import type { Metadata } from "next";

import { ExampleVault } from "@/components/examples/example-vault";
import { getTierDemo } from "@/lib/examples/tier-demos";
import { SITE_NAME } from "@/content/site";

const demo = getTierDemo("silver");

export const metadata: Metadata = {
  title: `Silver Package Demo Vault — ${SITE_NAME}`,
  description:
    "The Silver package as a real-feeling vault: photo gallery, guest uploads, QR access and guestbook — gated by the real Silver feature list.",
  alternates: { canonical: "/examples/silver" },
};

export default function SilverExample() {
  return <ExampleVault wedding={demo.wedding} tier={demo.tier} mode="tier" />;
}