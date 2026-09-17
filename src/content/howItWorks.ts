/**
 * How-it-works content: the 3 (4) step journey plus the extended lifecycle
 * motif (BEFORE → DURING(LIVE) → AFTER → FOREVER) used across the site.
 */

export interface HowItWorksStep {
  number: string;
  title: string;
  lead: string;
  body: string;
}

export interface LifecyclePhase {
  id: "before" | "during" | "after" | "forever";
  label: string;
  title: string;
  body: string;
}

export interface DemoStep {
  id: "create" | "share" | "collect" | "relive";
  label: string;
  title: string;
  body: string;
}

export const HOW_IT_WORKS_STEPS: readonly HowItWorksStep[] = [
  {
    number: "01",
    title: "CREATE",
    lead: "Create your vault in about two minutes.",
    body: "Name the wedding, add your date, pick a package and theme — and your private vault is ready, with its own unique QR code. No technical skills, no waiting.",
  },
  {
    number: "02",
    title: "SHARE",
    lead: "Share QR cards, invites and links.",
    body: "Print the QR design card, add it to your invitations, project it at the venue or message the link. Each guest just points their phone — no app, no account, no group to join.",
  },
  {
    number: "03",
    title: "COLLECT",
    lead: "Watch every memory land in one private vault.",
    body: "Photos, videos and messages appear in the vault as guests share them. Everything arrives at original quality, sorted into one beautiful gallery only you and your guests can see.",
  },
] as const;

export const LIFECYCLE_PHASES: readonly LifecyclePhase[] = [
  {
    id: "before",
    label: "BEFORE",
    title: "Create. Customize. Prepare.",
    body: "Set up your vault, choose your colours, and generate your QR code. Announce it to guests before the big day so everyone knows where their photos will live.",
  },
  {
    id: "during",
    label: "DURING — LIVE",
    title: "Scan. Upload. Watch it come alive.",
    body: "At the venue, guests scan, tap and share. New memories appear LIVE as they happen — watch the slideshow fill with every perspective of your day.",
  },
  {
    id: "after",
    label: "AFTER",
    title: "Download. Relive. Keep.",
    body: "When the celebration ends, the collection continues. Download everything at original quality inside your window, or browse the album and flipbook as a keepsake.",
  },
  {
    id: "forever",
    label: "FOREVER",
    title: "Preserved for every anniversary.",
    body: "Long after the window closes, your vault stays — a private, beautiful record of the day, ready whenever you want to remember it together.",
  },
] as const;

export const DEMO_STEPS: readonly DemoStep[] = [
  {
    id: "create",
    label: "CREATE",
    title: "A vault, in about two minutes",
    body: "Name the wedding, add your date, pick a package and theme — your private vault and QR code appear instantly.",
  },
  {
    id: "share",
    label: "SHARE",
    title: "Your QR code, everywhere it matters",
    body: "Print cards, add them to invitations, project them at the venue. Guests scan with their phone camera — nothing to install.",
  },
  {
    id: "collect",
    label: "COLLECT",
    title: "Guest uploads, at original quality",
    body: "Photos, videos and messages land in the vault as guests share them — no app, no account, no compression.",
  },
  {
    id: "relive",
    label: "RELIVE",
    title: "A gallery that feels like the day",
    body: "Browse, play slideshows, open the album, and relive every unforgettable moment from every guest's perspective.",
  },
] as const;