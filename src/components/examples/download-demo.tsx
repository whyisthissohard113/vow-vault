"use client";

/**
 * DownloadDemo — the Platinum demo download experience.
 *
 * Simulated only, and labelled as such: no archive is created and no files are
 * downloaded. It exists to show how the extended Platinum download window is
 * presented to a couple.
 */

import { useEffect, useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import { IconCheck, IconDownload } from "@/components/icons";
import { cn } from "@/lib/utils";

type DownloadChoice = "photos" | "videos" | "everything";
type Phase = "choose" | "working" | "done";

const CHOICES: { id: DownloadChoice; label: string; detail: string }[] = [
  { id: "photos", label: "Download photos", detail: "Every photo in the vault, original quality." },
  { id: "videos", label: "Download videos", detail: "Guest video uploads and the intro film." },
  { id: "everything", label: "Download everything", detail: "The full vault — photos, videos and keepsakes." },
];

export function DownloadDemo({
  downloadDays,
  coupleNames,
}: {
  downloadDays: number;
  coupleNames: string;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<DownloadChoice>("everything");
  const [phase, setPhase] = useState<Phase>("choose");
  const [progress, setProgress] = useState(0);

  const finished = phase === "working" && progress >= 100;
  const effectivePhase: Phase = finished ? "done" : phase;

  useEffect(() => {
    if (phase !== "working" || finished) return;
    const timer = window.setInterval(() => {
      setProgress((value) => Math.min(value + 6, 100));
    }, 90);
    return () => window.clearInterval(timer);
  }, [phase, finished]);

  function close() {
    setOpen(false);
    // Reset once the dialog has left the view.
    window.setTimeout(() => {
      setPhase("choose");
      setProgress(0);
    }, 200);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-bold uppercase tracking-wider transition-transform hover:scale-[1.02] vault-accent-bg"
      >
        <IconDownload className="h-4 w-4" />
        Download memories
      </button>

      <Dialog open={open} onClose={close} title="Demo download">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] vault-accent">Platinum experience</p>
        <p className="mt-2 text-sm leading-relaxed vault-muted">
          Platinum vaults keep the download window open for{" "}
          <strong className="vault-ink">{downloadDays} days</strong> after the wedding date. In a
          real vault, {coupleNames} would choose what to download and receive the files from Vow
          Vault. This is a demonstration — no archive is created and nothing is downloaded to your
          device.
        </p>

        {effectivePhase === "choose" ? (
          <div className="mt-5 space-y-2.5">
            {CHOICES.map((option) => {
              const active = choice === option.id;
              return (
                <label
                  key={option.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 border p-3.5 transition-colors vault-radius",
                    active ? "vault-accent-border vault-accent-soft" : "vault-line",
                  )}
                >
                  <input
                    type="radio"
                    name="download-choice"
                    value={option.id}
                    checked={active}
                    onChange={() => setChoice(option.id)}
                    className="mt-1 h-4 w-4"
                    style={{ accentColor: "var(--vault-accent)" }}
                  />
                  <span>
                    <span className="block text-sm font-semibold vault-ink">{option.label}</span>
                    <span className="block text-xs vault-muted">{option.detail}</span>
                  </span>
                </label>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setProgress(0);
                setPhase("working");
              }}
              className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-bold vault-accent-bg"
            >
              Start demo download
            </button>
          </div>
        ) : null}

        {effectivePhase === "working" ? (
          <div className="mt-5" role="status" aria-live="polite">
            <div className="flex items-center justify-between text-sm font-semibold vault-ink">
              <span>Preparing your demo archive…</span>
              <span className="tabular-nums">{Math.round(progress)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full vault-accent-soft">
              <div
                className="h-full rounded-full transition-[width] duration-100"
                style={{ width: `${progress}%`, background: "var(--vault-accent)" }}
              />
            </div>
            <p className="mt-3 text-xs vault-muted">
              Simulated progress — a real Platinum vault streams these files from secure storage.
            </p>
          </div>
        ) : null}

        {effectivePhase === "done" ? (
          <div className="mt-5" role="status" aria-live="polite">
            <div className="flex items-center gap-2 rounded-xl border p-3.5 vault-accent-border vault-accent-soft">
              <IconCheck className="h-5 w-5 vault-accent" />
              <p className="text-sm font-semibold vault-ink">
                Demo complete — this is how the Platinum download experience works.
              </p>
            </div>
            <p className="mt-3 text-xs vault-muted">
              No files were created and nothing was downloaded. Your choice was:{" "}
              {CHOICES.find((option) => option.id === choice)?.label.toLowerCase()}.
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full border text-sm font-semibold transition-colors vault-line vault-ink vault-hover-accent"
            >
              Close
            </button>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
