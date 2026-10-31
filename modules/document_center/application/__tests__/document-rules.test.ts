import { describe, expect, it } from "vitest"
import type { UserRole } from "@/lib/permissions"
import { canTouchDocument, documentWhere } from "@/modules/document_center/application/access"
import {
  descendantIds,
  fileKindOf,
  parentCreatesCycle,
  rollupCategoryCounts,
} from "@/modules/document_center/application/rules"

const BRANCH_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const BRANCH_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const COMPANY = "11111111-1111-1111-1111-111111111111"

function staff(branchId: string, actions: UserRole["permissions"]): UserRole[] {
  return [{ branchId, branchName: branchId, roleName: "Staff", permissions: actions }]
}

describe("document rules", () => {
  it("rejects a category parent cycle", () => {
    const rows = [
      { id: "a", parentId: null },
      { id: "b", parentId: "a" },
    ]
    expect(parentCreatesCycle(rows, "a", "b")).toBe(true)
    expect(parentCreatesCycle(rows, "b", null)).toBe(false)
    expect(descendantIds(rows, "a")).toEqual(expect.arrayContaining(["a", "b"]))
  })

  it("rolls child document counts into the parent", () => {
    const rows = [
      { id: "a", parentId: null },
      { id: "b", parentId: "a" },
    ]
    const totals = rollupCategoryCounts(rows, new Map([["b", 2]]))
    expect(totals.get("a")).toBe(2)
    expect(totals.get("b")).toBe(2)
  })

  it("maps office and pdf content types to a file kind", () => {
    expect(fileKindOf("application/pdf", "a.pdf")).toBe("pdf")
    expect(fileKindOf("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "a.docx")).toBe("word")
    expect(fileKindOf("application/vnd.ms-excel", "a.xls")).toBe("excel")
    expect(fileKindOf("text/plain", "a.txt")).toBe("other")
  })
})

describe("document scope", () => {
  const roles = staff(BRANCH_A, { documents: ["read", "create", "update"] })

  it("hides another branch when sharing is off", () => {
    expect(
      documentWhere({ companyId: COMPANY, roles, shareView: false, branchFilter: BRANCH_B })
    ).toEqual({ id: "00000000-0000-0000-0000-000000000000" })
  })

  it("keeps company-wide documents visible to a branch reader", () => {
    const where = documentWhere({ companyId: COMPANY, roles, shareView: false, branchFilter: "company" })
    expect(JSON.stringify(where)).toContain('"branchId":null')
  })

  it("allows a company document create and refuses another branch without sharing", () => {
    const flags = { view: false, edit: false, delete: false, create: false, approve: false }
    expect(canTouchDocument(roles, "create", null, flags)).toBe(true)
    expect(canTouchDocument(roles, "create", BRANCH_B, flags)).toBe(false)
    expect(canTouchDocument(roles, "create", BRANCH_A, flags)).toBe(true)
  })
})
