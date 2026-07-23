import { describe, expect, it } from "vitest"
import { personnelBranchWhereForRoles } from "@/modules/hr/application/personnel-service"

describe("personnelBranchWhereForRoles", () => {
  it("admin without branchIdParam gets no filter (null)", () => {
    expect(personnelBranchWhereForRoles(true, [], null)).toBeNull()
  })

  it("admin with branchIdParam filters by direct branch or assignment", () => {
    const result = personnelBranchWhereForRoles(true, [], "branch-1")

    expect(result).toEqual({
      OR: [{ branchId: "branch-1" }, { branchAssignments: { some: { branchId: "branch-1" } } }],
    })
  })

  it("non-admin with no allowed branches filters to a non-matching fake id", () => {
    const result = personnelBranchWhereForRoles(false, [], null)

    expect(result).toEqual({ id: "00000000-0000-0000-0000-000000000000" })
  })

  it("non-admin requesting a branch outside their allowed set gets null (forbidden upstream)", () => {
    const result = personnelBranchWhereForRoles(false, ["branch-1", "branch-2"], "branch-3")

    expect(result).toBeNull()
  })

  it("non-admin requesting an allowed branch filters by that branch or assignment", () => {
    const result = personnelBranchWhereForRoles(false, ["branch-1", "branch-2"], "branch-1")

    expect(result).toEqual({
      OR: [{ branchId: "branch-1" }, { branchAssignments: { some: { branchId: "branch-1" } } }],
    })
  })

  it("non-admin with no branchIdParam gets an OR covering all allowed branches", () => {
    const result = personnelBranchWhereForRoles(false, ["branch-1", "branch-2"], null)

    expect(result).toEqual({
      OR: [
        { branchId: { in: ["branch-1", "branch-2"] } },
        { branchAssignments: { some: { branchId: { in: ["branch-1", "branch-2"] } } } },
      ],
    })
  })
})
