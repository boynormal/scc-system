import { describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { createJobGroup, deleteJobGroup } from "@/modules/settings/application/master-data-service"

const CID = "00000000-0000-0000-0000-0000000000cc"
const GROUP_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

function fakeDb(opts: { personnelCount?: number; duplicate?: boolean } = {}) {
  const deleted: string[] = []
  const counted: unknown[] = []
  const api = {
    jobGroup: {
      findFirst: async ({ where }: { where: { id: string; companyId?: string } }) => {
        if (where.companyId && where.companyId !== CID) return null
        if (where.id !== GROUP_ID) return null
        return { id: GROUP_ID, companyId: CID, name: "แพ็ค" }
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (opts.duplicate) throw Object.assign(new Error("dup"), { code: "P2002" })
        return { id: "new-group", ...data }
      },
      delete: async ({ where }: { where: { id: string } }) => {
        deleted.push(where.id)
        return { id: where.id }
      },
    },
    personnel: {
      count: async (args: unknown) => {
        counted.push(args)
        return opts.personnelCount ?? 0
      },
    },
    deleted,
    counted,
  }
  return api as unknown as PrismaClient & { deleted: string[]; counted: unknown[] }
}

describe("job group master", () => {
  it("blocks delete while personnel still use the group", async () => {
    const db = fakeDb({ personnelCount: 2 })
    const result = await deleteJobGroup(db, { id: GROUP_ID, companyId: CID })
    expect(result).toMatchObject({ status: 400 })
    expect(db.counted).toEqual([{ where: { jobGroupId: GROUP_ID } }])
    expect(db.deleted).toEqual([])
  })

  it("deletes an unused group", async () => {
    const db = fakeDb()
    expect(await deleteJobGroup(db, { id: GROUP_ID, companyId: CID })).toEqual({ success: true })
    expect(db.deleted).toEqual([GROUP_ID])
  })

  it("returns 404 for a group from another company", async () => {
    const result = await deleteJobGroup(fakeDb(), { id: GROUP_ID, companyId: "other" })
    expect(result).toMatchObject({ status: 404 })
  })

  it("creates a group for the company and reports a duplicate name as 409", async () => {
    expect(await createJobGroup(fakeDb(), { companyId: CID, input: { name: "แพ็ค", code: "PK" } })).toMatchObject({
      data: { companyId: CID, name: "แพ็ค", code: "PK", isActive: true },
    })
    expect(await createJobGroup(fakeDb({ duplicate: true }), { companyId: CID, input: { name: "แพ็ค" } })).toMatchObject({
      status: 409,
    })
  })
})
