/**
 * Unit tests for MIME allowlisting and magic-byte signature detection.
 *
 * Focus on the security property: a renamed HTML/JS payload must fail closed
 * and unknown ISO-BMFF brands must not be guessed.
 */

import { describe, it, expect } from "vitest";

import {
  isSupportedMime,
  isImageMime,
  isVideoMime,
  sanitizeExt,
  detectSignature,
  signatureMatchesDetected,
  SUPPORTED_MIME_TYPES,
  type DetectedSignature,
} from "@/server/services/storage/mime";
import { MediaMimeRejectedError } from "@/lib/auth/errors";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const GIF = Buffer.from("GIF89a", "latin1");
const WEBP = Buffer.from("RIFF\x10\x00\x00\x00WEBPVP8 ", "latin1");
const WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]);
const HTML_PAYLOAD = Buffer.from("<html><script>alert(1)</script></html>");

function ftypBox(majorBrand: string): Buffer {
  const buf = Buffer.alloc(16);
  buf.writeUInt32BE(16, 0);
  buf.write("ftyp", 4, "latin1");
  buf.write(majorBrand.padEnd(4, " "), 8, "latin1");
  buf.writeUInt32BE(0, 12);
  return buf;
}

describe("MIME allowlist", () => {
  it("covers the expected image and video types", () => {
    expect(SUPPORTED_MIME_TYPES).toEqual(
      expect.arrayContaining([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/heic",
        "image/heif",
        "video/mp4",
        "video/quicktime",
        "video/webm",
      ]),
    );
  });

  it("rejects executable/document MIME types", () => {
    const rejected = [
      "text/html",
      "application/javascript",
      "application/octet-stream",
      "application/pdf",
      "text/plain",
      "application/x-msdownload",
    ];
    for (const mime of rejected) {
      expect(isSupportedMime(mime)).toBe(false);
      expect(isImageMime(mime)).toBe(false);
      expect(isVideoMime(mime)).toBe(false);
    }
  });

  it("sanitizeExt maps MIME and extension forms to the canonical extension", () => {
    expect(sanitizeExt("image/jpeg")).toBe("jpg");
    expect(sanitizeExt(".PNG")).toBe("png");
    expect(sanitizeExt("webp")).toBe("webp");
    expect(sanitizeExt("video/quicktime")).toBe("mov");
  });

  it("sanitizeExt fails closed on unsupported values", () => {
    expect(() => sanitizeExt("")).toThrow(MediaMimeRejectedError);
    expect(() => sanitizeExt("image/bmp")).toThrow(MediaMimeRejectedError);
    expect(() => sanitizeExt("exe")).toThrow(MediaMimeRejectedError);
  });
});

describe("detectSignature (magic bytes)", () => {
  it("identifies JPEG, PNG, GIF, WebP and WebM from their magic bytes", () => {
    expect(detectSignature(JPEG)).toEqual({ mime: "image/jpeg" });
    expect(detectSignature(PNG)).toEqual({ mime: "image/png" });
    expect(detectSignature(GIF)).toEqual({ mime: "image/gif" });
    expect(detectSignature(WEBP)).toEqual({ mime: "image/webp" });
    expect(detectSignature(WEBM)).toEqual({ mime: "video/webm" });
  });

  it("identifies MP4/MOV and HEIC/HEIF from their ftyp major brand", () => {
    expect(detectSignature(ftypBox("isom"))).toEqual({ mime: "video/mp4" });
    expect(detectSignature(ftypBox("mp42"))).toEqual({ mime: "video/mp4" });
    expect(detectSignature(ftypBox("qt  "))).toEqual({ mime: "video/quicktime" });
    expect(detectSignature(ftypBox("heic"))).toEqual({ mime: "image/heic" });
    expect(detectSignature(ftypBox("mif1"))).toEqual({ mime: "image/heif" });
  });

  it("fails closed on unknown ftyp brands instead of guessing", () => {
    expect(detectSignature(ftypBox("zzzz"))).toBeNull();
  });

  it("fails closed on HTML/JS payloads and empty buffers", () => {
    expect(detectSignature(HTML_PAYLOAD)).toBeNull();
    expect(detectSignature(Buffer.alloc(0))).toBeNull();
  });
});

describe("signatureMatchesDetected", () => {
  const detectedJpeg: DetectedSignature = { mime: "image/jpeg" };
  const detectedMp4: DetectedSignature = { mime: "video/mp4" };

  it("accepts matching image families", () => {
    expect(signatureMatchesDetected(detectedJpeg, "image/jpeg")).toBe(true);
    expect(signatureMatchesDetected(detectedJpeg, "image/png")).toBe(true); // family match
  });

  it("rejects cross-family mismatches (image vs video)", () => {
    expect(signatureMatchesDetected(detectedJpeg, "video/mp4")).toBe(false);
    expect(signatureMatchesDetected(detectedMp4, "image/jpeg")).toBe(false);
  });

  it("rejects null detection (unidentified content)", () => {
    expect(signatureMatchesDetected(null, "image/jpeg")).toBe(false);
  });
});