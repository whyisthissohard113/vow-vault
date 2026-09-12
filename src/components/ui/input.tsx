import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function Input({ className = "", error, ...rest }: InputProps) {
  return (
    <input
      className={`h-10 w-full rounded-lg border bg-white px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 ${
        error
          ? "border-red-400 focus:border-red-500 dark:border-red-700"
          : "border-zinc-300 dark:border-zinc-700"
      } ${className}`}
      aria-invalid={error ? true : undefined}
      {...rest}
    />
  );
}