/**
 * Contract tests for the reusable demo-vault theme layer.
 *
 * One `ExampleVault` shell renders all six fictional weddings; the per-wedding
 * "skin" (typography, colours, radius, mood, hero composition) comes entirely
 * from `VAULT_THEMES`, so the interface is guaranteed to change with the
 * selected wedding — never a static marketing look.
 */

import { describe, it, expect } from "vitest";

import { EXAMPLES } from "@/content/examples";
import {
  VAULT_THEMES,
  getVaultTheme,
  vaultStyleVars,
} from "@/lib/examples/vault-themes";

describe("VAULT_THEMES — demo vault shell identity", () => {
  it("provides a theme for every showcased wedding (one shell, six skins)", () => {
    const themeIds = EXAMPLES.map((example) => example.id);
    expect(Object.keys(VAULT_THEMES).sort()).toEqual([...themeIds].sort());
  });

  it("looks up every theme by its wedding id", () => {
    for (const example of EXAMPLES) {
      const theme = getVaultTheme(example.id);
      expect(theme.id).toBe(example.id);
      expect(theme.label.length).toBeGreaterThan(0);
    }
  });

  it("changes the interface per wedding: unique accent, radius and typeface mix", () => {
    const accents = Object.values(VAULT_THEMES).map((theme) => theme.accent.toLowerCase());
    expect(new Set(accents).size).toBe(EXAMPLES.length);

    const radii = Object.values(VAULT_THEMES).map((theme) => theme.radius);
    expect(new Set(radii).size).toBeGreaterThanOrEqual(3);

    const displayFaces = new Set(Object.values(VAULT_THEMES).map((theme) => theme.display));
    expect(displayFaces.size).toBe(2); // some serif, some sans

    const heroStyles = Object.values(VAULT_THEMES).map((theme) => theme.hero);
    for (const style of ["split", "centered", "banner"]) expect(heroStyles).toContain(style);
  });

  it("spans both light and dark moods", () => {
    const modes = new Set(Object.values(VAULT_THEMES).map((theme) => theme.mode));
    expect(modes).toContain("light");
    expect(modes).toContain("dark");
  });

  it("exposes every CSS variable the vault root consumes", () => {
    for (const theme of Object.values(VAULT_THEMES)) {
      const vars = vaultStyleVars(theme) as Record<string, string>;
      for (const key of [
        "--vault-bg",
        "--vault-surface",
        "--vault-surface-elevated",
        "--vault-ink",
        "--vault-muted",
        "--vault-line",
        "--vault-accent",
        "--vault-accent-ink",
        "--vault-radius",
        "--vault-texture",
      ]) {
        expect(vars[key]).toBeDefined();
        expect(vars[key].length).toBeGreaterThan(0);
      }
    }
  });
});