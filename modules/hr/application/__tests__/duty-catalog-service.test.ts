import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import {
  canEditDutyCatalog,
  canReadDutyCatalog,
  createDutyCategory,
  deleteDutyItem,
  importDutyCatalog,
  updateDutyItem,
} from "@/modules/hr/application/duty-catalog-service"
import { assertDutyItemsAllowed } from "@/modules/hr/application/duty-links"
import { groupDutyItems, parseDutyImport } from "@/modules/hr/application/duty-groups"

const CID = "00000000-0000-0000-0000-0000000000cc"
const BRANCH_A = "11111111-1111-1111-1111-111111111111"

const adminRoles: UserRole[] = [{ branchId: BRANCH_A, branchName: "HQ", roleName: "Admin", permissions: null }]
const managerA: UserRole[] = [{ branchId: BRANCH_A, branchName: "A", roleName: "Manager", permissions: null }]

type Cat = { id: string; companyId: string; name: string; sortOrder: number; isActive: boolean }
type Item = { id: string; categoryId: string; name: string; sortOrder: number; isActive: boolean }

function createDb(seed: { categories?: Cat[]; items?: Item[]; positionLinks?: number; seatLinks?: number } = {}) {
  const categories = [...(seed.categories ?? [])]
  const items = [...(seed.items ?? [])]
  let seq = 0
  const nextId = () => `90000000-0000-0000-0000-${String(++seq).padStart(12, "0")}`
  const db = {
    dutyCategory: {
      findMany: vi.fn(async () =>
        categories.map((c) => ({ ...c, items: items.filter((i) => i.categoryId === c.id).map((i) => ({ ...i })) }))
      ),
      findFirst: vi.fn(async (args: { where: { id?: string; companyId?: string } }) => {
        if (args.where.id) return categories.find((c) => c.id === args.where.id) ?? null
        const sorted = categories.filter((c) => c.companyId === args.where.companyId).sort((a, b) => b.sortOrder - a.sortOrder)
        return sorted[0] ?? null
      }),
      create: vi.fn(async (args: { data: Omit<Cat, "id" | "isActive"> }) => {
        if (categories.some((c) => c.companyId === args.data.companyId && c.name === args.data.name)) {
          throw Object.assign(new Error("unique"), { code: "P2002" })
        }
        const row = { id: nextId(), isActive: true, ...args.data }
        categories.push(row)
        return row
      }),
    },
    dutyItem: {
      findFirst: vi.fn(async (args: { where: { id?: string; categoryId?: string } }) => {
        if (args.where.id) return items.find((i) => i.id === args.where.id) ?? null
        const sorted = items.filter((i) => i.categoryId === args.where.categoryId).sort((a, b) => b.sortOrder - a.sortOrder)
        return sorted[0] ?? null
      }),
      findMany: vi.fn(async (args: { where: { id?: { in: string[] }; categoryId?: string } }) => {
        if (args.where.id) {
          return items
            .filter((i) => args.where.id!.in.includes(i.id))
            .map((i) => ({ ...i, category: { isActive: categories.find((c) => c.id === i.categoryId)?.isActive ?? true } }))
        }
        return items.filter((i) => i.categoryId === args.where.categoryId).sort((a, b) => a.sortOrder - b.sortOrder)
      }),
      create: vi.fn(async (args: { data: Omit<Item, "id" | "isActive"> }) => {
        const row = { id: nextId(), isActive: true, ...args.data }
        items.push(row)
        return row
      }),
      update: vi.fn(async (args: { where: { id: string }; data: Partial<Item> }) => {
        const row = items.find((i) => i.id === args.where.id)!
        Object.assign(row, args.data)
        return row
      }),
      delete: vi.fn(async () => ({})),
    },
    positionDutyItem: { count: vi.fn(async () => seed.positionLinks ?? 0) },
    personnelPositionDutyItem: { count: vi.fn(async () => seed.seatLinks ?? 0) },
    auditLog: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") return (arg as (tx: unknown) => Promise<unknown>)(db)
      return Promise.all(arg as Promise<unknown>[])
    }),
  }
  return { db, categories, items }
}

const asDb = (db: object) => db as unknown as PrismaClient

