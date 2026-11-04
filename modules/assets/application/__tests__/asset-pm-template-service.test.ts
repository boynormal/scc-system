import { describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import {
  createAssetPmTemplate,
  deleteAssetPmTemplate,
  listAssetPmTemplates,
  updateAssetPmTemplate,
} from "@/modules/assets/application/asset-pm-template-service"

const CID = "00000000-0000-0000-0000-0000000000cc"
const CID_B = "00000000-0000-0000-0000-0000000000bb"
const BRANCH_A = "11111111-1111-1111-1111-111111111111"

const adminRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Admin", permissions: null },
]
const viewerRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Viewer", permissions: null },
]

type Item = {
  id: string
  templateId: string
  sequence: number
  name: string
  detail: string | null
  audioBytes?: Buffer | null
  audioContentType?: string | null
}
type Template = { id: string; companyId: string; name: string; isActive: boolean; items: Item[] }

function fakeDb(templates: Template[] = []) {
  let seq = 0
  const nextId = () => `99999999-9999-4999-8999-${String(++seq).padStart(12, "0")}`
  const db = {
    assetPmTemplate: {
      findMany: async ({ where }: { where: { companyId: string; isActive?: boolean } }) =>
        templates
          .filter((row) => row.companyId === where.companyId && (where.isActive === undefined || row.isActive === where.isActive))
          .map((row) => ({ ...row, items: [...row.items].sort((a, b) => a.sequence - b.sequence) })),
      findFirst: async ({
        where,
      }: {
        where: { id?: string; companyId: string; name?: string; NOT?: { id: string } }
      }) =>
        templates.find((row) => {
          if (row.companyId !== where.companyId) return false
          if (where.id && row.id !== where.id) return false
          if (where.name && row.name !== where.name) return false
          if (where.NOT && row.id === where.NOT.id) return false
          return true
        }) ?? null,
      create: async ({
        data,
      }: {
        data: { companyId: string; name: string; items: { create: { sequence: number; name: string; detail: string | null }[] } }
      }) => {
        const id = nextId()
        const row: Template = {
          id,
          companyId: data.companyId,
          name: data.name,
          isActive: true,
          items: data.items.create.map((item) => ({ id: nextId(), templateId: id, ...item })),
        }
        templates.push(row)
        return row
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string }
        data: {
          name?: string
          isActive?: boolean
          items?: { create: { sequence: number; name: string; detail: string | null }[] }
        }
      }) => {
        const row = templates.find((template) => template.id === where.id)
        if (!row) throw new Error("missing template")
        if (data.name !== undefined) row.name = data.name
        if (data.isActive !== undefined) row.isActive = data.isActive
        if (data.items?.create) {
          row.items = data.items.create.map((item) => ({ id: nextId(), templateId: row.id, ...item }))
        }
        return row
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const index = templates.findIndex((row) => row.id === where.id)
        if (index < 0) throw new Error("missing template")
        const [removed] = templates.splice(index, 1)
        return removed
      },
    },
    assetPmTemplateItem: {
      findMany: async ({ where }: { where: { templateId: string; id: { in: string[] } } }) =>
        templates.flatMap((template) =>
          template.id === where.templateId ? template.items.filter((item) => where.id.in.includes(item.id)) : []
        ),
      deleteMany: async ({ where }: { where: { templateId: string } }) => {
        const row = templates.find((template) => template.id === where.templateId)
        const count = row?.items.length ?? 0
        if (row) row.items = []
        return { count }
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  }
  return db as unknown as PrismaClient
}

const vehicleItems = [
  { name: "ยางรถยนต์", detail: "สภาพยาง ลมยาง และความเสียหาย" },
  { name: "น้ำมันเครื่อง", detail: "ระดับน้ำมันเครื่อง" },
]

describe("asset PM templates", () => {
  it("hides another company's templates and rejects a duplicate name", async () => {
    const db = fakeDb()
    await expect(
      createAssetPmTemplate(db, { companyId: CID, roles: viewerRoles, input: { name: "ตรวจรถ", items: vehicleItems } })
    ).rejects.toBeInstanceOf(ForbiddenError)

    const created = await createAssetPmTemplate(db, {
      companyId: CID,
      roles: adminRoles,
      input: { name: "ตรวจรถ", items: vehicleItems },
    })
    expect(created.data.items.map((item) => item.name)).toEqual(["ยางรถยนต์", "น้ำมันเครื่อง"])
    expect(created.data.items[0]?.detail).toBe("สภาพยาง ลมยาง และความเสียหาย")

    const other = await listAssetPmTemplates(db, { companyId: CID_B, roles: adminRoles })
    expect(other.data).toEqual([])
    await expect(
      updateAssetPmTemplate(db, {
        companyId: CID_B,
        roles: adminRoles,
        id: created.data.id,
        input: { name: "แก้" },
      })
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      deleteAssetPmTemplate(db, { companyId: CID_B, roles: adminRoles, id: created.data.id })
    ).rejects.toBeInstanceOf(NotFoundError)

    await expect(
      createAssetPmTemplate(db, { companyId: CID, roles: adminRoles, input: { name: "ตรวจรถ", items: vehicleItems } })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("omits an inactive template from the active list used by the plan form", async () => {
    const db = fakeDb()
    const created = await createAssetPmTemplate(db, {
      companyId: CID,
      roles: adminRoles,
      input: { name: "ตรวจรถ", items: vehicleItems },
    })
    await updateAssetPmTemplate(db, {
      companyId: CID,
      roles: adminRoles,
      id: created.data.id,
      input: { isActive: false },
    })
    const active = await listAssetPmTemplates(db, { companyId: CID, roles: viewerRoles, activeOnly: true })
    expect(active.data).toEqual([])
    const all = await listAssetPmTemplates(db, { companyId: CID, roles: viewerRoles })
    expect(all.data.map((row) => row.isActive)).toEqual([false])
  })

  it("stores audio without returning the bytes and keeps it when the item is edited", async () => {
    const db = fakeDb()
    const clip = Buffer.from("thai-clip")
    const created = await createAssetPmTemplate(db, {
      companyId: CID,
      roles: adminRoles,
      input: {
        name: "เสียง",
        items: [
          {
            name: "ยางรถยนต์",
            detail: "สภาพยาง",
            audioBase64: clip.toString("base64"),
            audioContentType: "audio/webm",
          },
        ],
      },
    })
    expect(created.data.items[0]?.hasAudio).toBe(true)
    expect(JSON.stringify(created.data)).not.toContain(clip.toString("base64"))
    const sourceId = created.data.items[0]?.id
    const updated = await updateAssetPmTemplate(db, {
      companyId: CID,
      roles: adminRoles,
      id: created.data.id,
      input: { items: [{ name: "ยางรถยนต์", detail: "สภาพยาง", sourceItemId: sourceId }] },
    })
    expect(updated.data.items[0]?.hasAudio).toBe(true)
    expect(updated.data.items[0]?.id).not.toBe(sourceId)
  })
})
