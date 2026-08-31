import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import {
  updatePaidExpenseMetadata,
  _bangkokYearMonthForTests as bangkokYearMonth,
} from "@/modules/finance/application/expense-service"
import { ValidationError } from "@/lib/errors"

const COMPANY = "11111111-1111-1111-1111-111111111111"
const BRANCH = "22222222-2222-2222-2222-222222222222"
const USER = "33333333-3333-3333-3333-333333333333"
const EXPENSE = "44444444-4444-4444-4444-444444444444"
const LINE = "55555555-5555-5555-5555-555555555555"
const TYPE_A = "66666666-6666-6666-6666-666666666666"
const TYPE_B = "77777777-7777-7777-7777-777777777777"
const UNIT = "88888888-8888-8888-8888-888888888888"
const CC = "99999999-9999-9999-9999-999999999999"

const adminRoles: UserRole[] = [
  { branchId: BRANCH, branchName: "HQ", roleName: "Admin", permissions: null },
]

const clerkRoles: UserRole[] = [
  {
    branchId: BRANCH,
    branchName: "HQ",
    roleName: "Clerk",
    permissions: { expenses: ["read", "update"] },
  },
]

const existingLine = {
  id: LINE,
  lineNo: 1,
  expenseTypeId: TYPE_A,
  description: "เดิม",
  pricingMode: "QTY_PRICE" as const,
  quantity: 2,
  unitId: UNIT,
  unitCode: "HOUR",
  unitPrice: 100,
  amount: 200,
  taxAmount: 0,
  discountAmount: 0,
  costCenterId: null,
  processId: null,
  costObjectType: null,
  costObjectId: null,
  costObjectLabel: null,
  sourceKind: "MANUAL" as const,
  sourceModule: null,
  sourceType: null,
  sourceDocumentId: null,
  sourceLineId: null,
}

function paidExpense(over: Record<string, unknown> = {}) {
  return {
    id: EXPENSE,
    companyId: COMPANY,
    branchId: BRANCH,
    status: "PAID",
    vendorId: null,
    employeeId: null,
    notes: null,
    expenseDate: new Date("2026-08-15T00:00:00.000Z"),
    postingDate: new Date("2026-08-15T00:00:00.000Z"),
    paymentMethod: null,
    lines: [existingLine],
    ...over,
  }
}

function createMockDb(expense = paidExpense()) {
  const updated = {
    ...expense,
    branch: { id: BRANCH, name: "HQ" },
    vendor: null,
    employee: null,
    approvedBy: null,
    paidBy: null,
    creator: { id: USER, firstName: "A", lastName: "B" },
    attachments: [],
    lines: [
      {
        ...existingLine,
        expenseType: { id: TYPE_B, name: "แรงงาน", transactionType: "EXPENSE" },
        costCenter: null,
        process: null,
        unit: { id: UNIT, code: "PERSON", name: "คน" },
      },
    ],
    expenseNo: "EXP-2026-00020",
    expenseTypeId: TYPE_B,
    sourceModule: null,
    sourceType: null,
    sourceId: null,
    amount: 200,
    taxAmount: 0,
    discountAmount: 0,
    netAmount: 200,
    currency: "THB",
    paidAt: new Date(),
    paidById: USER,
    approvedById: USER,
    approvedAt: new Date(),
    createdById: USER,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  return {
    expense: {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(expense)
        .mockResolvedValueOnce(updated),
      update: vi.fn().mockResolvedValue(updated),
    },
    expenseLine: { update: vi.fn().mockResolvedValue({}) },
    expenseType: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: TYPE_B,
          requiresVendor: false,
          requiresVehicle: false,
          requiresMachine: false,
          requiresLocation: false,
          requiresCostCenter: false,
          requiresProcess: false,
          costCenterMaps: [],
          processMaps: [],
        },
      ]),
    },
    unit: { findMany: vi.fn().mockResolvedValue([{ id: UNIT, code: "PERSON" }]) },
    costCenter: { findMany: vi.fn().mockResolvedValue([{ id: CC }]) },
    process: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      expenseLine: { update: vi.fn().mockResolvedValue({}) },
      expense: { update: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    })),
  }
}

