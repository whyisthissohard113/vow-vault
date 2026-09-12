// Generates public placeholder assets used by marketing pages:
//  - QR code PNGs (placeholder-qr-sm/md/lg.png) via the qrcode library
//  - A wedding hero SVG (placeholder-wedding.svg)
// Run: node scripts/generate-placeholders.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public");
mkdirSync(outDir, { recursive: true });

const sampleUrls = {
  sm: "https://memory-vault.app/w/sample-event",
  md: "https://memory-vault.app/w/sample-event",
  lg: "https://memory-vault.app/w/sample-event?qr=platinum",
};

for (const [size, url] of Object.entries(sampleUrls)) {
  const dims = size === "sm" ? 320 : size === "md" ? 480 : 640;
  const buffer = await QRCode.toBuffer(url, {
    type: "png",
    width: dims,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#211a16", light: "#ffffff" },
  });
  const file = path.join(outDir, `placeholder-qr-${size}.png`);
  writeFileSync(file, buffer);
  console.log(`wrote ${file} (${buffer.length} bytes)`);
}

const weddingSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f4eee5"/>
      <stop offset="1" stop-color="#e8dccb"/>
    </linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fbd5d5"/>
      <stop offset="1" stop-color="#e11d48"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="900" fill="url(#bg)"/>
  <circle cx="600" cy="430" r="200" fill="url(#sun)" opacity="0.55"/>
  <circle cx="600" cy="430" r="140" fill="#fff" opacity="0.9"/>
  <g fill="#211a16" opacity="0.85">
    <path d="M600 268c-26-34-72-34-94 0-22 32-6 72 28 72 16 0 28-8 34-18 8 12 22 18 32 18 34 0 50-40 28-72-8-12-18-18-28-0zm0 0"/>
    <circle cx="600" cy="520" r="60" fill="#e11d48"/>
  </g>
  <text x="600" y="640" text-anchor="middle" font-family="Georgia, serif" font-size="44" font-style="italic" fill="#211a16" opacity="0.7">A day to remember</text>
  <text x="600" y="700" text-anchor="middle" font-family="sans-serif" font-size="20" letter-spacing="6" fill="#211a16" opacity="0.5">WEDDING MEMORY VAULT</text>
  <rect x="420" y="740" width="360" height="1" fill="#c8934a"/>
</svg>`;

const svgFile = path.join(outDir, "placeholder-wedding.svg");
writeFileSync(svgFile, weddingSvg);
console.log(`wrote ${svgFile} (${weddingSvg.length} bytes)`);