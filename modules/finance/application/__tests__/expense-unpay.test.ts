import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import {
  unpayExpense,
  unpayExpenseSchema,
} from "@/modules/finance/application/expense-service"

const COMPANY = "11111111-1111-1111-1111-111111111111"
const BRANCH_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const BRANCH_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const BRANCH_D = "dddddddd-dddd-dddd-dddd-dddddddddddd"
const EXPENSE = "44444444-4444-4444-4444-444444444444"
const USER = "33333333-3333-3333-3333-333333333333"
const PAYER = "55555555-5555-5555-5555-555555555555"
const LINE = "66666666-6666-6666-6666-666666666666"
const TYPE = "77777777-7777-7777-7777-777777777777"
const UNIT = "88888888-8888-8888-8888-888888888888"

const PAID_AT = new Date("2026-08-20T10:00:00.000Z")
const APPROVED_AT = new Date("2026-08-18T09:00:00.000Z")
const EXPENSE_DATE = new Date("2026-08-15T00:00:00.000Z")

const managerOnAViewerOnB: UserRole[] = [
  {
    branchId: BRANCH_A,
    branchName: "A",
    roleName: "Manager",
    permissions: { expenses: ["create", "read", "update", "approve"] },
  },
  {
    branchId: BRANCH_B,
    branchName: "B",
    roleName: "Viewer",
    permissions: { expenses: ["read"] },
  },
]

const updateOnlyRoles: UserRole[] = [
  {
    branchId: BRANCH_A,
    branchName: "A",
    roleName: "Clerk",
    permissions: { expenses: ["read", "update"] },
  },
]

const viewerRoles: UserRole[] = [
  {
    branchId: BRANCH_A,
    branchName: "A",
    roleName: "Viewer",
    permissions: { expenses: ["read"] },
  },
]

const adminRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Admin", permissions: null },
]

function asDb(db: object): PrismaClient {
  return db as unknown as PrismaClient
}

function paidExisting(over: { branchId?: string; status?: string } = {}) {
  return {
    id: EXPENSE,
    status: over.status ?? "PAID",
    branchId: over.branchId ?? BRANCH_A,
    paidAt: PAID_AT,
    paidById: PAYER,
    paymentMethod: "TRANSFER",
  }
}

function includedRow(over: {
  branchId?: string
  status?: string
  paidAt?: Date | null
  paidById?: string | null
} = {}) {
  const branchId = over.branchId ?? BRANCH_A
  return {
    id: EXPENSE,
    companyId: COMPANY,
    branchId,
    expenseNo: "EXP-2026-00042",
    expenseDate: EXPENSE_DATE,
    postingDate: EXPENSE_DATE,
    expenseTypeId: TYPE,
    sourceModule: null,
    sourceType: null,
    sourceId: null,
    vendorId: null,
    employeeId: null,
    amount: 200,
    taxAmount: 14,
    discountAmount: 5,
    netAmount: 209,
    currency: "THB",
    notes: null,
    status: over.status ?? "APPROVED",
    paymentMethod: "TRANSFER",
    paidAt: over.paidAt === undefined ? null : over.paidAt,
    paidById: over.paidById === undefined ? null : over.paidById,
    approvedById: USER,
    approvedAt: APPROVED_AT,
    createdById: USER,
    createdAt: new Date("2026-08-15T08:00:00.000Z"),
    updatedAt: new Date("2026-08-31T08:00:00.000Z"),
    branch: { id: branchId, name: branchId === BRANCH_B ? "B" : "A" },
    vendor: null,
    employee: null,
    approvedBy: { id: USER, firstName: "Approver", lastName: "One" },
    paidBy: null,
    creator: { id: USER, firstName: "Creator", lastName: "One" },
    attachments: [],
    lines: [
      {
        id: LINE,
        lineNo: 1,
        expenseTypeId: TYPE,
        description: "ค่าขนส่ง",
        pricingMode: "QTY_PRICE",
        quantity: 2,
        unitId: UNIT,
        unitCode: "TRIP",
        unitPrice: 100,
        amount: 200,
        taxAmount: 14,
        discountAmount: 5,
        netAmount: 209,
        costCenterId: null,
        processId: null,
        costObjectType: null,
        costObjectId: null,
        costObjectLabel: null,
        sourceKind: "MANUAL",
        sourceModule: null,
        sourceType: null,
        sourceDocumentId: null,
        sourceLineId: null,
        sourceLinkActive: true,
        expenseType: { id: TYPE, name: "ขนส่ง", transactionType: "EXPENSE" },
        costCenter: null,
        process: null,
        unit: { id: UNIT, code: "TRIP", name: "เที่ยว" },
      },
    ],
  }
}

