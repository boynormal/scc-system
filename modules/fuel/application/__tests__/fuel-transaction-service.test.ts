import { describe, expect, it, vi } from "vitest"
import { Prisma, type PrismaClient } from "@prisma/client"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"

vi.mock("@/modules/assets", () => ({
  findActiveAsset: vi.fn(async (_db: unknown, { id }: { id: string }) =>
    assetsById[id] ? { id, ...assetsById[id] } : null
  ),
}))
vi.mock("@/modules/notifications", () => ({
  notifyFuelTankLow: vi.fn(async () => 1),
}))

import { notifyFuelTankLow } from "@/modules/notifications"
import {
  adjustFuel,
  dispenseFuel,
  receiveFuel,
  reverseFuelTransaction,
} from "@/modules/fuel/application/fuel-transaction-service"

const CID = "00000000-0000-0000-0000-0000000000cc"
const BRANCH_A = "11111111-1111-1111-1111-111111111111"
const BRANCH_B = "22222222-2222-2222-2222-222222222222"
const TANK_ID = "33333333-3333-4333-8333-333333333333"
const USER_ID = "44444444-4444-4444-4444-444444444444"
const ASSET_A = "55555555-5555-4555-8555-555555555555"
const ASSET_B = "66666666-6666-4666-8666-666666666666"

const assetsById: Record<string, { branchId: string; code: string; name: string; typeName: string; status: string }> = {
  [ASSET_A]: { branchId: BRANCH_A, code: "AST-1", name: "Truck", typeName: "Vehicle", status: "ACTIVE" },
  [ASSET_B]: { branchId: BRANCH_B, code: "AST-2", name: "Loader", typeName: "Vehicle", status: "ACTIVE" },
}

const manager: UserRole[] = [{ branchId: BRANCH_A, branchName: "A", roleName: "Manager", permissions: null }]
const technician: UserRole[] = [{ branchId: BRANCH_A, branchName: "A", roleName: "Technician", permissions: null }]
const managerOfB: UserRole[] = [{ branchId: BRANCH_B, branchName: "B", roleName: "Manager", permissions: null }]

type TxnRow = Record<string, unknown> & { id: string }

function makeDb(tank: { qty: number; avgCost: number; capacity?: number; minLevel?: number }, opts: {
  prevMeter?: number
  txns?: TxnRow[]
} = {}) {
  const state = {
    tank: {
      id: TANK_ID,
      companyId: CID,
      branchId: BRANCH_A,
      code: "T1",
      name: "Diesel tank",
      capacity: new Prisma.Decimal(tank.capacity ?? 5000),
      minLevel: new Prisma.Decimal(tank.minLevel ?? 0),
      currentQty: new Prisma.Decimal(tank.qty),
      avgCost: new Prisma.Decimal(tank.avgCost),
      isActive: true,
      fuelType: { unit: "ลิตร" },
    },
    created: [] as Record<string, unknown>[],
    txns: opts.txns ?? [],
  }
  const db = {
    $queryRaw: vi.fn(async () => []),
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
    supplier: { findFirst: async () => ({ id: "s" }) },
    fuelTank: {
      findFirst: async () => state.tank,
      update: async ({ data }: { data: { currentQty: Prisma.Decimal; avgCost: Prisma.Decimal } }) => {
        state.tank.currentQty = data.currentQty
        state.tank.avgCost = data.avgCost
        return state.tank
      },
    },
    fuelTransaction: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id) return state.txns.find((t) => t.id === where.id) ?? null
        if (where.assetId && opts.prevMeter !== undefined) {
          const occurred = where.occurredAt as Record<string, unknown> | undefined
          if (occurred && "lte" in occurred) return { meterReading: new Prisma.Decimal(opts.prevMeter), occurredAt: new Date() }
        }
        return null
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.created.push(data)
        return {
          id: "new",
          ...data,
          meterReading: data.meterReading ?? null,
          createdAt: new Date(),
          occurredAt: data.occurredAt ?? new Date(),
          branch: { id: BRANCH_A, name: "A" },
          tank: { id: TANK_ID, code: "T1", name: "Diesel tank", fuelType: { name: "Diesel", unit: "ลิตร" } },
          supplier: null,
          asset: null,
          creator: null,
          reversedBy: null,
        }
      },
    },
  }
  return { db: db as unknown as PrismaClient, state }
}

const base = { companyId: CID, userId: USER_ID }

