import { describe, expect, it, vi } from "vitest"
import type { PersonnelDbTx } from "@/modules/hr/application/personnel-branch-utils"
import {
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
