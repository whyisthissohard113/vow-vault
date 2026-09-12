import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Wedding Memory Vault dashboard",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  const params = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Welcome back
      </h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Sign in to manage your wedding vaults.
      </p>

      {params.registered ? (
        <p
          className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          role="status"
        >
          Account created. Sign in to continue.
        </p>
      ) : null}

      {params.error === "no-organization" ? (
        <p
          className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          role="status"
        >
          Your account isn&apos;t linked to a company yet. Ask your admin to
          invite you before signing in.
        </p>
      ) : null}

      <LoginForm />
    </>
  );
}