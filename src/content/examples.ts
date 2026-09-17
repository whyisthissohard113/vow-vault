/**
 * Demo wedding examples for the marketing site.
 *
 * All six themed weddings are FICTIONAL demo data (no real couples, venues or
 * photos). Imagery is rendered by `<DemoArtwork />` from the motif/palette
 * specs below — the marketing site never touches real storage or APIs.
 */

export type DemoThemeId =
  | "classic-romance"
  | "modern-minimal"
  | "garden-wedding"
  | "luxury"
  | "boho"
  | "african-contemporary";

export type DemoMotif =
  | "rings"
  | "bouquet"
  | "dance"
  | "sparklers"
  | "vows"
  | "confetti"
  | "goldenhour"
  | "veil"
  | "toast"
  | "firstdance";

export interface DemoImage {
  id: string;
  caption: string;
  motif: DemoMotif;
  /** Three gradient stops used by the SVG artwork renderer. */
  palette: [string, string, string];
}

export interface DemoGuestbookEntry {
  id: string;
  name: string;
  message: string;
  moment: string;
}

export type DemoPackageTier = "Silver" | "Gold" | "Platinum";

export interface WeddingDemo {
  id: DemoThemeId;
  title: string;
  theme: string;
  coupleNames: string;
  couple: [string, string];
  dateLabel: string;
  venue: string;
  story: string;
  colors: { theme: string; accent: string; label: string };
  packageTier: DemoPackageTier;
  videoTitle?: string;
  videoNote?: string;
  gallery: DemoImage[];
  guestbook: DemoGuestbookEntry[];
  qrHint: string;
}

const GALLERY_CLASSIC: DemoImage[] = [
  { id: "c1", caption: "Getting ready — the veil", motif: "veil", palette: ["#f3e7d7", "#e7cfb2", "#c9a96e"] },
  { id: "c2", caption: "The rings", motif: "rings", palette: ["#f7efe3", "#e3c9a0", "#a1733f"] },
  { id: "c3", caption: "Bouquet toss", motif: "bouquet", palette: ["#f6ddd0", "#e6b8a0", "#9c6b4f"] },
  { id: "c4", caption: "First dance", motif: "firstdance", palette: ["#efe2cf", "#dcbf96", "#8f6f3f"] },
  { id: "c5", caption: "Sparkler send-off", motif: "sparklers", palette: ["#f7edd8", "#e8c98f", "#b08d57"] },
  { id: "c6", caption: "The toasts", motif: "toast", palette: ["#f4e9dc", "#dcc3a2", "#a0805a"] },
];

const GALLERY_MODERN: DemoImage[] = [
  { id: "m1", caption: "Minimalist ceremony", motif: "vows", palette: ["#ece8e2", "#d8d2c8", "#9b9287"] },
  { id: "m2", caption: "The rings, in shadow", motif: "rings", palette: ["#e5e1db", "#c8c2b8", "#7c7366"] },
  { id: "m3", caption: "City confetti", motif: "confetti", palette: ["#efe9df", "#d3c4ae", "#a1773f"] },
  { id: "m4", caption: "Dance floor", motif: "dance", palette: ["#242019", "#4a4238", "#b08d57"] },
  { id: "m5", caption: "Golden hour", motif: "goldenhour", palette: ["#e9dfce", "#cfa763", "#7c7366"] },
  { id: "m6", caption: "The quiet moment", motif: "veil", palette: ["#e8e3dc", "#cdc5b8", "#9b9287"] },
];

const GALLERY_GARDEN: DemoImage[] = [
  { id: "g1", caption: "Garden vows", motif: "vows", palette: ["#e9efe3", "#c8d5b5", "#7f9a6b"] },
  { id: "g2", caption: "Wildflower bouquet", motif: "bouquet", palette: ["#f2e6d6", "#e0c4a0", "#8a9b74"] },
  { id: "g3", caption: "The dance under linen", motif: "dance", palette: ["#ece9df", "#cfc9b4", "#9a9078"] },
  { id: "g4", caption: "Toasts in the orchard", motif: "toast", palette: ["#eee7d8", "#d9c8a8", "#7f9a6b"] },
  { id: "g5", caption: "Golden garden hour", motif: "goldenhour", palette: ["#f4ecd9", "#dfc489", "#8a9b74"] },
  { id: "g6", caption: "Sparkler exit", motif: "sparklers", palette: ["#f0ead9", "#ddd0ae", "#7f9a6b"] },
];

