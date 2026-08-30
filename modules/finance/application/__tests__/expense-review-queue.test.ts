import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import {
  assertSourceLinesNotLinked,
  listUnlinkedExpenseSources,
  markSourceNoExpense,
  reopenReviewsOnExpenseCancel,
} from "@/modules/finance/application/expense-source-service"

const COMPANY = "11111111-1111-1111-1111-111111111111"
const BRANCH = "22222222-2222-2222-2222-222222222222"
const USER = "33333333-3333-3333-3333-333333333333"

const adminRoles: UserRole[] = [
  { branchId: BRANCH, branchName: "HQ", roleName: "Admin", permissions: null },
]

function createMockDb() {
  return {
    transportRepairLog: { findMany: vi.fn().mockResolvedValue([]) },
    transportTireLog: { findMany: vi.fn().mockResolvedValue([]) },
    transportJob: { findMany: vi.fn().mockResolvedValue([]) },
    branch: { findMany: vi.fn().mockResolvedValue([{ id: BRANCH, name: "HQ" }]) },
    expenseLine: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
    expense: { findFirst: vi.fn() },
    financeSourceReview: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "rev-1", status: "NO_EXPENSE" }),
      update: vi.fn().mockResolvedValue({ id: "rev-1", status: "PENDING" }),
    },
  }
}

type MockDb = ReturnType<typeof createMockDb>
function asDb(db: MockDb): PrismaClient {
  return db as unknown as PrismaClient
}

const vehicle = { id: "v1", plateNumber: "กข-1" }

function closedRepair(over: { id: string; repairCost: unknown }) {
  return {
    id: over.id,
    companyId: COMPANY,
    branchId: BRANCH,
    vehicleId: "v1",
    reportedAt: new Date("2026-08-10T00:00:00.000Z"),
    repairCost: over.repairCost,
    paymentMethod: null,
    symptom: "ซ่อม",
    repairNumber: "RP-2026-00001",
    status: "closed",
    vehicle,
  }
}

describe("listUnlinkedExpenseSources — finance-ready queue", () => {
  it("1. includes closed repair with null reference amount", async () => {
    const db = createMockDb()
    db.transportRepairLog.findMany.mockResolvedValue([closedRepair({ id: "r-null", repairCost: null })])
    const result = await listUnlinkedExpenseSources(asDb(db), { companyId: COMPANY, roles: adminRoles })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].sourceDocumentId).toBe("r-null")
    expect(result.data[0].documentNo).toBe("RP-2026-00001")
    expect(result.data[0].amount).toBeNull()
    expect(result.data[0].branchName).toBe("HQ")
    expect(db.branch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: COMPANY, id: { in: [BRANCH] } }),
      })
    )
  })

  it("2. includes closed repair with 0 and keeps 0 distinct from null", async () => {
    const db = createMockDb()
    db.transportRepairLog.findMany.mockResolvedValue([closedRepair({ id: "r-zero", repairCost: 0 })])
    const result = await listUnlinkedExpenseSources(asDb(db), { companyId: COMPANY, roles: adminRoles })
    expect(result.data[0].amount).toBe(0)
    expect(result.data[0].amount).not.toBeNull()
  })

  it("3. includes closed repair with 8500 reference", async () => {
    const db = createMockDb()
    db.transportRepairLog.findMany.mockResolvedValue([closedRepair({ id: "r-amt", repairCost: 8500 })])
    const result = await listUnlinkedExpenseSources(asDb(db), { companyId: COMPANY, roles: adminRoles })
    expect(result.data[0].amount).toBe(8500)
  })

  it("4. adapter asks only for closed repairs (open repairs stay out)", async () => {
    const db = createMockDb()
    await listUnlinkedExpenseSources(asDb(db), { companyId: COMPANY, roles: adminRoles })
    expect(db.transportRepairLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "closed" }),
      })
    )
    expect(db.transportRepairLog.findMany.mock.calls[0][0].where.repairCost).toBeUndefined()
  })

  it("7. PENDING / missing review stays listed", async () => {
    const db = createMockDb()
    db.transportRepairLog.findMany.mockResolvedValue([closedRepair({ id: "r-pend", repairCost: null })])
    db.financeSourceReview.findMany.mockResolvedValue([])
    const result = await listUnlinkedExpenseSources(asDb(db), { companyId: COMPANY, roles: adminRoles })
    expect(result.data.map((r) => r.sourceDocumentId)).toContain("r-pend")
    expect(result.data[0].reviewStatus).toBe("PENDING")
  })

  it("8c. completed job is exactly one source identity", async () => {
    const db = createMockDb()
    db.transportJob.findMany.mockResolvedValue([
      {
        id: "job-1",
        branchId: BRANCH,
        jobNumber: "JOB-1",
        customerName: "A",
        scheduledDate: new Date("2026-08-11T00:00:00.000Z"),
        createdAt: new Date("2026-08-11T00:00:00.000Z"),
        updatedAt: new Date("2026-08-11T00:00:00.000Z"),
        assignment: { vehicleId: "v1", vehicle },
      },
    ])
    const result = await listUnlinkedExpenseSources(asDb(db), { companyId: COMPANY, roles: adminRoles })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].sourceType).toBe("TRANSPORT_JOB")
    expect(result.data[0].sourceDocumentId).toBe("job-1")
    expect(result.data[0].sourceLineId).toBeNull()
    expect(result.data[0].documentNo).toBe("JOB-1")
    expect(result.data[0].description).toBe("A")
    expect(db.transportJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "completed" }),
      })
    )
  })

  it("8d. every tire log in branch scope enters if not reviewed/linked", async () => {
    const db = createMockDb()
    db.transportTireLog.findMany.mockResolvedValue([
      {
        id: "t1",
        branchId: BRANCH,
        workDate: new Date("2026-08-12T00:00:00.000Z"),
        vehicleId: "v1",
        cost: null,
        paymentMethod: null,
        tireNumber: "TY-2026-00001",
        vehicle,
      },
    ])
    const result = await listUnlinkedExpenseSources(asDb(db), { companyId: COMPANY, roles: adminRoles })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].sourceType).toBe("TRANSPORT_TIRE")
    expect(result.data[0].documentNo).toBe("TY-2026-00001")
    expect(db.transportTireLog.findMany.mock.calls[0][0].where.cost).toBeUndefined()
    expect(db.transportTireLog.findMany.mock.calls[0][0].where.status).toBeUndefined()
  })

  it("excludes linked and NO_EXPENSE / EXPENSE_CREATED reviews", async () => {
    const db = createMockDb()
    db.transportRepairLog.findMany.mockResolvedValue([
      closedRepair({ id: "r-link", repairCost: 10 }),
      closedRepair({ id: "r-no", repairCost: 10 }),
      closedRepair({ id: "r-ok", repairCost: 10 }),
    ])
    db.expenseLine.findMany.mockResolvedValue([{ sourceType: "TRANSPORT_REPAIR", sourceDocumentId: "r-link" }])
    db.financeSourceReview.findMany.mockResolvedValue([
      { sourceType: "TRANSPORT_REPAIR", sourceDocumentId: "r-no", sourceLineId: null, status: "NO_EXPENSE" },
    ])
    const result = await listUnlinkedExpenseSources(asDb(db), { companyId: COMPANY, roles: adminRoles })
    expect(result.data.map((r) => r.sourceDocumentId)).toEqual(["r-ok"])
  })

  it("excludes NO_EXPENSE even when stored sourceLineId is not null", async () => {
    const db = createMockDb()
    db.transportRepairLog.findMany.mockResolvedValue([closedRepair({ id: "r-no", repairCost: 10 })])
    db.financeSourceReview.findMany.mockResolvedValue([
      { sourceType: "TRANSPORT_REPAIR", sourceDocumentId: "r-no", sourceLineId: "legacy", status: "NO_EXPENSE" },
    ])
    const result = await listUnlinkedExpenseSources(asDb(db), { companyId: COMPANY, roles: adminRoles })
    expect(result.data).toEqual([])
  })
})

