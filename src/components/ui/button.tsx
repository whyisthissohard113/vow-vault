/**
 * Button — hand-rolled button primitive on the Vow Vault token system.
 *
 * API is backward compatible with the previous zinc-palette version (same
 * variants, sizes and props), so dashboard and auth flows keep working.
 * Added variant: `accent` (champagne gold) for the marketing site.
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "accent";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-[#fbf7f0] hover:bg-brand-soft disabled:hover:bg-brand dark:bg-[#fbf7f0] dark:text-brand dark:hover:bg-white",
  secondary:
    "bg-blush text-ink hover:bg-blush-deep disabled:hover:bg-blush dark:bg-brand-soft dark:text-ivory dark:hover:bg-brand",
  outline:
    "border border-line bg-transparent text-ink hover:bg-ivory-deep dark:border-line dark:text-ivory dark:hover:bg-brand-soft",
  ghost:
    "bg-transparent text-muted hover:bg-ivory-deep hover:text-ink dark:text-ivory dark:hover:bg-brand-soft",
  accent:
    "bg-accent text-white hover:bg-accent-deep disabled:hover:bg-accent dark:bg-accent dark:hover:bg-accent-deep",
  danger:
    "bg-red-600 text-white hover:bg-red-500 dark:bg-red-600 dark:hover:bg-red-500",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${
        fullWidth ? "w-full" : ""
      } ${className}`}
      {...rest}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        leftIcon
      )}
      {children}
      {!loading ? rightIcon : null}
    </button>
  );
}