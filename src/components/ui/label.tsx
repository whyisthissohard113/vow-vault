import type { LabelHTMLAttributes, ReactNode } from "react";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
}

export function Label({ className = "", children, ...rest }: LabelProps) {
  return (
    <label
      className={`mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300 ${className}`}
      {...rest}
    >
      {children}
    </label>
  );
}