describe("receiveFuel", () => {
  it("writes the ledger row and updates the tank cache", async () => {
    const { db, state } = makeDb({ qty: 1000, avgCost: 30 })
    const res = await receiveFuel(db, { ...base, roles: technician, input: { tankId: TANK_ID, quantity: 500, unitCost: 33 } })
    expect(res.data.type).toBe("RECEIVE")
    expect(state.tank.currentQty.toNumber()).toBe(1500)
    expect(state.tank.avgCost.toNumber()).toBe(31)
    expect(db.$queryRaw).toHaveBeenCalled()
  })

  it("forbids users of another branch", async () => {
    const { db } = makeDb({ qty: 0, avgCost: 0 })
    await expect(
      receiveFuel(db, { ...base, roles: managerOfB, input: { tankId: TANK_ID, quantity: 10, unitCost: 30 } })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe("dispenseFuel", () => {
  it("rejects dispensing more than the tank holds", async () => {
    const { db } = makeDb({ qty: 50, avgCost: 30 })
    await expect(
      dispenseFuel(db, {
        ...base,
        roles: technician,
        input: { tankId: TANK_ID, quantity: 60, targetType: "OTHER", otherTargetName: "Generator" },
      })
    ).rejects.toThrow(/ไม่พอ/)
  })

  it("requires a name for free-text targets", async () => {
    const { db } = makeDb({ qty: 50, avgCost: 30 })
    await expect(
      dispenseFuel(db, { ...base, roles: technician, input: { tankId: TANK_ID, quantity: 5, targetType: "OTHER" } })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("rejects an asset from another branch", async () => {
    const { db } = makeDb({ qty: 500, avgCost: 30 })
    await expect(
      dispenseFuel(db, {
        ...base,
        roles: technician,
        input: { tankId: TANK_ID, quantity: 5, targetType: "ASSET", assetId: ASSET_B },
      })
    ).rejects.toThrow(/สาขาเดียวกับถัง/)
  })

  it("rejects a meter reading lower than the previous one", async () => {
    const { db } = makeDb({ qty: 500, avgCost: 30 }, { prevMeter: 12000 })
    await expect(
      dispenseFuel(db, {
        ...base,
        roles: technician,
        input: {
          tankId: TANK_ID,
          quantity: 40,
          targetType: "ASSET",
          assetId: ASSET_A,
          meterType: "ODOMETER",
          meterReading: 11999,
        },
      })
    ).rejects.toThrow(/ไม่น้อยกว่าครั้งก่อน/)
  })

  it("dispenses to an asset at the average cost and alerts when crossing the minimum", async () => {
    const { db, state } = makeDb({ qty: 300, avgCost: 31, minLevel: 200 }, { prevMeter: 12000 })
    const res = await dispenseFuel(db, {
      ...base,
      roles: technician,
      input: {
        tankId: TANK_ID,
        quantity: 150,
        targetType: "ASSET",
        assetId: ASSET_A,
        meterType: "ODOMETER",
        meterReading: 12500,
      },
    })
    expect(res.data.quantity).toBe(-150)
    expect(res.data.totalCost).toBe(4650)
    expect(state.tank.currentQty.toNumber()).toBe(150)
    expect(state.created[0].otherTargetName).toBeNull()
    expect(notifyFuelTankLow).toHaveBeenCalledOnce()
  })
})

describe("adjustFuel / reverseFuelTransaction", () => {
  it("requires approve permission for adjustments", async () => {
    const { db } = makeDb({ qty: 1000, avgCost: 30 })
    await expect(
      adjustFuel(db, { ...base, roles: technician, input: { tankId: TANK_ID, measuredQty: 990, remark: "dip" } })
    ).rejects.toBeInstanceOf(ForbiddenError)
    const res = await adjustFuel(db, { ...base, roles: manager, input: { tankId: TANK_ID, measuredQty: 990, remark: "dip" } })
    expect(res.data.quantity).toBe(-10)
  })

  it("refuses to reverse twice or reverse a reversal", async () => {
    const reversed: TxnRow = {
      id: "t1",
      tankId: TANK_ID,
      branchId: BRANCH_A,
      type: "DISPENSE",
      quantity: new Prisma.Decimal(-10),
      unitCost: new Prisma.Decimal(30),
      reversedBy: { id: "t2" },
    }
    const reversal: TxnRow = { ...reversed, id: "t3", type: "REVERSAL", reversedBy: null }
    const { db } = makeDb({ qty: 1000, avgCost: 30 }, { txns: [reversed, reversal] })
    await expect(
      reverseFuelTransaction(db, { ...base, roles: manager, id: "t1", input: { remark: "x" } })
    ).rejects.toThrow(/ถูกยกเลิกไปแล้ว/)
    await expect(
      reverseFuelTransaction(db, { ...base, roles: manager, id: "t3", input: { remark: "x" } })
    ).rejects.toThrow(/ยกเลิกซ้ำ/)
  })

  it("reverses a dispense back into the tank", async () => {
    const original: TxnRow = {
      id: "t1",
      tankId: TANK_ID,
      branchId: BRANCH_A,
      type: "DISPENSE",
      quantity: new Prisma.Decimal(-10),
      unitCost: new Prisma.Decimal(30),
      reversedBy: null,
    }
    const { db, state } = makeDb({ qty: 990, avgCost: 30 }, { txns: [original] })
    const res = await reverseFuelTransaction(db, { ...base, roles: manager, id: "t1", input: { remark: "wrong tank" } })
    expect(res.data.type).toBe("REVERSAL")
    expect(state.tank.currentQty.toNumber()).toBe(1000)
    expect(state.created[0].reversalOfId).toBe("t1")
  })
})
