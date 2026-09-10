/**
 * Role definitions and hierarchy for the Wedding Memory Vault.
 *
 * Roles are split into three scopes:
 *  1. **Platform** roles — global, cross-tenant (platform_admin, platform_support)
 *  2. **Organization (wedding company)** roles — tenant-scoped
 *  3. **Wedding / Couple** roles — scoped to a single wedding within a tenant
 *  4. **Guest** — temporary, vault-only, token-based (no user account required)
 *
 * Hierarchy (higher = more privileged):
 *   platform_admin > platform_support > wedding_company_owner >
 *   wedding_company_admin > wedding_company_staff >
 *   couple_owner > couple_member > guest
 */

// ── Enum ────────────────────────────────────────────────────────────────────

export const OrganizationRole = {
  PLATFORM_ADMIN: "platform_admin",
  PLATFORM_SUPPORT: "platform_support",
  WEDDING_COMPANY_OWNER: "wedding_company_owner",
  WEDDING_COMPANY_ADMIN: "wedding_company_admin",
  WEDDING_COMPANY_STAFF: "wedding_company_staff",
  COUPLE_OWNER: "couple_owner",
  COUPLE_MEMBER: "couple_member",
  GUEST: "guest",
} as const;

export type OrganizationRole =
  (typeof OrganizationRole)[keyof typeof OrganizationRole];

// ── Hierarchy (numeric: higher = more privileged) ───────────────────────────

const ROLE_HIERARCHY: Record<OrganizationRole, number> = {
  platform_admin: 100,
  platform_support: 90,
  wedding_company_owner: 80,
  wedding_company_admin: 70,
  wedding_company_staff: 60,
  couple_owner: 50,
  couple_member: 40,
  guest: 10,
};

/**
 * Returns the numeric privilege level of a role.
 * Higher = more privileged.
 */
export function getRoleLevel(role: OrganizationRole): number {
  return ROLE_HIERARCHY[role];
}

/**
 * Returns true when `actor` has equal or higher privilege than `required`.
 */
export function hasMinimumRole(
  actor: OrganizationRole,
  required: OrganizationRole,
): boolean {
  return ROLE_HIERARCHY[actor] >= ROLE_HIERARCHY[required];
}

// ── Scope Classification ────────────────────────────────────────────────────

const PLATFORM_ROLES: ReadonlySet<OrganizationRole> = new Set([
  "platform_admin",
  "platform_support",
]);

const ORGANIZATION_ROLES: ReadonlySet<OrganizationRole> = new Set([
  "wedding_company_owner",
  "wedding_company_admin",
  "wedding_company_staff",
]);

const COUPLE_ROLES: ReadonlySet<OrganizationRole> = new Set([
  "couple_owner",
  "couple_member",
]);

/** True if the role operates across all tenants. */
export function isPlatformRole(role: OrganizationRole): boolean {
  return PLATFORM_ROLES.has(role);
}

/** True if the role is scoped to a wedding company / tenant. */
export function isOrganizationRole(role: OrganizationRole): boolean {
  return ORGANIZATION_ROLES.has(role);
}

/** True if the role is scoped to a specific wedding (couple). */
export function isCoupleRole(role: OrganizationRole): boolean {
  return COUPLE_ROLES.has(role);
}

/** True if the role is guest (vault-only, token-based). */
export function isGuestRole(role: OrganizationRole): boolean {
  return role === "guest";
}

// ── Privilege Escalation Guards ─────────────────────────────────────────────

/**
 * Validate that `actorRole` is allowed to assign `targetRole`.
 *
 * Rules:
 *  - A user can only assign roles with a LOWER hierarchy level.
 *  - Platform roles can only be assigned by `platform_admin`.
 *  - Nobody can assign `platform_admin` (superadmin bootstrap only).
 */
export function canAssignRole(
  actorRole: OrganizationRole,
  targetRole: OrganizationRole,
): boolean {
  // Nobody can assign platform_admin through normal flows
  if (targetRole === "platform_admin") return false;

  // Platform roles can only be assigned by platform_admin
  if (isPlatformRole(targetRole) && actorRole !== "platform_admin") {
    return false;
  }

  // Actor must have strictly higher privilege than the target role
  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
}

// ── Valid Role List ─────────────────────────────────────────────────────────

/** All valid organization roles as a typed array. */
export const ALL_ROLES: readonly OrganizationRole[] = Object.values(
  OrganizationRole,
) as unknown as OrganizationRole[];

/** Runtime guard: returns true if the string is a valid OrganizationRole. */
export function isValidRole(value: string): value is OrganizationRole {
  return (ALL_ROLES as readonly string[]).includes(value);
}
