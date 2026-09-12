/**
 * Minimal class-name helper. Filters falsy values and joins the remainder.
 * (Deliberately dependency-free — no clsx/tailwind-merge needed for our usage.)
 */
export function cn(...values: Array<string | number | null | false | undefined>) {
  return values.filter(Boolean).join(" ");
}