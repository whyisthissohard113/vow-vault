"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";

export interface LoginState {
  error?: string;
}

function validate(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/**
 * Server action used by the login form. Calls NextAuth v5's `signIn` with the
 * Credentials provider. On success NextAuth performs the redirect to
 * `/dashboard` (throwing a NEXT_REDIRECT error that the framework handles);
 * we only intercept AuthError to surface human-readable messages.
 */
export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = validate(formData.get("email"));
  const password = validate(formData.get("password"));

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    await signIn("credentials", {
      email: email.toLowerCase(),
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "Invalid email or password" };
      }
      return { error: "Unable to sign in. Please try again." };
    }
    // NEXT_REDIRECT / other framework errors must propagate
    throw error;
  }

  return {};
}