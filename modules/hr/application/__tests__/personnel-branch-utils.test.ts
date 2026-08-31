import { describe, expect, it, vi } from "vitest"
import type { PersonnelDbTx } from "@/modules/hr/application/personnel-branch-utils"
import type { PrismaClient } from "@prisma/client"
import {
  backfillMissingPrimaryPersonnelBranches,
  ensurePersonnelBranch,
  replacePersonnelBranchesFromIds,
  setPersonnelPrimaryBranch,
} from "@/modules/hr/application/personnel-branch-utils"

function createMockTx() {
  return {
    personnelBranch: {
      findUnique: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    personnel: { update: vi.fn() },
  }
}

type MockTx = ReturnType<typeof createMockTx>

function asTx(tx: MockTx): PersonnelDbTx {
  return tx as unknown as PersonnelDbTx
}

const PERSONNEL_ID = "personnel-1"
const BRANCH_ID = "branch-1"

describe("ensurePersonnelBranch", () => {
  it("makes the first branch for this person primary and syncs personnel.branchId", async () => {
    const tx = createMockTx()
    tx.personnelBranch.findUnique.mockResolvedValue(null)
    tx.personnelBranch.count.mockResolvedValue(0)

    await ensurePersonnelBranch(asTx(tx), PERSONNEL_ID, BRANCH_ID)

    expect(tx.personnelBranch.updateMany).toHaveBeenCalledWith({
      where: { personnelId: PERSONNEL_ID },
      data: { isPrimary: false },
    })
    expect(tx.personnelBranch.create).toHaveBeenCalledWith({
      data: { personnelId: PERSONNEL_ID, branchId: BRANCH_ID, isPrimary: true },
    })
    expect(tx.personnel.update).toHaveBeenCalledWith({
      where: { id: PERSONNEL_ID },
      data: { branchId: BRANCH_ID },
    })
  })

  it("adding a second branch without makePrimary does not reset the existing primary", async () => {
    const tx = createMockTx()
    tx.personnelBranch.findUnique.mockResolvedValue(null)
    tx.personnelBranch.count.mockResolvedValue(1)

    await ensurePersonnelBranch(asTx(tx), PERSONNEL_ID, "branch-2")

    expect(tx.personnelBranch.updateMany).not.toHaveBeenCalled()
    expect(tx.personnelBranch.create).toHaveBeenCalledWith({
      data: { personnelId: PERSONNEL_ID, branchId: "branch-2", isPrimary: false },
    })
    expect(tx.personnel.update).not.toHaveBeenCalled()
  })

  it("is a no-op when the relation already exists and makePrimary is not requested", async () => {
    const tx = createMockTx()
    tx.personnelBranch.findUnique.mockResolvedValue({ isPrimary: true })

    await ensurePersonnelBranch(asTx(tx), PERSONNEL_ID, BRANCH_ID)

    expect(tx.personnelBranch.create).not.toHaveBeenCalled()
    expect(tx.personnelBranch.update).not.toHaveBeenCalled()
    expect(tx.personnelBranch.updateMany).not.toHaveBeenCalled()
    expect(tx.personnel.update).not.toHaveBeenCalled()
  })

  it("promotes an existing non-primary relation via setPersonnelPrimaryBranch when makePrimary is true", async () => {
    const tx = createMockTx()
    tx.personnelBranch.findUnique.mockResolvedValue({ isPrimary: false })

    await ensurePersonnelBranch(asTx(tx), PERSONNEL_ID, BRANCH_ID, { makePrimary: true })

    expect(tx.personnelBranch.updateMany).toHaveBeenCalledWith({
      where: { personnelId: PERSONNEL_ID },
      data: { isPrimary: false },
    })
    expect(tx.personnelBranch.update).toHaveBeenCalledWith({
      where: { personnelId_branchId: { personnelId: PERSONNEL_ID, branchId: BRANCH_ID } },
      data: { isPrimary: true },
    })
    expect(tx.personnel.update).toHaveBeenCalledWith({
      where: { id: PERSONNEL_ID },
      data: { branchId: BRANCH_ID },
    })
  })
})

describe("setPersonnelPrimaryBranch", () => {
  it("unsets all existing primaries, sets the target as primary, and syncs personnel.branchId", async () => {
    const tx = createMockTx()
    tx.personnelBranch.findUnique.mockResolvedValue({ isPrimary: false })

    await setPersonnelPrimaryBranch(asTx(tx), PERSONNEL_ID, BRANCH_ID)

    expect(tx.personnelBranch.updateMany).toHaveBeenCalledWith({
      where: { personnelId: PERSONNEL_ID },
      data: { isPrimary: false },
    })
    expect(tx.personnelBranch.update).toHaveBeenCalledWith({
      where: { personnelId_branchId: { personnelId: PERSONNEL_ID, branchId: BRANCH_ID } },
      data: { isPrimary: true },
    })
    expect(tx.personnel.update).toHaveBeenCalledWith({
      where: { id: PERSONNEL_ID },
      data: { branchId: BRANCH_ID },
    })
  })

  it("creates the relation when it does not exist yet", async () => {
    const tx = createMockTx()
    tx.personnelBranch.findUnique.mockResolvedValue(null)

    await setPersonnelPrimaryBranch(asTx(tx), PERSONNEL_ID, BRANCH_ID)

    expect(tx.personnelBranch.create).toHaveBeenCalledWith({
      data: { personnelId: PERSONNEL_ID, branchId: BRANCH_ID, isPrimary: true },
    })
    expect(tx.personnelBranch.update).not.toHaveBeenCalled()
  })
})

describe("replacePersonnelBranchesFromIds", () => {
  it("dedupes ids, prefers primaryBranchId when present, and syncs personnel.branchId", async () => {
    const tx = createMockTx()

    await replacePersonnelBranchesFromIds(asTx(tx), PERSONNEL_ID, ["b1", "b2", "b1"], "b2")

    expect(tx.personnelBranch.deleteMany).toHaveBeenCalledWith({ where: { personnelId: PERSONNEL_ID } })
    expect(tx.personnelBranch.create).toHaveBeenCalledTimes(2)
    expect(tx.personnelBranch.create).toHaveBeenCalledWith({
      data: { personnelId: PERSONNEL_ID, branchId: "b1", isPrimary: false },
    })
    expect(tx.personnelBranch.create).toHaveBeenCalledWith({
      data: { personnelId: PERSONNEL_ID, branchId: "b2", isPrimary: true },
    })
    expect(tx.personnel.update).toHaveBeenCalledWith({
      where: { id: PERSONNEL_ID },
      data: { branchId: "b2" },
    })
  })

  it("falls back to the first id when primaryBranchId is not in the list", async () => {
    const tx = createMockTx()

    await replacePersonnelBranchesFromIds(asTx(tx), PERSONNEL_ID, ["b1", "b2"], "not-in-list")

    expect(tx.personnelBranch.create).toHaveBeenCalledWith({
      data: { personnelId: PERSONNEL_ID, branchId: "b1", isPrimary: true },
    })
    expect(tx.personnel.update).toHaveBeenCalledWith({
      where: { id: PERSONNEL_ID },
      data: { branchId: "b1" },
    })
  })

  it("removes all branch relations and clears personnel.branchId when given an empty array", async () => {
    const tx = createMockTx()

    await replacePersonnelBranchesFromIds(asTx(tx), PERSONNEL_ID, [], null)

    expect(tx.personnelBranch.deleteMany).toHaveBeenCalledWith({ where: { personnelId: PERSONNEL_ID } })
    expect(tx.personnelBranch.create).not.toHaveBeenCalled()
    expect(tx.personnel.update).toHaveBeenCalledWith({
      where: { id: PERSONNEL_ID },
      data: { branchId: null },
    })
  })
})

type BackfillPerson = {
  id: string
  rosterNo: string
  branchId: string | null
  deletedAt: Date | null
}

function createBackfillDb(opts: {
  people: BackfillPerson[]
  branches: string[]
  existingPb: Array<{ personnelId: string; branchId: string; isPrimary: boolean }>
}) {
  const created: Array<{ personnelId: string; branchId: string; isPrimary: boolean }> = []
  const personnelUpdates: unknown[] = []

  const tx = {
    personnelBranch: {
      create: vi.fn(async ({ data }: { data: { personnelId: string; branchId: string; isPrimary: boolean } }) => {
        created.push(data)
        return data
      }),
    },
    personnel: {
      update: vi.fn(async (args: unknown) => {
        personnelUpdates.push(args)
        return args
      }),
    },
  }

  const db = {
    personnel: {
      findMany: vi.fn(async () => opts.people),
      update: vi.fn(async (args: unknown) => {
        personnelUpdates.push(args)
        return args
      }),
    },
    branch: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        opts.branches.filter((id) => where.id.in.includes(id)).map((id) => ({ id }))
      ),
    },
    personnelBranch: {
      findMany: vi.fn(async () => opts.existingPb),
    },
    $transaction: vi.fn(async (fn: (inner: typeof tx) => Promise<void>) => fn(tx)),
  }

  return { db: db as unknown as PrismaClient, created, personnelUpdates, tx }
}

