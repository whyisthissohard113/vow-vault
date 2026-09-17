/**
 * Shared types for the interactive wedding demo components.
 *
 * The demo components are intentionally decoupled from hardcoded couples:
 * they accept a `WeddingDemo` object (plain data from `@/content/examples`)
 * so the marketing site could later feed them real API-shaped data.
 */

import type {
  WeddingDemo,
  DemoImage,
  DemoMotif,
  DemoGuestbookEntry,
  DemoPackageTier,
  DemoThemeId,
} from "@/content/examples";

export type {
  WeddingDemo,
  DemoImage,
  DemoMotif,
  DemoGuestbookEntry,
  DemoPackageTier,
  DemoThemeId,
};