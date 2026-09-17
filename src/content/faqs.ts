/**
 * FAQ content for the marketing site — the 15 canonical questions.
 *
 * Product facts (expiry windows, tier features) are derived from
 * `src/lib/entitlements/packages.ts` so answers always match the product.
 */

import {
  PackageCode,
  getPackageExpiryWindows,
} from "@/lib/entitlements/packages";

const silver = getPackageExpiryWindows(PackageCode.SILVER);
const gold = getPackageExpiryWindows(PackageCode.GOLD);
const platinum = getPackageExpiryWindows(PackageCode.PLATINUM);

export interface FaqQuestion {
  q: string;
  a: string;
  category: "Basics" | "Guests" | "Customization" | "After the wedding" | "For wedding companies";
}

export const FAQS: readonly FaqQuestion[] = [
  {
    category: "Basics",
    q: "What is Vow Vault?",
    a: "Vow Vault is one private digital vault for your entire wedding memory. Your guests share the photos and videos they captured, leave messages, and everything lands together in one beautiful vault — at original quality, ready to download and keep forever.",
  },
  {
    category: "After the wedding",
    q: "How long is the vault available?",
    a: "Your vault stays available long after the wedding. Each package has an upload window and a download window — both calculated from your wedding date in Africa/Johannesburg — and both enforced server-side. After the download window closes the memories stay preserved in your vault, styled for browsing and remembering.",
  },
  {
    category: "After the wedding",
    q: "What happens after the wedding?",
    a: `Uploads stay open for ${silver.uploadDays} days on Silver and ${gold.uploadDays} days on Gold & Platinum, so guests can share photos from home after the big day. Downloads stay open for ${silver.downloadDays} days on Silver, ${gold.downloadDays} days on Gold and ${platinum.downloadDays} days on Platinum — plenty of time to download everything at original quality. After that the vault remains a private keepsake to visit whenever you like.`,
  },
  {
    category: "Guests",
    q: "Do guests need an app?",
    a: "No app at all. Guests just open the vault link in their phone's browser — it's responsive and works beautifully on any phone. Scan, tap, upload. That's the whole experience.",
  },
  {
    category: "Guests",
    q: "Do guests need an account?",
    a: "No. Guests upload through a temporary guest session — no account, no password, no app store, no sign-up wall. This is exactly why every guest actually contributes, from tech-savvy cousins to grandparents.",
  },
  {
    category: "Guests",
    q: "How does the QR code work?",
    a: "Each vault gets a unique QR code that encodes only the public vault URL. Print it, pop it on tables, add it to your invitations or project it at the venue. When a guest scans it with their phone camera, the vault opens instantly and they can upload photos, videos and messages.",
  },
  {
    category: "Guests",
    q: "Can guests upload videos?",
    a: "Yes — on Gold and Platinum packages guests can upload videos straight from their phones. Videos are processed server-side and appear in the gallery for everyone to enjoy, with a live slideshow on Gold & Platinum.",
  },
  {
    category: "Guests",
    q: "Can guests upload multiple photos?",
    a: "Absolutely. Guests select several photos at once from their phone and they upload in the background. Silver has a fair-use limit of 500 photos; Gold and Platinum offer unlimited photo uploads as a commercial entitlement (technical fair-use safeguards still apply).",
  },
  {
    category: "Guests",
    q: "Can guests leave messages?",
    a: "Yes. Every package includes a digital guestbook, so your guests can leave words along with their photos and videos — messages that become part of the memory itself.",
  },
  {
    category: "Guests",
    q: "What happens if someone cannot scan the QR?",
    a: "They don't need the QR at all. The vault has a simple, stable web address. Anyone without a QR reader — or who prefers not to scan — can open the link sent by text, WhatsApp or email, or read it from the QR card's printed URL.",
  },
  {
    category: "Customization",
    q: "Can we customize the vault?",
    a: "Yes. Every package supports custom theme and accent colours plus your names and wedding date displayed elegantly. Gold adds a custom banner, and Platinum adds an intro video or image, the interactive flipbook and beautifully designed QR cards.",
  },
  {
    category: "Customization",
    q: "Can we use our wedding colours?",
    a: "Yes — every package includes custom colours, so the vault can match your wedding palette from day one. Platinum's QR design cards also carry your colours, names and a personal message.",
  },
  {
    category: "After the wedding",
    q: "Can we download our memories?",
    a: "Yes. Guests and the couple can download memories at original quality inside the download window — no compression, no watermarks. Silver offers 7 download days, Gold 30, and Platinum 90, all calculated from your wedding date in Africa/Johannesburg. Downloads close automatically server-side after the window.",
  },
  {
    category: "For wedding companies",
    q: "Can wedding companies use Vow Vault?",
    a: "Yes — Vow Vault is built for wedding planners, venues, photographers and companies. Offer a private memory vault to every couple you work with as your own branded product, manage their vaults from one dashboard, and give your clients a gift they'll remember forever.",
  },
  {
    category: "For wedding companies",
    q: "Can wedding companies white-label Vow Vault?",
    a: "Yes. When you partner with Vow Vault, the vaults you offer carry your brand — your logo, your colours, your name — while the full Vow Vault platform works invisibly behind it. Manage multiple client vaults, invite couples and keep everything under your own brand. Contact us for partnership details.",
  },
] as const;