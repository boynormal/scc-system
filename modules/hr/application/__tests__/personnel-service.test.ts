import { describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { AppError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import {
  createPersonnel,
  createPersonnelSchema,
  deletePersonnel,
  formatRosterNo,
  getPersonnel,
  listPersonnel,
  listPersonnelDepartments,
  parseRosterNoSeq,
  personnelBranchWhereForRoles,
  suggestNextRosterNo,
  updatePersonnel,
  updatePersonnelSchema,
} from "@/modules/hr/application/personnel-service"

const CID = "00000000-0000-0000-0000-0000000000cc"
const CID_B = "00000000-0000-0000-0000-0000000000bb"
const BRANCH_A = "11111111-1111-1111-1111-111111111111"
const BRANCH_B = "22222222-2222-2222-2222-222222222222"
const USER_A = "44444444-4444-4444-4444-444444444444"
const USER_B = "66666666-6666-6666-6666-666666666666"
const PERSON_ID = "55555555-5555-5555-5555-555555555555"
const PERSON_OTHER = "77777777-7777-7777-7777-777777777777"
const DEPT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const DEPT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const DEPT_OTHER_CO = "cccccccc-cccc-cccc-cccc-cccccccccccc"

const adminRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Admin", permissions: null },
]
const managerRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Manager", permissions: null },
]
const viewerRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Viewer", permissions: null },
]
const noPermRoles: UserRole[] = [
  {
    branchId: BRANCH_A,
    branchName: "HQ",
    roleName: "Custom",
    permissions: { machines: ["read"] },
  },
]

const now = new Date("2026-08-31T00:00:00.000Z")

type PersonRow = {
  id: string
  companyId: string
  branchId: string | null
  rosterNo: string
  displayName: string
  jobGroup: string | null
  firstName: string | null
  lastName: string | null
  idCardNo: string | null
  phone: string | null
  address: string | null
  notes: string | null
  userId: string | null
  departmentId: string | null
  department: { id: string; name: string; code: string | null } | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  branch: { id: string; name: string; code: string } | null
  user: { id: string; firstName: string; lastName: string; username: string; email: string } | null
  branchAssignments: Array<{
    id: string
    branchId: string
    isPrimary: boolean
    branch: { id: string; name: string; code: string }
  }>
}

type UserRow = {
  id: string
  companyId: string
  deletedAt: Date | null
  isActive: boolean
  firstName: string
  lastName: string
  username: string
  email: string
  personnelId: string | null
}

function personRow(over: Partial<PersonRow> = {}): PersonRow {
  return {
    id: PERSON_ID,
    companyId: CID,
    branchId: BRANCH_A,
    rosterNo: "001",
    displayName: "สมชาย",
    jobGroup: "ผลิต",
    firstName: "สมชาย",
    lastName: "ใจดี",
    idCardNo: null,
    phone: null,
    address: null,
    notes: null,
    userId: null,
    departmentId: null,
    department: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    branch: { id: BRANCH_A, name: "HQ", code: "HQ" },
    user: null,
    branchAssignments: [],
    ...over,
  }
}

function matchPersonnel(where: Record<string, unknown> | undefined, row: PersonRow): boolean {
  if (!where) return true
  if (where.id === "00000000-0000-0000-0000-000000000000") return false
  if (typeof where.id === "string" && row.id !== where.id) return false
  if (typeof where.companyId === "string" && row.companyId !== where.companyId) return false
  if (typeof where.departmentId === "string" && row.departmentId !== where.departmentId) return false
  if (where.deletedAt === null && row.deletedAt) return false
  if (where.isActive === true || where.isActive === false) {
    if (row.isActive !== where.isActive) return false
  }
  if (where.branchId && typeof where.branchId === "string" && row.branchId !== where.branchId) return false
  if (where.branchId && typeof where.branchId === "object") {
    const inner = where.branchId as { in?: string[] }
    if (inner.in && !inner.in.includes(row.branchId ?? "")) return false
  }
  if (where.branchAssignments && typeof where.branchAssignments === "object") {
    const filter = where.branchAssignments as {
      some?: { branchId?: string | { in?: string[] }; isPrimary?: boolean }
      none?: { isPrimary?: boolean }
    }
    if (filter.none?.isPrimary === true && row.branchAssignments.some((assignment) => assignment.isPrimary)) return false
    const some = filter.some
    if (some?.branchId) {
      if (typeof some.branchId === "string") {
        const hit = row.branchAssignments.some(
          (assignment) =>
            assignment.branchId === some.branchId &&
            (some.isPrimary === undefined || assignment.isPrimary === some.isPrimary)
        )
        if (!hit) return false
      } else if (some.branchId.in) {
        const allowed = some.branchId.in
        const hit = row.branchAssignments.some((assignment) => allowed.includes(assignment.branchId))
        if (!hit) return false
      }
    }
  }
  if (Array.isArray(where.AND)) {
    return where.AND.every((part) => matchPersonnel(part as Record<string, unknown>, row))
  }
  if (Array.isArray(where.OR)) {
    return where.OR.some((part) => matchPersonnel(part as Record<string, unknown>, row))
  }
  return true
}

