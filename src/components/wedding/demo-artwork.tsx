/**
 * DemoArtwork — self-contained SVG wedding imagery for the marketing demos.
 *
 * There are no real wedding photos in the repo, so every demo "photo" is a
 * tasteful abstract composition: layered gradients from the theme palette,
 * soft glows, decorative grain and elegant line-art motifs. No external
 * images, no hotlinks, no stock downloads. The wedding components render
 * these instead of real media.
 */

import type { DemoImage, DemoMotif } from "./types";

interface MotifProps {
  tone: string;
  accent: string;
}

/**
 * 12-point sparkler star: ray endpoints from radius 46 to 74 around (200, 150).
 *
 * Precomputed as decimal literals instead of `Math.sin`/`Math.cos` at render
 * time. Floating-point trig on the computed angle `(i / 12) * 2 * Math.PI`
 * is not an exact multiple of `PI / 6`, and the result can differ by an ulp
 * between the server and browser engines — which would make the SSR HTML
 * attributes mismatch the client render and break React hydration.
 */
const SPARKLER_RAYS: ReadonlyArray<readonly [number, number, number, number]> = [
  [246, 150, 274, 150],
  [239.8372, 173, 264.0859, 187],
  [223, 189.8372, 237, 214.0859],
  [200, 196, 200, 224],
  [177, 189.8372, 163, 214.0859],
  [160.1628, 173, 135.9141, 187],
  [154, 150, 126, 150],
  [160.1628, 127, 135.9141, 113],
  [177, 110.1628, 163, 85.9141],
  [200, 104, 200, 76],
  [223, 110.1628, 237, 85.9141],
  [239.8372, 127, 264.0859, 113],
];

