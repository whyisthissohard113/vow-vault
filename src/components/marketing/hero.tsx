/**
 * HeroVisual — decorative hero illustration showing a miniature vault
 * interface: three demo images, a QR card overlay, and a live indicator.
 * Purely decorative; no interactivity.
 */

import { EXAMPLES } from "@/content/examples";
import { DemoArtwork } from "@/components/wedding/demo-artwork";
import { QrPattern } from "@/components/wedding/qr-preview";
import { IconHeart, IconCamera } from "@/components/icons";
import { cn } from "@/lib/utils";

const sample = EXAMPLES[0]; // classic-romance — gold palette
const images = sample.gallery.slice(0, 3);

export function HeroVisual({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-md", className)} aria-hidden="true">
      {/* Gallery stack */}
      <div className="relative">
        <div className="rotate-[-4deg] overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
          <DemoArtwork image={images[0]} className="aspect-[4/3] w-full" />
          <div className="flex items-center gap-2 px-4 py-3">
            <IconHeart className="h-4 w-4 text-accent-deep" />
            <span className="text-xs font-semibold text-muted">{sample.gallery[0].caption}</span>
          </div>
        </div>

        <div className="absolute -bottom-6 -left-6 w-40 rotate-3 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-card)] sm:w-44">
          <DemoArtwork image={images[1]} className="aspect-[3/2] w-full" />
          <div className="flex items-center gap-1.5 px-3 py-2">
            <IconCamera className="h-3.5 w-3.5 text-accent-deep" />
            <span className="text-[11px] font-semibold text-muted">{sample.gallery[1].caption}</span>
          </div>
        </div>

        <div className="absolute -right-4 -top-4 w-36 -rotate-3 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-card)] sm:w-40">
          <DemoArtwork image={images[2]} className="aspect-[3/2] w-full" />
          <div className="flex items-center gap-1.5 px-3 py-2">
            <span className="text-[11px] font-semibold text-muted">{sample.gallery[2].caption}</span>
          </div>
        </div>
      </div>

      {/* Floating QR card */}
<div className="absolute -bottom-10 right-1 flex w-28 flex-col items-center rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-float)] sm:-right-8 sm:w-32">
          <QrPattern seed={sample.id} label={sample.coupleNames} className="text-brand" />
          <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted">Scan to upload</p>
        </div>

        {/* Live indicator */}
        <div className="absolute -right-1 top-8 flex items-center gap-1.5 rounded-full bg-brand-ink px-3 py-1.5 shadow-[var(--shadow-float)] sm:-right-3">
        <span className="h-2 w-2 animate-live-pulse rounded-full bg-accent-glow" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-ivory">Live</span>
      </div>
    </div>
  );
}