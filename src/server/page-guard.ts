import { redirect } from "next/navigation";

import { requireTenant, type TenantContext } from "@/server/middleware/tenant";
import { hasPermission, Permission } from "@/lib/auth/permissions";

/**
 * guardPage — server-component guard for dashboard pages.
 *
 * Resolves the tenant for the signed-in user (redirecting to /login for
 * signed-out users and to /login?error=no-organization for accounts without a
 * tenant membership) and optionally enforces a permission. Pages that lack the
 * permission get an automatic redirect to /dashboard — the shell already hides
 * the links, this is defense-in-depth.
 */
export async function guardPage(permission?: Permission): Promise<TenantContext> {
  let tenant: TenantContext | null = null;
  try {
    tenant = await requireTenant();
  } catch {
    // Handled below; avoids swallowing NEXT_REDIRECT from `redirect()`.
  }

  if (!tenant) redirect("/login?error=no-organization");

  if (permission && !hasPermission(tenant.role, permission)) {
    redirect("/dashboard");
  }

  return tenant;
}