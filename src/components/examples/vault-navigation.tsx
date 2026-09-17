"use client";

/**
 * VaultNavigation — the in-vault section nav.
 *
 * Only capabilities the package actually includes are shown; the section list
 * is derived from the canonical package flags in `example-vault.tsx`.
 */

import type { VaultSection } from "./vault-types";
import { VAULT_SECTION_LABEL } from "./vault-types";
import { cn } from "@/lib/utils";

export function VaultNavigation({
  sections,
  active,
  onSelect,
  counts,
}: {
  sections: VaultSection[];
  active: VaultSection;
  onSelect: (section: VaultSection) => void;
  counts?: Partial<Record<VaultSection, number>>;
}) {
  return (
    <nav
      aria-label="Vault sections"
      className="sticky top-0 z-40 border-b backdrop-blur vault-surface vault-line"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-3 sm:px-6">
        {sections.map((section) => {
          const selected = section === active;
          const count = counts?.[section];
          return (
            <button
              key={section}
              type="button"
              aria-current={selected ? "true" : undefined}
              onClick={() => onSelect(section)}
              className={cn(
                "relative inline-flex h-14 shrink-0 items-center gap-2 border-b-2 px-3.5 text-sm font-semibold transition-colors sm:px-4",
                selected
                  ? "vault-accent vault-accent-border"
                  : "border-transparent vault-muted hover:text-[var(--vault-ink)]",
              )}
            >
              {VAULT_SECTION_LABEL[section]}
              {typeof count === "number" ? (
                <span className="rounded-full px-2 py-0.5 text-[11px] font-bold vault-accent-soft vault-accent">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
