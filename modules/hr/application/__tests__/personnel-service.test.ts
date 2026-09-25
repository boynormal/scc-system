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
const POS_A = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeea"
const POS_B = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeeb"
const POS_INACTIVE = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeec"

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
  department: { id: string; name: string; code: string | null; branchId: string } | null
  positionId: string | null
  position: { id: string; name: string; code: string | null; branchId: string } | null
  positionAssignments: Array<{
    id?: string
    positionId: string
    extraDuties?: string | null
    dutyItems?: { dutyItemId: string }[]
    position: { id: string; name: string; code: string | null; branchId: string }
  }>
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
    positionId: null,
    position: null,
    positionAssignments: [],
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
  if (typeof where.positionId === "string" && row.positionId !== where.positionId) return false
  if (where.positionAssignments && typeof where.positionAssignments === "object") {
    const some = (where.positionAssignments as { some?: { positionId?: string } }).some
    if (some?.positionId) {
      const hit =
        row.positionAssignments.some((a) => a.positionId === some.positionId) || row.positionId === some.positionId
      if (!hit) return false
    }
  }
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
    const some = (where.branchAssignments as { some?: { branchId?: string | { in?: string[] } } }).some
    if (some?.branchId) {
      if (typeof some.branchId === "string") {
        const hit = row.branchAssignments.some((a) => a.branchId === some.branchId) || row.branchId === some.branchId
        if (!hit) return false
      } else if (some.branchId.in) {
        const allowed = some.branchId.in
        const hit =
          row.branchAssignments.some((a) => allowed.includes(a.branchId)) || allowed.includes(row.branchId ?? "")
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
  branchId: string
  companyId: string
  isActive: boolean
}

type PositionRowFake = {
  id: string
  name: string
  code: string | null
  branchId: string
  companyId: string
  isActive: boolean
}

type FakeState = {
  people?: PersonRow[]
  users?: UserRow[]
  departments?: DeptRow[]
  positions?: PositionRowFake[]
  branches?: Record<string, { companyId: string; isActive: boolean; deletedAt: Date | null }>
  dutyItems?: { id: string; companyId: string; isActive: boolean }[]
  lastFindManyWhere?: unknown
}

function fakeDb(state: FakeState = {}): PrismaClient {
  const people = state.people ?? [personRow()]
  const users = state.users ?? []
  const departments = state.departments ?? []
  const positions = state.positions ?? []
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
              .map((d) => ({ id: d.id, name: d.name, code: d.code, branchId: d.branchId }))[0] ??
            row.department,
        }
      : { ...row, department: null }

    if (!withDept.positionId) return { ...withDept, position: null }
    const p = positions.find((x) => x.id === withDept.positionId)
    return {
      ...withDept,
      position: p ? { id: p.id, name: p.name, code: p.code, branchId: p.branchId } : withDept.position,
    }
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
        const branchWhere = where.branch as
          | { companyId?: string; deletedAt?: null; isActive?: boolean }
          | undefined
        const branch = branches[row.branchId]
        if (branchWhere?.companyId && row.companyId !== branchWhere.companyId) return null
        if (branchWhere?.deletedAt === null && branch?.deletedAt) return null
        if (branchWhere?.isActive === true && branch && !branch.isActive) return null
        return { id: row.id, branchId: row.branchId, isActive: row.isActive, name: row.name, code: row.code }
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        const branchWhere = where.branch as
          | { companyId?: string; deletedAt?: null; isActive?: boolean; id?: { in?: string[] } }
          | undefined
        return departments
          .filter((d) => {
            if (where.isActive === true && !d.isActive) return false
            if (branchWhere?.companyId && d.companyId !== branchWhere.companyId) return false
            const branch = branches[d.branchId]
            if (!branch) return false
            if (branchWhere?.deletedAt === null && branch.deletedAt) return false
            if (branchWhere?.isActive === true && !branch.isActive) return false
            if (branchWhere?.id?.in && !branchWhere.id.in.includes(d.branchId)) return false
            return true
          })
          .map((d) => ({ id: d.id, name: d.name, code: d.code, branchId: d.branchId }))
      },
    },
    position: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const row = positions.find((p) => p.id === where.id)
        if (!row) return null
        if (where.isActive === true && !row.isActive) return null
        const branchWhere = where.branch as { companyId?: string; deletedAt?: null } | undefined
        const branch = branches[row.branchId]
        if (branchWhere?.companyId && row.companyId !== branchWhere.companyId) return null
        if (branchWhere?.deletedAt === null && branch?.deletedAt) return null
        return { id: row.id, branchId: row.branchId, isActive: row.isActive }
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        const ids = (where.id as { in?: string[] } | undefined)?.in
        return positions
          .filter((row) => {
            if (ids && !ids.includes(row.id)) return false
            if (where.isActive === true && !row.isActive) return false
            const branchWhere = where.branch as { companyId?: string; deletedAt?: null } | undefined
            const branch = branches[row.branchId]
            if (branchWhere?.companyId && row.companyId !== branchWhere.companyId) return false
            if (branchWhere?.deletedAt === null && branch?.deletedAt) return false
            return true
          })
          .map((row) => ({ id: row.id, branchId: row.branchId, isActive: row.isActive }))
      },
    },
    dutyItem: {
      findMany: async ({ where }: { where: { id: { in: string[] }; category: { companyId: string } } }) =>
        (state.dutyItems ?? [])
          .filter((item) => where.id.in.includes(item.id) && item.companyId === where.category.companyId)
          .map((item) => ({ id: item.id, isActive: item.isActive, category: { isActive: true } })),
    },
    personnelPosition: {
      findMany: async ({ where }: { where: { personnelId: string } }) => {
        const person = people.find((p) => p.id === where.personnelId)
        return (person?.positionAssignments ?? []).map((seat) => ({
          id: seat.id ?? `seat-${seat.positionId}`,
          positionId: seat.positionId,
        }))
      },
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        for (const person of people) {
          person.positionAssignments = person.positionAssignments.filter(
            (seat) => !where.id.in.includes(seat.id ?? `seat-${seat.positionId}`)
          )
        }
        return { count: where.id.in.length }
      },
      create: async ({
        data,
      }: {
        data: {
          personnelId: string
          positionId: string
          extraDuties: string | null
          dutyItems?: { create: { dutyItemId: string }[] }
        }
      }) => {
        const person = people.find((p) => p.id === data.personnelId)
        const pos = positions.find((p) => p.id === data.positionId)
        const seat = {
          id: `seat-${data.positionId}`,
          positionId: data.positionId,
          extraDuties: data.extraDuties,
          dutyItems: data.dutyItems?.create ?? [],
          position: pos
            ? { id: pos.id, name: pos.name, code: pos.code, branchId: pos.branchId }
            : { id: data.positionId, name: data.positionId, code: null, branchId: "" },
        }
        person?.positionAssignments.push(seat)
        return seat
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string }
        data: { extraDuties: string | null; dutyItems: { create: { dutyItemId: string }[] } }
      }) => {
        for (const person of people) {
          const seat = person.positionAssignments.find((s) => (s.id ?? `seat-${s.positionId}`) === where.id)
          if (seat) {
            seat.extraDuties = data.extraDuties
            seat.dutyItems = data.dutyItems.create
            return seat
          }
        }
        throw new Error("seat not found")
      },
    },
    personnelBranch: {
      deleteMany: async ({ where }: { where: { personnelId: string } }) => {
        const person = people.find((p) => p.id === where.personnelId)
        if (person) person.branchAssignments = []
        return { count: 0 }
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
          positionId: (data.positionId as string | null) ?? null,
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
    { id: DEPT_A, name: "ผลิต", code: "PRD", branchId: BRANCH_A, companyId: CID, isActive: true },
    { id: DEPT_B, name: "คลัง", code: "WH", branchId: BRANCH_B, companyId: CID, isActive: true },
    { id: DEPT_OTHER_CO, name: "อื่น", code: "X", branchId: BRANCH_A, companyId: CID_B, isActive: true },
  ]

  it("creates with a same-company department on an assigned branch", async () => {
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

  it("rejects a department whose branch is not assigned", async () => {
    const db = fakeDb({ departments })
    const parsed = createPersonnelSchema.parse({
      rosterNo: "012",
      displayName: "แผนกสาขาอื่น",
      branchIds: [BRANCH_A],
      departmentId: DEPT_B,
    })
    await expect(createPersonnel(db, { companyId: CID, roles: adminRoles, input: parsed })).rejects.toBeInstanceOf(
      ValidationError
    )
  })

  it("clears departmentId when assigned branches no longer include the department branch", async () => {
    const db = fakeDb({
      departments,
      people: [personRow({ departmentId: DEPT_A, department: { id: DEPT_A, name: "ผลิต", code: "PRD", branchId: BRANCH_A } })],
    })
    const parsed = updatePersonnelSchema.parse({ branchIds: [BRANCH_B] })
    const result = await updatePersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      id: PERSON_ID,
      input: parsed,
    })
    expect(result.data.departmentId).toBeNull()
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

  it("lists active departments scoped to requested branches", async () => {
    const db = fakeDb({
      departments: [
        ...departments,
        { id: "dddddddd-dddd-dddd-dddd-dddddddddddd", name: "ปิด", code: "OFF", branchId: BRANCH_A, companyId: CID, isActive: false },
      ],
    })
    const listed = await listPersonnelDepartments(db, {
      companyId: CID,
      roles: adminRoles,
      branchIds: [BRANCH_A],
    })
    expect(listed.data.map((d) => d.id)).toEqual([DEPT_A])
  })
})

describe("personnel position", () => {
  const positions: PositionRowFake[] = [
    { id: POS_A, name: "ผู้จัดการฝ่ายผลิต", code: "MGR", branchId: BRANCH_A, companyId: CID, isActive: true },
    { id: POS_B, name: "หัวหน้าคลัง", code: "WH1", branchId: BRANCH_B, companyId: CID, isActive: true },
    { id: POS_INACTIVE, name: "ยกเลิกแล้ว", code: null, branchId: BRANCH_A, companyId: CID, isActive: false },
  ]

  it("creates with a position on an assigned branch", async () => {
    const db = fakeDb({ positions })
    const parsed = createPersonnelSchema.parse({
      rosterNo: "020",
      displayName: "คนมีตำแหน่ง",
      branchIds: [BRANCH_A],
      positionId: POS_A,
    })
    const created = await createPersonnel(db, { companyId: CID, roles: adminRoles, input: parsed })
    expect(created.positionId).toBe(POS_A)
  })

  it("saves every selected position and keeps the first id on the legacy column", async () => {
    const db = fakeDb({ positions })
    const parsed = createPersonnelSchema.parse({
      rosterNo: "024",
      displayName: "สองตำแหน่ง",
      branchIds: [BRANCH_A, BRANCH_B],
      positionIds: [POS_A, POS_B],
    })
    const created = await createPersonnel(db, { companyId: CID, roles: adminRoles, input: parsed })
    expect(created.positionId).toBe(POS_A)
    expect(created.positionAssignments.map((row) => row.positionId)).toEqual([POS_A, POS_B])
  })

  it("drops only the positions of a removed branch", async () => {
    const db = fakeDb({
      positions,
      people: [
        personRow({
          positionId: POS_A,
          positionAssignments: [
            { positionId: POS_A, position: { id: POS_A, name: "ผู้จัดการฝ่ายผลิต", code: "MGR", branchId: BRANCH_A } },
            { positionId: POS_B, position: { id: POS_B, name: "หัวหน้าคลัง", code: "WH1", branchId: BRANCH_B } },
          ],
        }),
      ],
    })
    const result = await updatePersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      id: PERSON_ID,
      input: updatePersonnelSchema.parse({ branchIds: [BRANCH_B] }),
    })
    expect(result.data.positionId).toBe(POS_B)
    expect(result.data.positionAssignments.map((row) => row.positionId)).toEqual([POS_B])
  })

  it("rejects a position whose branch is not assigned", async () => {
    const db = fakeDb({ positions })
    const parsed = createPersonnelSchema.parse({
      rosterNo: "021",
      displayName: "ตำแหน่งสาขาอื่น",
      branchIds: [BRANCH_A],
      positionId: POS_B,
    })
    await expect(
      createPersonnel(db, { companyId: CID, roles: adminRoles, input: parsed })
    ).rejects.toThrow("ตำแหน่งต้องอยู่ในสาขาที่เลือก")
  })

  it("rejects an inactive position", async () => {
    const db = fakeDb({ positions })
    const parsed = createPersonnelSchema.parse({
      rosterNo: "022",
      displayName: "ตำแหน่งปิด",
      branchIds: [BRANCH_A],
      positionId: POS_INACTIVE,
    })
    await expect(
      createPersonnel(db, { companyId: CID, roles: adminRoles, input: parsed })
    ).rejects.toThrow("ตำแหน่งไม่ถูกต้อง")
  })

  it("clears positionId when assigned branches no longer include the position branch", async () => {
    const db = fakeDb({
      positions,
      people: [
        personRow({
          positionId: POS_A,
          position: { id: POS_A, name: "ผู้จัดการฝ่ายผลิต", code: "MGR", branchId: BRANCH_A },
        }),
      ],
    })
    const result = await updatePersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      id: PERSON_ID,
      input: updatePersonnelSchema.parse({ branchIds: [BRANCH_B] }),
    })
    expect(result.data.positionId).toBeNull()
  })

  it("keeps positionId when the branch is still assigned", async () => {
    const db = fakeDb({
      positions,
      people: [
        personRow({
          positionId: POS_A,
          position: { id: POS_A, name: "ผู้จัดการฝ่ายผลิต", code: "MGR", branchId: BRANCH_A },
        }),
      ],
    })
    const result = await updatePersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      id: PERSON_ID,
      input: updatePersonnelSchema.parse({ branchIds: [BRANCH_A, BRANCH_B] }),
    })
    expect(result.data.positionId).toBe(POS_A)
  })

  it("clears positionId when the caller sends an explicit null", async () => {
    const db = fakeDb({
      positions,
      people: [
        personRow({
          positionId: POS_A,
          position: { id: POS_A, name: "ผู้จัดการฝ่ายผลิต", code: "MGR", branchId: BRANCH_A },
        }),
      ],
    })
    const result = await updatePersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      id: PERSON_ID,
      input: updatePersonnelSchema.parse({ positionId: "" }),
    })
    expect(result.data.positionId).toBeNull()
  })

  it("filters the list by positionId", async () => {
    const db = fakeDb({
      positions,
      people: [
        personRow({ positionId: POS_A }),
        personRow({ id: PERSON_OTHER, rosterNo: "002", displayName: "คลัง", positionId: POS_B }),
      ],
    })
    const listed = await listPersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      positionId: POS_A,
      page: 1,
      pageSize: 20,
    })
    expect(listed.data.map((p) => p.id)).toEqual([PERSON_ID])
  })

  it("leaves jobGroup untouched when a position is assigned", async () => {
    const db = fakeDb({ positions })
    const parsed = createPersonnelSchema.parse({
      rosterNo: "023",
      displayName: "คงกลุ่มงาน",
      branchIds: [BRANCH_A],
      jobGroup: "ผลิต",
      positionId: POS_A,
    })
    const created = await createPersonnel(db, { companyId: CID, roles: adminRoles, input: parsed })
    expect(created.jobGroup).toBe("ผลิต")
    expect(created.positionId).toBe(POS_A)
  })
})

