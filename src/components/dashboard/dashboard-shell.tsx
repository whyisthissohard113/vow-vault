"use client";

/**
 * DashboardShell — authenticated app chrome for the wedding-company dashboard.
 *
 * Navigation is computed server-side and passed down as plain props so the
 * client shell never decides what a user may see (RBAC stays authoritative on
 * the server). The shell only renders the given sections and the sign-out
 * affordance.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

import {
  IconBrand,
  IconCamera,
  IconCard,
  IconChevronRight,
  IconHeart,
  IconLink,
  IconLogout,
  IconMail,
  IconMedia,
  IconMenu,
  IconOrder,
  IconOverview,
  IconPackage,
  IconPlus,
  IconQr,
  IconSettings,
  IconSparkle,
  IconSupport,
  IconTemplate,
  IconUser,
  IconUsers,
  IconWedding,
} from "@/components/icons";
import { cn } from "@/lib/utils";

export type NavIconName =
  | "overview"
  | "wedding"
  | "users"
  | "package"
  | "order"
  | "card"
  | "media"
  | "qr"
  | "template"
  | "settings"
  | "support"
  | "user"
  | "sparkle"
  | "heart"
  | "camera"
  | "link"
  | "mail";

const ICON_MAP: Record<NavIconName, (props: { className?: string }) => React.ReactNode> =
  {
    overview: (p) => <IconOverview {...p} />,
    wedding: (p) => <IconWedding {...p} />,
    users: (p) => <IconUsers {...p} />,
    package: (p) => <IconPackage {...p} />,
    order: (p) => <IconOrder {...p} />,
    card: (p) => <IconCard {...p} />,
    media: (p) => <IconMedia {...p} />,
    qr: (p) => <IconQr {...p} />,
    template: (p) => <IconTemplate {...p} />,
    settings: (p) => <IconSettings {...p} />,
    support: (p) => <IconSupport {...p} />,
    user: (p) => <IconUser {...p} />,
    sparkle: (p) => <IconSparkle {...p} />,
    heart: (p) => <IconHeart {...p} />,
    camera: (p) => <IconCamera {...p} />,
    link: (p) => <IconLink {...p} />,
    mail: (p) => <IconMail {...p} />,
  };

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  exact?: boolean;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export interface ShellUser {
  name: string | null;
  email: string;
  role: string;
  organizationName: string;
}

export interface DashboardShellProps {
  navSections: NavSection[];
  user: ShellUser;
  canCreateWedding: boolean;
  children: React.ReactNode;
}

function roleLabel(role: string): string {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function DashboardShell({
  navSections,
  user,
  canCreateWedding,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <IconBrand className="h-7 w-7 text-rose-brand" />
          <span className="truncate text-sm font-semibold text-stone-900">
            {user.organizationName}
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main">
        {canCreateWedding ? (
          <Link
            href="/dashboard/weddings/new"
            className="flex h-10 items-center justify-center gap-2 rounded-full bg-rose-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-rose-500"
          >
            <IconPlus />
            New wedding
          </Link>
        ) : null}

        {navSections.map((section, idx) => (
          <div key={section.label ?? idx}>
            {section.label ? (
              <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-stone-400">
                {section.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item);
                const Icon = ICON_MAP[item.icon];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-rose-soft font-semibold text-rose-brand"
                          : "text-stone-600 hover:bg-sand hover:text-stone-900",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {active ? (
                        <IconChevronRight className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-stone-200 p-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sand"
            aria-expanded={menuOpen}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-soft text-xs font-semibold text-rose-brand">
              {(user.name ?? user.email).slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-stone-900">
                {user.name ?? "Dashboard user"}
              </span>
              <span className="block truncate text-xs text-stone-500">
                {roleLabel(user.role)}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-sand hover:text-stone-700"
            title="Sign out"
          >
            <IconLogout className="h-4 w-4" />
          </button>
        </div>

        {menuOpen ? (
          <div className="mt-2 space-y-1 px-2 pb-2">
            <Link
              href="/dashboard/account"
              className="block rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-sand"
            >
              Account settings
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-stone-200 bg-white lg:block">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-stone-200 bg-background/90 px-4 backdrop-blur lg:px-8">
          <button
            type="button"
            className="rounded-lg p-2 text-stone-500 hover:bg-sand lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          {canCreateWedding ? (
            <Link
              href="/dashboard/weddings/new"
              className="ml-auto hidden items-center gap-2 rounded-full bg-rose-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-500 sm:inline-flex"
            >
              <IconPlus />
              New wedding
            </Link>
          ) : null}
          <span className="ml-auto text-sm text-stone-500 sm:hidden">
            {user.name ?? user.email}
          </span>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}