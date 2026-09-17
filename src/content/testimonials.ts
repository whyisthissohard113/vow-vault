/**
 * Testimonial content for the marketing site.
 *
 * IMPORTANT: every entry is a FICTIONAL demo couple used to demonstrate the
 * product. Each is flagged `demo: true` and rendered with a visible
 * "Demo — fictional couple" label. Never treat these as real customer claims.
 */

export interface Testimonial {
  id: string;
  names: string;
  location: string;
  weddingType: string;
  quote: string;
  initials: string;
  demo: true;
}

export const TESTIMONIALS: readonly Testimonial[] = [
  {
    id: "demo-emma-james",
    names: "Emma & James",
    location: "Cape Town, South Africa",
    weddingType: "Winelands cellar wedding",
    quote:
      "We didn't realise how much we were missing until the vault started filling up. My cousin filmed the speeches from the back table, grandma captured the first dance, and now we have 400 photos we never knew existed.",
    initials: "EJ",
    demo: true,
  },
  {
    id: "demo-lerato-thabo",
    names: "Lerato & Thabo",
    location: "Johannesburg, South Africa",
    weddingType: "Modern city wedding",
    quote:
      "Our guests aren't the type to install apps for anything. The QR card on the tables was all it took — by midnight the slideshow was already playing their photos on the big screen. Absolute magic.",
    initials: "LT",
    demo: true,
  },
  {
    id: "demo-hannah-daniel",
    names: "Hannah & Daniel",
    location: "Franschhoek, South Africa",
    weddingType: "Mountain garden wedding",
    quote:
      "Three months later we're still finding new photos in the vault. The flipbook made everything feel like a real keepsake — we printed the QR card and framed it alongside our vows.",
    initials: "HD",
    demo: true,
  },
  {
    id: "demo-ayanda-sipho",
    names: "Ayanda & Sipho",
    location: "Durban, South Africa",
    weddingType: "Beachfront celebration",
    quote:
      "The download window bought us a honeymoon of calm. Every photo arrived at original quality, and we built our thank-you album from the guests' perspectives — not just the photographer's.",
    initials: "AS",
    demo: true,
  },
  {
    id: "demo-chloe-marc",
    names: "Chloé & Marc",
    location: "Stellenbosch, South Africa",
    weddingType: "Destination vineyard wedding",
    quote:
      "Our guests uploaded from three continents. The guestbook messages made us cry — paired with the photos our loved ones took, it's the most complete record of our day we could ever have asked for.",
    initials: "CM",
    demo: true,
  },
] as const;