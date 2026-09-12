import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, hint, icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "card-soft bg-white p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-stone-500">
          {label}
        </p>
        {icon ? (
          <span className="text-stone-400">{icon}</span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-stone-900">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
}