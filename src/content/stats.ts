/**
 * Trust-bar statistics for the marketing site.
 *
 * IMPORTANT: these numbers are DEVELOPMENT PLACEHOLDERS, not real customer
 * metrics. The site must never present them as verified social proof.
 */

export interface TrustStatItem {
  id: string;
  value: number;
  suffix: string;
  label: string;
}

export interface TrustBarContent {
  eyebrow: string;
  isDevelopmentPlaceholder: true;
  items: readonly TrustStatItem[];
}

export const TRUST_BAR: TrustBarContent = {
  eyebrow: "Built for unforgettable wedding days.",
  isDevelopmentPlaceholder: true,
  items: [
    { id: "memories", value: 10000, suffix: "+", label: "memories captured" },
    { id: "weddings", value: 500, suffix: "+", label: "weddings celebrated" },
    { id: "couples", value: 98, suffix: "%", label: "happy couples" },
  ],
} as const;