import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { getPersonnelOrgView } from "@/modules/hr/application/personnel-org-view"

const CID = "00000000-0000-0000-0000-0000000000cc"
const BRANCH_A = "11111111-1111-1111-1111-111111111111"
const BRANCH_B = "22222222-2222-2222-2222-222222222222"
const DEPT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const DEPT_A2 = "aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const DEPT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const PERSON_1 = "55555555-5555-5555-5555-555555555555"
const PERSON_2 = "66666666-6666-6666-6666-666666666666"

const adminRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Admin", permissions: null },
]
const viewerA: UserRole[] = [
  { branchId: BRANCH_A, branchName: "A", roleName: "Viewer", permissions: null },
]
const managerA: UserRole[] = [
  { branchId: BRANCH_A, branchName: "A", roleName: "Manager", permissions: null },
]
const noHrRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "A", roleName: "Custom", permissions: { machines: ["read"] } },
]

function asDb(db: object): PrismaClient {
  return db as unknown as PrismaClient
}

function dept(id: string, name: string, branchId: string, over: { code?: string | null; isActive?: boolean } = {}) {
  return { id, name, code: over.code ?? null, branchId, isActive: over.isActive ?? true }
}

function person(over: {
  id?: string
  branchId?: string | null
  departmentId?: string | null
  department?: { id: string; isActive: boolean; branchId: string } | null
  displayName?: string
  rosterNo?: string
  jobGroup?: string | null
  isActive?: boolean
  deletedAt?: Date | null
}) {
  const departmentId = over.departmentId === undefined ? DEPT_A : over.departmentId
  return {
    id: over.id ?? PERSON_1,
    rosterNo: over.rosterNo ?? "001",
    displayName: over.displayName ?? "สมชาย",
    jobGroup: over.jobGroup === undefined ? "พนักงาน" : over.jobGroup,
    isActive: over.isActive ?? true,
    departmentId,
    branchId: over.branchId === undefined ? BRANCH_A : over.branchId,
    department:
      over.department === undefined
        ? departmentId
          ? { id: departmentId, isActive: true, branchId: BRANCH_A }
          : null
        : over.department,
    deletedAt: over.deletedAt ?? null,
  }
}

function createDb(opts: {
  branch?: { id: string; code: string; name: string } | null
  departments?: { id: string; name: string; code: string | null }[]
  people?: ReturnType<typeof person>[]
}) {
  return {
    branch: {
      findFirst: vi.fn().mockResolvedValue(
        opts.branch === undefined
          ? { id: BRANCH_A, code: "A", name: "สาขา A" }
          : opts.branch
      ),
    },
    department: {
      findMany: vi.fn().mockResolvedValue(opts.departments ?? [dept(DEPT_A, "บัญชี", BRANCH_A)]),
    },
    personnel: {
      findMany: vi.fn().mockResolvedValue(opts.people ?? []),
    },
  }
}