describe("parseDutyImport", () => {
  it("แถวที่ช่องหมวดว่างใช้หมวดของแถวก่อน", () => {
    const rows = parseDutyImport("ราคา\tอัพเดตราคาในระบบ\n\tอัพเดตราคาจากไลน์\r\nลูกค้า\tรับรองลูกค้า\n\n")
    expect(rows).toEqual([
      { category: "ราคา", item: "อัพเดตราคาในระบบ" },
      { category: "ราคา", item: "อัพเดตราคาจากไลน์" },
      { category: "ลูกค้า", item: "รับรองลูกค้า" },
    ])
  })

  it("แถวแรกคอลัมน์เดียวถือเป็นหมวด แถวคอลัมน์เดียวถัดไปเป็นรายการ", () => {
    expect(parseDutyImport("ราคา\nอัพเดตราคา")).toEqual([
      { category: "ราคา", item: null },
      { category: "ราคา", item: "อัพเดตราคา" },
    ])
  })
})

describe("groupDutyItems", () => {
  it("เรียงตามลำดับหมวดแล้วลำดับรายการ", () => {
    const groups = groupDutyItems([
      { id: "b", name: "B", sortOrder: 20, isActive: true, category: { id: "c1", name: "หมวด1", sortOrder: 10 } },
      { id: "x", name: "X", sortOrder: 10, isActive: true, category: { id: "c2", name: "หมวด2", sortOrder: 5 } },
      { id: "a", name: "A", sortOrder: 10, isActive: false, category: { id: "c1", name: "หมวด1", sortOrder: 10 } },
    ])
    expect(groups.map((g) => g.category)).toEqual(["หมวด2", "หมวด1"])
    expect(groups[1]!.items.map((i) => i.id)).toEqual(["a", "b"])
  })
})

describe("importDutyCatalog", () => {
  const seed = {
    categories: [{ id: "c-price", companyId: CID, name: "ราคา", sortOrder: 10, isActive: true }],
    items: [{ id: "i-1", categoryId: "c-price", name: "อัพเดตราคาในระบบ", sortOrder: 10, isActive: true }],
  }
  const text = "ราคา\tอัพเดตราคาในระบบ\n\tอัพเดตราคาจากไลน์\nลูกค้า\tรับรองลูกค้า\n\tรับรองลูกค้า"

  it("ไม่ยืนยันได้แค่สรุป ไม่เขียนอะไร", async () => {
    const { db } = createDb(seed)
    const result = await importDutyCatalog(asDb(db), { companyId: CID, roles: adminRoles, input: { text } })
    expect(result.data).toMatchObject({
      applied: false,
      newCategories: ["ลูกค้า"],
      newItems: [
        { category: "ราคา", name: "อัพเดตราคาจากไลน์" },
        { category: "ลูกค้า", name: "รับรองลูกค้า" },
      ],
      skipped: 2,
    })
    expect(db.dutyCategory.create).not.toHaveBeenCalled()
    expect(db.dutyItem.create).not.toHaveBeenCalled()
  })

  it("ยืนยันแล้วสร้างเฉพาะที่ยังไม่มี ใต้หมวดที่สืบมา พร้อม audit", async () => {
    const { db, items, categories } = createDb(seed)
    await importDutyCatalog(asDb(db), { companyId: CID, roles: adminRoles, input: { text, confirm: true } })
    const customer = categories.find((c) => c.name === "ลูกค้า")!
    expect(items.filter((i) => i.categoryId === "c-price").map((i) => i.name)).toEqual([
      "อัพเดตราคาในระบบ",
      "อัพเดตราคาจากไลน์",
    ])
    expect(items.filter((i) => i.categoryId === customer.id).map((i) => i.name)).toEqual(["รับรองลูกค้า"])
    expect(items.find((i) => i.name === "อัพเดตราคาจากไลน์")!.sortOrder).toBe(20)
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ newValues: expect.objectContaining({ event: "DUTY_IMPORT" }) }) })
    )
  })

  it("นำเข้าซ้ำไม่สร้างซ้ำ", async () => {
    const { db, items } = createDb(seed)
    await importDutyCatalog(asDb(db), { companyId: CID, roles: adminRoles, input: { text, confirm: true } })
    const count = items.length
    const again = await importDutyCatalog(asDb(db), { companyId: CID, roles: adminRoles, input: { text, confirm: true } })
    expect(items.length).toBe(count)
    expect(again.data.newItems).toEqual([])
  })
})

