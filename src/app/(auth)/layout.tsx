import type { ReactNode } from "react";

import { IconBrand } from "@/components/icons";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="mb-8 flex items-center gap-3">
        <span className="text-zinc-900 dark:text-zinc-50">
          <IconBrand className="h-10 w-10" />
        </span>
        <span className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Wedding Memory Vault
        </span>
      </div>
      <main className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {children}
      </main>
    </div>
  );
}