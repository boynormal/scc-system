import { describe, expect, it, vi } from "vitest"
import type { Prisma, PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import { linkAssetTarget, setAssetMaintenancePm } from "@/modules/assets/application/asset-maintenance-service"
import { createMaintenancePlan } from "@/modules/maintenance/application/maintenance-plan-service"
import { listPmAssetOptions, loadPmAsset } from "@/modules/maintenance/application/pm-asset-options"
import { generatePmForPlan, generatePreventiveWork } from "@/modules/maintenance/application/pm-generator"
import { recordChecklistResult } from "@/modules/work_orders/application/work-order-checklist-service"
import { performAssignment } from "@/modules/transport/application/assignment-service"

const admin: UserRole = { branchId: "branch-1", branchName: "HQ", roleName: "Admin", permissions: null }
const ASSET_ID = "11111111-1111-4111-8111-111111111111"
const TYPE_ID = "22222222-2222-4222-8222-222222222222"

function assetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ASSET_ID,
    companyId: "company-1",
    branchId: "branch-1",
    code: "AS-001",
    name: "รถบรรทุก 6 ล้อ",
    status: "ACTIVE",
    isActive: true,
    deletedAt: null,
    maintenancePmEnabled: true,
    type: { name: "VEHICLE" },
    branch: { name: "HQ" },
    machine: null,
    vehicle: { id: "vehicle-1", plateNumber: "70-1234", name: "6 ล้อ" },
    ...overrides,
  }
}

describe("asset switch and link", () => {
  it("refuses to switch on a retired asset", async () => {
    const db = {
      asset: { findFirst: vi.fn().mockResolvedValue(assetRow({ status: "RETIRED", maintenancePmEnabled: false })), update: vi.fn() },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn(),
    }
    await expect(
      setAssetMaintenancePm(db as unknown as PrismaClient, {
        companyId: "company-1",
        roles: [admin],
        userId: "user-1",
        id: ASSET_ID,
        enabled: true,
      })
    ).rejects.toThrow("ปลดระวาง")
    expect(db.asset.update).not.toHaveBeenCalled()
  })

  it("writes an audit row when the switch changes", async () => {
    const db = {
      asset: { findFirst: vi.fn().mockResolvedValue(assetRow({ maintenancePmEnabled: false })), update: vi.fn() },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn().mockResolvedValue([]),
    }
    const result = await setAssetMaintenancePm(db as unknown as PrismaClient, {
      companyId: "company-1",
      roles: [admin],
      userId: "user-1",
      id: ASSET_ID,
      enabled: true,
    })
    expect(result).toEqual({ data: { enabled: true } })
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tableName: "assets", recordId: ASSET_ID }) })
    )
  })

  function linkDb(vehicle: Record<string, unknown> | null) {
    return {
      asset: { findFirst: vi.fn().mockResolvedValue(assetRow({ vehicle: null })) },
      transportVehicle: { findFirst: vi.fn().mockResolvedValue(vehicle), updateMany: vi.fn(), update: vi.fn() },
      machine: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn(),
    }
  }

  const linkParams = {
    companyId: "company-1",
    roles: [admin],
    userId: "user-1",
    id: ASSET_ID,
    input: { kind: "vehicle" as const, targetId: "33333333-3333-4333-8333-333333333333" },
  }

  it("rejects a vehicle already linked to another asset", async () => {
    const db = linkDb({ id: "v", branchId: "branch-1", assetId: "other-asset", isActive: true })
    await expect(linkAssetTarget(db as unknown as PrismaClient, linkParams)).rejects.toThrow("ผูกกับทรัพย์สินอื่นแล้ว")
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("rejects a vehicle in another branch", async () => {
    const db = linkDb({ id: "v", branchId: "branch-2", assetId: null, isActive: true })
    await expect(linkAssetTarget(db as unknown as PrismaClient, linkParams)).rejects.toThrow("สาขาเดียวกับทรัพย์สิน")
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("rejects a vehicle from another company (not found in company scope)", async () => {
    const db = linkDb(null)
    await expect(linkAssetTarget(db as unknown as PrismaClient, linkParams)).rejects.toThrow("ไม่พบรถ")
    expect(db.transportVehicle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: "company-1" }) })
    )
  })
})

