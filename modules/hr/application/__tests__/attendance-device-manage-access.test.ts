import { describe, expect, it } from "vitest"
import type { UserRole } from "@/lib/permissions"
import { canManageAttendanceDevice } from "@/modules/hr/application/attendance-access"

const BRANCH = "11111111-1111-1111-1111-111111111111"
const OTHER = "22222222-2222-2222-2222-222222222222"

function role(partial: Partial<UserRole> & Pick<UserRole, "branchId" | "roleName">): UserRole {
  return {
    branchName: "สาขา",
    permissions: null,
    ...partial,
  }
}

describe("canManageAttendanceDevice", () => {
  it("allows an admin for any branch", () => {
    const roles = [role({ branchId: OTHER, roleName: "Admin" })]
    expect(canManageAttendanceDevice(roles, BRANCH)).toBe(true)
  })

  it("allows settings update on that branch", () => {
    const roles = [role({ branchId: BRANCH, roleName: "Custom", permissions: { settings: ["update"] } })]
    expect(canManageAttendanceDevice(roles, BRANCH)).toBe(true)
  })

  it("rejects attendance update without settings update", () => {
    const roles = [
      role({
        branchId: BRANCH,
        roleName: "Custom",
        permissions: { hr_attendance: ["create", "read", "update"] },
      }),
    ]
    expect(canManageAttendanceDevice(roles, BRANCH)).toBe(false)
  })

  it("rejects settings update on a different branch", () => {
    const roles = [role({ branchId: OTHER, roleName: "Custom", permissions: { settings: ["update"] } })]
    expect(canManageAttendanceDevice(roles, BRANCH)).toBe(false)
  })
})
