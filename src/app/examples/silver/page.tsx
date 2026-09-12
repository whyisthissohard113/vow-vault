import { ExampleTier } from "@/components/marketing/example-tier";

export default function SilverExample() {
  return (
    <ExampleTier
      kicker="Silver package"
      name="The essential gallery"
      tagline="The essential foundation for sharing wedding memories. Photo gallery, guest uploads, and customisable colours."
      features={[
        { title: "Photo gallery", body: "Share and display the couple's favourite photos from the wedding day." },
        { title: "Guest uploads", body: "Guests can upload photos via QR code. Fair-use limit of 500 photos." },
        { title: "Names & date display", body: "Couple names and wedding date displayed elegantly at the top of the vault." },
        { title: "Optional colours", body: "Customisable theme and accent colours to match the wedding palette." },
      ]}
      qrSrc="/placeholder-qr-sm.png"
      qrAlt="Silver QR code"
      qrBody="Silver includes a standard QR code that guests can scan to open the vault and upload photos. The QR encodes the public vault URL only."
      uploadBody="Guests open the vault on their phone, tap &quot;Upload&quot;, and select photos from their gallery. Photos appear in the gallery once processed."
      bullets={[
        "Select photos from phone",
        "Add optional captions",
        "Upload progresses in real-time",
        "Appears in gallery after processing",
      ]}
      ctaTitle="Start with Silver"
      ctaBody="The Silver package is perfect for couples who want a private photo gallery with guest uploads. Upgrade anytime to add video, slideshow and more."
      ctaHref="/pricing"
      ctaLabel="See Gold & Platinum upgrades"
    />
  );
}