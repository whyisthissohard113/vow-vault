"use client";

/**
 * VaultUpload — the local demo upload experience.
 *
 * The visitor picks an image from their device, previews it, adds their name
 * and an optional caption, then submits. The image is added to the demo gallery
 * for this browser session only via an object URL. Nothing is uploaded, sent or
 * stored — and the UI says so explicitly.
 */

import { useRef, useState, type ChangeEvent } from "react";

import type { VaultMemory } from "@/lib/examples/demo-derive";
import { IconCheck, IconPhoto, IconUpload } from "@/components/icons";
import { DemoNotice } from "./demo-notice";

const MAX_BYTES = 25 * 1024 * 1024; // mirrors the real product's 25 MB image cap

let uploadSequence = 0;

export function VaultUpload({
  onAdd,
  coupleNames,
}: {
  onAdd: (memory: VaultMemory) => void;
  coupleNames: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(null);
  const [guestName, setGuestName] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);

  function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (JPG, PNG or HEIC).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That image is larger than 25 MB — the same limit the real vault uses.");
      return;
    }
    setError(null);
    setNotice(false);
    setPreview({ src: URL.createObjectURL(file), name: file.name.replace(/\.[^.]+$/, "") });
  }

  const canSubmit = Boolean(preview && guestName.trim().length > 0);

  function submit() {
    if (!preview || !guestName.trim()) return;
    uploadSequence += 1;
    onAdd({
      id: `demo-upload-${Date.now()}-${uploadSequence}`,
      caption: caption.trim() || preview.name || "Guest photo",
      category: "Guests",
      src: preview.src,
      isDemoUpload: true,
      by: guestName.trim(),
    });
    setNotice(true);
    setPreview(null);
    setCaption("");
  }

  return (
    <section aria-labelledby="vault-upload-heading">
      <div>
        <h2 id="vault-upload-heading" className="font-display text-2xl font-semibold tracking-tight vault-ink sm:text-3xl">
          Upload memories
        </h2>
        <p className="mt-1 max-w-2xl text-sm vault-muted">
          This is the guest upload experience for the {coupleNames} vault. In a real vault,
          guests scan the QR card, pick their photos and they land in the couple&apos;s gallery.
          Here it is a local demonstration — nothing leaves your device.
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Step 1 — choose + preview */}
        <div className="border p-5 vault-radius vault-line vault-surface">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] vault-accent">Step 1 · Choose a photo</p>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-4 flex w-full flex-col items-center justify-center gap-2 border border-dashed px-6 py-10 text-center transition-colors vault-radius vault-line vault-hover-accent"
          >
            <IconPhoto className="h-7 w-7 vault-accent" />
            <span className="text-sm font-semibold vault-ink">
              {preview ? "Choose a different photo" : "Select a photo from your device"}
            </span>
            <span className="text-xs vault-muted">JPG, PNG or HEIC · up to 25 MB</span>
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={onPickFile}
            className="sr-only"
            aria-label="Choose a photo for the demo upload"
          />

          {preview ? (
            <figure className="mt-4 overflow-hidden vault-radius">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={preview.src} alt="Preview of the photo you selected" className="aspect-video w-full object-cover" />
              <figcaption className="px-3 py-2 text-xs vault-muted">
                Preview — this photo stays in your browser.
              </figcaption>
            </figure>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        {/* Step 2 — details + submit */}
        <div className="border p-5 vault-radius vault-line vault-surface">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] vault-accent">Step 2 · Add your details</p>

          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="upload-name" className="text-xs font-semibold vault-muted">
                Your name <span className="text-red-500">*</span>
              </label>
              <input
                id="upload-name"
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                maxLength={60}
                placeholder="e.g. Aunt Mary"
                className="mt-1 h-10 w-full border px-3 text-sm outline-none transition-colors vault-radius vault-line vault-surface vault-ink focus:border-[var(--vault-accent)]"
              />
            </div>
            <div>
              <label htmlFor="upload-caption" className="text-xs font-semibold vault-muted">
                Caption (optional)
              </label>
              <input
                id="upload-caption"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                maxLength={90}
                placeholder="e.g. The moment he saw her"
                className="mt-1 h-10 w-full border px-3 text-sm outline-none transition-colors vault-radius vault-line vault-surface vault-ink focus:border-[var(--vault-accent)]"
              />
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full vault-accent-bg text-sm font-bold transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconUpload className="h-4 w-4" />
              Add to this example vault
            </button>
            {!canSubmit ? (
              <p className="text-center text-[11px] vault-muted">
                Choose a photo and enter your name to continue.
              </p>
            ) : null}
          </div>

          {notice ? (
            <div className="mt-4" role="status" aria-live="polite">
              <DemoNotice className="vault-muted">
                <span className="flex items-center gap-1.5 font-semibold vault-ink">
                  <IconCheck className="h-3.5 w-3.5" /> Demo upload — your photo has been added to
                  this example vault.
                </span>
                It lives in this browser session only; nothing was uploaded or saved to Vow Vault
                servers.
              </DemoNotice>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
