import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import {
  deleteExpense,
  markExpensePaid,
  updateExpense,
} from "@/modules/finance/application/expense-service"

const COMPANY = "11111111-1111-1111-1111-111111111111"
const BRANCH_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const BRANCH_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const BRANCH_D = "dddddddd-dddd-dddd-dddd-dddddddddddd"
const EXPENSE = "44444444-4444-4444-4444-444444444444"
const USER = "33333333-3333-3333-3333-333333333333"

const mixedRoles: UserRole[] = [
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

const financeRoles: UserRole[] = [
  {
    branchId: BRANCH_A,
    branchName: "A",
    roleName: "Finance",
    permissions: { expenses: ["create", "read", "update", "delete", "approve"] },
  },
  {
    branchId: BRANCH_B,
    branchName: "B",
    roleName: "Finance",
    permissions: { expenses: ["create", "read", "update", "delete", "approve"] },
  },
]

const adminRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Admin", permissions: null },
]

function asDb(db: object): PrismaClient {
  return db as unknown as PrismaClient
}

function expenseRow(over: { branchId: string; status: string }) {
  return {
    id: EXPENSE,
    companyId: COMPANY,
    branchId: over.branchId,
    status: over.status,
    vendorId: null,
    paymentMethod: null,
  }
}

describe("expense branch-aware mutations", () => {
  it("allows update on Manager branch and forbids update on Viewer branch", async () => {
    const dbB = {
      expense: {
        findFirst: vi.fn().mockResolvedValue(expenseRow({ branchId: BRANCH_B, status: "DRAFT" })),
        update: vi.fn(),
      },
    }
    await expect(
      updateExpense(asDb(dbB), {
        companyId: COMPANY,
        roles: mixedRoles,
        userId: USER,
        id: EXPENSE,
        input: { notes: "from HQ" },
      })
    ).rejects.toBeInstanceOf(ForbiddenError)
    expect(dbB.expense.update).not.toHaveBeenCalled()

    const dbA = {
      expense: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(expenseRow({ branchId: BRANCH_A, status: "DRAFT" }))
          .mockResolvedValueOnce(null),
        update: vi.fn().mockResolvedValue({}),
      },
    }
    await expect(
      updateExpense(asDb(dbA), {
        companyId: COMPANY,
        roles: mixedRoles,
        userId: USER,
        id: EXPENSE,
        input: { notes: "ok on A" },
      })
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(dbA.expense.update).toHaveBeenCalled()
  })

  it("forbids pay on a Viewer branch even if another branch has update", async () => {
    const db = {
      expense: {
        findFirst: vi.fn().mockResolvedValue(expenseRow({ branchId: BRANCH_B, status: "APPROVED" })),
        update: vi.fn(),
      },
    }
    await expect(
      markExpensePaid(asDb(db), {
        companyId: COMPANY,
        roles: mixedRoles,
        userId: USER,
        id: EXPENSE,
      })
    ).rejects.toBeInstanceOf(ForbiddenError)
    expect(db.expense.update).not.toHaveBeenCalled()
  })

  it("forbids Finance user from mutating an unassigned branch", async () => {
    const db = {
      expense: {
        findFirst: vi.fn().mockResolvedValue(expenseRow({ branchId: BRANCH_D, status: "DRAFT" })),
        update: vi.fn(),
      },
    }
    await expect(
      updateExpense(asDb(db), {
        companyId: COMPANY,
        roles: financeRoles,
        userId: USER,
        id: EXPENSE,
        input: { notes: "branch D" },
      })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("rejects DELETE of a PAID expense on the server", async () => {
    const db = {
      expense: {
        findFirst: vi.fn().mockResolvedValue(expenseRow({ branchId: BRANCH_A, status: "PAID" })),
        update: vi.fn(),
      },
      expenseLine: { findMany: vi.fn(), updateMany: vi.fn() },
      $transaction: vi.fn(),
    }
    await expect(
      deleteExpense(asDb(db), {
        companyId: COMPANY,
        roles: adminRoles,
        id: EXPENSE,
      })
    ).rejects.toBeInstanceOf(ValidationError)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("keeps Admin bypass for mutations on any company branch", async () => {
    const db = {
      expense: {
        findFirst: vi.fn().mockResolvedValue(expenseRow({ branchId: BRANCH_D, status: "DRAFT" })),
        update: vi.fn(),
      },
      expenseLine: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn().mockResolvedValue([]),
    }
    const result = await deleteExpense(asDb(db), {
      companyId: COMPANY,
      roles: adminRoles,
      id: EXPENSE,
    })
    expect(result).toEqual({ data: { id: EXPENSE } })
    expect(db.$transaction).toHaveBeenCalled()
  })
})
