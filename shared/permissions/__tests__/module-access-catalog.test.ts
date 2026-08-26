import { describe, expect, it } from "vitest"
import type { UserRole } from "@/lib/permissions"
import {
  canAccessModuleId,
  canEnterModuleArea,
  hasModuleAreaResourceRead,
} from "@/shared/permissions/module-access-catalog"

function role(overrides: Partial<UserRole> = {}): UserRole {
  return {
    branchId: "branch-1",
    branchName: "HQ",
    roleName: "Viewer",
    permissions: null,
    ...overrides,
  }
}

describe("module-access-catalog", () => {
  it("hasModuleAreaResourceRead is true when any mapped resource is readable", () => {
    const roles: UserRole[] = [
      role({
        roleName: "Custom",
        permissions: { transport_vehicles: ["read"] },
      }),
    ]
    expect(hasModuleAreaResourceRead(roles, "transport")).toBe(true)
    expect(hasModuleAreaResourceRead(roles, "hr")).toBe(false)
  })

  it("canAccessModuleId allows coarse catalog override to unlock nav moduleIds", () => {
    const roles: UserRole[] = [role()]
    expect(canAccessModuleId(roles, "transport_jobs", ["transport"])).toBe(true)
    expect(canAccessModuleId(roles, "hr_personnel", ["transport"])).toBe(false)
  })

  it("canAccessModuleId does not unlock sibling nav ids from a fine override", () => {
    const roles: UserRole[] = [role()]
    expect(canAccessModuleId(roles, "dashboard", ["dashboard"])).toBe(true)
    expect(canAccessModuleId(roles, "maintenance", ["dashboard"])).toBe(false)
    expect(canAccessModuleId(roles, "reports", ["dashboard"])).toBe(false)
  })

  it("canEnterModuleArea accepts fine nav override for the parent layout area", () => {
    const roles: UserRole[] = [
      role({
        roleName: "Custom",
        permissions: { transport_jobs: ["read"] },
      }),
    ]
    expect(canEnterModuleArea(roles, "transport", ["transport_jobs"])).toBe(true)
    expect(canEnterModuleArea(roles, "transport", ["hr_personnel"])).toBe(false)
  })

  it("canEnterModuleArea requires both override and resource read", () => {
    const roles: UserRole[] = [
      role({
        roleName: "Custom",
        permissions: { machines: ["read"] },
      }),
    ]
    expect(canEnterModuleArea(roles, "transport", ["transport"])).toBe(false)
    expect(canEnterModuleArea(roles, "machines", null)).toBe(true)
  })

  it("maps raw_material_news area and fine nav ids", () => {
    const roles: UserRole[] = [
      role({
        roleName: "Custom",
        permissions: { raw_material_news: ["read"] },
      }),
    ]
    expect(hasModuleAreaResourceRead(roles, "raw_material_news")).toBe(true)
    expect(canEnterModuleArea(roles, "raw_material_news", null)).toBe(true)
    expect(canAccessModuleId(roles, "raw_material_news_paper", ["raw_material_news"])).toBe(true)
    expect(canAccessModuleId(roles, "raw_material_news_ewaste", ["transport"])).toBe(false)
  })

  it("maps due_dates area and fine nav ids", () => {
    const roles: UserRole[] = [
      role({
        roleName: "Custom",
        permissions: { due_dates: ["read"] },
      }),
    ]
    expect(hasModuleAreaResourceRead(roles, "due_dates")).toBe(true)
    expect(canEnterModuleArea(roles, "due_dates", null)).toBe(true)
    expect(canAccessModuleId(roles, "due_dates", ["due_dates"])).toBe(true)
    expect(canAccessModuleId(roles, "due_dates", ["transport"])).toBe(false)
  })
})
