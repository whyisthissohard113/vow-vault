"use client";

/**
 * QRCodeCard — the interactive QR access demonstration.
 *
 * The QR encodes ONLY the public demo route for this wedding (e.g.
 * `/examples/classic-romance`) — never an internal id, token or credential.
 * "Try QR Demo" walks through what a guest sees when they scan; "Open Vault"
 * is the desktop fallback for visitors already on the device.
 */

import { useEffect, useState } from "react";

import type { WeddingDemo } from "@/content/examples";
import { Dialog } from "@/components/ui/dialog";
import { useReducedMotion } from "@/components/ui/use-reduced-motion";
import { DemoQrImage } from "./demo-qr";
import { IconCheck, IconQr, IconSparkle } from "@/components/icons";

export function QRCodeCard({
  wedding,
  qrDataUrl,
  display,
  onOpenVault,
}: {
  wedding: WeddingDemo;
  qrDataUrl: string | null;
  display: boolean;
  onOpenVault: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"ready" | "scanning" | "opened">("ready");
  const reduced = useReducedMotion();

  useEffect(() => {
    if (phase !== "scanning") return;
    const timer = window.setTimeout(
      () => setPhase("opened"),
      reduced ? 150 : 1400,
    );
    return () => window.clearTimeout(timer);
  }, [phase, reduced]);

  function openDemo() {
    setPhase("ready");
    setOpen(true);
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Scannable QR card */}
        <div className="flex flex-col items-center border p-6 text-center vault-radius vault-line vault-surface">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] vault-accent-soft vault-accent"
          >
            <IconQr className="h-3.5 w-3.5" />
            Guest QR access
          </span>
          <p className={`mt-3 text-2xl font-semibold vault-ink ${display ? "font-display" : ""}`}>
            {wedding.coupleNames}
          </p>
          <p className="text-xs vault-muted">
            {wedding.dateLabel} · {wedding.venue}
          </p>

          <div className="mt-5 rounded-2xl border bg-white p-3 vault-line">
            <DemoQrImage
              dataUrl={qrDataUrl}
              seed={wedding.id}
              label={`Scan to open the ${wedding.coupleNames} demo vault`}
              className="h-40 w-40"
            />
          </div>

          <p className="mt-4 text-sm font-semibold vault-ink">Scan to open this vault</p>
          <p className="mt-1 text-xs vault-muted">
            Scan this code to experience how your wedding guests access the vault.
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={openDemo}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition-transform hover:scale-[1.02] vault-accent-bg"
            >
              <IconSparkle className="h-4 w-4" />
              Try QR Demo
            </button>
            <button
              type="button"
              onClick={onOpenVault}
              className="inline-flex h-11 items-center justify-center rounded-full border px-6 text-sm font-semibold transition-colors vault-line vault-ink vault-hover-accent"
            >
              Open Vault
            </button>
          </div>
          <p className="mt-4 text-[11px] vault-muted">
            The QR encodes this public demo page only — no ids, tokens or private data.
          </p>
        </div>

        {/* What a guest does */}
        <div className="border p-6 vault-radius vault-line vault-surface">
          <h3 className="font-display text-lg font-semibold vault-ink">What your guests do</h3>
          <ol className="mt-4 space-y-4">
            {[
              "Scan the QR card on the table with their phone camera.",
              "The vault opens in their browser — no app, no account needed.",
              "They choose photos (and videos where included) and upload them.",
              "Every memory lands in the couple's vault within seconds.",
            ].map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold vault-accent-soft vault-accent">
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed vault-muted">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="QR demo — what a guest sees">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] vault-accent">Demonstration</p>

        {phase === "ready" ? (
          <div className="mt-4 flex flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full vault-accent-soft vault-accent">
              <IconQr className="h-7 w-7" />
            </span>
            <p className="mt-4 text-sm leading-relaxed vault-muted">
              On the big day a guest simply points their camera at the QR card. Press below to see
              what happens next.
            </p>
            <button
              type="button"
              onClick={() => setPhase("scanning")}
              className="mt-5 inline-flex h-11 items-center rounded-full px-6 text-sm font-bold vault-accent-bg"
            >
              Simulate a guest scan
            </button>
          </div>
        ) : null}

        {phase === "scanning" ? (
          <div className="mt-4 flex flex-col items-center text-center" role="status" aria-live="polite">
            <div className="relative h-40 w-40 overflow-hidden rounded-2xl border bg-white p-3 vault-line">
              <DemoQrImage
                dataUrl={qrDataUrl}
                seed={wedding.id}
                label="Scanning demo QR code"
                className="h-full w-full"
              />
              {!reduced ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3 top-3 h-0.5 animate-[scan-line_1.4s_ease-in-out_infinite] rounded-full"
                  style={{ background: "var(--vault-accent)" }}
                />
              ) : null}
            </div>
            <p className="mt-4 text-sm font-semibold vault-ink">Scanning…</p>
          </div>
        ) : null}

        {phase === "opened" ? (
          <div className="mt-4 text-center" role="status" aria-live="polite">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full vault-accent-soft vault-accent">
              <IconCheck className="h-6 w-6" />
            </span>
            <p className="mt-3 font-display text-lg font-semibold vault-ink">
              Vault opened — {wedding.coupleNames}
            </p>
            <p className="mt-1 text-sm vault-muted">
              This is exactly where guests land: the couple&apos;s memories, upload button and
              guestbook.
            </p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenVault();
              }}
              className="mt-5 inline-flex h-11 items-center rounded-full px-6 text-sm font-bold vault-accent-bg"
            >
              Continue into the vault
            </button>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
