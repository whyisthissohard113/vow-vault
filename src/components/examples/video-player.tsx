"use client";

/**
 * DemoVideoPlayer — a functional placeholder player for Gold+ vaults.
 *
 * There is no real customer footage in this repository, so the player pairs a
 * clearly-labelled "Demo video" still with a working play/pause control and a
 * simulated timeline. It never claims to stream real footage.
 */

import { useEffect, useState } from "react";

import type { DemoVideo } from "@/lib/examples/demo-derive";
import { DemoArtwork } from "@/components/wedding/demo-artwork";

function durationToSeconds(duration: string): number {
  const [minutes, seconds] = duration.split(":").map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) return 0;
  return minutes * 60 + seconds;
}

function formatSeconds(total: number): string {
  const safe = Math.max(0, Math.floor(total));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function DemoVideoPlayer({ video }: { video: DemoVideo }) {
  const totalSeconds = durationToSeconds(video.duration);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // The player reports "paused" once the demo timeline reaches the end; the
  // next press of play starts the timeline over.
  const isPlaying = playing && progress < 100;

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setProgress((value) => Math.min(value + 0.9, 100));
    }, 120);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  function togglePlay() {
    if (progress >= 100) setProgress(0);
    setPlaying((value) => !value);
  }

  const elapsed = (totalSeconds * progress) / 100;

  return (
    <figure className="overflow-hidden border vault-radius vault-line vault-surface">
      <div className="relative aspect-video w-full">
        {video.src ? (
          <video src={video.src} controls preload="metadata" className="h-full w-full bg-brand-ink object-cover" />
        ) : (
          <>
            <DemoArtwork image={video.image} className="h-full w-full" />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-brand-ink/45 transition-opacity"
              style={{ opacity: isPlaying ? 0.25 : 0.45 }}
            />
            <span className="absolute left-3 top-3 rounded-full bg-brand-ink/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-ivory">
              Demo video
            </span>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? `Pause demo video: ${video.title}` : `Play demo video: ${video.title}`}
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface/90 text-ink shadow-[var(--shadow-card)] transition-transform hover:scale-105">
                {isPlaying ? (
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M7 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 7 5.5Z" />
                  </svg>
                )}
              </span>
            </button>
          </>
        )}
      </div>

      {!video.src ? (
        <div className="border-t px-4 py-3 vault-line">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="flex h-9 w-9 items-center justify-center rounded-full vault-accent-soft vault-accent"
            >
              {isPlaying ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 7 5.5Z" />
                </svg>
              )}
            </button>

            <div className="flex flex-1 items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(progress)}
                onChange={(event) => setProgress(Number(event.target.value))}
                aria-label="Demo video timeline"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full vault-accent-soft"
                style={{ accentColor: "var(--vault-accent)" }}
              />
              <span className="shrink-0 text-xs tabular-nums vault-muted">
                {formatSeconds(elapsed)} / {video.duration}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <figcaption className="px-4 py-3">
        <p className="text-sm font-semibold vault-ink">{video.title}</p>
        <p className="mt-0.5 text-xs vault-muted">{video.note}</p>
        <p className="mt-2 text-[11px] vault-muted">
          Demo video placeholder — this is not real customer footage.
        </p>
      </figcaption>
    </figure>
  );
}
