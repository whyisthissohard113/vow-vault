/**
 * Tier → demo wedding mapping.
 *
 * The `/examples/silver|gold|platinum` routes demonstrate the package
 * experience using one of the six fictional weddings, so the same interactive
 * vault can be explored from a package angle. Kept in one place so the
 * examples index and the tier routes can never disagree.
 */

import type { DemoPackageTier, WeddingDemo } from "@/content/examples";
import { EXAMPLES } from "@/content/examples";

export type TierSlug = "silver" | "gold" | "platinum";

export interface TierDemoLink {
  slug: TierSlug;
  tier: DemoPackageTier;
  wedding: WeddingDemo;
}

export const TIER_DEMOS: readonly TierDemoLink[] = [
  { slug: "silver", tier: "Silver", wedding: EXAMPLES[1] }, // modern-minimal
  { slug: "gold", tier: "Gold", wedding: EXAMPLES[0] }, // classic-romance
  { slug: "platinum", tier: "Platinum", wedding: EXAMPLES[3] }, // luxury
] as const;

export function getTierDemo(slug: TierSlug): TierDemoLink {
  return TIER_DEMOS.find((demo) => demo.slug === slug) ?? TIER_DEMOS[0];
}
