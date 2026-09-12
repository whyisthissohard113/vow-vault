"use client";

/**
 * GalleryGrid — guest-facing gallery with lightbox and per-item download.
 * Thumbnails/previews are signed URLs provided by the server DTO; the
 * download button re-requests a fresh signed URL server-side (the window is
 * re-checked there, never trusted client-side).
 */

import Image from "next/image";
import { useCallback, useState } from "react";

import type { PublicVaultMediaItem } from "@/server/services/public-vault";

interface GalleryGridProps {
  slug: string;
  items: PublicVaultMediaItem[];
  downloadOpen: boolean;
}

function formatDuration(durationMs?: number | null): string {
  if (!durationMs || durationMs <= 0) return "";
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function GalleryGrid({ slug, items, downloadOpen }: GalleryGridProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const download = useCallback(
    async (item: PublicVaultMediaItem) => {
      try {
        const res = await fetch(
          `/api/vault/${slug}/media/${item.publicId}/download?variant=original&disposition=attachment`,
        );
        const body = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !body.url) {
          window.alert(body.error ?? "Download is not available");
          return;
        }
        window.open(body.url, "_blank", "noopener,noreferrer");
      } catch {
        window.alert("Download is not available right now");
      }
    },
    [slug],
  );

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-stone-500">
        No memories have been shared yet.
      </p>
    );
  }

  const selectedItem = selected !== null ? items[selected] : null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <button
            key={item.publicId}
            type="button"
            onClick={() => setSelected(index)}
            className="group relative aspect-square overflow-hidden rounded-xl bg-sand text-left"
            aria-label={`View ${item.filename}`}
          >
            {item.thumbnailUrl ?? item.fullUrl ? (
              <Image
                src={item.thumbnailUrl ?? item.fullUrl ?? ""}
                alt={item.filename}
                fill
                unoptimized
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-stone-400">
                Preview
              </div>
            )}
            {item.kind === "video" ? (
              <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
                {formatDuration(item.durationMs)}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {selectedItem ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
          aria-label={selectedItem.filename}
        >
          <div
            className="max-h-full w-full max-w-4xl"
            onClick={(event) => event.stopPropagation()}
          >
            {selectedItem.kind === "video" && selectedItem.fullUrl ? (
              <video
                src={selectedItem.fullUrl}
                controls
                autoPlay
                className="max-h-[75vh] w-full rounded-xl"
              />
            ) : selectedItem.fullUrl ? (
              <div className="relative max-h-[75vh] w-full">
                <Image
                  src={selectedItem.fullUrl}
                  alt={selectedItem.filename}
                  width={1600}
                  height={1200}
                  unoptimized
                  className="mx-auto max-h-[75vh] w-auto rounded-xl object-contain"
                />
              </div>
            ) : (
              <p className="text-center text-stone-300">Preview not available</p>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="min-w-0 flex-1 truncate text-sm text-stone-300">
                {selectedItem.filename}
              </span>
              {downloadOpen ? (
                <button
                  type="button"
                  onClick={() => download(selectedItem)}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition-opacity hover:opacity-90"
                >
                  Download
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full border border-stone-600 px-4 py-2 text-sm text-stone-200 transition-colors hover:bg-stone-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}