describe("backfillMissingPrimaryPersonnelBranches", () => {
  const PAD = "pad-branch"
  const OTHER = "other-branch"
  const live = {
    id: "p-live",
    rosterNo: "3",
    branchId: PAD,
    deletedAt: null,
  }
  const softDeleted = {
    id: "p-deleted",
    rosterNo: "ATT-TEST",
    branchId: PAD,
    deletedAt: new Date("2026-08-31T00:00:00.000Z"),
  }

  it("dry-run previews inserts including soft-deleted and does not write", async () => {
    const { db, created, personnelUpdates } = createBackfillDb({
      people: [live, softDeleted, { id: "p-null", rosterNo: "x", branchId: null, deletedAt: null }],
      branches: [PAD],
      existingPb: [],
    })

    const result = await backfillMissingPrimaryPersonnelBranches(db, { dryRun: true })

    expect(result.dryRun).toBe(true)
    expect(result.inserted).toBe(0)
    expect(result.skippedNullBranch).toBe(1)
    expect(result.toInsert).toHaveLength(2)
    expect(result.toInsert.every((row) => row.branchId === PAD && row.isPrimary)).toBe(true)
    expect(created).toHaveLength(0)
    expect(personnelUpdates).toHaveLength(0)
  })

  it("apply inserts one primary matching branchId and never updates Personnel.branchId", async () => {
    const { db, created, personnelUpdates } = createBackfillDb({
      people: [live],
      branches: [PAD],
      existingPb: [],
    })

    const result = await backfillMissingPrimaryPersonnelBranches(db, { dryRun: false })

    expect(result.inserted).toBe(1)
    expect(created).toEqual([{ personnelId: live.id, branchId: PAD, isPrimary: true }])
    expect(personnelUpdates).toHaveLength(0)
  })

  it("skips people who already have a row for the current branchId (idempotent)", async () => {
    const { db, created } = createBackfillDb({
      people: [live],
      branches: [PAD],
      existingPb: [{ personnelId: live.id, branchId: PAD, isPrimary: true }],
    })

    const result = await backfillMissingPrimaryPersonnelBranches(db, { dryRun: false })

    expect(result.skippedAlreadyHasRow).toBe(1)
    expect(result.toInsert).toHaveLength(0)
    expect(result.inserted).toBe(0)
    expect(created).toHaveLength(0)
  })

  it("inserts non-primary when another primary already exists for a different branch", async () => {
    const { db, created } = createBackfillDb({
      people: [live],
      branches: [PAD, OTHER],
      existingPb: [{ personnelId: live.id, branchId: OTHER, isPrimary: true }],
    })

    const result = await backfillMissingPrimaryPersonnelBranches(db, { dryRun: false })

    expect(result.toInsert[0]?.isPrimary).toBe(false)
    expect(created).toEqual([{ personnelId: live.id, branchId: PAD, isPrimary: false }])
  })

  it("skips and reports when Personnel.branchId points at a missing branch", async () => {
    const { db, created } = createBackfillDb({
      people: [live],
      branches: [],
      existingPb: [],
    })

    const result = await backfillMissingPrimaryPersonnelBranches(db, { dryRun: false })

    expect(result.skippedMissingBranch).toEqual([
      { personnelId: live.id, rosterNo: live.rosterNo, branchId: PAD },
    ])
    expect(created).toHaveLength(0)
  })
})
