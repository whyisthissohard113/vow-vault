/**
 * Derived demo data for the interactive example vaults.
 *
 * The six fictional weddings in `@/content/examples` are the single source of
 * truth. Everything here is a pure, deterministic projection of that data —
 * gallery categories, demo video items, flipbook pages and the unified
 * "memory" shape the vault components render. Nothing is randomised at render
 * time (SSR-safe) and nothing touches storage or an API.
 */

import type {
  DemoImage,
  DemoMotif,
  WeddingDemo,
} from "@/content/examples";

export type DemoCategory =
  | "Ceremony"
  | "Reception"
  | "Dance"
  | "Guests"
  | "Details";

export const DEMO_CATEGORIES: readonly DemoCategory[] = [
  "Ceremony",
  "Reception",
  "Dance",
  "Guests",
  "Details",
] as const;

const MOTIF_CATEGORY: Record<DemoMotif, DemoCategory> = {
  veil: "Ceremony",
  vows: "Ceremony",
  rings: "Details",
  bouquet: "Details",
  toast: "Reception",
  sparklers: "Reception",
  dance: "Dance",
  firstdance: "Dance",
  confetti: "Guests",
  goldenhour: "Guests",
};

export function getImageCategory(motif: DemoMotif): DemoCategory {
  return MOTIF_CATEGORY[motif];
}

/** Unified gallery item: either demo artwork or a locally uploaded file. */
export interface VaultMemory {
  id: string;
  caption: string;
  category: DemoCategory;
  /** Demo artwork spec (used with `<DemoArtwork />`). */
  image?: DemoImage;
  /** Object URL for a locally uploaded file (demo session only). */
  src?: string;
  /** True when this item was added by the visitor in this session. */
  isDemoUpload?: boolean;
  /** Uploader name for demo uploads. */
  by?: string;
}

export function toVaultMemories(wedding: WeddingDemo): VaultMemory[] {
  return wedding.gallery.map((image) => ({
    id: image.id,
    caption: image.caption,
    category: getImageCategory(image.motif),
    image,
  }));
}

export interface DemoVideo {
  id: string;
  title: string;
  note: string;
  image: DemoImage;
  duration: string;
  isDemoUpload?: boolean;
  src?: string;
}

const DEMO_DURATIONS = ["0:18", "0:31", "0:42"] as const;

/**
 * Demo video gallery for Gold+ packages. There is no real customer footage in
 * the repo, so each item pairs an abstract demo artwork still with an explicit
 * "Demo video" label and a simulated player.
 */
export function getDemoVideos(wedding: WeddingDemo): DemoVideo[] {
  const gallery = wedding.gallery;
  if (gallery.length === 0) return [];

  const videos: DemoVideo[] = [
    {
      id: "demo-video-1",
      title: wedding.videoTitle ?? "Guest video — the speeches",
      note: wedding.videoNote ?? "Every guest clip lands in the vault.",
      image: gallery[1 % gallery.length],
      duration: DEMO_DURATIONS[0],
    },
    {
      id: "demo-video-2",
      title: "Guest clip — the dance floor",
      note: "Filmed by a guest, four tables away.",
      image: gallery[3 % gallery.length],
      duration: DEMO_DURATIONS[1],
    },
    {
      id: "demo-video-3",
      title: "Guest clip — the send-off",
      note: "The last 42 seconds before the car pulled away.",
      image: gallery[5 % gallery.length],
      duration: DEMO_DURATIONS[2],
    },
  ];

  return videos;
}

export interface FlipbookPage {
  id: string;
  title: string;
  subtitle: string;
  image: DemoImage;
}

/**
 * Platinum flipbook pages. Pages map onto the actual demo gallery so the
 * keepsake always reflects the wedding's own memories.
 */
export function getFlipbookPages(wedding: WeddingDemo): FlipbookPage[] {
  const g = wedding.gallery;
  if (g.length === 0) return [];
  const pick = (index: number) => g[index % g.length];

  return [
    {
      id: "fb-cover",
      title: "Couple introduction",
      subtitle: `${wedding.coupleNames} · ${wedding.dateLabel}`,
      image: pick(0),
    },
    { id: "fb-ceremony", title: "Ceremony", subtitle: wedding.venue, image: pick(1) },
    { id: "fb-rings", title: "Rings", subtitle: "The details that started it all", image: pick(2) },
    { id: "fb-dance", title: "First dance", subtitle: "The room went quiet", image: pick(3) },
    { id: "fb-reception", title: "Reception", subtitle: "Long tables, longer stories", image: pick(4) },
    { id: "fb-sendoff", title: "Send-off", subtitle: "And just like that", image: pick(5) },
  ];
}

/** Short display names for the package tier (canonical names). */
export const TIER_LABEL: Record<"Silver" | "Gold" | "Platinum", string> = {
  Silver: "Silver",
  Gold: "Gold",
  Platinum: "Platinum",
};

/** Public demo path for a wedding, used for the QR payload. */
export function demoVaultPath(wedding: WeddingDemo): string {
  return `/examples/${wedding.id}`;
}
