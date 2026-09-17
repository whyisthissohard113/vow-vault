"use client";

/**
 * QRPreview — a table-card mock of the vault's QR card.
 *
 * The QR pattern itself is a decorative deterministic placeholder (not a
 * scannable code, and never derived from real vault data — the marketing
 * site must never expose real public v4 vault addresses). It exists purely
 * to communicate the "scan to upload" moment.
 */

import type { WeddingDemo } from "./types";

interface QrPatternProps {
  seed: string;
  label: string;
  className?: string;
}

export function QrPattern({ seed, label, className }: QrPatternProps) {
  const size = 21;
  const cells: boolean[] = [];

  let state = 0;
  for (let i = 0; i < seed.length; i += 1) {
    state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inFinder =
        (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
      const onTiming = (x === size - 8 && y > 7 && y < size - 1) || (y === size - 8 && x > 7 && x < size - 1);
      if (inFinder) {
        cells.push(true);
      } else if (onTiming) {
        cells.push((x + y) % 2 === 0);
      } else {
        cells.push(rand() > 0.45);
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      className={className}
    >
      <rect width={size} height={size} rx="2" fill="none" />
      {cells.map((on, index) => {
        if (!on) return null;
        const x = index % size;
        const y = Math.floor(index / size);
        const inFinder = (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
        if (inFinder) {
          // Finder frames are blank render cells; frames drawn below.
          return null;
        }
        return <rect key={index} x={x} y={y} width="1" height="1" fill="currentColor" />;
      })}
      {/* Finder patterns */}
      {[
        [1.5, 1.5, size - 9],
        [size - 7.5, 1.5, size - 9],
        [1.5, size - 7.5, size - 9],
      ].map(([cx, cy], i) => (
        <g key={i}>
          <rect x={cx} y={cy} width="4" height="4" rx="0.6" fill="currentColor" />
          <rect x={cx + 1} y={cy + 1} width="2" height="2" rx="0.4" fill="var(--surface)" />
        </g>
      ))}
    </svg>
  );
}

export function QRPreview({
  wedding,
  className,
  compact = false,
}: {
  wedding: WeddingDemo;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-line ${className ?? ""}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
        style={{ background: `linear-gradient(90deg, ${wedding.colors.theme}, ${wedding.colors.accent})` }}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-ink">
            {wedding.coupleNames}
          </p>
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            {wedding.dateLabel}
          </p>
        </div>
        <span
          aria-hidden="true"
          style={{ background: wedding.colors.accent }}
          className="h-2 w-2 shrink-0 rounded-full"
        />
      </div>

      <div
        className="mt-4 flex items-center justify-center rounded-xl p-4"
        style={{
          background: `linear-gradient(135deg, ${wedding.colors.theme}14, ${wedding.colors.accent}1f)`,
        }}
      >
        <QrPattern
          seed={wedding.id}
          label={`Decorative QR placeholder for the ${wedding.title} demo vault`}
          className="h-28 w-28 text-brand"
        />
      </div>

      {!compact ? (
        <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-deep">
          Scan to share your memories
        </p>
      ) : null}
    </div>
  );
}