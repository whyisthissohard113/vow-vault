import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SessionProvider } from "@/components/providers/session-provider";
import {
  DashboardShell,
  type NavSection,
  type ShellUser,
} from "@/components/dashboard/dashboard-shell";
import { requireTenant } from "@/server/middleware/tenant";
import { type TenantContext } from "@/server/middleware/tenant";
import {
  getOrganizationSummary,
  getProfile,
} from "@/server/services/dashboard-service";
import { hasPermission, Permission } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s | Wedding Memory Vault",
  },
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Builds the sidebar navigation sections based on the signed-in role.
 * This runs server-side — the client shell never decides what a user sees.
 */
function buildNav(tenant: TenantContext): NavSection[] {
  const sections: NavSection[] = [];

  const overview: NavSection = {
    items: [{ href: "/dashboard", label: "Overview", icon: "overview", exact: true }],
  };

  const manage: NavSection = {
    label: "Manage",
    items: [],
  };

  if (hasPermission(tenant.role, Permission.VIEW_WEDDING)) {
    manage.items.push({ href: "/dashboard/weddings", label: "Weddings", icon: "wedding" });
    manage.items.push({ href: "/dashboard/templates", label: "Templates", icon: "template" });
  }
  if (hasPermission(tenant.role, Permission.VIEW_ORGANIZATION)) {
    manage.items.push({ href: "/dashboard/customers", label: "Customers", icon: "users" });
    manage.items.push({ href: "/dashboard/packages", label: "Packages", icon: "package" });
  }

  const revenue: NavSection = { label: "Revenue", items: [] };
  if (hasPermission(tenant.role, Permission.VIEW_PAYMENTS)) {
    revenue.items.push({ href: "/dashboard/orders", label: "Orders", icon: "order" });
    revenue.items.push({ href: "/dashboard/payments", label: "Payments", icon: "card" });
  }

  const content: NavSection = { label: "Content", items: [] };
  if (hasPermission(tenant.role, Permission.VIEW_VAULT)) {
    content.items.push({ href: "/dashboard/media", label: "Media", icon: "media" });
    content.items.push({ href: "/dashboard/qr", label: "QR codes", icon: "qr" });
  }

  const org: NavSection = { label: "Organization", items: [] };
  if (hasPermission(tenant.role, Permission.MANAGE_ORGANIZATION_SETTINGS)) {
    org.items.push({ href: "/dashboard/settings", label: "Settings", icon: "settings" });
  }
  org.items.push({ href: "/dashboard/support", label: "Support", icon: "support" });

  const account: NavSection = {
    items: [{ href: "/dashboard/account", label: "Account", icon: "user" }],
  };

  sections.push(overview);
  if (manage.items.length > 0) sections.push(manage);
  if (revenue.items.length > 0) sections.push(revenue);
  if (content.items.length > 0) sections.push(content);
  if (org.items.length > 0) sections.push(org);
  sections.push(account);

  return sections;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let tenant: TenantContext | null = null;
  try {
    tenant = await requireTenant();
  } catch {
    // Fall through; redirect below avoids swallowing NEXT_REDIRECT.
  }
  if (!tenant) redirect("/login?error=no-organization");

  const [profile, organization] = await Promise.all([
    getProfile(tenant.userId),
    getOrganizationSummary(tenant.organizationId),
  ]);

  const user: ShellUser = {
    name: profile?.fullName ?? session.user.name ?? null,
    email: session.user.email ?? profile?.email ?? "",
    role: tenant.role,
    organizationName: organization?.name ?? "My Company",
  };

  const navSections = buildNav(tenant);

  return (
    <SessionProvider>
      <DashboardShell
        navSections={navSections}
        user={user}
        canCreateWedding={hasPermission(tenant.role, Permission.CREATE_WEDDING)}
      >
        {children}
      </DashboardShell>
    </SessionProvider>
  );
}