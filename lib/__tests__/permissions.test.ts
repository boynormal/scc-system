import { describe, expect, it } from "vitest"
import {
  canAccessModule,
  getBranchIds,
  hasPermission,
  isAdminInAnyBranch,
  isAdminInBranch,
  type UserRole,
} from "@/lib/permissions"

function role(overrides: Partial<UserRole>): UserRole {
  return {
    branchId: "branch-1",
    branchName: "HQ",
    roleName: "Viewer",
    permissions: null,
    ...overrides,
  }
}

describe("hasPermission", () => {
  it("allows Admin to bypass branch scope using default Admin permissions", () => {
    const roles: UserRole[] = [role({ branchId: "branch-1", roleName: "Admin", permissions: null })]

    // Admin has no user_branch_role row for "branch-2" but should still be allowed via bypass
    expect(hasPermission(roles, "branch-2", "machines", "delete")).toBe(true)
  })

  it("denies non-admin when branch does not match any role", () => {
    const roles: UserRole[] = [role({ branchId: "branch-1", roleName: "Viewer" })]

    expect(hasPermission(roles, "branch-2", "machines", "read")).toBe(false)
  })

  it("denies action not present in the default permission set for the role", () => {
    const roles: UserRole[] = [role({ branchId: "branch-1", roleName: "Viewer" })]

    // Viewer default only has "read" for machines
    expect(hasPermission(roles, "branch-1", "machines", "delete")).toBe(false)
    expect(hasPermission(roles, "branch-1", "machines", "read")).toBe(true)
  })

  it("applies default assets permissions for each built-in role", () => {
    expect(hasPermission([role({ roleName: "Admin" })], "branch-1", "assets", "delete")).toBe(true)
    expect(hasPermission([role({ roleName: "Manager" })], "branch-1", "assets", "create")).toBe(true)
    expect(hasPermission([role({ roleName: "Manager" })], "branch-1", "assets", "delete")).toBe(false)
    expect(hasPermission([role({ roleName: "Technician" })], "branch-1", "assets", "read")).toBe(true)
    expect(hasPermission([role({ roleName: "Technician" })], "branch-1", "assets", "update")).toBe(false)
    expect(hasPermission([role({ roleName: "Viewer" })], "branch-1", "assets", "read")).toBe(true)
    expect(hasPermission([role({ roleName: "Viewer" })], "branch-1", "assets", "create")).toBe(false)
  })

  it("uses stored DB permissions instead of default when the resource key is present", () => {
    const roles: UserRole[] = [
      role({
        branchId: "branch-1",
        roleName: "Manager",
        // Manager default for hr_personnel is ["create","read","update"] — stored overrides to read-only
        permissions: { hr_personnel: ["read"] },
      }),
    ]

    expect(hasPermission(roles, "branch-1", "hr_personnel", "read")).toBe(true)
    expect(hasPermission(roles, "branch-1", "hr_personnel", "update")).toBe(false)
  })

  it("falls back to default permissions for resource keys missing from stored JSON", () => {
    const roles: UserRole[] = [
      role({
        branchId: "branch-1",
        roleName: "Manager",
        // transport_drivers omitted entirely — should fall back to Manager default (["read","update"])
        permissions: { hr_personnel: ["read"] },
      }),
    ]

    expect(hasPermission(roles, "branch-1", "transport_drivers", "read")).toBe(true)
    expect(hasPermission(roles, "branch-1", "transport_drivers", "update")).toBe(true)
    expect(hasPermission(roles, "branch-1", "transport_drivers", "create")).toBe(false)
  })
})

describe("isAdminInBranch / isAdminInAnyBranch", () => {
  it("isAdminInBranch is true only for the exact matching branch", () => {
    const roles: UserRole[] = [role({ branchId: "branch-1", roleName: "Admin" })]

    expect(isAdminInBranch(roles, "branch-1")).toBe(true)
    expect(isAdminInBranch(roles, "branch-2")).toBe(false)
  })

  it("isAdminInAnyBranch is true if any role is Admin regardless of branch", () => {
    const roles: UserRole[] = [
      role({ branchId: "branch-1", roleName: "Viewer" }),
      role({ branchId: "branch-2", roleName: "Admin" }),
    ]

    expect(isAdminInAnyBranch(roles)).toBe(true)
    expect(isAdminInAnyBranch([role({ branchId: "branch-1", roleName: "Viewer" })])).toBe(false)
  })
})

describe("canAccessModule", () => {
  it("allows Admin to access any module even with a restrictive user override", () => {
    const roles: UserRole[] = [role({ roleName: "Admin" })]

    expect(canAccessModule(roles, "transport", ["hr"])).toBe(true)
  })

  it("allows all modules when there is no user override (ignores legacy Role moduleAccess)", () => {
    const roles: UserRole[] = [
      role({ roleName: "Viewer", permissions: { moduleAccess: ["hr"] } as never }),
    ]

    expect(canAccessModule(roles, "transport")).toBe(true)
    expect(canAccessModule(roles, "hr")).toBe(true)
    expect(canAccessModule(roles, "hr", null)).toBe(true)
    expect(canAccessModule(roles, "transport", undefined)).toBe(true)
  })

  it("restricts modules when a per-user override list is provided", () => {
    const roles: UserRole[] = [role({ roleName: "Viewer", permissions: null })]

    expect(canAccessModule(roles, "transport", ["hr"])).toBe(false)
    expect(canAccessModule(roles, "hr", ["hr"])).toBe(true)
  })

  it("treats a user-level override of \"all\" as unrestricted", () => {
    const roles: UserRole[] = [role({ roleName: "Viewer" })]

    expect(canAccessModule(roles, "transport", "all")).toBe(true)
  })
})

describe("getBranchIds", () => {
  it("dedupes branch ids across multiple roles", () => {
    const roles: UserRole[] = [
      role({ branchId: "branch-1" }),
      role({ branchId: "branch-1" }),
      role({ branchId: "branch-2" }),
    ]

    expect(getBranchIds(roles).sort()).toEqual(["branch-1", "branch-2"])
  })

  it("returns an empty array for no roles", () => {
    expect(getBranchIds([])).toEqual([])
  })
})