function asDb(db: ReturnType<typeof createMockDb>): PrismaClient {
  return db as unknown as PrismaClient
}

const classifyInput = {
  vendorId: null,
  employeeId: null,
  notes: "ลืมคีย์หมวด",
  expenseDate: "2026-08-20",
  reason: "แก้หมวดค่าใช้จ่ายให้ถูกต้อง",
  lines: [
    {
      id: LINE,
      expenseTypeId: TYPE_B,
      description: "ค่าแรง",
      pricingMode: "QTY_PRICE" as const,
      quantity: 2,
      unitId: UNIT,
      unitPrice: 100,
      amount: 200,
      taxAmount: 0,
      discountAmount: 0,
      costCenterId: null,
      processId: null,
    },
  ],
}

describe("bangkokYearMonth", () => {
  it("reads YYYY-MM from a date-only string", () => {
    expect(bangkokYearMonth("2026-08-15")).toBe("2026-08")
  })
})

describe("updatePaidExpenseMetadata", () => {
  it("updates classification fields on a PAID bill and writes audit", async () => {
    const auditCreate = vi.fn().mockResolvedValue({})
    const db = createMockDb()
    db.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        expenseLine: { update: vi.fn().mockResolvedValue({}) },
        expense: { update: vi.fn().mockResolvedValue({}) },
        auditLog: { create: auditCreate },
      })
    )
    const result = await updatePaidExpenseMetadata(asDb(db), {
      companyId: COMPANY,
      roles: adminRoles,
      userId: USER,
      id: EXPENSE,
      input: classifyInput,
    })
    expect(result.data.id).toBe(EXPENSE)
    expect(auditCreate).toHaveBeenCalled()
    const payload = auditCreate.mock.calls[0][0].data
    expect(payload.newValues).toMatchObject({
      event: "EXPENSE_PAID_METADATA_UPDATE",
      reason: "แก้หมวดค่าใช้จ่ายให้ถูกต้อง",
      branchId: BRANCH,
    })
  })

  it("requires a reason on PAID metadata edits", async () => {
    const db = createMockDb()
    await expect(
      updatePaidExpenseMetadata(asDb(db), {
        companyId: COMPANY,
        roles: adminRoles,
        userId: USER,
        id: EXPENSE,
        input: { notes: "ไม่มีเหตุผล" },
      })
    ).rejects.toThrow(/เหตุผล/)
  })

  it("rejects amount changes on PAID", async () => {
    const db = createMockDb()
    await expect(
      updatePaidExpenseMetadata(asDb(db), {
        companyId: COMPANY,
        roles: adminRoles,
        userId: USER,
        id: EXPENSE,
        input: {
          reason: "แก้ยอดไม่ได้",
          lines: [{ ...classifyInput.lines[0], amount: 999 }],
        },
      })
    ).rejects.toThrow(ValidationError)
  })

  it("rejects adding a line on PAID", async () => {
    const db = createMockDb()
    await expect(
      updatePaidExpenseMetadata(asDb(db), {
        companyId: COMPANY,
        roles: adminRoles,
        userId: USER,
        id: EXPENSE,
        input: {
          reason: "ห้ามเพิ่มบรรทัด",
          lines: [
            classifyInput.lines[0],
            { ...classifyInput.lines[0], id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
          ],
        },
      })
    ).rejects.toThrow(/เพิ่มหรือลบ/)
  })

  it("rejects crossing month without approve permission", async () => {
    const db = createMockDb()
    await expect(
      updatePaidExpenseMetadata(asDb(db), {
        companyId: COMPANY,
        roles: clerkRoles,
        userId: USER,
        id: EXPENSE,
        input: { expenseDate: "2026-09-01", notes: "ข้ามเดือน", reason: "ข้ามเดือน" },
      })
    ).rejects.toThrow(/ข้ามเดือน/)
  })
})
