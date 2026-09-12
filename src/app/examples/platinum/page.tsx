import { ExampleTier } from "@/components/marketing/example-tier";

export default function PlatinumExample() {
  return (
    <ExampleTier
      kicker="Platinum package"
      name="The ultimate experience"
      tagline="Everything in Gold, plus intro media, digital flipbook, QR design cards and 90-day extended download."
      features={[
        { title: "Photo gallery", body: "Share and display the couple's favourite photos from the wedding day." },
        { title: "Guest uploads", body: "Guests can upload photos and videos via QR code. Fair-use limits apply." },
        { title: "Video upload", body: "Guests can upload videos (up to 200 MB each) in addition to photos." },
        { title: "Slideshow", body: "Auto-playing slideshow of guest photos that plays before the gallery." },
        { title: "Banner", body: "Custom banner image at the top of the vault, matching the wedding colours and style." },
        { title: "Intro media", body: "Intro video or image that plays before the gallery, setting the tone for the couple's story." },
        { title: "Digital flipbook", body: "Interactive page-flip photo album that guests can browse, preserving memories in a keepsake format." },
        { title: "QR design cards", body: "Custom-designed QR code cards with the couple's branding, colours and a personalised message." },
        { title: "90-day download", body: "Download all memories for 90 days after the wedding date — plenty of time to share with family and friends." },
      ]}
      qrSrc="/placeholder-qr-lg.png"
      qrAlt="Platinum QR code"
      qrBody="Platinum includes custom-designed QR code cards with the couple's branding. Guests scan the card at the venue to open the vault and start sharing. The QR encodes only the public URL — no internal IDs."
      uploadBody="Guests open the vault on their phone, tap &quot;Upload&quot;, and select photos or videos from their gallery. Platinum guests also receive access to the digital flipbook and can download the full gallery within 90 days."
      bullets={[
        "Select photos or videos from phone",
        "Supports images up to 25 MB, videos up to 200 MB",
        "Upload progresses in real-time with progress bar",
        "Videos appear in gallery after processing",
        "Slideshow auto-plays when enough guest photos are uploaded",
        "Flipbook becomes available after photos are uploaded",
        "Download all memories within the 90-day window",
      ]}
      ctaTitle="The Platinum experience"
      ctaBody="The Platinum package is the ultimate wedding memory experience. Premium QR cards, intro media, and extended downloads make it unforgettable."
      ctaHref="/pricing"
      ctaLabel="See pricing"
      featured
    />
  );
}