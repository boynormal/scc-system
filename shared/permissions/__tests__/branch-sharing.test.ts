import { describe, expect, it } from "vitest"
import { hasPermission, type UserRole } from "@/lib/permissions"
import {
  defaultBranchSharing,
  parseBranchSharing,
  permissionCoversBranch,
} from "@/shared/permissions/branch-sharing"

const BRANCH_A = "11111111-1111-1111-1111-111111111111"
const BRANCH_B = "22222222-2222-2222-2222-222222222222"

function viewer(branchId: string): UserRole {
  return {
    branchId,
    branchName: branchId,
    roleName: "Staff",
    permissions: { assets: ["read", "update"] },
  }
}

describe("branch sharing defaults", () => {
  it("keeps transport view, edit, and create on, and every other switch off", () => {
    const flags = defaultBranchSharing()
    expect(flags.transport_jobs).toMatchObject({ view: true, edit: true, delete: false, create: true })
    expect(flags.assets).toMatchObject({ view: false, edit: false, delete: false, create: false })
    expect(flags.finance.approve).toBe(false)
    expect(flags.personnel.view).toBe(false)
  })

  it("fills missing modules from defaults and ignores approve outside finance", () => {
    const flags = parseBranchSharing({
      nav: { appearance: "dark" },
      branchSharing: {
        assets: { view: true, edit: false },
        finance: { approve: true },
        personnel: { approve: true, delete: true },
      },
    })
    expect(flags.transport_jobs.view).toBe(true)
    expect(flags.assets.view).toBe(true)
    expect(flags.assets.edit).toBe(false)
    expect(flags.assets.create).toBe(false)
    expect(flags.finance.approve).toBe(true)
    expect(flags.personnel.approve).toBe(false)
    expect(flags.personnel.delete).toBe(true)
  })

  it("extends an existing grant only when the switch is on", () => {
    const roles = [viewer(BRANCH_A)]
    expect(hasPermission(roles, BRANCH_A, "assets", "update")).toBe(true)
    expect(permissionCoversBranch(roles, "assets", "update", BRANCH_B, false)).toBe(false)
    expect(permissionCoversBranch(roles, "assets", "update", BRANCH_B, true)).toBe(true)
    expect(permissionCoversBranch(roles, "assets", "delete", BRANCH_B, true)).toBe(false)
  })
})