const GALLERY_LUXURY: DemoImage[] = [
  { id: "l1", caption: "Marble & gold details", motif: "rings", palette: ["#e7dfcf", "#cbb48a", "#8f6f3f"] },
  { id: "l2", caption: "The grand entrance", motif: "veil", palette: ["#252019", "#4a4030", "#c9a96e"] },
  { id: "l3", caption: "First dance, chandelier", motif: "firstdance", palette: ["#241f18", "#4c4234", "#b08d57"] },
  { id: "l4", caption: "On the terrace", motif: "goldenhour", palette: ["#efe3cf", "#d9b981", "#8f6f3f"] },
  { id: "l5", caption: "The champagne toast", motif: "toast", palette: ["#e9dfc9", "#cbb48a", "#7a664a"] },
  { id: "l6", caption: "A quiet glance", motif: "dance", palette: ["#2a251d", "#554a39", "#c9a96e"] },
];

const GALLERY_BOHO: DemoImage[] = [
  { id: "b1", caption: "Desert ceremony", motif: "vows", palette: ["#f2e3d2", "#dfbb93", "#b2763e"] },
  { id: "b2", caption: "Dried flower bouquet", motif: "bouquet", palette: ["#f4e2d0", "#e0b287", "#a8613f"] },
  { id: "b3", caption: "The dance at dusk", motif: "dance", palette: ["#3a2b23", "#6b4f3e", "#d9a05f"] },
  { id: "b4", caption: "Woven details", motif: "rings", palette: ["#eddfcd", "#d6b287", "#b2763e"] },
  { id: "b5", caption: "Golden hour hugs", motif: "goldenhour", palette: ["#f6e5cf", "#e2b878", "#b2763e"] },
  { id: "b6", caption: "Sparkler circle", motif: "sparklers", palette: ["#2e241d", "#5c4736", "#e0a85f"] },
];

const GALLERY_AFRICAN: DemoImage[] = [
  { id: "a1", caption: "Oceanfront ceremony", motif: "vows", palette: ["#f3e4d2", "#ddb98f", "#95a3a0"] },
  { id: "a2", caption: "The rings in ochre", motif: "rings", palette: ["#f0ddc8", "#d9a86f", "#a85f2f"] },
  { id: "a3", caption: "Cape infused details", motif: "bouquet", palette: ["#f2ddc6", "#dfae7d", "#8c5a33"] },
  { id: "a4", caption: "First dance at sunset", motif: "firstdance", palette: ["#2e211b", "#6b4530", "#e2a25f"] },
  { id: "a5", caption: "Laughter & confetti", motif: "confetti", palette: ["#f5e3cc", "#e0b57f", "#a85f2f"] },
  { id: "a6", caption: "The send-off", motif: "sparklers", palette: ["#241d18", "#554638", "#d9a05f"] },
];