function createDb(existing = paidExisting(), updated = includedRow()) {
  return {
    expense: {
      findFirst: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockResolvedValue(updated),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
}

describe("unpayExpenseSchema", () => {
  it("rejects a missing reason", () => {
    expect(unpayExpenseSchema.safeParse({}).success).toBe(false)
    expect(unpayExpenseSchema.safeParse({ reason: "" }).success).toBe(false)
    expect(unpayExpenseSchema.safeParse({ reason: "   " }).success).toBe(false)
  })

  it("accepts a trimmed 1–500 character reason", () => {
    expect(unpayExpenseSchema.safeParse({ reason: " จ่ายผิด " }).success).toBe(true)
    expect(unpayExpenseSchema.safeParse({ reason: "x".repeat(500) }).success).toBe(true)
    expect(unpayExpenseSchema.safeParse({ reason: "x".repeat(501) }).success).toBe(false)
  })
})

describe("unpayExpense", () => {
  it("TEST 1: PAID + valid reason + approve on the expense branch reverses payment only", async () => {
    const db = createDb()
    const result = await unpayExpense(asDb(db), {
      companyId: COMPANY,
      roles: managerOnAViewerOnB,
      userId: USER,
      id: EXPENSE,
      input: { reason: "  จ่ายผิดสาขา  " },
      audit: { ipAddress: "10.0.0.1", userAgent: "vitest" },
    })

    expect(result.data.status).toBe("APPROVED")
    expect(result.data.paidAt).toBeNull()
    expect(result.data.paidById).toBeNull()
    expect(result.data.paymentMethod).toBe("TRANSFER")
    expect(result.data.amount).toBe(200)
    expect(result.data.taxAmount).toBe(14)
    expect(result.data.discountAmount).toBe(5)
    expect(result.data.netAmount).toBe(209)
    expect(result.data.approvedById).toBe(USER)
    expect(result.data.lines[0]?.amount).toBe(200)
    expect(result.data.lines[0]?.quantity).toBe(2)
    expect(result.data.lines[0]?.unitPrice).toBe(100)

    expect(db.expense.update).toHaveBeenCalledTimes(1)
    const updateArg = db.expense.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(updateArg.data).toEqual({
      status: "APPROVED",
      paidAt: null,
      paidBy: { disconnect: true },
    })
    expect(updateArg.data).not.toHaveProperty("paymentMethod")
    expect(updateArg.data).not.toHaveProperty("amount")
    expect(updateArg.data).not.toHaveProperty("approvedById")
    expect(updateArg.data).not.toHaveProperty("branchId")

    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tableName: "expenses",
        recordId: EXPENSE,
        action: "update",
        userId: USER,
        ipAddress: "10.0.0.1",
        userAgent: "vitest",
        oldValues: {
          status: "PAID",
          paidAt: PAID_AT.toISOString(),
          paidById: PAYER,
        },
        newValues: {
          event: "EXPENSE_UNPAY",
          branchId: BRANCH_A,
          reason: "จ่ายผิดสาขา",
          status: "APPROVED",
          paidAt: null,
          paidById: null,
        },
      }),
    })
  })

  it("TEST 2: missing or blank reason is a ValidationError (400)", async () => {
    for (const input of [{}, { reason: "" }, { reason: "   " }, { reason: null }]) {
      const db = createDb()
      await expect(
        unpayExpense(asDb(db), {
          companyId: COMPANY,
          roles: managerOnAViewerOnB,
          userId: USER,
          id: EXPENSE,
          input,
        })
      ).rejects.toMatchObject({ name: "ValidationError", status: 400 })
      expect(db.expense.update).not.toHaveBeenCalled()
      expect(db.auditLog.create).not.toHaveBeenCalled()
    }
  })

  it("TEST 3: non-PAID expense is a ValidationError (400)", async () => {
    for (const status of ["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"]) {
      const db = createDb(paidExisting({ status }))
      await expect(
        unpayExpense(asDb(db), {
          companyId: COMPANY,
          roles: managerOnAViewerOnB,
          userId: USER,
          id: EXPENSE,
          input: { reason: "ยกเลิกการจ่าย" },
        })
      ).rejects.toMatchObject({ name: "ValidationError", status: 400 })
      expect(db.expense.update).not.toHaveBeenCalled()
    }
  })

  it("TEST 4: Viewer or update-only on the expense branch is ForbiddenError (403)", async () => {
    for (const roles of [viewerRoles, updateOnlyRoles]) {
      const db = createDb()
      await expect(
        unpayExpense(asDb(db), {
          companyId: COMPANY,
          roles,
          userId: USER,
          id: EXPENSE,
          input: { reason: "ยกเลิกการจ่าย" },
        })
      ).rejects.toMatchObject({ name: "ForbiddenError", status: 403 })
      expect(db.expense.update).not.toHaveBeenCalled()
      expect(db.auditLog.create).not.toHaveBeenCalled()
    }
  })

  it("TEST 5: Admin is allowed through the existing Admin permission bypass", async () => {
    const db = createDb(paidExisting({ branchId: BRANCH_D }), includedRow({ branchId: BRANCH_D }))
    const result = await unpayExpense(asDb(db), {
      companyId: COMPANY,
      roles: adminRoles,
      userId: USER,
      id: EXPENSE,
      input: { reason: "Admin reverse payment" },
    })
    expect(result.data.status).toBe("APPROVED")
    expect(db.expense.update).toHaveBeenCalled()
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        newValues: expect.objectContaining({ event: "EXPENSE_UNPAY", branchId: BRANCH_D }),
      }),
    })
  })

  it("TEST 6: Manager at Branch A can unpay A only; Viewer at Branch B cannot unpay B", async () => {
    const dbA = createDb(paidExisting({ branchId: BRANCH_A }), includedRow({ branchId: BRANCH_A }))
    const ok = await unpayExpense(asDb(dbA), {
      companyId: COMPANY,
      roles: managerOnAViewerOnB,
      userId: USER,
      id: EXPENSE,
      input: { reason: "unpay A" },
    })
    expect(ok.data.status).toBe("APPROVED")
    expect(dbA.expense.update).toHaveBeenCalled()

    const dbB = createDb(paidExisting({ branchId: BRANCH_B }))
    await expect(
      unpayExpense(asDb(dbB), {
        companyId: COMPANY,
        roles: managerOnAViewerOnB,
        userId: USER,
        id: EXPENSE,
        input: { reason: "unpay B" },
      })
    ).rejects.toBeInstanceOf(ForbiddenError)
    expect(dbB.expense.update).not.toHaveBeenCalled()
  })

  it("rejects a reason longer than 500 characters", async () => {
    const db = createDb()
    await expect(
      unpayExpense(asDb(db), {
        companyId: COMPANY,
        roles: managerOnAViewerOnB,
        userId: USER,
        id: EXPENSE,
        input: { reason: "x".repeat(501) },
      })
    ).rejects.toBeInstanceOf(ValidationError)
    expect(db.expense.update).not.toHaveBeenCalled()
  })
})
