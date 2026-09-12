/**
 * QR Card Generator — Generates printable QR cards (Platinum feature).
 *
 * Uses `sharp` for image composition. Creates a card image (PNG) with:
 *  - QR code centered at top
 *  - Couple names below QR
 *  - Wedding date below names
 *  - "Scan to share your memories" tagline
 *  - Custom colors from design
 *
 * Card dimensions: 1080x1620px (2:3 ratio, standard print size).
 */

import sharp from "sharp";
import { generateQrPng, type QrGenerateOptions } from "./qr-service";
import { QrCardGenerationError } from "@/lib/auth/errors";

// ── Types ────────────────────────────────────────────────────────────────────

export interface QrCardOptions {
  targetUrl: string;
  coupleName: string;
  weddingDate?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  logoKey?: string;
  width?: number;
  height?: number;
}

export interface QrCardResult {
  pngBuffer: Buffer;
  contentType: "image/png";
  width: number;
  height: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1620;
const QR_SIZE = 512;
const QR_MARGIN_TOP = 180;
const TEXT_AREA_TOP = QR_MARGIN_TOP + QR_SIZE + 80;
const FONT_SIZE_COUPLE = 56;
const FONT_SIZE_DATE = 36;
const FONT_SIZE_TAGLINE = 28;
const TAGLINE_COLOR = "#888888";

// ── QR Card Generation ──────────────────────────────────────────────────────

/**
 * Create a card image (PNG) with QR code, couple names, date, and tagline.
 *
 * Layout (1080x1620):
 *  - Background: backgroundColor (default white)
 *  - QR code: centered horizontally, positioned at ~11% from top
 *  - Couple names: centered below QR
 *  - Wedding date: centered below names
 *  - Tagline: "Scan to share your memories" centered near bottom
 */
export async function generateQrCardPng(
  options: QrCardOptions,
): Promise<QrCardResult> {
  const {
    targetUrl,
    coupleName,
    weddingDate,
    backgroundColor = "#FFFFFF",
    foregroundColor = "#000000",
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
  } = options;

  try {
    // 1. Generate QR code buffer with the couple's colors
    const qrOptions: QrGenerateOptions = {
      width: QR_SIZE,
      margin: 2,
      color: {
        dark: foregroundColor,
        light: backgroundColor,
      },
    };
    const qrBuffer = await generateQrPng(targetUrl, qrOptions);

    // 2. Create a white canvas with the specified background
    const canvas = sharp({
      create: {
        width,
        height,
        channels: 3,
        background: backgroundColor,
      },
    });

    // 3. Build SVG text overlay
    const qrX = Math.round((width - QR_SIZE) / 2);

    const textSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <!-- Couple names -->
        <text
          x="${width / 2}"
          y="${TEXT_AREA_TOP}"
          text-anchor="middle"
          font-family="Georgia, 'Times New Roman', serif"
          font-size="${FONT_SIZE_COUPLE}"
          fill="${foregroundColor}"
          font-weight="bold"
        >${escapeXml(coupleName)}</text>

        <!-- Wedding date -->
        ${weddingDate ? `
        <text
          x="${width / 2}"
          y="${TEXT_AREA_TOP + 70}"
          text-anchor="middle"
          font-family="Georgia, 'Times New Roman', serif"
          font-size="${FONT_SIZE_DATE}"
          fill="${foregroundColor}"
        >${escapeXml(weddingDate)}</text>
        ` : ""}

        <!-- Tagline -->
        <text
          x="${width / 2}"
          y="${height - 120}"
          text-anchor="middle"
          font-family="Helvetica, Arial, sans-serif"
          font-size="${FONT_SIZE_TAGLINE}"
          fill="${TAGLINE_COLOR}"
          font-style="italic"
        >Scan to share your memories</text>
      </svg>
    `;

    const textBuffer = Buffer.from(textSvg);

    // 4. Composite: background canvas + QR code + text overlay
    const result = await canvas
      .composite([
        {
          input: qrBuffer,
          left: qrX,
          top: QR_MARGIN_TOP,
        },
        {
          input: textBuffer,
          left: 0,
          top: 0,
        },
      ])
      .png()
      .toBuffer();

    return {
      pngBuffer: result,
      contentType: "image/png",
      width,
      height,
    };
  } catch (error) {
    throw new QrCardGenerationError(
      error instanceof Error ? error.message : "Unknown card generation error",
    );
  }
}

/**
 * Generate a QR card as PDF. Currently a stub — generates a PNG and wraps it
 * with a note. Full PDF generation is a future enhancement.
 */
export async function generateQrCardPdf(
  options: QrCardOptions,
): Promise<Buffer> {
  // For now, generate the PNG. Full PDF generation is a future enhancement.
  const card = await generateQrCardPng(options);
  return card.pngBuffer;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Escape special XML characters for SVG text content.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
