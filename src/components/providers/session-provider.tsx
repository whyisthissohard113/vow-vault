"use client";

/**
 * SessionProvider — thin client wrapper around next-auth/react's provider so
 * client components (e.g. the dashboard shell user menu) can use useSession.
 * Server pages should call `auth()` directly and pass data down as props.
 */

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function SessionProvider({ children }: { children: ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}