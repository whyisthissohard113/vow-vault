import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Vow Vault — Your wedding day, captured by everyone",
    template: "%s | Vow Vault",
  },
  description:
    "One digital vault for your entire wedding memory. Guests scan a QR code, upload photos and videos from their phones, and every moment lands in your private vault — no app, no accounts, preserved forever.",
  applicationName: "Vow Vault",
  keywords: [
    "wedding memory vault",
    "wedding photo sharing",
    "guest photo upload",
    "wedding QR code",
    "wedding gallery",
    "wedding album",
    "wedding tech",
  ],
  openGraph: {
    type: "website",
    siteName: "Vow Vault",
    title: "Vow Vault — Your wedding day, captured by everyone",
    description:
      "Every guest, every perspective, every unforgettable moment — in one beautiful private wedding vault.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vow Vault — Your wedding day, captured by everyone",
    description:
      "Every guest, every perspective, every unforgettable moment — in one beautiful private wedding vault.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}