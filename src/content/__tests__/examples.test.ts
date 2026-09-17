/**
 * Contract tests for the `/examples` landing page data.
 *
 * Every requirement that renders on the landing page comes from `EXAMPLES`
 * (single source of truth), so the card contract is asserted here:
 * six fictional weddings, unique couples, valid package tiers, non-empty
 * venue/date/theme/story, and a resolvable "Open Vault" route for each.
 * Also guards against SVG gradient-id collisions (one DemoArtwork id per
 * image, globally unique across weddings) that could visually break a card.
 */

import { describe, it, expect } from "vitest";

import { EXAMPLES, getExampleById, type DemoPackageTier, type DemoThemeId } from "@/content/examples";
import { TIER_DEMOS } from "@/lib/examples/tier-demos";

const THEME_IDS: readonly DemoThemeId[] = [
  "classic-romance",
  "modern-minimal",
  "garden-wedding",
  "luxury",
  "boho",
  "african-contemporary",
];

const VALID_TIERS: readonly DemoPackageTier[] = ["Silver", "Gold", "Platinum"];

/** The documented package assigned to each fictional couple. */
const EXPECTED_TIERS: Record<DemoThemeId, DemoPackageTier> = {
  "classic-romance": "Gold",
  "modern-minimal": "Silver",
  "garden-wedding": "Gold",
  luxury: "Platinum",
  boho: "Gold",
  "african-contemporary": "Platinum",
};

describe("EXAMPLES — landing page contract", () => {
  it("exposes exactly the six documented themed weddings, in order", () => {
    expect(EXAMPLES.map((example) => example.id)).toEqual(THEME_IDS);
  });

  it("uses a unique couple per wedding (no duplicate couples)", () => {
    const couples = EXAMPLES.map((example) => example.coupleNames);
    expect(new Set(couples).size).toBe(EXAMPLES.length);
  });

  it("gives every wedding the correct package tier", () => {
    for (const example of EXAMPLES) {
      expect(example.packageTier).toBe(EXPECTED_TIERS[example.id]);
      expect(VALID_TIERS).toContain(example.packageTier);
    }
    // Package mix across the six demos stays intentional.
    const counts = EXAMPLES.reduce<Record<string, number>>((acc, example) => {
      acc[example.packageTier] = (acc[example.packageTier] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ Silver: 1, Gold: 3, Platinum: 2 });
  });

  it("shows a distinct theme for every wedding", () => {
    const themes = EXAMPLES.map((example) => example.theme);
    expect(themes.every((theme) => theme.length > 0)).toBe(true);
    expect(new Set(themes).size).toBe(EXAMPLES.length);
  });

  it("has all the per-card fields every card must display", () => {
    for (const example of EXAMPLES) {
      expect(example.coupleNames.length).toBeGreaterThan(0);
      expect(example.couple).toHaveLength(2);
      expect(example.dateLabel.length).toBeGreaterThan(0);
      expect(example.venue.length).toBeGreaterThan(0);
      expect(example.story.length).toBeGreaterThan(0);
      expect(example.qrHint.length).toBeGreaterThan(0);
      expect(example.colors.theme.length).toBeGreaterThan(0);
      expect(example.colors.label.length).toBeGreaterThan(0);
      // Cover selection on the card is `gallery[1] ?? gallery[0]`.
      expect(example.gallery.length).toBeGreaterThanOrEqual(2);
      expect(example.guestbook.length).toBeGreaterThan(0);
      for (const image of example.gallery) {
        expect(image.caption.length).toBeGreaterThan(0);
        expect(image.palette).toHaveLength(3);
      }
    }
  });

  it("keeps DemoArtwork SVG gradient ids globally unique", () => {
    const ids = EXAMPLES.flatMap((example) => example.gallery.map((image) => image.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(EXAMPLES.length * 6);
  });

  it("resolves every 'Open Vault' target to its demo route", () => {
    for (const example of EXAMPLES) {
      // getExampleById is the lookup behind /examples/[themeId].
      expect(getExampleById(example.id)).toBe(example);
    }
    expect(getExampleById("does-not-exist")).toBeUndefined();
  });

  it("maps every tier showcase link to a real tier route and wedding", () => {
    expect(TIER_DEMOS.map((demo) => demo.slug)).toEqual(["silver", "gold", "platinum"]);
    for (const demo of TIER_DEMOS) {
      expect(VALID_TIERS).toContain(demo.tier);
      expect(EXAMPLE_IDS_CONTAIN(demo.wedding.id)).toBe(true);
    }
  });
});

function EXAMPLE_IDS_CONTAIN(id: string): boolean {
  return EXAMPLES.some((example) => example.id === id);
}