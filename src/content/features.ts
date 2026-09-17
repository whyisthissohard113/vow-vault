/**
 * Feature list for the marketing site — 10 core features of Vow Vault.
 *
 * Plain data only. Component files map `icon` keys to icon components.
 * An admin CMS can drive the marketing site from this shape in future.
 */

export type FeatureIconKey =
  | "qr"
  | "unlimited-photos"
  | "video"
  | "slideshow"
  | "lock"
  | "guestbook"
  | "album"
  | "flipbook"
  | "qr-cards"
  | "custom-page";

export interface Feature {
  id: string;
  icon: FeatureIconKey;
  title: string;
  short: string;
  long: string;
  example?: string;
  tierBadge?: string;
}

export const FEATURES: readonly Feature[] = [
  {
    id: "qr-guest-uploads",
    icon: "qr",
    title: "QR Guest Uploads",
    short: "Scan. Upload. Done.",
    long: "Place a QR code on tables or in invitations. Guests point their phone camera at it, the vault opens, and they upload — no app, no account, no group to join. Works on every phone with a camera.",
    example: "Perfect for receptions where guests are already taking photos.",
    tierBadge: "All packages",
  },
  {
    id: "unlimited-photos",
    icon: "unlimited-photos",
    title: "Unlimited Photos",
    short: "Every guest, every angle.",
    long: "With Gold and Platinum packages there is no cap on how many photos guests upload. Every speech captured from three tables. Every dance move. Every candid look between the couple. Nothing is a waste.",
    example: "Wedding of 200 guests could easily capture 500+ photos.",
    tierBadge: "Gold & Platinum",
  },
  {
    id: "video-memories",
    icon: "video",
    title: "Video Memories",
    short: "The moments a photo can't hold.",
    long: "Let guests capture full video — first dances from their table, heartfelt speeches on their phone, surprise performances. Videos upload straight from any phone and appear in the gallery after processing.",
    example: "A 20-second clip of your best friend's speech at their table.",
    tierBadge: "Gold & Platinum",
  },
  {
    id: "live-slideshow",
    icon: "slideshow",
    title: "Live Slideshow",
    short: "Watch the day unfold in real time.",
    long: "As guests upload, the slideshow starts playing live. See every perspective of the first kiss. Watch the dance floor build from empty to packed. Proximity to the couple changes the story — your vault captures all of them.",
    example: "Project the slideshow during the reception for all to see.",
    tierBadge: "Gold & Platinum",
  },
  {
    id: "private-vault",
    icon: "lock",
    title: "Private Vault",
    short: "Your memories. Your world.",
    long: "Every vault is completely private — hidden from search engines, protected by unique URLs, and with media links that expire. Upload and download windows are enforced server-side. Your wedding memories stay safe.",
    example: "No one can stumble onto your vault through a web search.",
    tierBadge: "All packages",
  },
  {
    id: "digital-guestbook",
    icon: "guestbook",
    title: "Digital Guestbook",
    short: "Messages as meaningful as the memories.",
    long: "Alongside photos and videos, guests leave written messages — what they saw, felt and loved about the day. These become part of your wedding memory, perfectly paired with the moments they captured.",
    example: "A guestbook entry paired with the photo they took at the same moment.",
    tierBadge: "All packages",
  },
  {
    id: "digital-album",
    icon: "album",
    title: "Digital Album",
    short: "Curated, beautiful, together.",
    long: "Your memories are presented in an elegant digital album — organized, styled and ready to enjoy. Browse by photo, video or message. Download the entire album before the window closes.",
    example: "An album cover styled to your wedding colours.",
    tierBadge: "All packages",
  },
  {
    id: "flipbook",
    icon: "flipbook",
    title: "Interactive Flipbook",
    short: "A keepsake you can touch.",
    long: "An interactive page-flip album that gives your digital memories the weight of a physical keepsake. Two-page spreads on desktop, swipeable pages on mobile. The ultimate way to revisit your day.",
    example: "A 30-page flipbook with guest photos, messages and your wedding story.",
    tierBadge: "Platinum",
  },
  {
    id: "custom-qr-cards",
    icon: "qr-cards",
    title: "Custom QR Cards",
    short: "Designed for your tables.",
    long: "Beautifully designed QR cards in PNG or PDF format, featuring your names, wedding date and chosen colours. Print them for table centrepieces, slip them into invitations, or project them at the venue.",
    example: "A watercolour card with gold foil-style QR and your names in cursive.",
    tierBadge: "Platinum",
  },
  {
    id: "custom-wedding-page",
    icon: "custom-page",
    title: "Custom Wedding Page",
    short: "Your day. Your design.",
    long: "Every package includes custom theme and accent colours to match your wedding palette. Gold adds a custom banner, and Platinum adds an intro video or image — your vault looks like it was built for your celebration.",
    example: "Deep emerald and gold colours for a winter garden wedding.",
    tierBadge: "All packages",
  },
] as const;