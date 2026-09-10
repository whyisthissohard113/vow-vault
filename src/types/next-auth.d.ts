import type { DefaultSession } from "next-auth";

/**
 * Augmented session and JWT types for the Wedding Memory Vault.
 *
 * NEXTAUTH_SESSION adds:
 *  - user.id          — internal UUID (never expose to guests)
 *  - user.role        — organization-level role (null for platform-only users)
 *  - user.organizationId — active tenant context (null when multi-org)
 *  - user.isPlatformUser — true for platform_admin / platform_support
 *
 * NEXTAUTH_JWT carries the same data in the signed token.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: import("@/lib/auth/roles").OrganizationRole | null;
      organizationId: string | null;
      isPlatformUser: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: import("@/lib/auth/roles").OrganizationRole | null;
    organizationId: string | null;
    isPlatformUser: boolean;
  }
}
