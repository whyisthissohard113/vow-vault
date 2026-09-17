"use client";

/**
 * GuestUpload — a realistic phone mock of the guest upload experience.
 *
 * Simulates: choose media → upload progress → success animation. Local state
 * only — the marketing site never performs real uploads or calls storage.
 * Accepts a `WeddingDemo` so the demo can later be fed by real data shapes.
 */

import { useEffect, useState } from "react";
import type { WeddingDemo } from "./types";
import { DemoArtwork } from "./demo-artwork";
import { IconCamera, IconCheck, IconHeart, IconPhoto, IconUpload } from "@/components/icons";
import { cn } from "@/lib/utils";

type UploadState = "idle" | "uploading" | "done";

export function GuestUpload({
  wedding,
  className,
}: {
  wedding: WeddingDemo;
  className?: string;
}) {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    if (state !== "uploading") return;
    const timer = window.setInterval(() => {
      setProgress((current) => {
        const next = Math.min(current + 8 + Math.random() * 16, 100);
        if (next >= 100) {
          window.clearInterval(timer);
          window.setTimeout(() => {
            setState("done");
            setToastVisible(true);
            window.setTimeout(() => setToastVisible(false), 3200);
          }, 250);
        }
        return next;
      });
    }, 160);
    return () => window.clearInterval(timer);
  }, [state]);

  function startUpload() {
    setState("uploading");
    setProgress(0);
  }

  const hero = wedding.gallery[0];

  return (
    <div className={className}>
      {/* Phone frame */}
      <div className="relative mx-auto w-[17.5rem] overflow-hidden rounded-[2.4rem] border-[10px] border-brand-ink bg-surface shadow-[var(--shadow-float)]">
        <div aria-hidden="true" className="absolute left-1/2 top-0 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-brand-ink" />

        <div className="bg-gradient-to-br px-5 pb-4 pt-12 text-center text-white" style={{ background: `linear-gradient(135deg, ${wedding.colors.theme}, ${wedding.colors.accent})` }}>
          <p className="font-display text-xl font-semibold tracking-tight">{wedding.coupleNames}</p>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] opacity-90">
            Share your memories
          </p>
        </div>

        <div className="space-y-3 px-4 py-4">
          <p className="text-center text-xs font-medium leading-relaxed text-muted">
            Take a photo or pick one from your gallery — it appears in{" "}
            {wedding.couple[0]} &amp; {wedding.couple[1]}&apos;s private vault instantly.
          </p>

          <div className="overflow-hidden rounded-2xl">
            <DemoArtwork image={hero} className="h-32 w-full" />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={startUpload}
              disabled={state === "uploading"}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-70"
            >
              <IconPhoto className="h-4 w-4" />
              Upload Photos
            </button>
            <button
              type="button"
              onClick={startUpload}
              disabled={state === "uploading"}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface text-sm font-semibold text-ink transition-colors hover:bg-blush disabled:opacity-70"
            >
              <IconCamera className="h-4 w-4" />
              Upload Videos
            </button>
            <button
              type="button"
              onClick={startUpload}
              disabled={state === "uploading"}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface text-sm font-semibold text-ink transition-colors hover:bg-blush disabled:opacity-70"
            >
              <IconHeart className="h-4 w-4" />
              Leave a Message
            </button>
          </div>

          {state === "uploading" ? (
            <div role="status" aria-live="polite" className="rounded-xl border border-line bg-ivory px-4 py-3">
              <div className="flex items-center justify-between text-xs font-medium text-ink">
                <span className="flex items-center gap-1.5">
                  <IconUpload className="h-3.5 w-3.5 text-accent-deep" />
                  Uploading {Math.min(2 + Math.floor(progress / 28), 4)} memories…
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}

          {state === "done" ? (
            <div className="flex items-center justify-center gap-2 rounded-full bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700">
              <IconCheck className="h-4 w-4" />
              Memories added to the vault
            </div>
          ) : null}
        </div>
      </div>

      {/* Success toast */}
      <div
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand-ink px-5 py-2.5 text-sm font-medium text-ivory shadow-[var(--shadow-float)] transition-all duration-300",
          toastVisible ? "opacity-100" : "opacity-0 translate-y-2",
        )}
      >
        <span className="flex items-center gap-2">
          <IconCheck className="h-4 w-4 text-accent-glow" />
          Memory added.
        </span>
      </div>
    </div>
  );
}