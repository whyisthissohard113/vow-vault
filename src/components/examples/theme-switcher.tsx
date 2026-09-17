"use client";

/**
 * QrDesignSwitcher — the Platinum custom QR card designer (demo).
 *
 * Choosing a design genuinely restyles the live preview. There is no fake
 * selector: every option changes something real.
 */

import { useState } from "react";

import type { WeddingDemo } from "@/content/examples";
import { DemoQrImage } from "./demo-qr";
import { cn } from "@/lib/utils";

type DesignId = "classic" | "minimal" | "luxury" | "african";

interface Design {
  id: DesignId;
  label: string;
  hint: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  display: boolean;
  radius: string;
  border: string;
  layout: "centered" | "left";
}

const DESIGNS: Design[] = [
  {
    id: "classic",
    label: "Classic",
    hint: "Gold & ivory",
    surface: "#faf6ef",
    ink: "#2b241c",
    muted: "#7c7366",
    accent: "#b08d57",
    display: true,
    radius: "1.25rem",
    border: "1px solid #e2d3ba",
    layout: "centered",
  },
  {
    id: "minimal",
    label: "Minimal",
    hint: "Charcoal & ivory",
    surface: "#ffffff",
    ink: "#1b1b1b",
    muted: "#6d6d6a",
    accent: "#1b1b1b",
    display: false,
    radius: "0.2rem",
    border: "1px solid #1b1b1b",
    layout: "left",
  },
  {
    id: "luxury",
    label: "Luxury",
    hint: "Noir & gold",
    surface: "#14110c",
    ink: "#f5ebd8",
    muted: "#bbaa88",
    accent: "#c9a96e",
    display: true,
    radius: "0.7rem",
    border: "1px solid #3b3223",
    layout: "centered",
  },
  {
    id: "african",
    label: "African Contemporary",
    hint: "Ochre & indigo",
    surface: "#1c1938",
    ink: "#f7efe0",
    muted: "#cbbfdd",
    accent: "#e0a24f",
    display: false,
    radius: "1rem",
    border: "1px solid #4a3f86",
    layout: "left",
  },
];

export function QrDesignSwitcher({
  wedding,
  qrDataUrl,
}: {
  wedding: WeddingDemo;
  qrDataUrl: string | null;
}) {
  const [designId, setDesignId] = useState<DesignId>("luxury");
  const design = DESIGNS.find((item) => item.id === designId) ?? DESIGNS[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <h3 className="font-display text-lg font-semibold vault-ink">Design your QR card</h3>
        <p className="mt-1 text-sm vault-muted">
          Platinum couples choose a look for the printed QR cards on their tables. Pick a style and
          the preview changes instantly.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {DESIGNS.map((option) => {
            const active = option.id === designId;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setDesignId(option.id)}
                className={cn(
                  "border px-3 py-2.5 text-left transition-colors vault-radius",
                  active ? "vault-accent-border vault-accent-soft" : "vault-line vault-hover-accent",
                )}
              >
                <span className="block text-sm font-semibold vault-ink">{option.label}</span>
                <span className="block text-[11px] vault-muted">{option.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] vault-accent">
          Live preview · {design.label}
        </p>
        <div
          className="mx-auto w-full max-w-xs p-6 shadow-[var(--shadow-card)]"
          style={{
            background: design.surface,
            color: design.ink,
            border: design.border,
            borderRadius: design.radius,
            textAlign: design.layout === "centered" ? "center" : "left",
          }}
        >
          <p
            style={{
              color: design.accent,
              fontSize: "0.62rem",
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Scan to open
          </p>
          <p
            className={design.display ? "font-display" : ""}
            style={{ marginTop: "0.4rem", fontSize: "1.35rem", fontWeight: 600 }}
          >
            {wedding.coupleNames}
          </p>
          <p style={{ color: design.muted, fontSize: "0.72rem", marginTop: "0.15rem" }}>
            {wedding.dateLabel} · {wedding.venue}
          </p>

          <div
            className="mx-auto mt-4 flex items-center justify-center p-3"
            style={{
              background: "#ffffff",
              border: design.border,
              borderRadius: design.radius,
              width: "9rem",
              height: "9rem",
            }}
          >
            <DemoQrImage
              dataUrl={qrDataUrl}
              seed={wedding.id}
              label={`Demo vault QR for ${wedding.coupleNames}`}
              className="h-full w-full"
            />
          </div>

          <p
            className={design.display ? "font-display" : ""}
            style={{ marginTop: "0.9rem", fontSize: "0.8rem", fontStyle: "italic" }}
          >
            {wedding.qrHint}
          </p>
        </div>
        <p className="mt-3 text-center text-[11px] vault-muted">
          Preview only — QR cards are generated as PNG/PDF in a real Platinum vault.
        </p>
      </div>
    </div>
  );
}