export const EXAMPLES: readonly WeddingDemo[] = [
  {
    id: "classic-romance",
    title: "Classic Romance",
    theme: "Vineyard classics, blush & gold",
    coupleNames: "Emma & James",
    couple: ["Emma", "James"],
    dateLabel: "14 March 2026",
    venue: "Die Ou Pastorie, Franschhoek",
    story:
      "A candlelit manor wedding where every table had a story and every guest had a camera. The vault collected 480 photos and 23 videos before the last sparkler went out.",
    colors: { theme: "#8f6f3f", accent: "#c9a96e", label: "Gold & Ivory" },
    packageTier: "Gold",
    videoTitle: "Our first dance — guest cut",
    videoNote: "Filmed from three different tables by guests. Feels like being back in the room.",
    gallery: GALLERY_CLASSIC,
    guestbook: [
      { id: "gc1", name: "Aunt Mary", message: "Congratulations, darlings! I captured the moment he saw you in your dress — check the third photo.", moment: "Pre-ceremony" },
      { id: "gc2", name: "Liam (best man)", message: "James cried in the car on the way here. We will never let him forget it. What an incredible day!", moment: "Reception" },
      { id: "gc3", name: "Priya", message: "Your first dance had the whole room in tears. Thank you for letting us be part of it.", moment: "First dance" },
    ],
    qrHint: "The Gold QR card sits on every table — scan, upload, done.",
  },
  {
    id: "modern-minimal",
    title: "Modern Minimal",
    theme: "Clean lines, charcoal & ivory",
    coupleNames: "Lerato & Thabo",
    couple: ["Lerato", "Thabo"],
    dateLabel: "2 May 2026",
    venue: "Constitution Hill Gallery, Johannesburg",
    story:
      "A gallery loft wedding with a tablescape of white orchids and warm spotlighting. Guests captured the city lights, the confetti and the quiet moments in between.",
    colors: { theme: "#2c2620", accent: "#b08d57", label: "Charcoal & Gold" },
    packageTier: "Silver",
    gallery: GALLERY_MODERN,
    guestbook: [
      { id: "gm1", name: "Naledi", message: "The gallery setting was perfection. Lerato, your dress against that concrete — wow.", moment: "Reception" },
      { id: "gm2", name: "Tumi", message: "Congrats you two! Got the confetti shot of a lifetime, you're welcome.", moment: "Exit" },
      { id: "gm3", name: "Sipho & Ayanda", message: "Minimal in design, maximal in love. What a beautiful modern wedding.", moment: "After party" },
    ],
    qrHint: "The Silver QR card on the welcome table collected every guest photo.",
  },
  {
    id: "garden-wedding",
    title: "Garden Wedding",
    theme: "Wildflower meadow, sage & cream",
    coupleNames: "Hannah & Daniel",
    couple: ["Hannah", "Daniel"],
    dateLabel: "19 September 2026",
    venue: "Leopard's Leap Family Vineyards",
    story:
      "An all-day garden celebration under linen canopies. Kids chased bubbles, grandparents took photos with tablets, and the slideshow played every new upload on loop.",
    colors: { theme: "#7f9a6b", accent: "#c9a96e", label: "Sage & Gold" },
    packageTier: "Gold",
    videoTitle: "Bubble exit — filmed by the kids' table",
    videoNote: "The most chaotic, joyful 20 seconds of the entire day.",
    gallery: GALLERY_GARDEN,
    guestbook: [
      { id: "gg1", name: "Mom (Judy)", message: "I've never seen so many photos of one day. Well done, my loves — every single one is a keeper.", moment: "Evening" },
      { id: "gg2", name: "Ryan", message: "The orchard toast had us howling. Hannah, your speech was the best part of the day.", moment: "Toasts" },
      { id: "gg3", name: "Grace (flower girl)", message: "I caught the bubbles! Love you Daniel and Hannah!", moment: "Exit" },
    ],
    qrHint: "QR cards on every picnic table — even the kids managed it.",
  },
  {
    id: "luxury",
    title: "Luxury",
    theme: "Old-world opulence, dark green & gold",
    coupleNames: "Chloé & Marc",
    couple: ["Chloé", "Marc"],
    dateLabel: "7 November 2026",
    venue: "Grande Provence Estate, Franschhoek",
    story:
      "A candlelit estate wedding with champagne towers and golden light. Platinum QR cards doubled as place markers, and the flipbook published itself within days.",
    colors: { theme: "#2a251d", accent: "#c9a96e", label: "Noir & Gold" },
    packageTier: "Platinum",
    videoTitle: "The grand entrance — intro film",
    videoNote: "Platinum introduces the vault with a cinematic minute before the gallery loads.",
    gallery: GALLERY_LUXURY,
    guestbook: [
      { id: "gl1", name: "Baron von Strauss", message: "A wedding of rare elegance. The candles, the music, the light — magnificent.", moment: "Reception" },
      { id: "gl2", name: "Felicity", message: "Marc, you sobbed during your vows. We all saw it. Perfect day!", moment: "Ceremony" },
      { id: "gl3", name: "The Honeymooners", message: "Ninety days to download this album and we'll need all ninety to relive it.", moment: "Send-off" },
    ],
    qrHint: "Custom Platinum QR cards doubled as place markers at every seat.",
  },
  {
    id: "boho",
    title: "Boho",
    theme: "Desert bloom, terracotta & sand",
    coupleNames: "Willow & Finn",
    couple: ["Willow", "Finn"],
    dateLabel: "24 October 2026",
    venue: "The Karoo Bloom, Prince Albert",
    story:
      "Feathers, dried blooms and a long table under open sky. Sunset hit at the exact moment of the first dance, and not one guest missed the upload prompt.",
    colors: { theme: "#a8613f", accent: "#d9a05f", label: "Terracotta & Gold" },
    packageTier: "Gold",
    videoTitle: "Dance at dusk — guest perspective",
    videoNote: "The desert light made every guest a cinematographer.",
    gallery: GALLERY_BOHO,
    guestbook: [
      { id: "gb1", name: "Saskia", message: "Willow, that bouquet with the dried limonium — perfection. And the sunset! I'm still not over it.", moment: "Sunset" },
      { id: "gb2", name: "Milo", message: "Finn crying at the vows, then busting moves at the fire. Full circle. Legend.", moment: "Evening" },
      { id: "gb3", name: "Indigo", message: "The sparkler circle photo made me tear up. Thank you for the most beautiful weekend.", moment: "Send-off" },
    ],
    qrHint: "Handmade QR cards hung from macramé on each table.",
  },
  {
    id: "african-contemporary",
    title: "African Contemporary",
    theme: "Oceanfront celebration, ochre & indigo",
    coupleNames: "Ayanda & Sipho",
    couple: ["Ayanda", "Sipho"],
    dateLabel: "12 December 2026",
    venue: "The Oyster Box, Durban",
    story:
      "An oceanfront celebration weaving tradition with modern design. Vibrant textiles, bold gold, and a vault filled with every family's perspective of the day.",
    colors: { theme: "#a85f2f", accent: "#e2a25f", label: "Ochre & Gold" },
    packageTier: "Platinum",
    videoTitle: "The reception reel — intro film",
    videoNote: "Every video clip, woven into a cinematic intro for the vault.",
    gallery: GALLERY_AFRICAN,
    guestbook: [
      { id: "ga1", name: "Gogo (grandma)", message: "I watched my photographs come up on the screen and I nearly cried. This is how we keep our stories now.", moment: "Reception" },
      { id: "ga2", name: "Thandeka", message: "From the first drum to the last dance — every moment was golden. Congratulations, you two!", moment: "Celebration" },
      { id: "ga3", name: "Khumalo family", message: "The confetti shot from the balcony is a masterpiece. 90 days to download? We'll need 90 nights.", moment: "Exit" },
    ],
    qrHint: "Custom Platinum QR cards in ochre & gold on every chair.",
  },
] as const;