describe("รายการที่แต่ละคนดูแล", () => {
  const DUTY_1 = "30000000-0000-0000-0000-000000000001"
  const DUTY_2 = "30000000-0000-0000-0000-000000000002"
  const DUTY_OFF = "30000000-0000-0000-0000-000000000003"
  const dutyItems = [
    { id: DUTY_1, companyId: CID, isActive: true },
    { id: DUTY_2, companyId: CID, isActive: true },
    { id: DUTY_OFF, companyId: CID, isActive: false },
  ]
  const positions: PositionRowFake[] = [
    { id: POS_A, name: "ธุรการ", code: null, branchId: BRANCH_A, companyId: CID, isActive: true },
    { id: POS_B, name: "คลัง", code: null, branchId: BRANCH_B, companyId: CID, isActive: true },
  ]
  const seatA = (over: Partial<PersonRow["positionAssignments"][number]> = {}) => ({
    id: "seat-a",
    positionId: POS_A,
    extraDuties: "ตอบไลน์",
    dutyItems: [{ dutyItemId: DUTY_1 }],
    position: { id: POS_A, name: "ธุรการ", code: null, branchId: BRANCH_A },
    ...over,
  })

  it("สร้างพร้อมรายการของแต่ละที่นั่ง และ seats มาก่อน positionIds", async () => {
    const db = fakeDb({ positions, dutyItems })
    const created = await createPersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      input: createPersonnelSchema.parse({
        rosterNo: "030",
        displayName: "มีรายการ",
        branchIds: [BRANCH_A],
        positionIds: [],
        seats: [{ positionId: POS_A, dutyItemIds: [DUTY_1, DUTY_1], extraDuties: "  ตอบไลน์  " }],
      }),
    })
    expect(created.positionId).toBe(POS_A)
    expect(created.positionAssignments[0]).toMatchObject({
      positionId: POS_A,
      extraDuties: "ตอบไลน์",
      dutyItems: [{ dutyItemId: DUTY_1 }],
    })
  })

  it("สองคนตำแหน่งเดียวกันเก็บรายการแยกกัน", async () => {
    const db = fakeDb({
      positions,
      dutyItems,
      people: [
        personRow({ positionId: POS_A, positionAssignments: [seatA({ id: "seat-1" })] }),
        personRow({
          id: PERSON_OTHER,
          rosterNo: "002",
          positionId: POS_A,
          positionAssignments: [seatA({ id: "seat-2", dutyItems: [{ dutyItemId: DUTY_2 }], extraDuties: null })],
        }),
      ],
    })
    await updatePersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      id: PERSON_ID,
      input: updatePersonnelSchema.parse({ seats: [{ positionId: POS_A, dutyItemIds: [DUTY_1, DUTY_2] }] }),
    })
    const other = await updatePersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      id: PERSON_OTHER,
      input: updatePersonnelSchema.parse({ displayName: "แก้ชื่ออย่างเดียว" }),
    })
    expect(other.data.positionAssignments[0]!.dutyItems).toEqual([{ dutyItemId: DUTY_2 }])
  })

  it("ไม่ส่ง seats แล้วรายการของที่นั่งเดิมไม่หาย", async () => {
    const db = fakeDb({
      positions,
      dutyItems,
      people: [personRow({ positionId: POS_A, positionAssignments: [seatA()] })],
    })
    const result = await updatePersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      id: PERSON_ID,
      input: updatePersonnelSchema.parse({ positionIds: [POS_A] }),
    })
    expect(result.data.positionAssignments[0]).toMatchObject({
      id: "seat-a",
      extraDuties: "ตอบไลน์",
      dutyItems: [{ dutyItemId: DUTY_1 }],
    })
  })

  it("เอาตำแหน่งออกแล้วรายการของที่นั่งนั้นหายไปด้วย", async () => {
    const db = fakeDb({
      positions,
      dutyItems,
      people: [
        personRow({
          positionId: POS_A,
          branchAssignments: [
            { id: "pb-a", branchId: BRANCH_A, isPrimary: true, branch: { id: BRANCH_A, name: "A", code: "A" } },
            { id: "pb-b", branchId: BRANCH_B, isPrimary: false, branch: { id: BRANCH_B, name: "B", code: "B" } },
          ],
          positionAssignments: [
            seatA(),
            {
              id: "seat-b",
              positionId: POS_B,
              dutyItems: [{ dutyItemId: DUTY_2 }],
              position: { id: POS_B, name: "คลัง", code: null, branchId: BRANCH_B },
            },
          ],
        }),
      ],
    })
    const result = await updatePersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      id: PERSON_ID,
      input: updatePersonnelSchema.parse({ seats: [{ positionId: POS_B, dutyItemIds: [DUTY_2] }] }),
    })
    expect(result.data.positionAssignments.map((seat) => seat.positionId)).toEqual([POS_B])
    expect(result.data.positionId).toBe(POS_B)
  })

  it("ข้อที่ปิดแล้วเพิ่มใหม่ไม่ได้ แต่ที่นั่งที่ติ๊กไว้เดิมคงไว้ได้", async () => {
    const db = fakeDb({
      positions,
      dutyItems,
      people: [personRow({ positionId: POS_A, positionAssignments: [seatA({ dutyItems: [{ dutyItemId: DUTY_OFF }] })] })],
    })
    const kept = await updatePersonnel(db, {
      companyId: CID,
      roles: adminRoles,
      id: PERSON_ID,
      input: updatePersonnelSchema.parse({ seats: [{ positionId: POS_A, dutyItemIds: [DUTY_OFF, DUTY_1] }] }),
    })
    expect(kept.data.positionAssignments[0]!.dutyItems).toEqual([{ dutyItemId: DUTY_OFF }, { dutyItemId: DUTY_1 }])

    const fresh = fakeDb({ positions, dutyItems })
    await expect(
      createPersonnel(fresh, {
        companyId: CID,
        roles: adminRoles,
        input: createPersonnelSchema.parse({
          rosterNo: "031",
          displayName: "ข้อปิด",
          branchIds: [BRANCH_A],
          seats: [{ positionId: POS_A, dutyItemIds: [DUTY_OFF] }],
        }),
      })
    ).rejects.toThrow("รายการหน้าที่นี้ถูกปิดใช้งานแล้ว")
  })
})

describe("personnel schemas", () => {
  it("maps empty userId, departmentId and positionId to null", () => {
    expect(updatePersonnelSchema.parse({ userId: "" }).userId).toBeNull()
    expect(createPersonnelSchema.parse({ rosterNo: "1", displayName: "A", userId: "" }).userId).toBeNull()
    expect(updatePersonnelSchema.parse({ departmentId: "" }).departmentId).toBeNull()
    expect(createPersonnelSchema.parse({ rosterNo: "1", displayName: "A", departmentId: "" }).departmentId).toBeNull()
    expect(updatePersonnelSchema.parse({ positionId: "" }).positionId).toBeNull()
    expect(createPersonnelSchema.parse({ rosterNo: "1", displayName: "A", positionId: "" }).positionId).toBeNull()
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