describe("markSourceNoExpense", () => {
  it("6. writes NO_EXPENSE without creating an Expense", async () => {
    const db = createMockDb()
    db.transportRepairLog.findMany.mockResolvedValue([closedRepair({ id: "r1", repairCost: null })])
    const result = await markSourceNoExpense(asDb(db), {
      companyId: COMPANY,
      roles: adminRoles,
      userId: USER,
      input: { sourceType: "TRANSPORT_REPAIR", sourceDocumentId: "r1", reason: "ซ่อมภายใน" },
    })
    expect(result.data.status).toBe("NO_EXPENSE")
    expect(db.financeSourceReview.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "NO_EXPENSE",
          sourceDocumentId: "r1",
          reason: "ซ่อมภายใน",
        }),
      })
    )
    expect(db.expense).toBeDefined()
    expect(db.expense.findFirst).not.toHaveBeenCalled()
  })

  it("8. rejects when review is already NO_EXPENSE or EXPENSE_CREATED on create path", async () => {
    const db = createMockDb()
    db.financeSourceReview.findFirst.mockResolvedValue({ id: "rev", status: "NO_EXPENSE" })
    await expect(
      assertSourceLinesNotLinked(asDb(db), {
        companyId: COMPANY,
        identities: [
          {
            sourceModule: "TRANSPORT",
            sourceType: "TRANSPORT_REPAIR",
            sourceDocumentId: "r1",
            sourceLineId: null,
          },
        ],
      })
    ).rejects.toThrow(/ไม่มีค่าใช้จ่าย/)
  })
})

describe("reopenReviewsOnExpenseCancel", () => {
  it("8b. EXPENSE_CREATED returns to PENDING; NO_EXPENSE stays closed", async () => {
    const db = createMockDb()
    db.financeSourceReview.findFirst
      .mockResolvedValueOnce({ id: "a", status: "EXPENSE_CREATED", reviewedById: USER })
      .mockResolvedValueOnce({ id: "b", status: "NO_EXPENSE", reviewedById: USER })

    await reopenReviewsOnExpenseCancel(asDb(db), {
      companyId: COMPANY,
      identities: [
        {
          sourceModule: "TRANSPORT",
          sourceType: "TRANSPORT_REPAIR",
          sourceDocumentId: "created",
          sourceLineId: null,
        },
        {
          sourceModule: "TRANSPORT",
          sourceType: "TRANSPORT_REPAIR",
          sourceDocumentId: "noexp",
          sourceLineId: null,
        },
      ],
    })

    expect(db.financeSourceReview.update).toHaveBeenCalledTimes(1)
    expect(db.financeSourceReview.update).toHaveBeenCalledWith({
      where: { id: "a" },
      data: expect.objectContaining({ status: "PENDING" }),
    })
  })
})
