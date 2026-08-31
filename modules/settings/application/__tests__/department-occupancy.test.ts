import { describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { deleteDepartment, updateDepartment } from "@/modules/settings/application/master-data-service"

const CID = "00000000-0000-0000-0000-0000000000cc"
const BRANCH_A = "11111111-1111-1111-1111-111111111111"
const BRANCH_B = "22222222-2222-2222-2222-222222222222"
const DEPT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

function fakeDb(opts: { personnelCount?: number; machineCount?: number } = {}) {
  const personnelCount = opts.personnelCount ?? 0
  const machineCount = opts.machineCount ?? 0
  const api = {
    department: {
      findFirst: async () => ({ id: DEPT_ID, branchId: BRANCH_A, name: "ผลิต" }),
      update: async ({ data }: { data: Record<string, unknown> }) => ({ id: DEPT_ID, ...data }),
      delete: async () => ({ id: DEPT_ID }),
    },
    branch: {
      findFirst: async ({ where }: { where: { id: string } }) =>
        where.id === BRANCH_B || where.id === BRANCH_A ? { id: where.id } : null,
    },
    machine: {
      count: async () => machineCount,
    },
    personnel: {
      count: async () => personnelCount,
    },
  }
  return api as unknown as PrismaClient
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
})
