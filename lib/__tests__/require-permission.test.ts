import { describe, expect, it } from "vitest"
import { forbidUnlessPermission } from "@/lib/require-permission"
import type { UserRole } from "@/lib/permissions"

function role(overrides: Partial<UserRole> = {}): UserRole {
  return {
    branchId: "branch-1",
    branchName: "HQ",
    roleName: "Viewer",
    permissions: null,
    ...overrides,
  }
}

describe("forbidUnlessPermission", () => {
  it("returns null when the role has the required action", () => {
    const roles: UserRole[] = [
      role({
        roleName: "Custom",
        permissions: { settings: ["read", "update"] },
      }),
    ]
    expect(forbidUnlessPermission(roles, "settings", "update")).toBeNull()
  })

  it("returns 403 when the action is missing", () => {
    const roles: UserRole[] = [
      role({
        roleName: "Custom",
        permissions: { settings: ["read"] },
      }),
    ]
    const res = forbidUnlessPermission(roles, "settings", "update")
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })

  it("allows Admin via isAdminInAnyBranch bypass", () => {
    const roles: UserRole[] = [role({ roleName: "Admin", permissions: null })]
    expect(forbidUnlessPermission(roles, "roles", "delete")).toBeNull()
  })
})
