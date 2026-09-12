"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_POLICY } from "@/lib/auth/constants";

interface RegisterFormProps {
  hasCompanyNameField?: boolean;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * RegisterForm — creates the user account via POST /api/auth/register and then
 * redirects to the login page. The "company name" field is a UI-only stub:
 * organization provisioning is not yet implemented server-side, and the API
 * schema is `.strict()` (unknown keys are rejected), so only email / password /
 * fullName are sent.
 */
export function RegisterForm({ hasCompanyNameField = false }: RegisterFormProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    const body = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      fullName: String(formData.get("fullName") ?? ""),
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readJson(res);
      if (!res.ok) {
        setError((data.error as string) ?? "Could not create your account");
        return;
      }
      setRegistered(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (registered) {
    return (
      <p
        className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        role="status"
      >
        Account created!{" "}
        <Link
          href="/login"
          className="font-medium text-emerald-800 underline dark:text-emerald-200"
        >
          Sign in
        </Link>{" "}
        to continue.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {hasCompanyNameField ? (
        <div>
          <Label htmlFor="companyName">Company name</Label>
          <Input id="companyName" name="companyName" placeholder="Coming soon" disabled />
          <p className="mt-1 text-xs text-zinc-400">
            Company onboarding is coming soon.
          </p>
        </div>
      ) : null}

      <div>
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          maxLength={200}
          placeholder="Jane Doe"
        />
      </div>

      <div>
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_POLICY.MIN_LENGTH}
          maxLength={PASSWORD_POLICY.MAX_LENGTH}
          placeholder={`At least ${PASSWORD_POLICY.MIN_LENGTH} characters`}
        />
        <p className="mt-1 text-xs text-zinc-400">
          At least {PASSWORD_POLICY.MIN_LENGTH} characters.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <Button type="submit" fullWidth loading={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}