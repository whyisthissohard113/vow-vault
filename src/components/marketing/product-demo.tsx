"use client";

/**
 * ProductDemo — interactive product tour. Switch between the five vault
 * experiences (gallery, slideshow, guestbook, album, flipbook) and play with
 * them directly. All components render local demo imagery only.
 */

import { useState } from "react";
import type { WeddingDemo } from "@/content/examples";

import { WeddingGallery } from "@/components/wedding/wedding-gallery";
import { LiveSlideshow } from "@/components/wedding/live-slideshow";
import { DigitalGuestbook } from "@/components/wedding/digital-guestbook";
import { DigitalAlbum } from "@/components/wedding/digital-album";
import { Flipbook } from "@/components/wedding/flipbook";
import {
  IconCamera,
  IconHeart,
  IconMenu,
  IconPlay,
  IconPhoto,
  IconTemplate,
} from "@/components/icons";
import { cn } from "@/lib/utils";

type DemoView = "gallery" | "slideshow" | "guestbook" | "album" | "flipbook";

const VIEWS: { id: DemoView; label: string; caption: string; icon: typeof IconPhoto }[] = [
  { id: "gallery", label: "Vault", caption: "The private gallery", icon: IconMenu },
  { id: "slideshow", label: "Live slideshow", caption: "Plays as guests upload", icon: IconPlay },
  { id: "guestbook", label: "Guestbook", caption: "Words from your guests", icon: IconHeart },
  { id: "album", label: "Digital album", caption: "Curated pages", icon: IconPhoto },
  { id: "flipbook", label: "Flipbook", caption: "A keepsake you can touch", icon: IconCamera },
];

export function ProductDemo({
  wedding,
  initialView = "gallery",
}: {
  wedding: WeddingDemo;
  initialView?: DemoView;
}) {
  const [view, setView] = useState<DemoView>(initialView);
  const active = VIEWS.find((item) => item.id === view) ?? VIEWS[0];

  return (
    <section id="product-demo" className="container-page py-20 sm:py-24">
      <div className="grid items-start gap-8 lg:grid-cols-[17rem_1fr]">
        {/* Tab list */}
        <div role="tablist" aria-label="Vault experiences" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {VIEWS.map((item) => {
            const selected = view === item.id;
            return (
              <button
                key={item.id}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => setView(item.id)}
                className={cn(
                  "flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                  selected
                    ? "border-accent/50 bg-surface text-ink shadow-[var(--shadow-soft)]"
                    : "border-transparent text-muted hover:bg-blush/60 hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    selected ? "bg-brand text-accent-glow" : "bg-blush text-accent-deep",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="block text-xs text-faint">{item.caption}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Preview panel */}
        <div className="min-w-0 overflow-hidden rounded-3xl border border-line bg-ivory-deep p-3 sm:p-5 lg:p-6">
          <div className="flex items-center justify-between px-2 pb-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-faint">
              {active.label} — live demo
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blush px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-accent-deep">
              <IconTemplate className="h-3 w-3" />
              Demo imagery
            </span>
          </div>

          {view === "gallery" ? <WeddingGallery wedding={wedding} /> : null}
          {view === "slideshow" ? <LiveSlideshow wedding={wedding} /> : null}
          {view === "guestbook" ? <DigitalGuestbook wedding={wedding} /> : null}
          {view === "album" ? <DigitalAlbum wedding={wedding} /> : null}
          {view === "flipbook" ? <Flipbook wedding={wedding} /> : null}

          {view === "gallery" ? (
            <p className="mt-4 px-2 text-center text-xs text-faint">
              Explore the tabs — Photos, Videos, Messages, Albums and Timeline are all part of the guest experience.
            </p>
          ) : view === "slideshow" ? (
            <p className="mt-4 px-2 text-center text-xs text-faint">
              Auto-plays with every new upload. Pause it, step through it, or go fullscreen.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export type { DemoView };