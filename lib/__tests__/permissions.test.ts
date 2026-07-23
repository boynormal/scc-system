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
  it("allows Admin to access any module regardless of moduleAccess restrictions", () => {
    const roles: UserRole[] = [role({ roleName: "Admin", permissions: { moduleAccess: ["hr"] } as never })]

    expect(canAccessModule(roles, "transport")).toBe(true)
  })

  it("allows access when moduleAccess is not set on the role (backward compat)", () => {
    const roles: UserRole[] = [role({ roleName: "Viewer", permissions: null })]

    expect(canAccessModule(roles, "hr")).toBe(true)
  })

  it("allows access when moduleAccess is the literal string \"all\"", () => {
    const roles: UserRole[] = [
      role({ roleName: "Viewer", permissions: { moduleAccess: "all" } as never }),
    ]

    expect(canAccessModule(roles, "transport")).toBe(true)
  })

  it("denies access when moduleAccess is a list that does not include the moduleId", () => {
    const roles: UserRole[] = [
      role({ roleName: "Viewer", permissions: { moduleAccess: ["hr"] } as never }),
    ]

    expect(canAccessModule(roles, "transport")).toBe(false)
    expect(canAccessModule(roles, "hr")).toBe(true)
  })

  it("allows access if any of the user's multiple roles grants the module", () => {
    const roles: UserRole[] = [
      role({ branchId: "branch-1", roleName: "Viewer", permissions: { moduleAccess: ["hr"] } as never }),
      role({ branchId: "branch-2", roleName: "Viewer", permissions: { moduleAccess: ["transport"] } as never }),
    ]

    expect(canAccessModule(roles, "transport")).toBe(true)
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
