import { cn } from "@/lib/utils";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-50",
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}