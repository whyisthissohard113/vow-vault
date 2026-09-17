"use client";

/**
 * WeddingGallery — the couple's vault UI mock: couple header, feature tabs,
 * gallery grid and a Download All affordance. Local demo imagery only.
 */

import { useState } from "react";
import type { WeddingDemo } from "./types";
import { DemoArtwork, DemoInitials } from "./demo-artwork";
import { IconCamera, IconCheck, IconDownload, IconPlay } from "@/components/icons";
import { cn } from "@/lib/utils";

type GalleryTab = "photos" | "videos" | "messages" | "albums" | "timeline";

const TABS: { id: GalleryTab; label: string }[] = [
  { id: "photos", label: "Photos" },
  { id: "videos", label: "Videos" },
  { id: "messages", label: "Messages" },
  { id: "albums", label: "Albums" },
  { id: "timeline", label: "Timeline" },
];

export function WeddingGallery({
  wedding,
  className,
}: {
  wedding: WeddingDemo;
  className?: string;
}) {
  const [tab, setTab] = useState<GalleryTab>("photos");
  const [downloaded, setDownloaded] = useState(false);

  return (
    <div className={cn("overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-card)]", className)}>
      {/* Header */}
      <div className="border-b border-line-soft px-6 pb-5 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent-deep">
              Wedding Vault
            </p>
            <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
              {wedding.coupleNames}
            </h3>
            <p className="mt-0.5 text-sm text-muted">
              {wedding.dateLabel} · {wedding.venue}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDownloaded(true)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
              downloaded
                ? "bg-emerald-50 text-emerald-700"
                : "bg-brand text-ivory hover:bg-brand-soft",
            )}
          >
            {downloaded ? <IconCheck className="h-4 w-4" /> : <IconDownload className="h-4 w-4" />}
            {downloaded ? "Downloaded" : "Download All"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label={`${wedding.coupleNames} vault sections`} className="flex gap-1 overflow-x-auto border-b border-line-soft px-6">
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setTab(item.id)}
              className={cn(
                "-mb-px inline-flex h-12 shrink-0 items-center border-b-2 px-3 text-sm font-semibold transition-colors",
                selected
                  ? "border-accent text-ink"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              {item.label}
              {item.id === "photos" ? (
                <span className="ml-2 rounded-full bg-blush px-2 py-0.5 text-[11px] font-bold text-accent-deep">
                  {wedding.gallery.length * 82}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Panels */}
      <div className="p-6">
        {tab === "photos" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[...wedding.gallery, ...wedding.gallery, ...wedding.gallery, ...wedding.gallery].slice(0, 12).map((image, index) => (
              <figure key={`${image.id}-${index}`} className="group relative overflow-hidden rounded-xl">
                <DemoArtwork image={image} className="aspect-square w-full transition-transform duration-500 group-hover:scale-105" />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-ink/70 to-transparent px-3 pb-2 pt-8 text-left text-[11px] font-medium text-ivory opacity-0 transition-opacity group-hover:opacity-100">
                  {image.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : null}

        {tab === "videos" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((index) => {
              const image = wedding.gallery[(index + 1) % wedding.gallery.length];
              return (
                <div key={index} className="overflow-hidden rounded-2xl border border-line">
                  <div className="relative">
                    <DemoArtwork image={image} className="aspect-video w-full" />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface/90 text-ink shadow-[var(--shadow-card)]">
                        <IconPlay className="h-5 w-5" />
                      </span>
                    </span>
                    <span className="absolute bottom-2 right-2 rounded-md bg-brand-ink/70 px-1.5 py-0.5 text-[10px] font-semibold text-ivory">
                      {index === 0 ? "0:18" : "0:42"}
                    </span>
                  </div>
                  <p className="px-4 py-3 text-sm font-medium text-ink">
                    {index === 0 ? `Guest clip — ${image.caption.toLowerCase()}` : wedding.videoTitle ?? "Guest clip"}
                  </p>
                </div>
              );
            })}
          </div>
        ) : null}

        {tab === "messages" ? (
          <ul className="space-y-3">
            {wedding.guestbook.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 rounded-2xl border border-line-soft bg-ivory p-4">
                <DemoInitials initials={entry.name.split(" ").slice(0, 2).map((part) => part[0]).join("")} className="h-10 w-10 text-xs" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm font-semibold text-ink">{entry.name}</p>
                    <p className="text-[11px] text-faint">{entry.moment}</p>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{entry.message}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {tab === "albums" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "The Ceremony", count: 214, image: wedding.gallery[0] },
              { title: "Reception Stars", count: 168, image: wedding.gallery[2] },
              { title: "Golden Hour", count: 96, image: wedding.gallery[4] },
            ].map((album) => (
              <button
                key={album.title}
                type="button"
                className="group overflow-hidden rounded-2xl border border-line bg-surface text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"
              >
                <div className="relative">
                  <DemoArtwork image={album.image} className="aspect-[4/3] w-full" />
                  <span className="absolute right-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-bold text-ink">
                    {album.count} photos
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="font-display text-base font-semibold text-ink">{album.title}</p>
                  <IconCamera className="h-4 w-4 text-accent-deep" />
                </div>
              </button>
            ))}
          </div>
        ) : null}

        {tab === "timeline" ? (
          <ol className="relative space-y-5 border-l border-line pl-6">
            {[
              { time: "14:20", text: "First upload lands — grandma's confetti shot, 3s after the kiss." },
              { time: "15:40", text: "43 memories in the vault. The slideshow starts playing live." },
              { time: "18:05", text: "First video arrives — the best man's speech from table nine." },
              { time: "21:30", text: "Send-off sparklers fill the gallery. 512 memories and counting." },
            ].map((moment) => (
              <li key={moment.time} className="relative">
                <span aria-hidden="true" className="absolute -left-[1.72rem] top-1 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-accent/20" />
                <p className="text-xs font-bold uppercase tracking-widest text-accent-deep">{moment.time}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{moment.text}</p>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}