type DeptRow = {
  id: string
  name: string
  code: string | null
  companyId: string
  isActive: boolean
}

type FakeState = {
  people?: PersonRow[]
  users?: UserRow[]
  departments?: DeptRow[]
  branches?: Record<string, { companyId: string; isActive: boolean; deletedAt: Date | null }>
  lastFindManyWhere?: unknown
}

function fakeDb(state: FakeState = {}): PrismaClient {
  const people = state.people ?? [personRow()]
  const users = state.users ?? []
  const departments = state.departments ?? []
  const branches = state.branches ?? {
    [BRANCH_A]: { companyId: CID, isActive: true, deletedAt: null },
    [BRANCH_B]: { companyId: CID, isActive: true, deletedAt: null },
  }

  function attachDept(row: PersonRow): PersonRow {
    const withDept = row.departmentId
      ? {
          ...row,
          department:
            departments
              .filter((x) => x.id === row.departmentId)
              .map((d) => ({ id: d.id, name: d.name, code: d.code }))[0] ??
            row.department,
        }
      : { ...row, department: null }
    return withDept
  }

  const api = {
    branch: {
      findFirst: async ({ where }: { where: { id: string; companyId: string } }) => {
        const row = branches[where.id]
        if (!row || row.companyId !== where.companyId || row.deletedAt || !row.isActive) return null
        return { id: where.id }
      },
      findMany: async ({ where }: { where: { companyId: string; id?: { in?: string[] } } }) =>
        Object.entries(branches)
          .filter(([id, b]) => {
            if (b.companyId !== where.companyId || !b.isActive || b.deletedAt) return false
            if (where.id?.in && !where.id.in.includes(id)) return false
            return true
          })
          .map(([id]) => ({ id, name: id, code: id.slice(0, 2) })),
    },
    department: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const row = departments.find((d) => d.id === where.id)
        if (!row) return null
        if (where.isActive === true && !row.isActive) return null
        if (typeof where.companyId === "string" && row.companyId !== where.companyId) return null
        return { id: row.id, isActive: row.isActive, name: row.name, code: row.code }
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        return departments
          .filter((d) => {
            if (where.isActive === true && !d.isActive) return false
            if (typeof where.companyId === "string" && d.companyId !== where.companyId) return false
            return true
          })
          .map((d) => ({ id: d.id, name: d.name, code: d.code }))
      },
    },
    personnelBranch: {
      deleteMany: async ({ where }: { where: { personnelId: string } }) => {
        const person = people.find((p) => p.id === where.personnelId)
        if (person) person.branchAssignments = []
        return { count: 0 }
      },
      findUnique: async ({
        where,
      }: {
        where: { personnelId_branchId: { personnelId: string; branchId: string } }
      }) => {
        const key = where.personnelId_branchId
        const person = people.find((p) => p.id === key.personnelId)
        const row = person?.branchAssignments.find((a) => a.branchId === key.branchId)
        return row ? { isPrimary: row.isPrimary } : null
      },
      count: async ({ where }: { where: { personnelId: string } }) =>
        people.find((p) => p.id === where.personnelId)?.branchAssignments.length ?? 0,
      updateMany: async ({
        where,
        data,
      }: {
        where: { personnelId: string }
        data: { isPrimary?: boolean }
      }) => {
        const person = people.find((p) => p.id === where.personnelId)
        if (person && data.isPrimary === false) {
          for (const assignment of person.branchAssignments) assignment.isPrimary = false
        }
        return { count: person?.branchAssignments.length ?? 0 }
      },
      update: async ({
        where,
        data,
      }: {
        where: { personnelId_branchId: { personnelId: string; branchId: string } }
        data: { isPrimary: boolean }
      }) => {
        const key = where.personnelId_branchId
        const person = people.find((p) => p.id === key.personnelId)
        const row = person?.branchAssignments.find((a) => a.branchId === key.branchId)
        if (!row) throw new Error("not found")
        row.isPrimary = data.isPrimary
        return row
      },
      create: async ({
        data,
      }: {
        data: { personnelId: string; branchId: string; isPrimary: boolean }
      }) => {
        const person = people.find((p) => p.id === data.personnelId)
        if (person) {
          person.branchAssignments.push({
            id: `pb-${person.id}-${data.branchId}`,
            branchId: data.branchId,
            isPrimary: data.isPrimary,
            branch: { id: data.branchId, name: data.branchId, code: data.branchId.slice(0, 2) },
          })
        }
        return data
      },
    },
    user: {
      findFirst: async ({ where }: { where: { id: string; companyId: string; deletedAt: null } }) => {
        const row = users.find((u) => u.id === where.id && u.companyId === where.companyId && !u.deletedAt)
        if (!row) return null
        return {
          id: row.id,
          personnel: row.personnelId ? { id: row.personnelId } : null,
        }
      },
      findMany: async () => users.filter((u) => u.companyId === CID && !u.deletedAt && u.isActive),
    },
    personnel: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        state.lastFindManyWhere = where
        return people.filter((p) => matchPersonnel(where, p))
      },
      count: async ({ where }: { where: Record<string, unknown> }) => people.filter((p) => matchPersonnel(where, p)).length,
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        people.find((p) => matchPersonnel(where, p)) ?? null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const row = people.find((p) => p.id === where.id)
        if (!row) throw new Error("not found")
        return row
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const dup = people.find(
          (p) => p.companyId === data.companyId && p.rosterNo === data.rosterNo && !p.deletedAt
        )
        if (dup) {
          const err = Object.assign(new Error("Unique constraint"), { code: "P2002" })
          throw err
        }
        const row = personRow({
          id: (data.id as string) ?? `created-${people.length + 1}`,
          companyId: data.companyId as string,
          branchId: (data.branchId as string | null) ?? null,
          rosterNo: data.rosterNo as string,
          displayName: data.displayName as string,
          jobGroup: (data.jobGroup as string | null) ?? null,
          firstName: (data.firstName as string | null) ?? null,
          lastName: (data.lastName as string | null) ?? null,
          idCardNo: (data.idCardNo as string | null) ?? null,
          phone: (data.phone as string | null) ?? null,
          address: (data.address as string | null) ?? null,
          notes: (data.notes as string | null) ?? null,
          userId: (data.userId as string | null) ?? null,
          departmentId: (data.departmentId as string | null) ?? null,
        })
        const attached = attachDept(row)
        people.push(attached)
        return attached
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const idx = people.findIndex((p) => p.id === where.id)
        if (idx < 0) throw new Error("not found")
        if (typeof data.rosterNo === "string") {
          const dup = people.find(
            (p) => p.id !== where.id && p.companyId === people[idx]!.companyId && p.rosterNo === data.rosterNo && !p.deletedAt
          )
          if (dup) {
            const err = Object.assign(new Error("Unique constraint"), { code: "P2002" })
            throw err
          }
        }
        const next = attachDept(
          personRow({
            ...people[idx]!,
            ...data,
            deletedAt: (data.deletedAt as Date | null) ?? people[idx]!.deletedAt,
          })
        )
        if (typeof data.userId === "string") {
          const u = users.find((x) => x.id === data.userId)
          next.userId = data.userId
          next.user = u
            ? { id: u.id, firstName: u.firstName, lastName: u.lastName, username: u.username, email: u.email }
            : null
        }
        if (data.userId === null) {
          next.userId = null
          next.user = null
        }
        people[idx] = next
        return next
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(api),
  }

  return api as unknown as PrismaClient
}

