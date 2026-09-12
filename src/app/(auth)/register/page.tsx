import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Wedding Memory Vault account",
};

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-stone-900">
        Create your account
      </h1>
      <p className="mt-1 mb-6 text-sm text-stone-500">
        Start building beautiful wedding memory vaults.
      </p>
      <RegisterForm />
    </>
  );
}