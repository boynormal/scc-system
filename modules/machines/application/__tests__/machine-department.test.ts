import { describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import { createMachine, updateMachine } from "@/modules/machines/application/machine-service"

const CID = "00000000-0000-0000-0000-0000000000cc"
const BRANCH_A = "11111111-1111-1111-1111-111111111111"
const BRANCH_B = "22222222-2222-2222-2222-222222222222"
const DEPT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const DEPT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const CAT_ID = "99999999-9999-9999-9999-999999999999"
const MACHINE_ID = "33333333-3333-3333-3333-333333333333"
const USER_ID = "44444444-4444-4444-4444-444444444444"

const adminRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Admin", permissions: null },
]

type MachineRow = {
  id: string
  branchId: string
  departmentId: string | null
  categoryId: string
  code: string
  name: string
  deletedAt: Date | null
  companyId: string
}

function fakeDb(state: { machines?: MachineRow[] } = {}) {
  const machines = state.machines ?? [
    {
      id: MACHINE_ID,
      branchId: BRANCH_A,
      departmentId: DEPT_A,
      categoryId: CAT_ID,
      code: "M-001",
      name: "เครื่อง A",
      deletedAt: null,
      companyId: CID,
    },
  ]
  const departments: Record<string, { branchId: string; companyId: string; isActive: boolean }> = {
    [DEPT_A]: { branchId: BRANCH_A, companyId: CID, isActive: true },
    [DEPT_B]: { branchId: BRANCH_B, companyId: CID, isActive: true },
  }

  const api = {
    branch: {
      findFirst: async ({ where }: { where: { id: string; companyId: string } }) =>
        where.companyId === CID && (where.id === BRANCH_A || where.id === BRANCH_B) ? { id: where.id } : null,
    },
    department: {
      findFirst: async ({ where }: { where: { id: string; isActive?: boolean; branch?: { companyId: string } } }) => {
        const row = departments[where.id]
        if (!row) return null
        if (where.isActive === true && !row.isActive) return null
        if (where.branch?.companyId && row.companyId !== where.branch.companyId) return null
        return { id: where.id, branchId: row.branchId }
      },
    },
    machine: {
      findFirst: async ({ where }: { where: { id: string; deletedAt: null } }) =>
        machines.find((m) => m.id === where.id && !m.deletedAt) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: MachineRow = {
          id: `created-${machines.length + 1}`,
          branchId: data.branchId as string,
          departmentId: (data.departmentId as string | null) ?? null,
          categoryId: data.categoryId as string,
          code: data.code as string,
          name: data.name as string,
          deletedAt: null,
          companyId: CID,
        }
        machines.push(row)
        return row
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const idx = machines.findIndex((m) => m.id === where.id)
        if (idx < 0) throw new Error("not found")
        machines[idx] = { ...machines[idx]!, ...data } as MachineRow
        return machines[idx]
      },
    },
  }
  return api as unknown as PrismaClient
}

const createBase = {
  branchId: BRANCH_A,
  categoryId: CAT_ID,
  code: "M-NEW",
  name: "เครื่องใหม่",
  criticalLevel: 1,
}

describe("machine department branch match", () => {
  it("rejects create when department is on another branch", async () => {
    const result = await createMachine(fakeDb({ machines: [] }), {
      companyId: CID,
      userId: USER_ID,
      roles: adminRoles,
      input: { ...createBase, departmentId: DEPT_B },
    })
    expect(result).toMatchObject({
      status: 400,
      error: "Department must belong to the machine branch",
    })
  })

  it("rejects an explicit patch that sets a department from another branch", async () => {
    const result = await updateMachine(fakeDb(), {
      id: MACHINE_ID,
      companyId: CID,
      input: { departmentId: DEPT_B },
    })
    expect(result).toMatchObject({
      status: 400,
      error: "Department must belong to the machine branch",
    })
  })

  it("clears departmentId when the machine branch moves and the old department no longer matches", async () => {
    const result = await updateMachine(fakeDb(), {
      id: MACHINE_ID,
      companyId: CID,
      input: { branchId: BRANCH_B },
    })
    expect(result).toMatchObject({ departmentId: null, branchId: BRANCH_B })
  })
})
