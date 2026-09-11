/**
 * MIME allowlist, extension mapping and magic-byte signature detection.
 *
 * Upload magic-byte sniffing protects against "malicious files" (e.g. an
 * HTML/JS payload renamed to `.jpg`). `detectSignature` is a pure function —
 * no I/O, so it is unit-testable offline.
 */

import { MediaMimeRejectedError } from "@/lib/auth/errors";

// ── Allowlist ─────────────────────────────────────────────────────────────────

export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

export const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

export const SUPPORTED_MIME_TYPES: readonly string[] = [
  ...IMAGE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
];

/** Map of allowed MIME → canonical storage extension (no leading dot). */
export const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];
export type VideoMime = (typeof VIDEO_MIME_TYPES)[number];
export type SupportedMime = ImageMime | VideoMime;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isSupportedMime(contentType: string): boolean {
  return SUPPORTED_MIME_TYPES.includes(contentType);
}

export function isImageMime(contentType: string): boolean {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(contentType);
}

export function isVideoMime(contentType: string): boolean {
  return (VIDEO_MIME_TYPES as readonly string[]).includes(contentType);
}

/** Returns `no-leading-dot` extension for a MIME, or throws when unsupported. */
export function sanitizeExt(mimeOrExt: string): string {
  const value = mimeOrExt.trim().toLowerCase();
  if (!value) {
    throw new MediaMimeRejectedError("Empty media type");
  }
  if (value.includes("/")) {
    const ext = MIME_TO_EXT[value];
    if (!ext) {
      throw new MediaMimeRejectedError(`Unsupported media type: ${value}`);
    }
    return ext;
  }
  const ext = value.startsWith(".") ? value.slice(1) : value;
  const known = Object.values(MIME_TO_EXT).includes(ext);
  if (!known) {
    throw new MediaMimeRejectedError(`Unsupported media extension: ${ext}`);
  }
  return ext;
}

// ── Magic-byte signature detection ────────────────────────────────────────────

export interface DetectedSignature {
  mime: string;
}

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBM_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];

/** HEIC/HEIF ISO-BMFF major brands → mime. */
const HEIF_BRANDS: Record<string, string> = {
  heic: "image/heic",
  heix: "image/heic",
  hevc: "image/heic",
  hevx: "image/heic",
  heim: "image/heic",
  heis: "image/heic",
  hevm: "image/heic",
  hevs: "image/heic",
  mif1: "image/heif",
  msf1: "image/heif",
};

/** ISO-BMFF major brands for MP4/MOV → mime. */
const MP4_BRANDS: Record<string, string> = {
  isom: "video/mp4",
  iso2: "video/mp4",
  iso3: "video/mp4",
  iso4: "video/mp4",
  iso5: "video/mp4",
  iso6: "video/mp4",
  mp41: "video/mp4",
  mp42: "video/mp4",
  avc1: "video/mp4",
  avc2: "video/mp4",
  avc3: "video/mp4",
  dash: "video/mp4",
  m4a: "video/mp4",
  m4v: "video/mp4",
  "3gp4": "video/mp4",
  "3gp5": "video/mp4",
  "qt  ": "video/quicktime",
  " M4V ": "video/mp4",
};

function startsWithMagic(buf: Buffer, magic: readonly number[]): boolean {
  if (buf.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (buf[i] !== magic[i]) return false;
  }
  return true;
}

/**
 * Detects the real MIME type of a buffer from its magic bytes.
 * Returns null when the file cannot be positively identified (reject case).
 */
export function detectSignature(buf: Buffer): DetectedSignature | null {
  if (!buf || buf.length === 0) return null;

  // JPEG: FF D8 FF
  if (startsWithMagic(buf, JPEG_MAGIC)) {
    return { mime: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWithMagic(buf, PNG_MAGIC)) {
    return { mime: "image/png" };
  }

  // GIF: GIF87a / GIF89a
  if (buf.length >= 6) {
    const gifText = buf.toString("latin1", 0, 6);
    if (gifText === "GIF87a" || gifText === "GIF89a") {
      return { mime: "image/gif" };
    }
  }

  // WebP: "RIFF" .... "WEBP"
  if (buf.length >= 12) {
    const riff = buf.toString("latin1", 0, 4);
    const webp = buf.toString("latin1", 8, 12);
    if (riff === "RIFF" && webp === "WEBP") {
      return { mime: "image/webp" };
    }
  }

  // WebM / Matroska: EBML header 1A 45 DF A3
  if (startsWithMagic(buf, WEBM_MAGIC)) {
    return { mime: "video/webm" };
  }

  // ISO-BMFF (MP4 / MOV / HEIC / HEIF): size(4) + "ftyp" + major_brand(4)
  if (buf.length >= 12) {
    const boxType = buf.toString("latin1", 4, 8);
    if (boxType === "ftyp") {
      const majorBrand = buf.toString("latin1", 8, 12);
      const heifMime = HEIF_BRANDS[majorBrand];
      if (heifMime) return { mime: heifMime };
      const videoMime = MP4_BRANDS[majorBrand];
      if (videoMime) return { mime: videoMime };
      // Unknown ftyp brand — fail closed rather than guessing.
      return null;
    }
  }

  return null;
}

/**
 * True when the detected signature's family (image vs video) matches the
 * declared content type. A `.jpg` containing a PNG is still an image, but a
 * `.jpg` containing HTML (detected null) is rejected by callers.
 */
export function signatureMatchesDetected(
  detected: DetectedSignature | null,
  declaredContentType: string,
): boolean {
  if (!detected) return false;
  return (
    isImageMime(detected.mime) === isImageMime(declaredContentType) &&
    isVideoMime(detected.mime) === isVideoMime(declaredContentType)
  );
}