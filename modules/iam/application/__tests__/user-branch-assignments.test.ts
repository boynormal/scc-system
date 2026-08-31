import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import {
  assignmentBranchIdsFromCreateInput,
  assignmentBranchIdsFromUpdateInput,
  createUser,
  createUserSchema,
  updateUser,
  updateUserSchema,
} from "@/modules/iam/application/user-service"

const COMPANY = "11111111-1111-1111-1111-111111111111"
const USER = "22222222-2222-2222-2222-222222222222"
const BRANCH_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const BRANCH_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const ROLE_FIN = "cccccccc-cccc-cccc-cccc-cccccccccccc"
const ROLE_VIEW = "dddddddd-dddd-dddd-dddd-dddddddddddd"
const ASSIGNED_BY = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"

function asDb(db: object): PrismaClient {
  return db as unknown as PrismaClient
}

describe("createUserSchema branchAssignments", () => {
  const base = {
    username: "hq.finance",
    email: "finance@example.com",
    password: "Password1",
    firstName: "HQ",
    lastName: "Finance",
  }

  it("accepts legacy branchId + roleId", () => {
    const parsed = createUserSchema.safeParse({ ...base, branchId: BRANCH_A, roleId: ROLE_FIN })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(assignmentBranchIdsFromCreateInput(parsed.data)).toEqual([BRANCH_A])
    }
  })

  it("accepts multiple branchAssignments", () => {
    const parsed = createUserSchema.safeParse({
      ...base,
      branchAssignments: [
        { branchId: BRANCH_A, roleId: ROLE_FIN },
        { branchId: BRANCH_B, roleId: ROLE_FIN },
      ],
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(assignmentBranchIdsFromCreateInput(parsed.data)).toEqual([BRANCH_A, BRANCH_B])
    }
  })

  it("rejects duplicate branch in assignments", () => {
    const parsed = createUserSchema.safeParse({
      ...base,
      branchAssignments: [
        { branchId: BRANCH_A, roleId: ROLE_FIN },
        { branchId: BRANCH_A, roleId: ROLE_VIEW },
      ],
    })
    expect(parsed.success).toBe(false)
  })

  it("requires a branch when assignments omitted", () => {
    const parsed = createUserSchema.safeParse(base)
    expect(parsed.success).toBe(false)
  })
})

describe("updateUserSchema branchAssignments", () => {
  it("does not require assignments (omit = leave rows intact)", () => {
    const parsed = updateUserSchema.safeParse({ firstName: "A" })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(assignmentBranchIdsFromUpdateInput(parsed.data)).toEqual([])
    }
  })

  it("rejects empty assignments", () => {
    const parsed = updateUserSchema.safeParse({ branchAssignments: [] })
    expect(parsed.success).toBe(false)
  })

  it("rejects duplicate branch", () => {
    const parsed = updateUserSchema.safeParse({
      branchAssignments: [
        { branchId: BRANCH_A, roleId: ROLE_FIN },
        { branchId: BRANCH_A, roleId: ROLE_VIEW },
      ],
    })
    expect(parsed.success).toBe(false)
  })
})

describe("createUser", () => {
  it("creates one UserBranchRole per assignment", async () => {
    const db = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: USER,
          email: "finance@example.com",
          username: "hq.finance",
        }),
      },
      branch: { findMany: vi.fn().mockResolvedValue([{ id: BRANCH_A }, { id: BRANCH_B }]) },
      role: { findMany: vi.fn().mockResolvedValue([{ id: ROLE_FIN }]) },
    }

    const result = await createUser(asDb(db), {
      companyId: COMPANY,
      input: createUserSchema.parse({
        username: "hq.finance",
        email: "finance@example.com",
        password: "Password1",
        firstName: "HQ",
        lastName: "Finance",
        branchAssignments: [
          { branchId: BRANCH_A, roleId: ROLE_FIN },
          { branchId: BRANCH_B, roleId: ROLE_FIN },
        ],
      }),
    })

    expect("data" in result).toBe(true)
    expect(db.user.create).toHaveBeenCalled()
    const created = db.user.create.mock.calls[0][0].data
    expect(created.userBranchRoles.create).toHaveLength(2)
    expect(created.userBranchRoles.create.map((r: { branchId: string }) => r.branchId)).toEqual([
      BRANCH_A,
      BRANCH_B,
    ])
  })
})

describe("updateUser", () => {
  it("does not touch assignments when branchAssignments is omitted", async () => {
    const db = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: USER,
          username: "hq.finance",
          email: "finance@example.com",
          employeeCode: null,
          userBranchRoles: [
            { id: "r1", branchId: BRANCH_A, roleId: ROLE_FIN },
            { id: "r2", branchId: BRANCH_B, roleId: ROLE_FIN },
          ],
        }),
        update: vi.fn().mockResolvedValue({
          id: USER,
          email: "finance@example.com",
          username: "hq.finance",
        }),
      },
      userBranchRole: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    }

    const result = await updateUser(asDb(db), {
      id: USER,
      companyId: COMPANY,
      assignedBy: ASSIGNED_BY,
      input: updateUserSchema.parse({ firstName: "Updated" }),
    })

    expect("data" in result).toBe(true)
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.userBranchRole.deleteMany).not.toHaveBeenCalled()
    expect(db.userBranchRole.update).not.toHaveBeenCalled()
  })

  it("replaces assignments when branchAssignments is sent", async () => {
    const tx = {
      userBranchRole: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    }
    const db = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: USER,
          username: "hq.finance",
          email: "finance@example.com",
          employeeCode: null,
          userBranchRoles: [
            { id: "r1", branchId: BRANCH_A, roleId: ROLE_FIN },
            { id: "r2", branchId: BRANCH_B, roleId: ROLE_FIN },
          ],
        }),
        update: vi.fn().mockResolvedValue({
          id: USER,
          email: "finance@example.com",
          username: "hq.finance",
        }),
      },
      branch: { findMany: vi.fn().mockResolvedValue([{ id: BRANCH_A }]) },
      role: { findMany: vi.fn().mockResolvedValue([{ id: ROLE_FIN }]) },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    }

    const result = await updateUser(asDb(db), {
      id: USER,
      companyId: COMPANY,
      assignedBy: ASSIGNED_BY,
      input: updateUserSchema.parse({
        branchAssignments: [{ branchId: BRANCH_A, roleId: ROLE_FIN }],
      }),
    })

    expect("data" in result).toBe(true)
    expect(tx.userBranchRole.deleteMany).toHaveBeenCalledWith({ where: { userId: USER } })
    expect(tx.userBranchRole.createMany).toHaveBeenCalled()
    const created = tx.userBranchRole.createMany.mock.calls[0][0].data
    expect(created).toHaveLength(1)
    expect(created[0].branchId).toBe(BRANCH_A)
  })
})