describe("plan options follow the switch", () => {
  it("only offers enabled, active, non-retired assets", async () => {
    const db = { asset: { findMany: vi.fn().mockResolvedValue([assetRow()]) } }
    const options = await listPmAssetOptions(db as unknown as PrismaClient, {
      companyId: "company-1",
      roles: [admin],
      resource: "maintenance_plans",
      action: "create",
    })
    expect(options.map((o) => o.id)).toEqual([ASSET_ID])
    expect(db.asset.findMany.mock.calls[0][0].where.OR[0]).toEqual({
      deletedAt: null,
      isActive: true,
      maintenancePmEnabled: true,
      status: { notIn: ["RETIRED", "DISPOSED"] },
    })
  })

  it("loadPmAsset returns null once the switch is off", async () => {
    const on = { asset: { findFirst: vi.fn().mockResolvedValue(assetRow()) } }
    const off = { asset: { findFirst: vi.fn().mockResolvedValue(assetRow({ maintenancePmEnabled: false })) } }
    expect(await loadPmAsset(on as unknown as PrismaClient, "company-1", ASSET_ID)).not.toBeNull()
    expect(await loadPmAsset(off as unknown as PrismaClient, "company-1", ASSET_ID)).toBeNull()
  })

  it("createMaintenancePlan rejects an asset whose switch is off", async () => {
    const db = {
      asset: { findFirst: vi.fn().mockResolvedValue(assetRow({ maintenancePmEnabled: false })) },
      maintenanceType: { findFirst: vi.fn() },
      $transaction: vi.fn(),
    }
    const result = await createMaintenancePlan(db as unknown as PrismaClient, {
      userId: "user-1",
      companyId: "company-1",
      roles: [admin],
      input: {
        assetId: ASSET_ID,
        typeId: TYPE_ID,
        name: "PM รถ",
        frequencyUnit: "month",
        frequencyValue: 1,
        startDate: "2026-10-01",
        leadTimeDays: 7,
      },
    })
    expect(result).toMatchObject({ status: 400 })
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})

function planFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    name: "PM",
    machineId: null as string | null,
    assetId: ASSET_ID as string | null,
    typeId: TYPE_ID,
    frequencyUnit: "week",
    frequencyValue: 1,
    startDate: new Date("2026-10-01T00:00:00.000Z"),
    endDate: null,
    lastGeneratedDate: null,
    leadTimeDays: 7,
    isActive: true,
    estimatedDurationMin: null,
    createdAt: new Date(2026, 9, 1, 9),
    machine: null as Record<string, unknown> | null,
    asset: assetRow() as Record<string, unknown> | null,
    ...overrides,
  }
}

function generatorTx(plan: ReturnType<typeof planFixture>) {
  const scheduleRows: Record<string, unknown>[] = []
  const woRows: Record<string, unknown>[] = []
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    maintenancePlan: { findUnique: vi.fn(async () => plan), update: vi.fn() },
    maintenanceSchedule: {
      createMany: vi.fn(async ({ data }: { data: Record<string, unknown>[] }) => {
        data.forEach((row, i) => scheduleRows.push({ ...row, id: `s-${i}` }))
        return { count: data.length }
      }),
      updateMany: vi.fn(),
      findMany: vi.fn(async () => scheduleRows.map((r) => ({ id: r.id, dueDate: r.dueDate }))),
    },
    workOrder: {
      count: vi.fn(async () => woRows.length),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        woRows.push(data)
        return { id: `wo-${woRows.length}` }
      }),
    },
    workOrderStatusHistory: { create: vi.fn() },
    checklistItem: { findMany: vi.fn(async () => []) },
    checklistResult: { createMany: vi.fn() },
  }
  return { tx, scheduleRows, woRows }
}

describe("generator and asset targets", () => {
  const today = new Date(2026, 9, 21, 10)

  it("skips a plan whose asset switch is off", async () => {
    const plan = planFixture({ asset: assetRow({ maintenancePmEnabled: false }) })
    const { tx } = generatorTx(plan)
    const outcome = await generatePmForPlan(tx as unknown as Prisma.TransactionClient, { planId: plan.id, today, userId: null })
    expect(outcome.skipped).toBe("asset_inactive")
    expect(tx.maintenanceSchedule.createMany).not.toHaveBeenCalled()
  })

  it("writes assetId and the asset branch onto rounds and PM work orders", async () => {
    const plan = planFixture({ asset: assetRow({ branchId: "branch-9" }) })
    const { tx, scheduleRows, woRows } = generatorTx(plan)
    await generatePmForPlan(tx as unknown as Prisma.TransactionClient, { planId: plan.id, today, userId: null })
    expect(scheduleRows.length).toBeGreaterThan(0)
    expect(scheduleRows.every((r) => r.assetId === ASSET_ID && r.machineId === null)).toBe(true)
    expect(woRows.every((r) => r.assetId === ASSET_ID && r.branchId === "branch-9")).toBe(true)
  })

  it("still generates legacy machine-only plans", async () => {
    const plan = planFixture({
      assetId: null,
      asset: null,
      machineId: "machine-1",
      machine: { id: "machine-1", code: "M01", name: "Lathe", branchId: "branch-1", deletedAt: null },
    })
    const { tx, scheduleRows, woRows } = generatorTx(plan)
    const outcome = await generatePmForPlan(tx as unknown as Prisma.TransactionClient, { planId: plan.id, today, userId: null })
    expect(outcome.schedulesCreated).toBeGreaterThan(0)
    expect(scheduleRows.every((r) => r.machineId === "machine-1" && r.assetId === null)).toBe(true)
    expect(woRows.every((r) => r.branchId === "branch-1")).toBe(true)
  })

  it("filters out disabled assets in the cron query", async () => {
    const db = { maintenancePlan: { findMany: vi.fn().mockResolvedValue([]) } }
    await generatePreventiveWork(db as unknown as PrismaClient, { today })
    const where = db.maintenancePlan.findMany.mock.calls[0][0].where
    expect(where.AND[0].OR[0].asset).toMatchObject({ maintenancePmEnabled: true, isActive: true, deletedAt: null })
    expect(where.AND[0].OR[1]).toEqual({ assetId: null, machine: { deletedAt: null } })
  })
})

