/**
 * Tests for the RBAC permission matrix.
 */

import { describe, it, expect } from "vitest";
import {
  Permission,
  PERMISSION_MATRIX,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getPermissionsForRole,
  isValidPermission,
} from "@/lib/auth/permissions";
import type { OrganizationRole } from "@/lib/auth/roles";

// ── Permission Matrix Completeness ──────────────────────────────────────────

describe("PERMISSION_MATRIX", () => {
  it("has exactly 15 permissions", () => {
    const keys = Object.keys(PERMISSION_MATRIX);
    expect(keys).toHaveLength(15);
  });

  it("every permission maps to a non-empty role array", () => {
    for (const [, roles] of Object.entries(PERMISSION_MATRIX)) {
      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate role entries within a permission", () => {
    for (const [, roles] of Object.entries(PERMISSION_MATRIX)) {
      const unique = new Set(roles);
      expect(unique.size).toBe(roles.length);
    }
  });
});

// ── hasPermission Tests ─────────────────────────────────────────────────────

describe("hasPermission", () => {
  it("returns true when role has permission", () => {
    expect(hasPermission("platform_admin", Permission.MANAGE_PLATFORM)).toBe(true);
    expect(hasPermission("wedding_company_owner", Permission.MANAGE_ORGANIZATION)).toBe(true);
    expect(hasPermission("guest", Permission.VIEW_VAULT)).toBe(true);
    expect(hasPermission("guest", Permission.UPLOAD_MEDIA)).toBe(true);
  });

  it("returns false when role lacks permission", () => {
    expect(hasPermission("guest", Permission.MANAGE_PLATFORM)).toBe(false);
    expect(hasPermission("couple_member", Permission.DELETE_MEDIA)).toBe(false);
    expect(hasPermission("wedding_company_staff", Permission.MANAGE_PAYMENTS)).toBe(false);
  });

  it("platform_admin has all permissions", () => {
    const allPermissions = Object.values(Permission);
    for (const perm of allPermissions) {
      expect(hasPermission("platform_admin", perm)).toBe(true);
    }
  });

  it("guest only has VIEW_VAULT and UPLOAD_MEDIA", () => {
    const guestPerms = getPermissionsForRole("guest");
    expect(guestPerms).toContain(Permission.VIEW_VAULT);
    expect(guestPerms).toContain(Permission.UPLOAD_MEDIA);
    expect(guestPerms).not.toContain(Permission.MANAGE_PLATFORM);
    expect(guestPerms).not.toContain(Permission.DELETE_MEDIA);
    expect(guestPerms).not.toContain(Permission.MANAGE_WEDDING);
  });
});

// ── hasAllPermissions Tests ─────────────────────────────────────────────────

describe("hasAllPermissions", () => {
  it("returns true when role has ALL specified permissions", () => {
    expect(
      hasAllPermissions("platform_admin", [
        Permission.MANAGE_PLATFORM,
        Permission.VIEW_WEDDING,
      ]),
    ).toBe(true);
  });

  it("returns false when role lacks ANY specified permission", () => {
    expect(
      hasAllPermissions("couple_member", [
        Permission.VIEW_WEDDING,
        Permission.DELETE_MEDIA,
      ]),
    ).toBe(false);
  });

  it("returns true for empty array", () => {
    expect(hasAllPermissions("guest", [])).toBe(true);
  });
});

// ── hasAnyPermission Tests ──────────────────────────────────────────────────

describe("hasAnyPermission", () => {
  it("returns true when role has ANY specified permission", () => {
    expect(
      hasAnyPermission("couple_member", [
        Permission.VIEW_WEDDING,
        Permission.DELETE_MEDIA,
      ]),
    ).toBe(true);
  });

  it("returns false when role lacks ALL specified permissions", () => {
    expect(
      hasAnyPermission("guest", [
        Permission.MANAGE_PLATFORM,
        Permission.DELETE_MEDIA,
      ]),
    ).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(hasAnyPermission("platform_admin", [])).toBe(false);
  });
});

// ── getPermissionsForRole Tests ─────────────────────────────────────────────

describe("getPermissionsForRole", () => {
  it("platform_admin has all 15 permissions", () => {
    const perms = getPermissionsForRole("platform_admin");
    expect(perms).toHaveLength(15);
  });

  it("platform_support has limited permissions", () => {
    const perms = getPermissionsForRole("platform_support");
    expect(perms).toContain(Permission.VIEW_PLATFORM_ANALYTICS);
    expect(perms).toContain(Permission.VIEW_ORGANIZATION);
    expect(perms).toContain(Permission.VIEW_WEDDING);
    expect(perms).toContain(Permission.VIEW_VAULT);
    expect(perms).not.toContain(Permission.MANAGE_PLATFORM);
    expect(perms).not.toContain(Permission.MANAGE_ORGANIZATION);
  });

  it("wedding_company_owner has org + billing + payments", () => {
    const perms = getPermissionsForRole("wedding_company_owner");
    expect(perms).toContain(Permission.MANAGE_ORGANIZATION);
    expect(perms).toContain(Permission.MANAGE_ORGANIZATION_BILLING);
    expect(perms).toContain(Permission.VIEW_PAYMENTS);
    expect(perms).toContain(Permission.MANAGE_PAYMENTS);
    expect(perms).toContain(Permission.CREATE_WEDDING);
  });

  it("wedding_company_admin has settings but not billing", () => {
    const perms = getPermissionsForRole("wedding_company_admin");
    expect(perms).toContain(Permission.MANAGE_ORGANIZATION_SETTINGS);
    expect(perms).not.toContain(Permission.MANAGE_ORGANIZATION_BILLING);
    expect(perms).not.toContain(Permission.VIEW_PAYMENTS);
  });

  it("wedding_company_staff can create weddings and view org", () => {
    const perms = getPermissionsForRole("wedding_company_staff");
    expect(perms).toContain(Permission.CREATE_WEDDING);
    expect(perms).toContain(Permission.VIEW_ORGANIZATION);
    expect(perms).toContain(Permission.UPLOAD_MEDIA);
    expect(perms).not.toContain(Permission.MANAGE_ORGANIZATION_SETTINGS);
  });

  it("couple_owner can manage wedding and vault", () => {
    const perms = getPermissionsForRole("couple_owner");
    expect(perms).toContain(Permission.MANAGE_WEDDING);
    expect(perms).toContain(Permission.MANAGE_VAULT);
    expect(perms).toContain(Permission.DELETE_MEDIA);
    expect(perms).toContain(Permission.UPLOAD_MEDIA);
    expect(perms).toContain(Permission.VIEW_VAULT);
  });

  it("couple_member has view-only + upload", () => {
    const perms = getPermissionsForRole("couple_member");
    expect(perms).toContain(Permission.VIEW_WEDDING);
    expect(perms).toContain(Permission.VIEW_VAULT);
    expect(perms).toContain(Permission.UPLOAD_MEDIA);
    expect(perms).not.toContain(Permission.MANAGE_WEDDING);
    expect(perms).not.toContain(Permission.DELETE_MEDIA);
  });

  it("guest can only view vault and upload", () => {
    const perms = getPermissionsForRole("guest");
    expect(perms).toHaveLength(2);
    expect(perms).toContain(Permission.VIEW_VAULT);
    expect(perms).toContain(Permission.UPLOAD_MEDIA);
  });
});

// ── IDOR Prevention Cross-check ─────────────────────────────────────────────

describe("Permission hierarchy integrity", () => {
  // NOTE: The permission matrix is NOT a strict superset hierarchy.
  // platform_support is a READ-ONLY cross-tenant role (no CREATE_WEDDING).
  // wedding_company_staff is an ORG-SCOPED role (has CREATE_WEDDING).
  // This is an intentional design: platform_support has broader READ access
  // across tenants, while wedding_company_staff has more WRITE access within
  // their tenant. The hierarchy numeric level is about privilege, not superset.

  it("platform_admin has all permissions (superset of everything)", () => {
    const allPermissions = Object.values(Permission);
    const adminPerms = new Set(getPermissionsForRole("platform_admin"));
    for (const perm of allPermissions) {
      expect(adminPerms.has(perm)).toBe(true);
    }
  });

  it("organization roles have superset of their sub-roles' permissions", () => {
    // wedding_company_owner >= wedding_company_admin >= wedding_company_staff
    const pairs: [OrganizationRole, OrganizationRole][] = [
      ["wedding_company_owner", "wedding_company_admin"],
      ["wedding_company_admin", "wedding_company_staff"],
    ];
    for (const [higher, lower] of pairs) {
      const higherPerms = new Set(getPermissionsForRole(higher));
      const lowerPerms = getPermissionsForRole(lower);
      for (const perm of lowerPerms) {
        expect(higherPerms.has(perm)).toBe(true);
      }
    }
  });

  it("couple_owner has superset of couple_member permissions", () => {
    const higherPerms = new Set(getPermissionsForRole("couple_owner"));
    const lowerPerms = getPermissionsForRole("couple_member");
    for (const perm of lowerPerms) {
      expect(higherPerms.has(perm)).toBe(true);
    }
  });

  it("platform_support has read permissions but not org-write permissions", () => {
    const perms = new Set(getPermissionsForRole("platform_support"));
    // Has read access across tenants
    expect(perms.has(Permission.VIEW_PLATFORM_ANALYTICS)).toBe(true);
    expect(perms.has(Permission.VIEW_ORGANIZATION)).toBe(true);
    expect(perms.has(Permission.VIEW_WEDDING)).toBe(true);
    expect(perms.has(Permission.VIEW_VAULT)).toBe(true);
    // Does NOT have write access within a tenant
    expect(perms.has(Permission.CREATE_WEDDING)).toBe(false);
    expect(perms.has(Permission.MANAGE_ORGANIZATION)).toBe(false);
  });
});

// ── isValidPermission ───────────────────────────────────────────────────────

describe("isValidPermission", () => {
  it("validates correct permission strings", () => {
    expect(isValidPermission("manage_platform")).toBe(true);
    expect(isValidPermission("view_vault")).toBe(true);
    expect(isValidPermission("upload_media")).toBe(true);
  });

  it("rejects invalid permission strings", () => {
    expect(isValidPermission("admin")).toBe(false);
    expect(isValidPermission("")).toBe(false);
    expect(isValidPermission("MANAGE_PLATFORM")).toBe(false);
  });
});
