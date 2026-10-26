import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import {
  approveIncome,
  computeIncomeLineAmounts,
  createIncomeSchema,
  deleteIncome,
  getIncome,
  incomeWhere,
  markIncomeReceived,
  rejectIncome,
  sumIncomeTotals,
  unreceiveIncome,
  updateIncome,
  uploadIncomeFile,
} from "@/modules/finance/application/income-service"
import { generateIncomeNo } from "@/modules/finance/application/generate-income-no"
import { aggregateIncomeReport, type IncomeReportRow } from "@/modules/finance/application/income-reports-service"

const COMPANY = "11111111-1111-1111-1111-111111111111"
const BRANCH_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const BRANCH_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const INCOME = "44444444-4444-4444-4444-444444444444"
const USER = "33333333-3333-3333-3333-333333333333"
const LINE = "66666666-6666-6666-6666-666666666666"
const TYPE = "77777777-7777-7777-7777-777777777777"
const TYPE_2 = "78777777-7777-7777-7777-777777777777"
const CC = "88888888-8888-8888-8888-888888888888"
const manager: UserRole[] = [
  {
    branchId: BRANCH_A,
    branchName: "A",
    roleName: "Manager",
    permissions: { incomes: ["create", "read", "update", "approve"] },
  },
]
const clerk: UserRole[] = [
  { branchId: BRANCH_A, branchName: "A", roleName: "Clerk", permissions: { incomes: ["create", "read", "update"] } },
]
const viewer: UserRole[] = [{ branchId: BRANCH_A, branchName: "A", roleName: "Viewer", permissions: { incomes: ["read"] } }]
const expenseOnly: UserRole[] = [
  { branchId: BRANCH_A, branchName: "A", roleName: "ExpenseClerk", permissions: { expenses: ["create", "read", "update", "approve"] } },
]
const admin: UserRole[] = [{ branchId: BRANCH_A, branchName: "HQ", roleName: "Admin", permissions: null }]

function asDb(db: object): PrismaClient {
  return db as unknown as PrismaClient
}

function row(over: { status?: string; branchId?: string } = {}) {
  const branchId = over.branchId ?? BRANCH_A
  return {
    id: INCOME,
    companyId: COMPANY,
    branchId,
    incomeNo: "INC-2026-00001",
    incomeDate: new Date("2026-10-01T00:00:00.000Z"),
    postingDate: null,
    payerName: "ร้านค้า ก",
    employeeId: null,
    amount: 1000,
    taxAmount: 70,
    discountAmount: 0,
    netAmount: 1070,
    currency: "THB",
    notes: null,
    status: over.status ?? "APPROVED",
    paymentMethod: "cash",
    receivedAt: null,
    receivedById: null,
    approvedById: USER,
    approvedAt: new Date("2026-10-02T00:00:00.000Z"),
    createdById: USER,
    createdAt: new Date("2026-10-01T08:00:00.000Z"),
    updatedAt: new Date("2026-10-02T08:00:00.000Z"),
    branch: { id: branchId, name: "A" },
    employee: null,
    approvedBy: { id: USER, firstName: "A", lastName: "B" },
    receivedBy: null,
    creator: { id: USER, firstName: "A", lastName: "B" },
    attachments: [],
    lines: [
      {
        id: LINE,
        lineNo: 1,
        incomeTypeId: TYPE,
        description: "ค่าเช่าห้อง",
        pricingMode: "AMOUNT",
        quantity: 1,
        unitId: null,
        unitCode: null,
        unitPrice: 1000,
        amount: 1000,
        taxAmount: 70,
        discountAmount: 0,
        netAmount: 1070,
        costCenterId: null,
        incomeType: { id: TYPE, code: "IT-0001", name: "ค่าเช่า" },
        costCenter: null,
        unit: null,
      },
    ],
  }
}

