"use client";

/**
 * MemoryVisual — renders either local demo artwork (SVG) or a visitor's
 * locally-uploaded demo image (object URL). Keeps the gallery, slideshow and
 * lightbox on one rendering path.
 */

import { DemoArtwork } from "@/components/wedding/demo-artwork";
import type { VaultMemory } from "@/lib/examples/demo-derive";
import { cn } from "@/lib/utils";

export function MemoryVisual({
  memory,
  className,
  priority = false,
}: {
  memory: VaultMemory;
  className?: string;
  priority?: boolean;
}) {
  if (memory.src) {
    // eslint-disable-next-line @next/next/no-img-element -- local object URL, never a remote asset
    return <img src={memory.src} alt={memory.caption} className={className} />;
  }
  if (memory.image) {
    return <DemoArtwork image={memory.image} className={className} priority={priority} />;
  }
  return <div className={cn("vault-accent-soft", className)} aria-hidden="true" />;
}