function motifContent(motif: DemoMotif, p: MotifProps) {
  const { tone, accent } = p;

  switch (motif) {
    case "rings":
      return (
        <>
          <circle cx="158" cy="150" r="52" stroke={accent} strokeWidth="3" fill="none" opacity="0.9" />
          <circle cx="242" cy="150" r="52" stroke={tone} strokeWidth="2.4" fill="none" />
          <circle cx="200" cy="132" r="14" fill={accent} opacity="0.35" />
        </>
      );
    case "bouquet":
      return (
        <g>
          <path d="M200 270 C 186 220, 188 186, 200 150" stroke={tone} strokeWidth="2.4" fill="none" />
          <g fill={accent} opacity="0.9">
            <circle cx="200" cy="126" r="20" />
            <circle cx="174" cy="142" r="15" />
            <circle cx="226" cy="142" r="15" />
            <circle cx="188" cy="114" r="12" />
            <circle cx="212" cy="114" r="12" />
          </g>
          <circle cx="200" cy="126" r="8" fill="#fffaf0" opacity="0.85" />
          <path d="M186 226 C 172 234, 160 236, 148 230" stroke={tone} strokeWidth="1.8" fill="none" opacity="0.6" />
          <path d="M213 226 C 227 234, 239 236, 251 230" stroke={tone} strokeWidth="1.8" fill="none" opacity="0.6" />
        </g>
      );
    case "dance":
      return (
        <g>
          <path d="M158 162 C 136 140, 136 112, 158 96 C 180 80, 198 92, 200 112 C 217 96, 244 108, 244 134 C 244 158, 224 178, 200 196 C 190 186, 172 176, 158 162 Z" fill={accent} opacity="0.28" />
          <path d="M170 148 C 156 130, 158 116, 174 106" stroke={tone} strokeWidth="2.4" fill="none" />
          <path d="M222 136 C 232 150, 226 166, 210 174" stroke={tone} strokeWidth="2.4" fill="none" />
          <circle cx="176" cy="100" r="10" stroke={accent} strokeWidth="2.4" fill="none" />
          <circle cx="224" cy="130" r="10" stroke={accent} strokeWidth="2.4" fill="none" />
        </g>
      );
    case "sparklers":
      return (
        <g>
          {SPARKLER_RAYS.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 3 === 0 ? accent : tone} strokeWidth="1.8" opacity="0.8" />
          ))}
          <circle cx="200" cy="150" r="13" fill={accent} opacity="0.9" />
          <circle cx="200" cy="150" r="28" stroke={accent} strokeWidth="1.4" opacity="0.5" />
          {Array.from({ length: 10 }).map((_, i) => {
            const x = 120 + ((i * 137) % 160);
            const y = 70 + ((i * 89) % 130);
            return <circle key={`d${i}`} cx={x} cy={y} r="2" fill={tone} opacity="0.8" />;
          })}
        </g>
      );
    case "vows":
      return (
        <g>
          <path d="M152 126 C 172 112, 190 128, 200 144 C 210 128, 228 112, 248 126 L 248 202 C 228 188, 210 202, 200 218 C 190 202, 172 188, 152 202 Z" fill={accent} opacity="0.22" />
          <path d="M152 126 C 172 112, 190 128, 200 144 C 210 128, 228 112, 248 126" stroke={tone} strokeWidth="2.2" fill="none" />
          <path d="M152 202 C 172 188, 190 202, 200 218 C 210 202, 228 188, 248 202" stroke={tone} strokeWidth="2.2" fill="none" />
          <path d="M200 144 L 200 218" stroke={tone} strokeWidth="1.6" opacity="0.55" />
          <circle cx="200" cy="158" r="7" fill={accent} opacity="0.85" />
        </g>
      );
    case "confetti":
      return (
        <g>
          {Array.from({ length: 14 }).map((_, i) => {
            const x = 130 + ((i * 173) % 140);
            const y = 92 + ((i * 97) % 116);
            const size = 5 + (i % 3) * 3;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={size}
                height={size}
                rx="1.5"
                transform={`rotate(${i * 31} ${x + size / 2} ${y + size / 2})`}
                fill={i % 2 === 0 ? accent : tone}
                opacity="0.85"
              />
            );
          })}
          <path d="M176 208 C 190 196, 208 196, 223 208" stroke={tone} strokeWidth="2" fill="none" opacity="0.6" />
        </g>
      );
    case "goldenhour":
      return (
        <g>
          <circle cx="200" cy="132" r="44" fill={accent} opacity="0.55" />
          <circle cx="200" cy="132" r="44" stroke={tone} strokeWidth="2" fill="none" opacity="0.9" />
          <line x1="132" y1="184" x2="268" y2="184" stroke={tone} strokeWidth="2.2" opacity="0.9" />
          <line x1="152" y1="200" x2="248" y2="200" stroke={tone} strokeWidth="1.6" opacity="0.5" />
          <line x1="172" y1="216" x2="228" y2="216" stroke={tone} strokeWidth="1.6" opacity="0.35" />
          <path d="M200 46 L 200 62 M 108 84 L 120 94 M 280 84 L 294 94" stroke={tone} strokeWidth="2" opacity="0.7" />
        </g>
      );
    case "veil":
      return (
        <g>
          <path d="M148 82 C 168 70, 236 70, 254 84 C 246 122, 226 168, 200 220 C 176 172, 156 124, 148 82 Z" fill={accent} opacity="0.2" />
          <path d="M152 88 C 172 74, 232 74, 250 86 C 242 124, 222 170, 200 216 C 180 172, 160 126, 152 88 Z" stroke={tone} strokeWidth="2.2" fill="none" />
          <path d="M160 104 C 178 92, 226 92, 242 102" stroke={tone} strokeWidth="1.4" opacity="0.6" />
          <path d="M166 132 C 182 122, 222 122, 235 130" stroke={tone} strokeWidth="1.4" opacity="0.45" />
          <path d="M174 160 C 188 152, 214 152, 226 158" stroke={tone} strokeWidth="1.4" opacity="0.35" />
        </g>
      );
    case "toast":
      return (
        <g>
          <path d="M172 96 L 200 150 L 200 220 L 172 206 Z" fill={accent} opacity="0.32" />
          <path d="M228 96 L 200 150 L 200 220 L 228 206 Z" fill={tone} opacity="0.22" />
          <path d="M172 96 L 200 150 L 200 150" stroke={tone} strokeWidth="2.2" fill="none" />
          <path d="M228 96 L 200 150" stroke={tone} strokeWidth="2.2" fill="none" />
          <circle cx="200" cy="150" r="5" fill="#fffaf0" opacity="0.9" />
          {Array.from({ length: 6 }).map((_, i) => {
            const x = 178 + ((i * 53) % 44);
            const y = 92 + ((i * 29) % 40);
            return <circle key={`f${i}`} cx={x} cy={y} r="2.4" fill={accent} opacity="0.8" />;
          })}
        </g>
      );
    case "firstdance":
      return (
        <g>
          <circle cx="158" cy="106" r="16" stroke={tone} strokeWidth="2.4" fill="none" />
          <path d="M158 122 C 146 150, 134 178, 122 212" stroke={tone} strokeWidth="2.4" fill="none" />
          <circle cx="238" cy="128" r="16" stroke={accent} strokeWidth="2.4" fill="none" />
          <path d="M238 144 C 244 166, 248 190, 252 212" stroke={accent} strokeWidth="2.4" fill="none" />
          <path d="M134 168 C 166 158, 188 178, 222 172" stroke={tone} strokeWidth="1.8" opacity="0.75" />
          <path d="M168 106 C 188 100, 208 110, 222 122" stroke={tone} strokeWidth="1.4" opacity="0.6" />
        </g>
      );
    default:
      return null;
  }
}