function createDb(existing: Record<string, unknown>, updated = row()) {
  return {
    income: {
      findFirst: vi.fn().mockResolvedValueOnce(existing).mockResolvedValue(updated),
      update: vi.fn().mockResolvedValue(updated),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
}

const base = { companyId: COMPANY, userId: USER, id: INCOME }

describe("computeIncomeLineAmounts", () => {
  it("QTY_PRICE multiplies quantity by unit price and nets tax minus discount", () => {
    expect(
      computeIncomeLineAmounts({ pricingMode: "QTY_PRICE", quantity: 3, unitPrice: 33.335, taxAmount: 7, discountAmount: 2 })
    ).toEqual({ pricingMode: "QTY_PRICE", quantity: 3, unitPrice: 33.335, amount: 100.01, taxAmount: 7, discountAmount: 2, netAmount: 105.01 })
  })

  it("AMOUNT uses the entered amount with quantity 1", () => {
    const r = computeIncomeLineAmounts({ pricingMode: "AMOUNT", amount: 500, quantity: 9 })
    expect(r.quantity).toBe(1)
    expect(r.amount).toBe(500)
    expect(r.netAmount).toBe(500)
  })

  it("floors net at zero when the discount exceeds the amount", () => {
    expect(computeIncomeLineAmounts({ amount: 100, discountAmount: 150 }).netAmount).toBe(0)
  })

  it("VAT_EXCLUSIVE adds 7% of amount minus discount and ignores entered tax", () => {
    const r = computeIncomeLineAmounts({ amount: 1000, discountAmount: 100, taxAmount: 999 }, "VAT_EXCLUSIVE")
    expect(r.taxAmount).toBe(63)
    expect(r.netAmount).toBe(963)
  })

  it("VAT_INCLUSIVE extracts tax from the base and keeps net equal to the base", () => {
    const r = computeIncomeLineAmounts({ amount: 1070 }, "VAT_INCLUSIVE")
    expect(r.taxAmount).toBe(70)
    expect(r.netAmount).toBe(1070)
    expect(computeIncomeLineAmounts({ amount: 100, discountAmount: 150 }, "VAT_INCLUSIVE")).toMatchObject({
      taxAmount: 0,
      netAmount: 0,
    })
  })
})

describe("sumIncomeTotals", () => {
  it("sums header totals from lines", () => {
    expect(
      sumIncomeTotals([
        { amount: 100.1, taxAmount: 7, discountAmount: 0, netAmount: 107.1 },
        { amount: 200.2, taxAmount: 0, discountAmount: 10, netAmount: 190.2 },
      ])
    ).toEqual({ amount: 300.3, taxAmount: 7, discountAmount: 10, netAmount: 297.3 })
  })
})

describe("createIncomeSchema", () => {
  const line = { incomeTypeId: TYPE, amount: 100 }
  it("requires a payer name and at least one line", () => {
    expect(createIncomeSchema.safeParse({ branchId: BRANCH_A, incomeDate: "2026-10-01", payerName: " ", lines: [line] }).success).toBe(false)
    expect(createIncomeSchema.safeParse({ branchId: BRANCH_A, incomeDate: "2026-10-01", payerName: "ก", lines: [] }).success).toBe(false)
    expect(createIncomeSchema.safeParse({ branchId: BRANCH_A, incomeDate: "2026-10-01", payerName: "ก", lines: [line] }).success).toBe(true)
  })
})

describe("generateIncomeNo", () => {
  it("returns INC-YYYY-00001 style numbers counting existing rows per company", async () => {
    const count = vi.fn().mockResolvedValue(41)
    const no = await generateIncomeNo(asDb({ income: { count } }), COMPANY, new Date(2026, 5, 1))
    expect(no).toBe("INC-2026-00042")
    expect(count).toHaveBeenCalledWith({ where: { companyId: COMPANY, incomeNo: { startsWith: "INC-2026-" } } })
  })
})

describe("incomeWhere", () => {
  it("scopes to company, excludes soft-deleted rows, and limits non-admins to their branches", () => {
    expect(incomeWhere(COMPANY, manager)).toEqual({ companyId: COMPANY, deletedAt: null, branchId: { in: [BRANCH_A] } })
    expect(incomeWhere(COMPANY, admin)).toEqual({ companyId: COMPANY, deletedAt: null })
    expect(incomeWhere(COMPANY, manager, BRANCH_B)).toEqual({ id: expect.any(String) })
  })
})

describe("getIncome", () => {
  it("queries with company scope and rejects users without incomes.read", async () => {
    const db = createDb(row())
    await getIncome(asDb(db), { companyId: COMPANY, roles: manager, id: INCOME })
    const where = db.income.findFirst.mock.calls[0]?.[0]?.where
    expect(where).toMatchObject({ id: INCOME, companyId: COMPANY, deletedAt: null })
    await expect(getIncome(asDb(createDb(row())), { companyId: COMPANY, roles: expenseOnly, id: INCOME })).rejects.toMatchObject({
      name: "ForbiddenError",
    })
  })
})

describe("status transitions", () => {
  it("approve moves PENDING to APPROVED and writes an incomes audit row", async () => {
    const db = createDb({ id: INCOME, status: "PENDING", branchId: BRANCH_A })
    await approveIncome(asDb(db), { ...base, roles: manager })
    expect(db.income.update.mock.calls[0]?.[0]?.data).toMatchObject({ status: "APPROVED", approvedById: USER })
    expect(db.auditLog.create.mock.calls[0]?.[0]?.data).toMatchObject({ tableName: "incomes", recordId: INCOME })
  })

  it("approve and reject need incomes.approve", async () => {
    for (const fn of [approveIncome, rejectIncome]) {
      const db = createDb({ id: INCOME, status: "PENDING", branchId: BRANCH_A })
      await expect(fn(asDb(db), { ...base, roles: clerk })).rejects.toMatchObject({ name: "ForbiddenError" })
      expect(db.income.update).not.toHaveBeenCalled()
    }
  })

  it("approve rejects bills that already left the pending states", async () => {
    for (const status of ["APPROVED", "RECEIVED", "REJECTED", "CANCELLED"]) {
      const db = createDb({ id: INCOME, status, branchId: BRANCH_A })
      await expect(approveIncome(asDb(db), { ...base, roles: manager })).rejects.toMatchObject({ name: "ValidationError" })
    }
  })

  it("receive needs APPROVED and incomes.update", async () => {
    const ok = createDb({ id: INCOME, status: "APPROVED", branchId: BRANCH_A }, row({ status: "RECEIVED" }))
    await markIncomeReceived(asDb(ok), { ...base, roles: clerk, input: { paymentMethod: "cash", receivedAt: "2026-10-05" } })
    expect(ok.income.update.mock.calls[0]?.[0]?.data).toMatchObject({
      status: "RECEIVED",
      receivedById: USER,
      receivedAt: new Date("2026-10-05T00:00:00.000Z"),
      paymentMethod: "cash",
    })

    const pending = createDb({ id: INCOME, status: "PENDING", branchId: BRANCH_A })
    await expect(markIncomeReceived(asDb(pending), { ...base, roles: clerk })).rejects.toMatchObject({ name: "ValidationError" })

    const ro = createDb({ id: INCOME, status: "APPROVED", branchId: BRANCH_A })
    await expect(markIncomeReceived(asDb(ro), { ...base, roles: viewer })).rejects.toMatchObject({ name: "ForbiddenError" })
  })

  it("unreceive needs a reason and returns the bill to APPROVED", async () => {
    const blank = createDb({ id: INCOME, status: "RECEIVED", branchId: BRANCH_A, receivedAt: new Date(), receivedById: USER })
    await expect(unreceiveIncome(asDb(blank), { ...base, roles: clerk, input: { reason: "  " } })).rejects.toMatchObject({
      name: "ValidationError",
    })
    expect(blank.income.update).not.toHaveBeenCalled()

    const db = createDb({ id: INCOME, status: "RECEIVED", branchId: BRANCH_A, receivedAt: new Date(), receivedById: USER })
    await unreceiveIncome(asDb(db), { ...base, roles: clerk, input: { reason: "รับผิดบิล" } })
    expect(db.income.update.mock.calls[0]?.[0]?.data).toEqual({
      status: "APPROVED",
      receivedAt: null,
      receivedBy: { disconnect: true },
    })
    expect(db.auditLog.create.mock.calls[0]?.[0]?.data?.newValues).toMatchObject({ event: "INCOME_UNRECEIVE", reason: "รับผิดบิล" })
  })

  it("delete blocks RECEIVED and soft-deletes others as CANCELLED", async () => {
    const received = createDb({ id: INCOME, status: "RECEIVED", branchId: BRANCH_A })
    await expect(deleteIncome(asDb(received), { ...base, roles: admin })).rejects.toMatchObject({ name: "ValidationError" })

    const draft = createDb({ id: INCOME, status: "DRAFT", branchId: BRANCH_A })
    await deleteIncome(asDb(draft), { ...base, roles: admin })
    expect(draft.income.update.mock.calls[0]?.[0]?.data).toMatchObject({ status: "CANCELLED", deletedAt: expect.any(Date) })
  })

  it("update rejects APPROVED bills", async () => {
    const db = createDb({ id: INCOME, status: "APPROVED", branchId: BRANCH_A })
    await expect(updateIncome(asDb(db), { ...base, roles: clerk, input: { notes: "x" } })).rejects.toMatchObject({
      name: "ValidationError",
    })
  })
})

describe("RECEIVED edits", () => {
  function receivedExisting() {
    return {
      id: INCOME,
      status: "RECEIVED",
      branchId: BRANCH_A,
      incomeDate: new Date("2026-10-01T00:00:00.000Z"),
      postingDate: null,
      payerName: "ร้านค้า ก",
      employeeId: null,
      paymentMethod: "cash",
      notes: null,
      lines: [
        {
          id: LINE,
          lineNo: 1,
          incomeTypeId: TYPE,
          description: "ค่าเช่าห้อง",
          pricingMode: "AMOUNT",
          quantity: 1,
          unitId: null,
          unitPrice: 1000,
          amount: 1000,
          taxAmount: 70,
          discountAmount: 0,
          costCenterId: null,
        },
      ],
    }
  }

  function receivedDb() {
    const db = {
      income: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: INCOME, status: "RECEIVED", branchId: BRANCH_A })
          .mockResolvedValueOnce(receivedExisting())
          .mockResolvedValue(row({ status: "RECEIVED" })),
        update: vi.fn().mockResolvedValue({}),
      },
      incomeLine: { update: vi.fn().mockResolvedValue({}) },
      incomeType: { findMany: vi.fn().mockResolvedValue([{ id: TYPE_2 }]) },
      unit: { findMany: vi.fn().mockResolvedValue([]) },
      costCenter: { findMany: vi.fn().mockResolvedValue([{ id: CC }]) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn(),
    }
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db))
    return db
  }

  it("locks money fields", async () => {
    const db = receivedDb()
    await expect(
      updateIncome(asDb(db), {
        ...base,
        roles: clerk,
        input: { reason: "แก้ยอด", lines: [{ id: LINE, incomeTypeId: TYPE, amount: 2000 }] },
      })
    ).rejects.toMatchObject({ name: "ValidationError" })
    expect(db.incomeLine.update).not.toHaveBeenCalled()
  })

  it("requires a reason", async () => {
    const db = receivedDb()
    await expect(updateIncome(asDb(db), { ...base, roles: clerk, input: { notes: "x" } })).rejects.toMatchObject({
      name: "ValidationError",
    })
  })

  it("allows type and cost center changes with a reason", async () => {
    const db = receivedDb()
    await updateIncome(asDb(db), {
      ...base,
      roles: clerk,
      input: {
        reason: "จัดประเภทใหม่",
        lines: [{ id: LINE, incomeTypeId: TYPE_2, costCenterId: CC, description: "ค่าเช่าห้อง" }],
      },
    })
    expect(db.incomeLine.update).toHaveBeenCalledTimes(1)
    expect(db.incomeLine.update.mock.calls[0]?.[0]?.data).not.toHaveProperty("amount")
  })
})

