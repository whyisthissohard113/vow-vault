import { ExampleTier } from "@/components/marketing/example-tier";

export default function GoldExample() {
  return (
    <ExampleTier
      kicker="Gold package"
      name="The complete experience"
      tagline="Silver plus video, slideshow banner and unlimited photos. The complete experience for most weddings."
      features={[
        { title: "Photo gallery", body: "Share and display the couple's favourite photos from the wedding day." },
        { title: "Guest uploads", body: "Guests can upload photos and videos via QR code. Fair-use limits apply." },
        { title: "Video upload", body: "Guests can upload videos (up to 200 MB each) in addition to photos." },
        { title: "Slideshow", body: "Auto-playing slideshow of guest photos that plays before the gallery." },
        { title: "Banner", body: "Custom banner image at the top of the vault, matching the wedding colours and style." },
        { title: "Names & date display", body: "Couple names and wedding date displayed elegantly at the top of the vault." },
      ]}
      qrSrc="/placeholder-qr-md.png"
      qrAlt="Gold QR code"
      qrBody="Gold includes a standard QR code that guests can scan to open the vault and upload photos and videos. The QR encodes the public vault URL only."
      uploadBody="Guests open the vault on their phone, tap &quot;Upload&quot;, and select photos or videos from their gallery."
      bullets={[
        "Select photos or videos from phone",
        "Supports images up to 25 MB, videos up to 200 MB",
        "Upload progresses in real-time",
        "Videos appear in gallery after processing",
        "Slideshow auto-plays when enough guest photos are uploaded",
      ]}
      ctaTitle="Start with Gold"
      ctaBody="The Gold package is our most popular choice. Video, slideshow, banner and unlimited photos make it the complete wedding memory experience."
      ctaHref="/pricing"
      ctaLabel="See Platinum upgrade"
    />
  );
}