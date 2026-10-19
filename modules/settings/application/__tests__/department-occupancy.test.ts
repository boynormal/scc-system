import { describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { createDepartment, deleteDepartment } from "@/modules/settings/application/master-data-service"

const CID = "00000000-0000-0000-0000-0000000000cc"
const DEPT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

function fakeDb(opts: { personnelCount?: number; machineCount?: number } = {}) {
  const personnelCount = opts.personnelCount ?? 0
  const machineCount = opts.machineCount ?? 0
  const created: unknown[] = []
  const api = {
    department: {
      findFirst: async ({ where }: { where: { id: string; companyId?: string } }) => {
        if (where.companyId && where.companyId !== CID) return null
        if (where.id !== DEPT_ID) return null
        return { id: DEPT_ID, companyId: CID, name: "ผลิต" }
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data)
        return { id: "new-dept", ...data }
      },
      delete: async () => ({ id: DEPT_ID }),
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
  it("blocks delete when personnel still occupy the department", async () => {
    const result = await deleteDepartment(fakeDb({ personnelCount: 1, machineCount: 0 }), {
      id: DEPT_ID,
      companyId: CID,
    })
    expect(result).toMatchObject({
      status: 400,
      error: { message: "Cannot delete department because 1 personnel still use it" },
    })
  })

  it("allows delete when no machines or personnel point at it", async () => {
    const result = await deleteDepartment(fakeDb({ personnelCount: 0, machineCount: 0 }), {
      id: DEPT_ID,
      companyId: CID,
    })
    expect(result).toEqual({ success: true })
  })

  it("creates a department for the company without a branch", async () => {
    const result = await createDepartment(fakeDb(), {
      companyId: CID,
      input: { name: "บุคลากรโรงกระดาษ", code: "PPL" },
    })
    expect(result).toMatchObject({
      data: { name: "บุคลากรโรงกระดาษ", code: "PPL", companyId: CID, isActive: true },
    })
  })
})
