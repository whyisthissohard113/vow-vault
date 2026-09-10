/**
 * NextAuth.js v5 configuration for the Wedding Memory Vault.
 *
 * Uses JWT strategy with Credentials provider (email/password).
 * The JWT carries user ID, role, and organization context.
 *
 * IMPORTANT: This module is server-side only.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq, and, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { db } from "@/lib/db";
import { users, organizationMembers } from "@/lib/db/schema";
import type { OrganizationRole } from "@/lib/auth/roles";
import { isPlatformRole } from "@/lib/auth/roles";

// ── Input validation ────────────────────────────────────────────────────────

const credentialsSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ── Auth config ─────────────────────────────────────────────────────────────

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // 1. Validate input shape
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // 2. Look up user (include only non-deleted, active users)
        const [user] = await db
          .select({
            id: users.id,
            email: users.email,
            passwordHash: users.passwordHash,
            fullName: users.fullName,
            status: users.status,
          })
          .from(users)
          .where(
            and(
              eq(users.email, email),
              isNull(users.deletedAt),
            ),
          )
          .limit(1);

        if (!user) return null;

        // 3. Check account status
        if (user.status === "suspended") return null;
        if (user.status === "deactivated") return null;

        // 4. Verify password
        if (!user.passwordHash) return null; // OAuth-only user, no password
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // 5. Update last login timestamp (fire-and-forget)
        db.update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id))
          .execute()
          .catch(() => {
            // Non-critical; don't block login on failure
          });

        // 6. Return user object for JWT
        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  callbacks: {
    // ── JWT callback: enrich token with user data ──────────────────────
    async jwt({ token, user, account }) {
      // On initial sign-in, `user` is the object from `authorize()`
      if (user && account?.provider === "credentials") {
        token.id = user.id as string;

        // Fetch the user's primary role + organization context
        const membership = await db
          .select({
            role: organizationMembers.role,
            organizationId: organizationMembers.organizationId,
          })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.userId, user.id as string),
              eq(organizationMembers.status, "active"),
              isNull(organizationMembers.deletedAt),
            ),
          )
          .limit(1);

        if (membership.length > 0) {
          token.role = membership[0].role as OrganizationRole;
          token.organizationId = membership[0].organizationId;
          token.isPlatformUser = isPlatformRole(
            membership[0].role as OrganizationRole,
          );
        } else {
          // User exists but has no organization membership yet
          token.role = null;
          token.organizationId = null;
          token.isPlatformUser = false;
        }
      }

      return token;
    },

    // ── Session callback: expose selected fields to client ─────────────
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as OrganizationRole) ?? null;
        session.user.organizationId = (token.organizationId as string) ?? null;
        session.user.isPlatformUser = (token.isPlatformUser as boolean) ?? false;
      }
      return session;
    },

    // ── Authorized callback: middleware-level access control ────────────
    async authorized({ auth: session, request }) {
      const { nextUrl } = request;

      // Public routes that don't require auth
      const publicPaths = ["/", "/pricing", "/about", "/faq", "/contact", "/login", "/register"];
      if (publicPaths.includes(nextUrl.pathname)) return true;

      // API routes with guest access (e.g., vault upload) are handled by their own guards
      if (nextUrl.pathname.startsWith("/api/auth/")) return true;

      // Everything else requires authentication
      return !!session?.user;
    },
  },
});