/* ── Tier showcases (keep /examples/silver|gold|platinum alive) ─────────── */

export interface TierShowcaseFeature {
  title: string;
  body: string;
}

export interface TierShowcase {
  kicker: string;
  name: string;
  tagline: string;
  features: TierShowcaseFeature[];
  qrBody: string;
  uploadBody: string;
  bullets: string[];
  ctaTitle: string;
  ctaBody: string;
  ctaHref: string;
  ctaLabel: string;
  featured?: boolean;
}

export const TIER_SHOWCASES: Record<"silver" | "gold" | "platinum", TierShowcase> = {
  silver: {
    kicker: "Silver package",
    name: "The Essential Gallery",
    tagline: "The beautiful foundation for sharing wedding memories — photo gallery, guest uploads and custom colours.",
    features: [
      { title: "Photo gallery", body: "Share and display the couple's favourite photos from the wedding day." },
      { title: "Guest uploads", body: "Guests upload photos by scanning a QR code. Fair-use limit of 500 photos." },
      { title: "Names & date", body: "Couple names and wedding date displayed elegantly at the top of the vault." },
      { title: "Optional colours", body: "Customise theme and accent colours to match the wedding palette." },
    ],
    qrBody: "Silver includes a QR code that guests scan to open the vault and upload photos. The QR encodes only the public vault URL.",
    uploadBody: "Guests open the vault on their phone, tap 'Upload' and select photos from their gallery. Photos appear in the gallery once processed.",
    bullets: [
      "Select photos from phone",
      "Add optional captions",
      "Upload progresses in real-time",
      "Appears in gallery after processing",
    ],
    ctaTitle: "Start with Silver",
    ctaBody: "The Silver package is perfect for couples who want a private photo gallery with guest uploads. Upgrade anytime to add video, slideshow and more.",
    ctaHref: "/packages",
    ctaLabel: "See Gold & Platinum",
  },
  gold: {
    kicker: "Gold package",
    name: "The Complete Experience",
    tagline: "Silver plus video, slideshow, banner and unlimited photos — the complete experience for most weddings.",
    features: [
      { title: "Photo gallery", body: "Share and display the couple's favourite photos from the wedding day." },
      { title: "Guest uploads", body: "Guests upload photos and videos by scanning a QR code. Fair-use limits apply." },
      { title: "Video upload", body: "Guests upload videos in addition to photos — speeches, dances, laughs in motion." },
      { title: "Live slideshow", body: "Auto-playing slideshow of guest photos that plays live as the day unfolds." },
      { title: "Custom banner", body: "Banner image at the top of the vault matching the wedding colours and style." },
      { title: "Unlimited photos", body: "Unlimited photo uploads as a commercial entitlement (technical fair-use still applies)." },
    ],
    qrBody: "Gold includes a QR code that guests scan to open the vault and upload photos and videos. The QR encodes only the public vault URL.",
    uploadBody: "Guests open the vault on their phone, tap 'Upload' and select photos or videos from their gallery — they appear in the vault after processing.",
    bullets: [
      "Select photos or videos from phone",
      "Supports images up to 25 MB, videos up to 200 MB",
      "Upload progresses in real-time",
      "Videos appear in gallery after processing",
      "Slideshow plays live as guest photos arrive",
    ],
    ctaTitle: "Start with Gold",
    ctaBody: "The Gold package is our most loved choice. Video, slideshow, banner and unlimited photos make it the complete wedding memory experience.",
    ctaHref: "/packages",
    ctaLabel: "See Platinum upgrade",
  },
  platinum: {
    kicker: "Platinum package",
    name: "The Ultimate Keepsake",
    tagline: "Everything in Gold, plus intro media, digital flipbook, custom QR cards and a 90-day download window.",
    features: [
      { title: "Photo gallery", body: "Share and display the couple's favourite photos from the wedding day." },
      { title: "Guest uploads", body: "Guests upload photos and videos by scanning a QR code. Fair-use limits apply." },
      { title: "Intro media", body: "Intro video or image plays before the gallery, setting the tone for the couple's story." },
      { title: "Interactive flipbook", body: "Page-flip photo album guests can browse — a keepsake that preserves memories." },
      { title: "QR design cards", body: "Custom-designed QR cards with the couple's branding, colours and a personal message." },
      { title: "90-day download", body: "Download everything for 90 days after the wedding date — plenty of time to share." },
    ],
    qrBody: "Platinum includes custom QR design cards bearing the couple's branding. Guests scan the card to open the vault instantly. The QR encodes only the public URL — never internal IDs.",
    uploadBody: "Guests open the vault on their phone and select photos or videos. Platinum guests get the flipbook and can download the full gallery within the 90-day window.",
    bullets: [
      "Select photos or videos from phone",
      "Supports images up to 25 MB, videos up to 200 MB",
      "Upload progresses in real-time with a progress bar",
      "Videos appear in the gallery after processing",
      "Slideshow plays live as guest photos arrive",
      "Flipbook becomes available once photos are uploaded",
      "Download all memories within the 90-day window",
    ],
    ctaTitle: "The Platinum experience",
    ctaBody: "The Platinum package is the ultimate wedding memory keepsake — premium QR cards, intro media and extended downloads.",
    ctaHref: "/packages",
    ctaLabel: "See pricing",
    featured: true,
  },
};

export function getExampleById(id: string): WeddingDemo | undefined {
  return EXAMPLES.find((example) => example.id === id);
}