import { describe, expect, it } from "vitest"
import { canDeleteSupplier, canWriteSupplier } from "@/lib/hr-settings-nav-access"
import { DEFAULT_ROLE_PERMISSIONS, type UserRole } from "@/lib/permissions"
import { formKey, storedToMatrixForm } from "@/shared/permissions/role-matrix"

function role(overrides: Partial<UserRole> = {}): UserRole {
  return {
    branchId: "branch-1",
    branchName: "HQ",
    roleName: "Viewer",
    permissions: null,
    ...overrides,
  }
}

describe("supplier access", () => {
  it("lets Manager create and update suppliers without settings update or delete", () => {
    const roles = [role({ roleName: "Manager", permissions: null })]
    expect(canWriteSupplier(roles, "create")).toBe(true)
    expect(canWriteSupplier(roles, "update")).toBe(true)
    expect(canDeleteSupplier(roles)).toBe(false)
    expect(DEFAULT_ROLE_PERMISSIONS.Manager.settings).toEqual(["read"])
    expect(DEFAULT_ROLE_PERMISSIONS.Manager.suppliers).toEqual(["create", "read", "update"])
  })

  it("does not let Technician create, update, or delete suppliers", () => {
    const roles = [role({ roleName: "Technician", permissions: null })]
    expect(canWriteSupplier(roles, "create")).toBe(false)
    expect(canWriteSupplier(roles, "update")).toBe(false)
    expect(canDeleteSupplier(roles)).toBe(false)
  })

  it("keeps create and update for a custom role that only has settings update", () => {
    const roles = [
      role({
        roleName: "Custom",
        permissions: { settings: ["read", "update"] },
      }),
    ]
    expect(canWriteSupplier(roles, "create")).toBe(true)
    expect(canWriteSupplier(roles, "update")).toBe(true)
    expect(canDeleteSupplier(roles)).toBe(false)
  })

  it("lets Admin delete suppliers", () => {
    const roles = [role({ roleName: "Admin", permissions: null })]
    expect(canWriteSupplier(roles, "create")).toBe(true)
    expect(canWriteSupplier(roles, "update")).toBe(true)
    expect(canDeleteSupplier(roles)).toBe(true)
  })

  it("shows supplier create and update on the Manager role matrix", () => {
    const form = storedToMatrixForm(null, "Manager")
    expect(form[formKey("suppliers", "read")]).toBe(true)
    expect(form[formKey("suppliers", "create")]).toBe(true)
    expect(form[formKey("suppliers", "update")]).toBe(true)
    expect(form[formKey("suppliers", "delete")]).toBe(false)
    expect(form[formKey("settings", "update")]).toBe(false)
  })
})
