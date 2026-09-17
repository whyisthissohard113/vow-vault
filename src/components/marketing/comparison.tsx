/**
 * Comparison — full feature comparison table sourced from the content layer.
 * Upload/download windows come straight from each package's marketing data.
 */

import { COMPARISON_ROWS, PACKAGES, hasComparisonFeature } from "@/content/packages";
import { SectionHeading } from "@/components/ui/section-heading";
import { IconCheck, IconMinus } from "@/components/icons";
import { cn } from "@/lib/utils";

function featureCell(
  rowLabel: string,
  packageCode: string,
): { value: string; supported: boolean } {
  if (rowLabel === "Upload window (days)") {
    const pkg = PACKAGES.find((p) => p.code === packageCode);
    return { value: `${pkg?.uploadDays ?? "—"} days`, supported: true };
  }
  if (rowLabel === "Download window (days)") {
    const pkg = PACKAGES.find((p) => p.code === packageCode);
    return { value: `${pkg?.downloadDays ?? "—"} days`, supported: true };
  }
  const row = COMPARISON_ROWS.find((r) => r.label === rowLabel);
  if (!row) return { value: "", supported: false };
  if (row.tier === "all") return { value: "Included", supported: true };
  return {
    value: hasComparisonFeature(packageCode as "gold" | "platinum", row.tier) ? "Included" : "",
    supported: hasComparisonFeature(packageCode as "gold" | "platinum", row.tier),
  };
}

const PACKAGE_COLUMNS = PACKAGES.map((pkg) => pkg.code);

export function Comparison() {
  return (
    <section id="comparison" className="border-y border-line-soft bg-ivory-deep/60">
      <div className="container-page py-20 sm:py-24">
        <SectionHeading
          eyebrow="Compare"
          title="Every package, side by side"
          lead="The same beautiful vault experience — your choice is about how much you want to capture, keep and share."
        />

        <div className="mt-14 overflow-x-auto rounded-3xl border border-line bg-surface shadow-[var(--shadow-soft)]">
          <table className="w-full min-w-[44rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-blush/40">
                <th scope="col" className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-faint">
                  Feature
                </th>
                {PACKAGES.map((pkg) => (
                  <th key={pkg.code} scope="col" className={cn("px-5 py-4 text-center", pkg.code === "gold" && "text-accent-deep")}>
                    <span className="font-display text-base font-semibold tracking-tight text-ink">{pkg.name}</span>
                    <span className="mt-0.5 block text-xs font-medium text-faint">{pkg.priceLabel}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.label} className="border-b border-line-soft last:border-0">
                  <th scope="row" className="px-5 py-3.5 text-sm font-medium text-ink">
                    {row.label}
                    {row.note ? (
                      <span className="block text-xs font-normal text-faint">{row.note}</span>
                    ) : null}
                  </th>
                  {PACKAGE_COLUMNS.map((code) => {
                    const cell = featureCell(row.label, code);
                    return (
                      <td key={code} className="px-5 py-3.5 text-center text-sm">
                        {cell.supported ? (
                          cell.value !== "Included" ? (
                            <span className="font-semibold text-accent-deep">{cell.value}</span>
                          ) : (
                            <span className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-ink">
                              <IconCheck className="h-4 w-4 text-accent-deep" />
                              Included
                            </span>
                          )
                        ) : (
                          <IconMinus className="mx-auto h-4 w-4 text-line" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}