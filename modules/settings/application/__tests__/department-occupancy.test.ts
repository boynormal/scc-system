import { describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import {
  createDepartment,
  deleteDepartment,
  updateDepartment,
} from "@/modules/settings/application/master-data-service"

const CID = "00000000-0000-0000-0000-0000000000cc"
const BRANCH_A = "11111111-1111-1111-1111-111111111111"
const BRANCH_B = "22222222-2222-2222-2222-222222222222"
const INACTIVE_HQ = "33333333-3333-3333-3333-333333333333"
const DEPT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

function fakeDb(opts: { personnelCount?: number; machineCount?: number } = {}) {
  const personnelCount = opts.personnelCount ?? 0
  const machineCount = opts.machineCount ?? 0
  const created: unknown[] = []
  const branches: Record<string, { id: string; isActive: boolean }> = {
    [BRANCH_A]: { id: BRANCH_A, isActive: true },
    [BRANCH_B]: { id: BRANCH_B, isActive: true },
    [INACTIVE_HQ]: { id: INACTIVE_HQ, isActive: false },
  }
  const api = {
    department: {
      findFirst: async () => ({ id: DEPT_ID, branchId: BRANCH_A, name: "ผลิต" }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data)
        return { id: "new-dept", ...data }
      },
      update: async ({ data }: { data: Record<string, unknown> }) => ({ id: DEPT_ID, ...data }),
      delete: async () => ({ id: DEPT_ID }),
    },
    branch: {
      findFirst: async ({
        where,
      }: {
        where: { id: string; deletedAt?: null; isActive?: boolean }
      }) => {
        const row = branches[where.id]
        if (!row) return null
        if (where.isActive === true && !row.isActive) return null
        return { id: row.id }
      },
    },
    machine: {
      count: async () => machineCount,
    },
    personnel: {
      count: async () => personnelCount,
    },
    created,
  }
  return api as unknown as PrismaClient & { created: unknown[] }
}

describe("department occupancy guards", () => {
  it("blocks delete when soft-deleted personnel still occupy the department", async () => {
    const result = await deleteDepartment(fakeDb({ personnelCount: 1, machineCount: 0 }), {
      id: DEPT_ID,
      companyId: CID,
    })
    expect(result).toMatchObject({
      status: 400,
      error: { message: "Cannot delete department because 1 personnel still use it" },
    })
  })

  it("blocks moving a department while personnel still point at it", async () => {
    const result = await updateDepartment(fakeDb({ personnelCount: 2 }), {
      id: DEPT_ID,
      companyId: CID,
      input: { branchId: BRANCH_B },
    })
    expect(result).toMatchObject({
      status: 400,
      error: { message: "Cannot move department while machines or personnel still use it" },
    })
  })

  it("allows delete when no machines or personnel point at it", async () => {
    const result = await deleteDepartment(fakeDb({ personnelCount: 0, machineCount: 0 }), {
      id: DEPT_ID,
      companyId: CID,
    })
    expect(result).toEqual({ success: true })
  })

  it("rejects creating a department on an inactive branch", async () => {
    const db = fakeDb()
    const result = await createDepartment(db, {
      companyId: CID,
      input: { name: "บุคลากรโรงกระดาษ", code: "PPL", branchId: INACTIVE_HQ },
    })
    expect(result).toEqual({ error: "Invalid branch", status: 400 })
  })

  it("creates a department on an active branch", async () => {
    const result = await createDepartment(fakeDb(), {
      companyId: CID,
      input: { name: "บุคลากรโรงกระดาษ", code: "PPL", branchId: BRANCH_A },
    })
    expect(result).toMatchObject({
      data: { name: "บุคลากรโรงกระดาษ", code: "PPL", branchId: BRANCH_A, isActive: true },
    })
  })

  it("rejects moving a department onto an inactive branch", async () => {
    const result = await updateDepartment(fakeDb(), {
      id: DEPT_ID,
      companyId: CID,
      input: { branchId: INACTIVE_HQ },
    })
    expect(result).toEqual({ error: "Invalid branch", status: 400 })
  })
})
