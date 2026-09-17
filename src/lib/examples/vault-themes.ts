/**
 * Per-theme visual identity for the interactive example vaults.
 *
 * Each of the six fictional weddings gets a genuinely different vault look —
 * not just a swapped accent colour. The theme drives typography, corner radius,
 * surfaces, hero composition and the overall light/dark mood. Values are exposed
 * as CSS custom properties on the vault root and consumed by the `.vault-*`
 * utility classes in `globals.css`.
 */

import type { CSSProperties } from "react";
import type { DemoThemeId } from "@/content/examples";

export interface VaultTheme {
  id: DemoThemeId;
  label: string;
  mode: "light" | "dark";
  bg: string;
  surface: string;
  surfaceElevated: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  accentInk: string;
  /** Base corner radius for cards/surfaces. */
  radius: string;
  /** Use the serif display face for headings. */
  display: boolean;
  /** Hero composition. */
  hero: "split" | "centered" | "banner";
  /** Eyebrow letter-spacing. */
  eyebrowTracking: string;
  /** Optional ambient background texture layered behind the vault. */
  texture: string;
}

export const VAULT_THEMES: Record<DemoThemeId, VaultTheme> = {
  "classic-romance": {
    id: "classic-romance",
    label: "Classic Romance",
    mode: "light",
    bg: "#faf6ef",
    surface: "#fffdf9",
    surfaceElevated: "#ffffff",
    ink: "#2b241c",
    muted: "#7c7366",
    line: "#e8dfd1",
    accent: "#b08d57",
    accentInk: "#fffdf9",
    radius: "1.25rem",
    display: true,
    hero: "split",
    eyebrowTracking: "0.22em",
    texture:
      "radial-gradient(60% 46% at 50% 0%, rgba(176,141,87,0.18), transparent 70%)",
  },
  "modern-minimal": {
    id: "modern-minimal",
    label: "Modern Minimal",
    mode: "light",
    bg: "#f4f4f2",
    surface: "#ffffff",
    surfaceElevated: "#ffffff",
    ink: "#1b1b1b",
    muted: "#6d6d6a",
    line: "#e3e3df",
    accent: "#1b1b1b",
    accentInk: "#ffffff",
    radius: "0.2rem",
    display: false,
    hero: "centered",
    eyebrowTracking: "0.36em",
    texture: "linear-gradient(180deg, rgba(0,0,0,0.035), transparent 26%)",
  },
  "garden-wedding": {
    id: "garden-wedding",
    label: "Garden Wedding",
    mode: "light",
    bg: "#f4f7ee",
    surface: "#ffffff",
    surfaceElevated: "#fbfdf6",
    ink: "#283321",
    muted: "#68755d",
    line: "#dde5d0",
    accent: "#6f8f57",
    accentInk: "#ffffff",
    radius: "1.5rem",
    display: true,
    hero: "banner",
    eyebrowTracking: "0.24em",
    texture:
      "radial-gradient(70% 50% at 18% 0%, rgba(111,143,87,0.2), transparent 68%)",
  },
  luxury: {
    id: "luxury",
    label: "Luxury",
    mode: "dark",
    bg: "#14110c",
    surface: "#1d1913",
    surfaceElevated: "#272018",
    ink: "#f5ebd8",
    muted: "#bbaa88",
    line: "#3b3223",
    accent: "#c9a96e",
    accentInk: "#191308",
    radius: "0.7rem",
    display: true,
    hero: "banner",
    eyebrowTracking: "0.3em",
    texture:
      "radial-gradient(70% 60% at 50% -10%, rgba(201,169,110,0.28), transparent 62%)",
  },
  boho: {
    id: "boho",
    label: "Boho",
    mode: "light",
    bg: "#f8efe3",
    surface: "#fffbf4",
    surfaceElevated: "#fffdfa",
    ink: "#33251d",
    muted: "#8a7060",
    line: "#ead9c5",
    accent: "#b06a3f",
    accentInk: "#fffbf4",
    radius: "1.75rem",
    display: true,
    hero: "split",
    eyebrowTracking: "0.2em",
    texture:
      "radial-gradient(60% 50% at 82% 4%, rgba(176,106,63,0.22), transparent 66%)",
  },
  "african-contemporary": {
    id: "african-contemporary",
    label: "African Contemporary",
    mode: "dark",
    bg: "#131127",
    surface: "#1c1938",
    surfaceElevated: "#26214d",
    ink: "#f7efe0",
    muted: "#b7aecf",
    line: "#37315f",
    accent: "#e0a24f",
    accentInk: "#221806",
    radius: "1rem",
    display: true,
    hero: "banner",
    eyebrowTracking: "0.26em",
    texture:
      "radial-gradient(80% 60% at 15% 0%, rgba(224,162,79,0.26), transparent 60%), radial-gradient(60% 50% at 100% 10%, rgba(80,72,190,0.32), transparent 66%)",
  },
};

export function getVaultTheme(id: DemoThemeId): VaultTheme {
  return VAULT_THEMES[id];
}

export function vaultStyleVars(theme: VaultTheme): CSSProperties {
  return {
    "--vault-bg": theme.bg,
    "--vault-surface": theme.surface,
    "--vault-surface-elevated": theme.surfaceElevated,
    "--vault-ink": theme.ink,
    "--vault-muted": theme.muted,
    "--vault-line": theme.line,
    "--vault-accent": theme.accent,
    "--vault-accent-ink": theme.accentInk,
    "--vault-radius": theme.radius,
    "--vault-texture": theme.texture,
  } as CSSProperties;
}
