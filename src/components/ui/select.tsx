import type { ReactNode, SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  children: ReactNode;
}

export function Select({ className = "", error, children, ...rest }: SelectProps) {
  return (
    <select
      className={`h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-9 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-900 dark:text-zinc-50 ${
        error
          ? "border-red-400 focus:border-red-500 dark:border-red-700"
          : "border-zinc-300 dark:border-zinc-700"
      } ${className}`}
      aria-invalid={error ? true : undefined}
      {...rest}
    >
      {children}
    </select>
  );
}