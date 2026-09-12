import type { ReactNode } from "react";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function ErrorState({
  title = "Something went wrong",
  description = "Please try again. If the problem persists, contact support.",
  action,
}: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-900/60 dark:bg-red-950/30">
      <h3 className="text-base font-semibold text-red-900 dark:text-red-200">
        {title}
      </h3>
      <p className="mt-1 text-sm text-red-700 dark:text-red-300">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}