export function DemoArtwork({
  image,
  className,
  priority = false,
}: {
  image: DemoImage;
  className?: string;
  priority?: boolean;
}) {
  const [from, via, to] = image.palette;
  const tone = "rgba(255,250,240,0.92)";
  const accent = "rgba(255,255,255,0.9)";

  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      role={priority ? undefined : "img"}
      aria-label={priority ? undefined : image.caption}
      className={className}
    >
      <defs>
        <linearGradient id={`g-${image.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="55%" stopColor={via} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <radialGradient id={`glow-${image.id}`} cx="50%" cy="38%" r="60%">
          <stop offset="0%" stopColor="rgba(255,250,240,0.35)" />
          <stop offset="100%" stopColor="rgba(255,250,240,0)" />
        </radialGradient>
        <filter id={`soft-${image.id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <rect width="400" height="300" fill={`url(#g-${image.id})`} />
      <rect width="400" height="300" fill={`url(#glow-${image.id})`} />

      {/* Decorative grain */}
      <g opacity="0.16">
        {Array.from({ length: 26 }).map((_, i) => {
          const x = 18 + ((i * 61) % 364);
          const y = 14 + ((i * 47) % 272);
          return <circle key={`n${i}`} cx={x} cy={y} r={i % 3 === 0 ? 1.6 : 1} fill="#fffaf0" />;
        })}
      </g>

      {/* Corner frames */}
      <path d="M28 24 H 64 M 28 24 V 60" stroke="rgba(255,250,240,0.5)" strokeWidth="1.6" fill="none" />
      <path d="M372 24 H 336 M 372 24 V 60" stroke="rgba(255,250,240,0.5)" strokeWidth="1.6" fill="none" />
      <path d="M28 276 H 64 M 28 276 V 240" stroke="rgba(255,250,240,0.5)" strokeWidth="1.6" fill="none" />
      <path d="M372 276 H 336 M 372 276 V 240" stroke="rgba(255,250,240,0.5)" strokeWidth="1.6" fill="none" />

      {/* Subtle gold ring behind the motif */}
      <circle cx="200" cy="150" r="92" fill="none" stroke="rgba(255,250,240,0.18)" strokeWidth="1.2" />

      {motifContent(image.motif, { tone, accent })}
    </svg>
  );
}

/** Elegant initials avatar used for guestbook/testimonial placeholders. */
export function DemoInitials({
  initials,
  className,
  palette = ["#efe4ce", "#b08d57"],
}: {
  initials: string;
  className?: string;
  palette?: [string, string];
}) {
  const [from, to] = palette;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white ${className ?? "h-10 w-10 text-sm"}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  );
}