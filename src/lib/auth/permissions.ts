/**
 * Permission matrix for the Wedding Memory Vault.
 *
 * Each permission maps to the set of roles that hold it.
 * Checking a permission is a simple array-includes test.
 *
 * IMPORTANT: This file is the single source of truth for RBAC.
 * Changing a permission here changes it everywhere — API guards,
 * tenant middleware, and downstream services.
 */

import type { OrganizationRole } from "./roles";

// ── Permission constants ────────────────────────────────────────────────────

export const Permission = {
  // Platform-level
  MANAGE_PLATFORM: "manage_platform",
  VIEW_PLATFORM_ANALYTICS: "view_platform_analytics",

  // Organization-level
  MANAGE_ORGANIZATION: "manage_organization",
  MANAGE_ORGANIZATION_BILLING: "manage_organization_billing",
  MANAGE_ORGANIZATION_SETTINGS: "manage_organization_settings",
  VIEW_ORGANIZATION: "view_organization",

  // Wedding-level
  CREATE_WEDDING: "create_wedding",
  MANAGE_WEDDING: "manage_wedding",
  VIEW_WEDDING: "view_wedding",

  // Vault-level
  MANAGE_VAULT: "manage_vault",
  VIEW_VAULT: "view_vault",

  // Media-level
  UPLOAD_MEDIA: "upload_media",
  DELETE_MEDIA: "delete_media",

  // Payment-level
  VIEW_PAYMENTS: "view_payments",
  MANAGE_PAYMENTS: "manage_payments",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

// ── Permission → Role mapping ───────────────────────────────────────────────

type RoleSet = readonly OrganizationRole[];

export const PERMISSION_MATRIX: Record<Permission, RoleSet> = {
  // Platform-level
  [Permission.MANAGE_PLATFORM]: ["platform_admin"],
  [Permission.VIEW_PLATFORM_ANALYTICS]: ["platform_admin", "platform_support"],

  // Organization-level
  [Permission.MANAGE_ORGANIZATION]: [
    "platform_admin",
    "wedding_company_owner",
  ],
  [Permission.MANAGE_ORGANIZATION_BILLING]: [
    "platform_admin",
    "wedding_company_owner",
  ],
  [Permission.MANAGE_ORGANIZATION_SETTINGS]: [
    "platform_admin",
    "wedding_company_owner",
    "wedding_company_admin",
  ],
  [Permission.VIEW_ORGANIZATION]: [
    "platform_admin",
    "platform_support",
    "wedding_company_owner",
    "wedding_company_admin",
    "wedding_company_staff",
  ],

  // Wedding-level
  [Permission.CREATE_WEDDING]: [
    "platform_admin",
    "wedding_company_owner",
    "wedding_company_admin",
    "wedding_company_staff",
  ],
  [Permission.MANAGE_WEDDING]: [
    "platform_admin",
    "wedding_company_owner",
    "wedding_company_admin",
    "couple_owner",
  ],
  [Permission.VIEW_WEDDING]: [
    "platform_admin",
    "platform_support",
    "wedding_company_owner",
    "wedding_company_admin",
    "wedding_company_staff",
    "couple_owner",
    "couple_member",
  ],

  // Vault-level
  [Permission.MANAGE_VAULT]: [
    "platform_admin",
    "wedding_company_owner",
    "wedding_company_admin",
    "couple_owner",
  ],
  [Permission.VIEW_VAULT]: [
    "platform_admin",
    "platform_support",
    "wedding_company_owner",
    "wedding_company_admin",
    "wedding_company_staff",
    "couple_owner",
    "couple_member",
    "guest",
  ],

  // Media-level
  [Permission.UPLOAD_MEDIA]: [
    "platform_admin",
    "wedding_company_owner",
    "wedding_company_admin",
    "wedding_company_staff",
    "couple_owner",
    "couple_member",
    "guest",
  ],
  [Permission.DELETE_MEDIA]: [
    "platform_admin",
    "wedding_company_owner",
    "wedding_company_admin",
    "couple_owner",
  ],

  // Payment-level
  [Permission.VIEW_PAYMENTS]: ["platform_admin", "wedding_company_owner"],
  [Permission.MANAGE_PAYMENTS]: ["platform_admin", "wedding_company_owner"],
};

// ── Checking functions ──────────────────────────────────────────────────────

/**
 * Returns true when `role` holds `permission`.
 */
export function hasPermission(
  role: OrganizationRole,
  permission: Permission,
): boolean {
  const allowed = PERMISSION_MATRIX[permission];
  return (allowed as readonly string[]).includes(role);
}

/**
 * Returns true when `role` holds ALL of the given permissions.
 */
export function hasAllPermissions(
  role: OrganizationRole,
  permissions: readonly Permission[],
): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/**
 * Returns true when `role` holds ANY of the given permissions.
 */
export function hasAnyPermission(
  role: OrganizationRole,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/**
 * Returns all permissions held by a given role.
 */
export function getPermissionsForRole(role: OrganizationRole): Permission[] {
  return (Object.entries(PERMISSION_MATRIX) as [string, RoleSet][])
    .filter(([, roles]) => (roles as readonly string[]).includes(role))
    .map(([permission]) => permission as Permission);
}

/**
 * Runtime guard: returns true if the string is a valid Permission.
 */
export function isValidPermission(value: string): value is Permission {
  return value in PERMISSION_MATRIX;
}
