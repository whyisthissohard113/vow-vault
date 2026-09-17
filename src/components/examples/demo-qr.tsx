"use client";

/**
 * DemoQr — a genuinely scannable QR code for the interactive example vaults.
 *
 * The QR encodes ONLY the public demo route (`/examples/<theme>`), never a
 * database id, token or credential. Generation happens on the client (the
 * `qrcode` package resolves to its canvas/browser build) so the payload can
 * include the current origin. If generation fails for any reason we degrade to
 * the deterministic decorative pattern from `qr-preview.tsx` — clearly a
 * decorative placeholder — rather than shipping a broken image.
 */

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { QrPattern } from "@/components/wedding/qr-preview";

/** Resolve a scannable data-URL for the given demo path (client-only). */
export function useDemoQrDataUrl(
  path: string,
  options?: { dark?: string; light?: string; width?: number },
): string | null {
  const dark = options?.dark ?? "#120f0c";
  const light = options?.light ?? "#ffffff";
  const width = options?.width ?? 256;
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    QRCode.toDataURL(`${origin}${path}`, {
      errorCorrectionLevel: "M",
      margin: 1,
      width,
      color: { dark, light },
    })
      .then((value) => {
        if (!cancelled) setDataUrl(value);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path, dark, light, width]);

  return dataUrl;
}

/**
 * Renders the scannable QR when available, otherwise the decorative fallback.
 * The caller controls sizing via `className`.
 */
export function DemoQrImage({
  dataUrl,
  seed,
  label,
  className,
}: {
  dataUrl: string | null;
  seed: string;
  label: string;
  className?: string;
}) {
  if (dataUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- client-generated data URL
    return <img src={dataUrl} alt={label} className={className} />;
  }
  return <QrPattern seed={seed} label={label} className={className} />;
}
