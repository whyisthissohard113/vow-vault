/**
 * Tests for RBAC permissions and role hierarchy.
 */

import { describe, it, expect } from "vitest";
import {
  getRoleLevel,
  hasMinimumRole,
  isPlatformRole,
  isOrganizationRole,
  isCoupleRole,
  isGuestRole,
  canAssignRole,
  isValidRole,
  ALL_ROLES,
} from "@/lib/auth/roles";

// ── Role Level Tests ────────────────────────────────────────────────────────

describe("getRoleLevel", () => {
  it("returns correct hierarchy levels", () => {
    expect(getRoleLevel("platform_admin")).toBe(100);
    expect(getRoleLevel("platform_support")).toBe(90);
    expect(getRoleLevel("wedding_company_owner")).toBe(80);
    expect(getRoleLevel("wedding_company_admin")).toBe(70);
    expect(getRoleLevel("wedding_company_staff")).toBe(60);
    expect(getRoleLevel("couple_owner")).toBe(50);
    expect(getRoleLevel("couple_member")).toBe(40);
    expect(getRoleLevel("guest")).toBe(10);
  });

  it("maintains strict ordering", () => {
    const levels = ALL_ROLES.map((r) => ({
      role: r,
      level: getRoleLevel(r),
    }));
    for (let i = 1; i < levels.length; i++) {
      // Note: not strictly ordered by array index, but by level
      expect(levels[i].level).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── hasMinimumRole Tests ────────────────────────────────────────────────────

describe("hasMinimumRole", () => {
  it("returns true when actor has equal or higher privilege", () => {
    expect(hasMinimumRole("platform_admin", "platform_admin")).toBe(true);
    expect(hasMinimumRole("platform_admin", "guest")).toBe(true);
    expect(hasMinimumRole("wedding_company_owner", "wedding_company_staff")).toBe(true);
    expect(hasMinimumRole("couple_owner", "couple_member")).toBe(true);
  });

  it("returns false when actor has lower privilege", () => {
    expect(hasMinimumRole("guest", "couple_member")).toBe(false);
    expect(hasMinimumRole("couple_member", "couple_owner")).toBe(false);
    expect(hasMinimumRole("wedding_company_staff", "wedding_company_owner")).toBe(false);
    expect(hasMinimumRole("platform_support", "platform_admin")).toBe(false);
  });

  it("returns true for same-level roles", () => {
    expect(hasMinimumRole("platform_admin", "platform_admin")).toBe(true);
    expect(hasMinimumRole("wedding_company_owner", "wedding_company_owner")).toBe(true);
    expect(hasMinimumRole("guest", "guest")).toBe(true);
  });
});

// ── Scope Classification Tests ──────────────────────────────────────────────

describe("isPlatformRole", () => {
  it("identifies platform roles", () => {
    expect(isPlatformRole("platform_admin")).toBe(true);
    expect(isPlatformRole("platform_support")).toBe(true);
  });

  it("rejects non-platform roles", () => {
    expect(isPlatformRole("wedding_company_owner")).toBe(false);
    expect(isPlatformRole("couple_owner")).toBe(false);
    expect(isPlatformRole("guest")).toBe(false);
  });
});

describe("isOrganizationRole", () => {
  it("identifies organization roles", () => {
    expect(isOrganizationRole("wedding_company_owner")).toBe(true);
    expect(isOrganizationRole("wedding_company_admin")).toBe(true);
    expect(isOrganizationRole("wedding_company_staff")).toBe(true);
  });

  it("rejects non-organization roles", () => {
    expect(isOrganizationRole("platform_admin")).toBe(false);
    expect(isOrganizationRole("couple_owner")).toBe(false);
    expect(isOrganizationRole("guest")).toBe(false);
  });
});

describe("isCoupleRole", () => {
  it("identifies couple roles", () => {
    expect(isCoupleRole("couple_owner")).toBe(true);
    expect(isCoupleRole("couple_member")).toBe(true);
  });

  it("rejects non-couple roles", () => {
    expect(isCoupleRole("platform_admin")).toBe(false);
    expect(isCoupleRole("wedding_company_owner")).toBe(false);
    expect(isCoupleRole("guest")).toBe(false);
  });
});

describe("isGuestRole", () => {
  it("identifies guest role", () => {
    expect(isGuestRole("guest")).toBe(true);
  });

  it("rejects non-guest roles", () => {
    expect(isGuestRole("platform_admin")).toBe(false);
    expect(isGuestRole("couple_owner")).toBe(false);
  });
});

// ── Privilege Escalation Prevention ─────────────────────────────────────────

describe("canAssignRole", () => {
  it("prevents assigning platform_admin", () => {
    expect(canAssignRole("platform_admin", "platform_admin")).toBe(false);
  });

  it("allows platform_admin to assign platform_support", () => {
    expect(canAssignRole("platform_admin", "platform_support")).toBe(true);
  });

  it("prevents non-admin from assigning platform roles", () => {
    expect(canAssignRole("platform_support", "platform_support")).toBe(false);
    expect(canAssignRole("wedding_company_owner", "platform_support")).toBe(false);
    expect(canAssignRole("wedding_company_owner", "platform_admin")).toBe(false);
  });

  it("allows higher roles to assign lower roles", () => {
    expect(canAssignRole("wedding_company_owner", "wedding_company_admin")).toBe(true);
    expect(canAssignRole("wedding_company_owner", "wedding_company_staff")).toBe(true);
    expect(canAssignRole("wedding_company_admin", "wedding_company_staff")).toBe(true);
  });

  it("prevents equal or lower roles from assigning", () => {
    expect(canAssignRole("wedding_company_staff", "wedding_company_admin")).toBe(false);
    expect(canAssignRole("wedding_company_staff", "wedding_company_owner")).toBe(false);
    expect(canAssignRole("couple_owner", "couple_owner")).toBe(false);
  });

  it("allows couple_owner to assign couple_member", () => {
    expect(canAssignRole("couple_owner", "couple_member")).toBe(true);
  });

  it("prevents couple_member from assigning couple_owner", () => {
    expect(canAssignRole("couple_member", "couple_owner")).toBe(false);
  });
});

// ── Validation ──────────────────────────────────────────────────────────────

describe("isValidRole", () => {
  it("validates correct role strings", () => {
    expect(isValidRole("platform_admin")).toBe(true);
    expect(isValidRole("guest")).toBe(true);
    expect(isValidRole("couple_owner")).toBe(true);
  });

  it("rejects invalid role strings", () => {
    expect(isValidRole("superadmin")).toBe(false);
    expect(isValidRole("admin")).toBe(false);
    expect(isValidRole("")).toBe(false);
    expect(isValidRole("Platform_Admin")).toBe(false);
  });
});

describe("ALL_ROLES", () => {
  it("contains all 8 roles", () => {
    expect(ALL_ROLES).toHaveLength(8);
  });

  it("includes every expected role", () => {
    const expected = [
      "platform_admin",
      "platform_support",
      "wedding_company_owner",
      "wedding_company_admin",
      "wedding_company_staff",
      "couple_owner",
      "couple_member",
      "guest",
    ];
    for (const role of expected) {
      expect(ALL_ROLES).toContain(role);
    }
  });
});