describe("getPersonnelOrgView", () => {
  it("places a person in the department of the selected branch", async () => {
    const db = createDb({
      people: [person({ departmentId: DEPT_A })],
    })
    const result = await getPersonnelOrgView(asDb(db), {
      companyId: CID,
      roles: adminRoles,
      branchId: BRANCH_A,
    })
    expect(result.data.departments[0]?.personnel.map((p) => p.id)).toEqual([PERSON_1])
    expect(result.data.unassigned).toEqual([])
    expect(result.data.totals).toEqual({ personnel: 1, departments: 1, unassigned: 0 })
    expect(JSON.stringify(db.personnel.findMany.mock.calls[0]?.[0])).not.toContain("branchAssignments")
  })

  it("does not put a PersonnelBranch-only assignee into the org (department lives on the other branch)", async () => {
    const db = createDb({
      departments: [dept(DEPT_A, "บัญชี", BRANCH_A)],
      people: [],
    })
    const result = await getPersonnelOrgView(asDb(db), {
      companyId: CID,
      roles: adminRoles,
      branchId: BRANCH_A,
    })
    expect(result.data.departments[0]?.personnel).toEqual([])
    expect(result.data.unassigned).toEqual([])
    const where = db.personnel.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>
    expect(JSON.stringify(where)).not.toMatch(/branchAssignments/)
  })

  it("RULE: branchId A + active department B appears only under B", async () => {
    const onB = person({
      branchId: BRANCH_A,
      departmentId: DEPT_B,
      department: { id: DEPT_B, isActive: true, branchId: BRANCH_B },
    })
    const dbA = createDb({
      departments: [dept(DEPT_A, "บัญชี", BRANCH_A)],
      people: [],
    })
    const a = await getPersonnelOrgView(asDb(dbA), {
      companyId: CID,
      roles: adminRoles,
      branchId: BRANCH_A,
    })
    expect(a.data.departments.flatMap((d) => d.personnel)).toEqual([])
    expect(a.data.unassigned).toEqual([])

    const dbB = createDb({
      branch: { id: BRANCH_B, code: "B", name: "สาขา B" },
      departments: [dept(DEPT_B, "บัญชี", BRANCH_B)],
      people: [onB],
    })
    const b = await getPersonnelOrgView(asDb(dbB), {
      companyId: CID,
      roles: adminRoles,
      branchId: BRANCH_B,
    })
    expect(b.data.departments[0]?.personnel.map((p) => p.id)).toEqual([PERSON_1])
  })

  it("puts departmentId null + branchId A into ยังไม่จัดแผนก on A only", async () => {
    const db = createDb({
      people: [person({ departmentId: null, department: null, jobGroup: null })],
    })
    const result = await getPersonnelOrgView(asDb(db), {
      companyId: CID,
      roles: adminRoles,
      branchId: BRANCH_A,
    })
    expect(result.data.unassigned).toEqual([
      {
        id: PERSON_1,
        rosterNo: "001",
        displayName: "สมชาย",
        jobGroup: null,
        isActive: true,
      },
    ])
    expect(result.data.departments[0]?.personnel).toEqual([])
    expect(result.data.totals.unassigned).toBe(1)
  })

  it("does not show departmentId null + branchId null on a branch view", async () => {
    const db = createDb({ people: [] })
    const result = await getPersonnelOrgView(asDb(db), {
      companyId: CID,
      roles: adminRoles,
      branchId: BRANCH_A,
    })
    expect(result.data.unassigned).toEqual([])
    expect(result.data.totals.personnel).toBe(0)
  })

  it("treats an inactive department pointer as unassigned when home branch matches", async () => {
    const db = createDb({
      departments: [dept(DEPT_A, "บัญชี", BRANCH_A)],
      people: [
        person({
          departmentId: DEPT_A,
          department: { id: DEPT_A, isActive: false, branchId: BRANCH_A },
        }),
      ],
    })
    const result = await getPersonnelOrgView(asDb(db), {
      companyId: CID,
      roles: adminRoles,
      branchId: BRANCH_A,
    })
    expect(result.data.departments.map((d) => d.id)).toEqual([DEPT_A])
    expect(result.data.departments[0]?.personnel).toEqual([])
    expect(result.data.unassigned.map((p) => p.id)).toEqual([PERSON_1])
  })

  it("hides inactive personnel by default and includes them when isActive is null", async () => {
    const hidden = createDb({ people: [] })
    await getPersonnelOrgView(asDb(hidden), {
      companyId: CID,
      roles: adminRoles,
      branchId: BRANCH_A,
    })
    const defaultWhere = hidden.personnel.findMany.mock.calls[0]?.[0]?.where as { AND: Record<string, unknown>[] }
    expect(defaultWhere.AND.some((p) => p.isActive === true)).toBe(true)

    const shown = createDb({
      people: [person({ isActive: false })],
    })
    const result = await getPersonnelOrgView(asDb(shown), {
      companyId: CID,
      roles: adminRoles,
      branchId: BRANCH_A,
      isActive: null,
    })
    expect(result.data.departments[0]?.personnel[0]?.isActive).toBe(false)
    const allWhere = shown.personnel.findMany.mock.calls[0]?.[0]?.where as { AND: Record<string, unknown>[] }
    expect(allWhere.AND.some((p) => "isActive" in p && typeof p.isActive === "boolean")).toBe(false)
  })

  it("keeps empty active departments in the structure", async () => {
    const db = createDb({
      departments: [dept(DEPT_A, "บัญชี", BRANCH_A), dept(DEPT_A2, "IT", BRANCH_A, { code: "IT" })],
      people: [person({ departmentId: DEPT_A })],
    })
    const result = await getPersonnelOrgView(asDb(db), {
      companyId: CID,
      roles: adminRoles,
      branchId: BRANCH_A,
    })
    expect(result.data.departments.map((d) => d.name)).toEqual(["บัญชี", "IT"])
    expect(result.data.departments[1]?.personnelCount).toBe(0)
    expect(result.data.totals.departments).toBe(2)
    expect(result.data.totals.personnel).toBe(1)
  })

  it("filters people by search but does not drop empty departments from totals.departments", async () => {
    const db = createDb({
      departments: [dept(DEPT_A, "บัญชี", BRANCH_A), dept(DEPT_A2, "IT", BRANCH_A)],
      people: [person({ displayName: "สมชาย", departmentId: DEPT_A })],
    })
    const result = await getPersonnelOrgView(asDb(db), {
      companyId: CID,
      roles: adminRoles,
      branchId: BRANCH_A,
      search: "สมชาย",
    })
    expect(result.data.totals.departments).toBe(2)
    expect(result.data.departments).toHaveLength(2)
    const where = JSON.stringify(db.personnel.findMany.mock.calls[0]?.[0])
    expect(where).toContain("สมชาย")
  })

  it("keeps two departments with the same name as distinct sections", async () => {
    const db = createDb({
      departments: [
        dept(DEPT_A, "บัญชี", BRANCH_A),
        dept(DEPT_A2, "บัญชี", BRANCH_A),
      ],
      people: [
        person({ id: PERSON_1, departmentId: DEPT_A, department: { id: DEPT_A, isActive: true, branchId: BRANCH_A } }),
        person({
          id: PERSON_2,
          rosterNo: "002",
          displayName: "สมหญิง",
          departmentId: DEPT_A2,
          department: { id: DEPT_A2, isActive: true, branchId: BRANCH_A },
        }),
      ],
    })
    const result = await getPersonnelOrgView(asDb(db), {
      companyId: CID,
      roles: adminRoles,
      branchId: BRANCH_A,
    })
    expect(result.data.departments).toHaveLength(2)
    expect(result.data.departments[0]?.id).toBe(DEPT_A)
    expect(result.data.departments[1]?.id).toBe(DEPT_A2)
    expect(result.data.departments[0]?.personnel[0]?.id).toBe(PERSON_1)
    expect(result.data.departments[1]?.personnel[0]?.id).toBe(PERSON_2)
  })

  it("forbids callers without hr_personnel read", async () => {
    const db = createDb({})
    await expect(
      getPersonnelOrgView(asDb(db), { companyId: CID, roles: noHrRoles, branchId: BRANCH_A })
    ).rejects.toBeInstanceOf(ForbiddenError)
    expect(db.branch.findFirst).not.toHaveBeenCalled()
  })

  it("returns 403 when a branch-restricted user requests another branch", async () => {
    const db = createDb({
      branch: { id: BRANCH_B, code: "B", name: "สาขา B" },
    })
    await expect(
      getPersonnelOrgView(asDb(db), { companyId: CID, roles: viewerA, branchId: BRANCH_B })
    ).rejects.toMatchObject({ name: "ForbiddenError", status: 403 })
    expect(db.personnel.findMany).not.toHaveBeenCalled()
  })

  it("allows Admin on a branch they are not assigned to", async () => {
    const db = createDb({
      branch: { id: BRANCH_B, code: "B", name: "สาขา B" },
      departments: [dept(DEPT_B, "บัญชี", BRANCH_B)],
      people: [],
    })
    const result = await getPersonnelOrgView(asDb(db), {
      companyId: CID,
      roles: adminRoles,
      branchId: BRANCH_B,
    })
    expect(result.data.branch.id).toBe(BRANCH_B)
    expect(result.data.totals.departments).toBe(1)
  })

  it("rejects a missing or invalid branchId", async () => {
    const db = createDb({ branch: null })
    await expect(
      getPersonnelOrgView(asDb(db), { companyId: CID, roles: managerA, branchId: "not-a-uuid" })
    ).rejects.toBeInstanceOf(ValidationError)

    await expect(
      getPersonnelOrgView(asDb(db), { companyId: CID, roles: managerA, branchId: BRANCH_A })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("does not include machine counts in the department query", async () => {
    const db = createDb({})
    await getPersonnelOrgView(asDb(db), {
      companyId: CID,
      roles: adminRoles,
      branchId: BRANCH_A,
    })
    expect(JSON.stringify(db.department.findMany.mock.calls[0]?.[0])).not.toContain("machines")
  })
})
