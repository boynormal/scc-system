import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import * as XLSX from "xlsx"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { importAttendanceFromXls } from "@/modules/hr/application/attendance-service"

const CID = "00000000-0000-0000-0000-0000000000cc"
const BRANCH_A = "11111111-1111-1111-1111-111111111111"
const USER_ID = "44444444-4444-4444-4444-444444444444"

const adminRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "PAD", roleName: "Admin", permissions: null },
]

function xlsxBuffer(rows: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" })) as Buffer
}

function fakeImportDb() {
  const upserts: Array<{ where: unknown; create: unknown; update: unknown }> = []
  const tx = {
    attendanceImportBatch: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "batch-1",
        rowCount: data.rowCount,
        ...data,
      })),
    },
    personnel: {
      upsert: vi.fn(async (args: { where: unknown; create: unknown; update: unknown }) => {
        upserts.push(args)
        return { id: "person-1" }
      }),
    },
    personnelBranch: {
      findUnique: vi.fn(async () => ({ isPrimary: true })),
      count: vi.fn(async () => 1),
      create: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    attendanceEntry: {
      upsert: vi.fn(async () => ({ id: "entry-1" })),
    },
  }
  const db = {
    branch: {
      findFirst: vi.fn(async () => ({ id: BRANCH_A, companyId: CID, isActive: true })),
    },
    $transaction: vi.fn(async (fn: (inner: typeof tx) => Promise<unknown>) => fn(tx)),
  }
  return { db: db as unknown as PrismaClient, tx, upserts }
}

async function importFile(file: Blob | null, fileName = "upload.xlsx") {
  const { db, tx, upserts } = fakeImportDb()
  const result = await importAttendanceFromXls(db, {
    companyId: CID,
    roles: adminRoles,
    userId: USER_ID,
    branchId: BRANCH_A,
    file,
    fileName,
  })
  return { result, db, tx, upserts }
}

describe("importAttendanceFromXls empty/invalid parse", () => {
  it("rejects an empty file with ValidationError (HTTP 400)", async () => {
    await expect(importFile(new Blob([]), "empty.xlsx")).rejects.toMatchObject({
      name: "ValidationError",
      status: 400,
      message: "ไฟล์ว่าง",
    })
    await expect(importFile(new Blob([]))).rejects.toBeInstanceOf(ValidationError)
  })

  it("rejects garbage bytes that parse to zero dated rows", async () => {
    await expect(importFile(new Blob([Buffer.from("not-an-xlsx")]), "garbage.xls")).rejects.toMatchObject({
      name: "ValidationError",
      status: 400,
      message: "อ่านไฟล์ไม่ได้ หรือไม่มีแถววันที่ที่อ่านได้",
    })
  })

  it("rejects a header-only workbook", async () => {
    const buf = xlsxBuffer([["ลำดับ", "", "ชื่อ", "กลุ่มงาน", "วันที่", "เข้า"]])
    await expect(importFile(new Blob([buf]), "header-only.xlsx")).rejects.toMatchObject({
      name: "ValidationError",
      status: 400,
      message: "อ่านไฟล์ไม่ได้ หรือไม่มีแถววันที่ที่อ่านได้",
    })
  })

  it("accepts a valid dated row, merges punches, and does not write departmentId or userId", async () => {
    const buf = xlsxBuffer([
      ["ลำดับ", "", "ชื่อ", "กลุ่มงาน", "วันที่", "เข้า", "ออก"],
      ["999", "", "ทดสอบ", "A", "01-04-2026", "08:00", "17:00"],
      ["999", "", "ทดสอบ", "A", "01-04-2026", "12:00"],
    ])
    const { result, upserts, tx } = await importFile(new Blob([buf]), "valid.xlsx")

    expect(result.attendanceEntries).toBe(1)
    expect(result.personnelTouched).toBe(1)
    expect(upserts).toHaveLength(1)
    expect(upserts[0]?.update).toEqual({
      displayName: "ทดสอบ",
      jobGroup: "A",
    })
    expect(upserts[0]?.update).not.toHaveProperty("departmentId")
    expect(upserts[0]?.update).not.toHaveProperty("userId")
    expect(tx.attendanceEntry.upsert).toHaveBeenCalledTimes(1)
    const entryCalls = tx.attendanceEntry.upsert.mock.calls as unknown as Array<
      [{ update: { punchTimes: string[] } }]
    >
    expect(entryCalls[0]?.[0].update.punchTimes).toEqual(["08:00", "17:00", "12:00"])
  })
})