describe("failed check on a vehicle-linked asset", () => {
  it("opens a corrective work order in Maintenance and never touches transport repair logs", async () => {
    const pm = {
      id: "wo-pm",
      woNumber: "WO-2026-00001",
      status: "in_progress",
      branchId: "branch-1",
      machineId: null,
      assetId: ASSET_ID,
      typeId: TYPE_ID,
      priority: "medium",
    }
    const transportRepairLog = { create: vi.fn(), update: vi.fn(), count: vi.fn() }
    const db = {
      workOrder: {
        findFirst: vi.fn().mockResolvedValue(pm),
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue({ id: "wo-fix", woNumber: "WO-2026-00002" }),
      },
      checklistResult: {
        findFirst: vi.fn().mockResolvedValue({
          id: "res-1",
          item: { itemName: "ลมยาง", itemType: "pass_fail", unit: null, standardValue: null },
          followUp: null,
        }),
        update: vi.fn(),
      },
      workOrderStatusHistory: { create: vi.fn() },
      transportRepairLog,
      $executeRaw: vi.fn(),
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
    }
    const result = await recordChecklistResult(db as unknown as PrismaClient, {
      id: pm.id,
      companyId: "company-1",
      userId: "user-1",
      roles: [admin],
      input: { resultId: "44444444-4444-4444-8444-444444444444", status: "fail" },
    })
    expect(result).toMatchObject({ data: { followUp: { created: true } } })
    expect(db.workOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workKind: "corrective", assetId: ASSET_ID, machineId: null, branchId: "branch-1" }),
      })
    )
    expect(transportRepairLog.create).not.toHaveBeenCalled()
    expect(transportRepairLog.update).not.toHaveBeenCalled()
  })
})

describe("transport assignment reads maintenance work orders", () => {
  it("refuses a vehicle whose asset has a maintenance work order in progress", async () => {
    const db = {
      transportVehicle: {
        findFirst: vi.fn().mockResolvedValue({
          id: "vehicle-1",
          plateNumber: "70-1234",
          currentStatus: "available",
          assetId: ASSET_ID,
        }),
        update: vi.fn(),
      },
      workOrder: { findFirst: vi.fn().mockResolvedValue({ woNumber: "WO-2026-00002" }) },
      driver: { findFirst: vi.fn() },
      $transaction: vi.fn(),
    }
    await expect(
      performAssignment(db as unknown as PrismaClient, {
        jobId: "job-1",
        companyId: "company-1",
        userId: "user-1",
        scheduledDate: null,
        input: { vehicleId: "55555555-5555-4555-8555-555555555555", driverId: "66666666-6666-4666-8666-666666666666" },
      })
    ).rejects.toThrow("WO-2026-00002")
    expect(db.workOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { assetId: ASSET_ID, status: { in: ["in_progress", "on_hold"] } } })
    )
    expect(db.transportVehicle.update).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("lets an unlinked vehicle through to the existing checks", async () => {
    const db = {
      transportVehicle: {
        findFirst: vi.fn().mockResolvedValue({ id: "v", plateNumber: "70-9", currentStatus: "available", assetId: null }),
      },
      workOrder: { findFirst: vi.fn() },
      driver: { findFirst: vi.fn().mockResolvedValue(null) },
    }
    await expect(
      performAssignment(db as unknown as PrismaClient, {
        jobId: "job-1",
        companyId: "company-1",
        userId: "user-1",
        scheduledDate: null,
        input: { vehicleId: "55555555-5555-4555-8555-555555555555", driverId: "66666666-6666-4666-8666-666666666666" },
      })
    ).rejects.toThrow("Driver not found")
    expect(db.workOrder.findFirst).not.toHaveBeenCalled()
  })
})
