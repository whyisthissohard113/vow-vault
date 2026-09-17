"use client";

/**
 * VaultGallery — the interactive memory gallery.
 *
 * Filter chips genuinely filter the displayed memories (categories derived from
 * the demo motifs), every tile is clickable and opens the lightbox at the
 * matching position, and visitor-uploaded demo items are marked as such.
 */

import { useMemo, useState } from "react";

import type { VaultMemory } from "@/lib/examples/demo-derive";
import { DEMO_CATEGORIES, type DemoCategory } from "@/lib/examples/demo-derive";
import { MemoryVisual } from "./memory-visual";
import { GalleryLightbox } from "./gallery-lightbox";
import { IconHeart, IconPlus } from "@/components/icons";
import { cn } from "@/lib/utils";

type Filter = "All" | DemoCategory;

export function VaultGallery({
  memories,
  coupleNames,
  onRequestUpload,
  uploadLabel = "Add your photos",
}: {
  memories: VaultMemory[];
  coupleNames: string;
  onRequestUpload?: () => void;
  uploadLabel?: string;
}) {
  const [filter, setFilter] = useState<Filter>("All");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const presentCategories = useMemo(() => {
    const found = new Set<DemoCategory>();
    for (const memory of memories) found.add(memory.category);
    return DEMO_CATEGORIES.filter((category) => found.has(category));
  }, [memories]);

  const filtered = useMemo(
    () => (filter === "All" ? memories : memories.filter((memory) => memory.category === filter)),
    [memories, filter],
  );

  const resultCount =
    filter === "All"
      ? memories.length
      : memories.filter((memory) => memory.category === filter).length;

  return (
    <section id="vault-memories" aria-labelledby="vault-memories-heading" className="scroll-mt-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="vault-memories-heading" className="font-display text-2xl font-semibold tracking-tight vault-ink sm:text-3xl">
            Memories
          </h2>
          <p className="mt-1 text-sm vault-muted">
            {resultCount} demo {resultCount === 1 ? "memory" : "memories"} · tap any image to open it
          </p>
        </div>
        {onRequestUpload ? (
          <button
            type="button"
            onClick={onRequestUpload}
            className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors vault-line vault-ink vault-hover-accent"
          >
            <IconPlus className="h-4 w-4" />
            {uploadLabel}
          </button>
        ) : null}
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter memories">
        {(["All", ...presentCategories] as Filter[]).map((option) => {
          const active = filter === option;
          const count =
            option === "All"
              ? memories.length
              : memories.filter((memory) => memory.category === option).length;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                active ? "vault-accent-bg vault-accent-border" : "vault-line vault-muted hover:text-[var(--vault-ink)]",
              )}
            >
              {option}
              <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((memory, index) => (
            <button
              key={memory.id}
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={`Open memory: ${memory.caption}`}
              className="group relative block overflow-hidden vault-radius focus-visible:outline-none"
            >
              <MemoryVisual
                memory={memory}
                className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-brand-ink/75 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100"
              />
              {memory.isDemoUpload ? (
                <span className="absolute left-2 top-2 rounded-full bg-brand-ink/75 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ivory">
                  Demo upload
                </span>
              ) : null}
              <span className="absolute inset-x-0 bottom-0 translate-y-1 px-3 pb-2.5 pt-8 text-left text-[11px] font-medium text-ivory opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                {memory.caption}
                {memory.by ? <span className="block text-ivory/75">by {memory.by}</span> : null}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-3xl border border-dashed px-6 py-14 text-center vault-line">
          <IconHeart className="h-6 w-6 vault-accent" />
          <p className="text-sm font-semibold vault-ink">No demo memories in this filter yet</p>
          <p className="text-xs vault-muted">Choose another filter to keep exploring.</p>
        </div>
      )}

      {openIndex !== null ? (
        <GalleryLightbox
          memories={filtered}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onIndexChange={setOpenIndex}
          coupleNames={coupleNames}
        />
      ) : null}
    </section>
  );
}