describe("uploadIncomeFile", () => {
  it("rejects attachments on CANCELLED bills before touching storage", async () => {
    const db = createDb({ id: INCOME, status: "CANCELLED", branchId: BRANCH_A })
    const putObject = vi.fn()
    await expect(
      uploadIncomeFile(asDb(db), {
        ...base,
        roles: clerk,
        originalName: "a.pdf",
        body: Buffer.from("%PDF-1.4"),
        storage: { putObject } as never,
      })
    ).rejects.toMatchObject({ name: "ValidationError" })
    expect(putObject).not.toHaveBeenCalled()
  })

  it("stores the object, then a StoredFile with entityType income and an attachment row", async () => {
    const pdf = Buffer.from("%PDF-1.4 hello")
    const storage = {
      bucket: "erp",
      maxUploadBytes: 1024,
      putObject: vi.fn().mockResolvedValue(undefined),
      getObject: vi.fn(),
      deleteObject: vi.fn().mockResolvedValue(undefined),
      headBucket: vi.fn(),
    }
    const tx = {
      storedFile: { create: vi.fn().mockResolvedValue({}) },
      incomeAttachment: {
        create: vi.fn().mockResolvedValue({ id: "att-1" }),
        update: vi.fn().mockImplementation(async ({ data }: { data: { fileUrl: string } }) => ({
          id: "att-1",
          fileUrl: data.fileUrl,
          fileName: "slip.pdf",
          fileSize: pdf.length,
          storedFileId: "f",
        })),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    const db = {
      income: { findFirst: vi.fn().mockResolvedValue({ id: INCOME, status: "RECEIVED", branchId: BRANCH_A }) },
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    }
    const result = await uploadIncomeFile(asDb(db), { ...base, roles: clerk, originalName: "slip.pdf", body: pdf, storage })
    expect(storage.putObject).toHaveBeenCalledOnce()
    expect(tx.storedFile.create.mock.calls[0]?.[0]?.data).toMatchObject({
      companyId: COMPANY,
      branchId: BRANCH_A,
      module: "finance",
      entityType: "income",
      entityId: INCOME,
    })
    expect(result.data.fileUrl).toBe(`/api/finance/incomes/${INCOME}/attachments/att-1/file`)
  })
})

describe("aggregateIncomeReport", () => {
  const rows: IncomeReportRow[] = [
    {
      id: "r1",
      status: "RECEIVED",
      branchId: BRANCH_A,
      branchName: "A",
      incomeDate: "2026-10-01",
      lines: [
        { netAmount: 1000, incomeTypeId: TYPE, incomeTypeCode: "IT-0001", incomeTypeName: "ค่าเช่า", costCenterId: CC, costCenterName: "ขนส่ง" },
        { netAmount: 200, incomeTypeId: TYPE_2, incomeTypeName: "ค่าชั่ง", costCenterId: null },
      ],
    },
    {
      id: "r2",
      status: "APPROVED",
      branchId: BRANCH_B,
      branchName: "B",
      incomeDate: "2026-11-03",
      lines: [{ netAmount: 300, incomeTypeId: TYPE_2, incomeTypeName: "ค่าชั่ง", costCenterId: null }],
    },
    {
      id: "r3",
      status: "CANCELLED",
      branchId: BRANCH_A,
      branchName: "A",
      incomeDate: "2026-10-02",
      lines: [{ netAmount: 9999, incomeTypeId: TYPE, incomeTypeName: "ค่าเช่า", costCenterId: null }],
    },
    {
      id: "r4",
      status: "REJECTED",
      branchId: BRANCH_A,
      branchName: "A",
      incomeDate: "2026-10-02",
      lines: [{ netAmount: 8888, incomeTypeId: TYPE, incomeTypeName: "ค่าเช่า", costCenterId: null }],
    },
  ]

  it("sums line net amounts and skips CANCELLED and REJECTED bills", () => {
    const r = aggregateIncomeReport(rows)
    expect(r.grandTotal).toBe(1500)
    expect(r.count).toBe(2)
    expect(r.lineCount).toBe(3)
    expect(r.receivedTotal).toBe(1200)
    expect(r.outstandingTotal).toBe(300)
    expect(r.byType.map((b) => [b.key, b.total])).toEqual([
      [TYPE, 1000],
      [TYPE_2, 500],
    ])
    expect(r.byType[0]?.label).toBe("IT-0001 · ค่าเช่า")
    expect(r.byMonth.map((b) => b.key)).toEqual(["2026-10", "2026-11"])
    expect(r.byCostCenter.find((b) => b.key === "none")?.total).toBe(500)
    expect(r).not.toHaveProperty("byProcess")
  })

  it("applies line filters including the none key", () => {
    expect(aggregateIncomeReport(rows, { costCenterId: CC }).grandTotal).toBe(1000)
    expect(aggregateIncomeReport(rows, { costCenterId: "none" }).grandTotal).toBe(500)
    expect(aggregateIncomeReport(rows, { incomeTypeId: TYPE }).grandTotal).toBe(1000)
  })
})