describe("สิทธิ์สมุดหน้าที่", () => {
  it("ผู้จัดการสาขาอ่านได้ แต่แก้ไม่ได้", async () => {
    expect(canReadDutyCatalog(managerA)).toBe(true)
    expect(canEditDutyCatalog(managerA)).toBe(false)
    expect(canEditDutyCatalog(adminRoles)).toBe(true)
    const { db } = createDb()
    await expect(
      createDutyCategory(asDb(db), { companyId: CID, roles: managerA, input: { name: "ราคา" } })
    ).rejects.toBeInstanceOf(ForbiddenError)
    await expect(
      importDutyCatalog(asDb(db), { companyId: CID, roles: managerA, input: { text: "a\tb" } })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("ชื่อหมวดซ้ำแจ้งเป็นภาษาไทย", async () => {
    const { db } = createDb({ categories: [{ id: "c1", companyId: CID, name: "ราคา", sortOrder: 10, isActive: true }] })
    await expect(
      createDutyCategory(asDb(db), { companyId: CID, roles: adminRoles, input: { name: "ราคา" } })
    ).rejects.toThrow("มีหมวดชื่อนี้แล้ว")
  })
})

describe("รายการที่มีคนใช้", () => {
  const seed = {
    categories: [{ id: "c1", companyId: CID, name: "ราคา", sortOrder: 10, isActive: true }],
    items: [
      { id: "i-1", categoryId: "c1", name: "A", sortOrder: 10, isActive: true },
      { id: "i-2", categoryId: "c1", name: "B", sortOrder: 10, isActive: true },
    ],
  }

  it("ลบไม่ได้เมื่อยังถูกติ๊กอยู่ ให้ปิดใช้งานแทน", async () => {
    const { db } = createDb({ ...seed, seatLinks: 1 })
    await expect(
      deleteDutyItem(asDb(db), { companyId: CID, roles: adminRoles, id: "i-1" })
    ).rejects.toBeInstanceOf(ValidationError)
    expect(db.dutyItem.delete).not.toHaveBeenCalled()
  })

  it("เลื่อนลำดับจัดเลขใหม่แม้ลำดับเดิมซ้ำกัน", async () => {
    const { db, items } = createDb(seed)
    await updateDutyItem(asDb(db), { companyId: CID, roles: adminRoles, id: "i-2", input: { move: "up" } })
    expect(items.find((i) => i.id === "i-2")!.sortOrder).toBe(10)
    expect(items.find((i) => i.id === "i-1")!.sortOrder).toBe(20)
  })
})

describe("assertDutyItemsAllowed", () => {
  const seed = {
    categories: [{ id: "c1", companyId: CID, name: "ราคา", sortOrder: 10, isActive: true }],
    items: [
      { id: "on", categoryId: "c1", name: "A", sortOrder: 10, isActive: true },
      { id: "off", categoryId: "c1", name: "B", sortOrder: 20, isActive: false },
    ],
  }

  it("ข้อที่ปิดแล้วเพิ่มใหม่ไม่ได้ แต่คงไว้ได้ถ้าเดิมติ๊กอยู่", async () => {
    const { db } = createDb(seed)
    await expect(
      assertDutyItemsAllowed(asDb(db), { companyId: CID, dutyItemIds: ["on", "off"], alreadyLinked: [] })
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      assertDutyItemsAllowed(asDb(db), { companyId: CID, dutyItemIds: ["on", "off", "on"], alreadyLinked: ["off"] })
    ).resolves.toEqual(["on", "off"])
  })

  it("ข้อที่ไม่อยู่ในบริษัทถูกปฏิเสธ", async () => {
    const { db } = createDb(seed)
    await expect(
      assertDutyItemsAllowed(asDb(db), { companyId: CID, dutyItemIds: ["missing"], alreadyLinked: [] })
    ).rejects.toThrow("รายการหน้าที่ไม่ถูกต้อง")
  })
})