describe("personnelBranchWhereForRoles", () => {
  it("admin without branchIdParam gets no filter (null)", () => {
    expect(personnelBranchWhereForRoles(true, [], null)).toBeNull()
  })

  it("admin with branchIdParam filters by the primary branch shown in the list", () => {
    const result = personnelBranchWhereForRoles(true, [], "branch-1")

    expect(result).toEqual({
      OR: [
        { branchAssignments: { some: { branchId: "branch-1", isPrimary: true } } },
        { branchId: "branch-1", branchAssignments: { none: { isPrimary: true } } },
      ],
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

  it("non-admin requesting an allowed branch filters by the primary branch", () => {
    const result = personnelBranchWhereForRoles(false, ["branch-1", "branch-2"], "branch-1")

    expect(result).toEqual({
      OR: [
        { branchAssignments: { some: { branchId: "branch-1", isPrimary: true } } },
        { branchId: "branch-1", branchAssignments: { none: { isPrimary: true } } },
      ],
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

describe("updatePersonnel", () => {
  it("updates displayName and isActive", async () => {
    const db = fakeDb()
    const parsed = updatePersonnelSchema.parse({ displayName: "สมหญิง", isActive: false })
    const result = await updatePersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      id: PERSON_ID,
      input: parsed,
    })
    expect(result.data.displayName).toBe("สมหญิง")
    expect(result.data.isActive).toBe(false)
  })

  it("inactive row is hidden from isActive=true list", async () => {
    const db = fakeDb({
      people: [personRow({ isActive: false }), personRow({ id: PERSON_OTHER, rosterNo: "002", displayName: "เปิด", isActive: true })],
    })
    const listed = await listPersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      isActive: true,
      page: 1,
      pageSize: 20,
    })
    expect(listed.data.map((p) => p.id)).toEqual([PERSON_OTHER])
  })

  it("soft-delete then GET is NotFound and list excludes deletedAt", async () => {
    const people = [personRow()]
    const db = fakeDb({ people })
    await deletePersonnel(db, { companyId: CID, roles: adminRoles, id: PERSON_ID })
    expect(people[0]!.deletedAt).toBeInstanceOf(Date)
    expect(people[0]!.isActive).toBe(false)

    await expect(getPersonnel(db, { companyId: CID, roles: adminRoles, id: PERSON_ID })).rejects.toBeInstanceOf(
      NotFoundError
    )

    const listed = await listPersonnel(db, { companyId: CID, roles: adminRoles, page: 1, pageSize: 20 })
    expect(listed.data).toHaveLength(0)
  })

  it("rejects duplicate rosterNo in the same company", async () => {
    const db = fakeDb({
      people: [personRow(), personRow({ id: PERSON_OTHER, rosterNo: "002", displayName: "อื่น" })],
    })
    const parsed = updatePersonnelSchema.parse({ rosterNo: "002" })
    await expect(
      updatePersonnel(db, { companyId: CID, roles: adminRoles, id: PERSON_ID, input: parsed })
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" } satisfies Partial<AppError>)
  })

  it("allows the same rosterNo in another company", async () => {
    const db = fakeDb({
      people: [personRow({ companyId: CID_B, rosterNo: "001" })],
    })
    const parsed = createPersonnelSchema.parse({
      rosterNo: "001",
      displayName: "คนใหม่",
    })
    const created = await createPersonnel(db, { companyId: CID, roles: adminRoles, input: parsed })
    expect(created.rosterNo).toBe("001")
    expect(created.companyId).toBe(CID)
  })

  it("auto-assigns the next roster number when rosterNo is omitted", async () => {
    const db = fakeDb({
      people: [personRow({ rosterNo: "001" }), personRow({ id: PERSON_OTHER, rosterNo: "007" })],
    })
    const parsed = createPersonnelSchema.parse({ displayName: "คนใหม่", rosterNo: "  " })
    expect(parsed.rosterNo).toBeUndefined()
    const created = await createPersonnel(db, { companyId: CID, roles: adminRoles, input: parsed })
    expect(created.rosterNo).toBe("008")
  })

  it("retries auto roster when another create takes the number first", async () => {
    const db = fakeDb({ people: [personRow({ rosterNo: "001" })] })
    const realFindMany = db.personnel.findMany
    let calls = 0
    db.personnel.findMany = (async (args: unknown) => {
      calls++
      if (calls === 1) return []
      return (realFindMany as (a: unknown) => Promise<unknown>)(args)
    }) as typeof db.personnel.findMany
    const parsed = createPersonnelSchema.parse({ displayName: "คนใหม่" })
    const created = await createPersonnel(db, { companyId: CID, roles: adminRoles, input: parsed })
    expect(created.rosterNo).toBe("002")
    expect(calls).toBe(2)
  })

  it("does not retry when a caller-supplied rosterNo conflicts", async () => {
    const db = fakeDb({ people: [personRow({ rosterNo: "001" })] })
    const parsed = createPersonnelSchema.parse({ rosterNo: "001", displayName: "คนใหม่" })
    await expect(
      createPersonnel(db, { companyId: CID, roles: adminRoles, input: parsed })
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" } satisfies Partial<AppError>)
  })

  it("links a same-company user", async () => {
    const db = fakeDb({
      users: [
        {
          id: USER_A,
          companyId: CID,
          deletedAt: null,
          isActive: true,
          firstName: "Ada",
          lastName: "Admin",
          username: "ada",
          email: "ada@example.com",
          personnelId: null,
        },
      ],
    })
    const parsed = updatePersonnelSchema.parse({ userId: USER_A })
    const result = await updatePersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      id: PERSON_ID,
      input: parsed,
    })
    expect(result.data.userId).toBe(USER_A)
  })

  it("rejects user from another company", async () => {
    const db = fakeDb({
      users: [
        {
          id: USER_B,
          companyId: CID_B,
          deletedAt: null,
          isActive: true,
          firstName: "Other",
          lastName: "Co",
          username: "other",
          email: "o@example.com",
          personnelId: null,
        },
      ],
    })
    const parsed = updatePersonnelSchema.parse({ userId: USER_B })
    await expect(
      updatePersonnel(db, { companyId: CID, roles: adminRoles, id: PERSON_ID, input: parsed })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("rejects a user already linked to another personnel", async () => {
    const db = fakeDb({
      users: [
        {
          id: USER_A,
          companyId: CID,
          deletedAt: null,
          isActive: true,
          firstName: "Ada",
          lastName: "Admin",
          username: "ada",
          email: "ada@example.com",
          personnelId: PERSON_OTHER,
        },
      ],
    })
    const parsed = updatePersonnelSchema.parse({ userId: USER_A })
    await expect(
      updatePersonnel(db, { companyId: CID, roles: adminRoles, id: PERSON_ID, input: parsed })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("non-admin cannot update a row outside allowed branches", async () => {
    const db = fakeDb({
      people: [personRow({ branchId: BRANCH_B, branch: { id: BRANCH_B, name: "B", code: "B" } })],
    })
    const parsed = updatePersonnelSchema.parse({ displayName: "ห้าม" })
    await expect(
      updatePersonnel(db, { companyId: CID, roles: managerRoles, id: PERSON_ID, input: parsed })
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("forbids update without hr_personnel update", async () => {
    const db = fakeDb()
    const parsed = updatePersonnelSchema.parse({ displayName: "ห้าม" })
    await expect(
      updatePersonnel(db, { companyId: CID, roles: viewerRoles, id: PERSON_ID, input: parsed })
    ).rejects.toBeInstanceOf(ForbiddenError)
    await expect(
      updatePersonnel(db, { companyId: CID, roles: noPermRoles, id: PERSON_ID, input: parsed })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("forbids delete without hr_personnel delete", async () => {
    const db = fakeDb()
    await expect(deletePersonnel(db, { companyId: CID, roles: managerRoles, id: PERSON_ID })).rejects.toBeInstanceOf(
      ForbiddenError
    )
    await expect(deletePersonnel(db, { companyId: CID, roles: viewerRoles, id: PERSON_ID })).rejects.toBeInstanceOf(
      ForbiddenError
    )
  })
})

describe("personnel department", () => {
  const departments: DeptRow[] = [
    { id: DEPT_A, name: "ผลิต", code: "PRD", companyId: CID, isActive: true },
    { id: DEPT_B, name: "คลัง", code: "WH", companyId: CID, isActive: true },
    { id: DEPT_OTHER_CO, name: "อื่น", code: "X", companyId: CID_B, isActive: true },
  ]

  it("creates with a department from the same company", async () => {
    const db = fakeDb({ departments })
    const parsed = createPersonnelSchema.parse({
      rosterNo: "010",
      displayName: "คนแผนก",
      branchIds: [BRANCH_A],
      departmentId: DEPT_A,
    })
    const created = await createPersonnel(db, { companyId: CID, roles: adminRoles, input: parsed })
    expect(created.departmentId).toBe(DEPT_A)
  })

  it("rejects a department from another company", async () => {
    const db = fakeDb({ departments })
    const parsed = createPersonnelSchema.parse({
      rosterNo: "011",
      displayName: "ข้ามบริษัท",
      branchIds: [BRANCH_A],
      departmentId: DEPT_OTHER_CO,
    })
    await expect(createPersonnel(db, { companyId: CID, roles: adminRoles, input: parsed })).rejects.toBeInstanceOf(
      ValidationError
    )
  })

  it("accepts a same-company department when the person is on another branch", async () => {
    const db = fakeDb({ departments })
    const parsed = createPersonnelSchema.parse({
      rosterNo: "012",
      displayName: "แผนกสาขาอื่น",
      branchIds: [BRANCH_A],
      departmentId: DEPT_B,
    })
    const created = await createPersonnel(db, { companyId: CID, roles: adminRoles, input: parsed })
    expect(created.departmentId).toBe(DEPT_B)
  })

  it("promotes the home branch and keeps branches added by badge mapping", async () => {
    const db = fakeDb({
      people: [
        personRow({
          branchAssignments: [
            {
              id: "pb-a",
              branchId: BRANCH_A,
              isPrimary: true,
              branch: { id: BRANCH_A, name: "HQ", code: "HQ" },
            },
            {
              id: "pb-b",
              branchId: BRANCH_B,
              isPrimary: false,
              branch: { id: BRANCH_B, name: "NRS", code: "NRS" },
            },
          ],
        }),
      ],
    })
    const parsed = updatePersonnelSchema.parse({ primaryBranchId: BRANCH_B })
    const result = await updatePersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      id: PERSON_ID,
      input: parsed,
    })
    expect(result.data.branchId).toBe(BRANCH_B)
    expect(result.data.branchAssignments.map((a) => a.branchId).sort()).toEqual([BRANCH_A, BRANCH_B])
    expect(result.data.branchAssignments.find((a) => a.branchId === BRANCH_B)?.isPrimary).toBe(true)
    expect(result.data.branchAssignments.find((a) => a.branchId === BRANCH_A)?.isPrimary).toBe(false)
  })

  it("replaces every branch when branchIds is sent", async () => {
    const db = fakeDb({
      people: [
        personRow({
          branchAssignments: [
            {
              id: "pb-a",
              branchId: BRANCH_A,
              isPrimary: true,
              branch: { id: BRANCH_A, name: "HQ", code: "HQ" },
            },
            {
              id: "pb-b",
              branchId: BRANCH_B,
              isPrimary: false,
              branch: { id: BRANCH_B, name: "NRS", code: "NRS" },
            },
          ],
        }),
      ],
    })
    const parsed = updatePersonnelSchema.parse({ branchIds: [BRANCH_B] })
    const result = await updatePersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      id: PERSON_ID,
      input: parsed,
    })
    expect(result.data.branchAssignments.map((a) => a.branchId)).toEqual([BRANCH_B])
  })

  it("keeps departmentId when the home branch changes", async () => {
    const db = fakeDb({
      departments,
      people: [personRow({ departmentId: DEPT_A, department: { id: DEPT_A, name: "ผลิต", code: "PRD" } })],
    })
    const parsed = updatePersonnelSchema.parse({ branchIds: [BRANCH_B] })
    const result = await updatePersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      id: PERSON_ID,
      input: parsed,
    })
    expect(result.data.departmentId).toBe(DEPT_A)
  })

  it("filters the list by departmentId", async () => {
    const db = fakeDb({
      departments,
      people: [
        personRow({ departmentId: DEPT_A }),
        personRow({ id: PERSON_OTHER, rosterNo: "002", displayName: "คลัง", departmentId: DEPT_B }),
      ],
    })
    const listed = await listPersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      departmentId: DEPT_A,
      page: 1,
      pageSize: 20,
    })
    expect(listed.data.map((p) => p.id)).toEqual([PERSON_ID])
  })

  it("branch filter keeps people whose primary branch matches and drops a secondary link", async () => {
    const db = fakeDb({
      people: [
        personRow({
          branchAssignments: [
            {
              id: "assign-a",
              branchId: BRANCH_A,
              isPrimary: true,
              branch: { id: BRANCH_A, name: "พระประแดง", code: "PPD" },
            },
          ],
        }),
        personRow({
          id: PERSON_OTHER,
          rosterNo: "78",
          displayName: "สาขาอื่น",
          branchId: BRANCH_B,
          branch: { id: BRANCH_B, name: "อื่น", code: "OTH" },
          branchAssignments: [
            {
              id: "assign-b",
              branchId: BRANCH_B,
              isPrimary: true,
              branch: { id: BRANCH_B, name: "อื่น", code: "OTH" },
            },
            {
              id: "assign-link",
              branchId: BRANCH_A,
              isPrimary: false,
              branch: { id: BRANCH_A, name: "พระประแดง", code: "PPD" },
            },
          ],
        }),
      ],
    })
    const listed = await listPersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      branchId: BRANCH_A,
      page: 1,
      pageSize: 20,
    })
    expect(listed.data.map((person) => person.rosterNo)).toEqual(["001"])
  })

  it("lists active departments for the whole company", async () => {
    const db = fakeDb({
      departments: [
        ...departments,
        { id: "dddddddd-dddd-dddd-dddd-dddddddddddd", name: "ปิด", code: "OFF", companyId: CID, isActive: false },
      ],
    })
    const listed = await listPersonnelDepartments(db, {
      companyId: CID,
      roles: adminRoles,
    })
    expect(listed.data.map((d) => d.id).sort()).toEqual([DEPT_A, DEPT_B].sort())
  })
})

describe("personnel schemas", () => {
  it("maps empty userId and departmentId to null", () => {
    expect(updatePersonnelSchema.parse({ userId: "" }).userId).toBeNull()
    expect(createPersonnelSchema.parse({ rosterNo: "1", displayName: "A", userId: "" }).userId).toBeNull()
    expect(updatePersonnelSchema.parse({ departmentId: "" }).departmentId).toBeNull()
    expect(createPersonnelSchema.parse({ rosterNo: "1", displayName: "A", departmentId: "" }).departmentId).toBeNull()
  })

  it("drops unknown position fields from the body", () => {
    const parsed = createPersonnelSchema.parse({
      rosterNo: "1",
      displayName: "A",
      positionId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeea",
      positionIds: ["eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeea"],
    })
    expect(parsed).not.toHaveProperty("positionId")
    expect(parsed).not.toHaveProperty("positionIds")
  })
})

describe("suggestNextRosterNo", () => {
  it("formats and parses numeric roster numbers", () => {
    expect(formatRosterNo(1)).toBe("001")
    expect(formatRosterNo(99)).toBe("099")
    expect(formatRosterNo(100)).toBe("100")
    expect(parseRosterNoSeq("001")).toBe(1)
    expect(parseRosterNoSeq("A-12")).toBeNull()
    expect(parseRosterNoSeq("000")).toBeNull()
  })

  it("returns 001 when the company has no personnel", async () => {
    const db = fakeDb({ people: [] })
    const result = await suggestNextRosterNo(db, { companyId: CID, roles: adminRoles })
    expect(result.data.rosterNo).toBe("001")
  })

  it("increments past existing numeric codes", async () => {
    const db = fakeDb({
      people: [personRow({ rosterNo: "001" }), personRow({ id: PERSON_OTHER, rosterNo: "002" })],
    })
    const result = await suggestNextRosterNo(db, { companyId: CID, roles: adminRoles })
    expect(result.data.rosterNo).toBe("003")
  })

  it("ignores non-numeric codes when computing max", async () => {
    const db = fakeDb({
      people: [personRow({ rosterNo: "001" }), personRow({ id: PERSON_OTHER, rosterNo: "A-12" })],
    })
    const result = await suggestNextRosterNo(db, { companyId: CID, roles: adminRoles })
    expect(result.data.rosterNo).toBe("002")
  })

  it("skips numbers held by soft-deleted rows", async () => {
    const db = fakeDb({
      people: [
        personRow({ rosterNo: "001" }),
        personRow({ id: PERSON_OTHER, rosterNo: "002" }),
        personRow({ id: "88888888-8888-8888-8888-888888888888", rosterNo: "003", deletedAt: now }),
      ],
    })
    const result = await suggestNextRosterNo(db, { companyId: CID, roles: adminRoles })
    expect(result.data.rosterNo).toBe("004")
  })

  it("forbids callers without hr_personnel create or read", async () => {
    const db = fakeDb({ people: [] })
    await expect(suggestNextRosterNo(db, { companyId: CID, roles: noPermRoles })).rejects.toBeInstanceOf(ForbiddenError)
  })
})
