import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full text-left text-sm", className)} {...rest} />
    </div>
  );
}

export function TableHeader({
  className,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-zinc-200 dark:border-zinc-800", className)} {...rest} />;
}

export function TableBody({
  className,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-zinc-100 dark:divide-zinc-800/70", className)} {...rest} />;
}

export function TableRow({
  className,
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("hover:bg-zinc-50 dark:hover:bg-zinc-900/50", className)} {...rest} />;
}

export function TableHead({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400", className)}
      {...rest}
    />
  );
}

export function TableCell({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 align-middle text-zinc-700 dark:text-zinc-300", className)} {...rest} />;
}

export function TableEmpty({
  colSpan,
  children = "No records found",
}: {
  colSpan: number;
  children?: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-zinc-400">
        {children}
      </td>
    </tr>
  );
}