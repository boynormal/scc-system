import { describe, expect, it, vi } from "vitest"
import type { Prisma, PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import { addFrequency, generatePmForPlan, parseDateOnly } from "@/modules/maintenance/application/pm-generator"
import { generateMaintenanceSchedulesForUser } from "@/modules/maintenance/application/maintenance-schedule-service"

type Schedule = { id: string; planId: string; dueDate: Date; status: string; workOrderId: string | null }

function basePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    name: "PM รายสัปดาห์",
    description: null,
    machineId: "machine-1",
    typeId: "type-1",
    frequencyUnit: "week",
    frequencyValue: 1,
    startDate: new Date("2026-10-01T00:00:00.000Z"),
    endDate: null,
    lastGeneratedDate: null,
    leadTimeDays: 7,
    isActive: true,
    estimatedDurationMin: 60,
    createdAt: new Date(2026, 9, 1, 9, 0, 0),
    machine: { branchId: "branch-1", deletedAt: null },
    ...overrides,
  }
}

/** Minimal in-memory stand-in for the tables the generator writes. */
function createStore(plan: ReturnType<typeof basePlan>) {
  const schedules: Schedule[] = []
  const workOrders: { id: string; scheduleId: string; workKind: string; status: string }[] = []
  const results: { workOrderId: string; itemId: string }[] = []
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    maintenancePlan: {
      findUnique: vi.fn(async () => plan),
      update: vi.fn(async ({ data }: { data: { lastGeneratedDate: Date } }) => {
        plan.lastGeneratedDate = data.lastGeneratedDate as never
        return plan
      }),
    },
    maintenanceSchedule: {
      createMany: vi.fn(async ({ data }: { data: { planId: string; dueDate: Date; status: string }[] }) => {
        let count = 0
        for (const row of data) {
          const exists = schedules.some(
            (s) => s.planId === row.planId && s.dueDate.getTime() === row.dueDate.getTime()
          )
          if (exists) continue
          schedules.push({ id: `s-${schedules.length + 1}`, planId: row.planId, dueDate: row.dueDate, status: row.status, workOrderId: null })
          count++
        }
        return { count }
      }),
      updateMany: vi.fn(async ({ where }: { where: { dueDate: { lt: Date } } }) => {
        let count = 0
        for (const s of schedules) {
          if (s.status === "pending" && s.dueDate < where.dueDate.lt) {
            s.status = "overdue"
            count++
          }
        }
        return { count }
      }),
      findMany: vi.fn(async () =>
        schedules
          .filter((s) => (s.status === "pending" || s.status === "overdue") && !s.workOrderId)
          .map((s) => ({ id: s.id, dueDate: s.dueDate }))
      ),
    },
    workOrder: {
      count: vi.fn(async () => workOrders.length),
      create: vi.fn(async ({ data }: { data: { scheduleId: string; workKind: string; status: string } }) => {
        const id = `wo-${workOrders.length + 1}`
        workOrders.push({ id, scheduleId: data.scheduleId, workKind: data.workKind, status: data.status })
        const schedule = schedules.find((s) => s.id === data.scheduleId)
        if (schedule) schedule.workOrderId = id
        return { id }
      }),
    },
    workOrderStatusHistory: { create: vi.fn() },
    checklistItem: { findMany: vi.fn(async () => [{ id: "item-1" }, { id: "item-2" }]) },
    checklistResult: {
      createMany: vi.fn(async ({ data }: { data: { workOrderId: string; itemId: string }[] }) => {
        results.push(...data)
        return { count: data.length }
      }),
    },
  }
  return { tx, schedules, workOrders, results }
}

function asTx(tx: unknown) {
  return tx as Prisma.TransactionClient
}

describe("date helpers", () => {
  it("parses calendar dates without shifting the day", () => {
    expect(parseDateOnly("2026-10-21")?.toISOString()).toBe("2026-10-21T00:00:00.000Z")
    expect(parseDateOnly("21/10/2026")).toBeNull()
  })

  it("adds months in UTC and refuses runtime hours", () => {
    expect(addFrequency(new Date("2026-01-15T00:00:00.000Z"), "month", 1)?.toISOString()).toBe("2026-02-15T00:00:00.000Z")
    expect(addFrequency(new Date("2026-01-15T00:00:00.000Z"), "runtime_hour", 100)).toBeNull()
  })
})

describe("generatePmForPlan", () => {
  it("creates rounds and preventive work orders once, and a second run adds nothing", async () => {
    const plan = basePlan()
    const store = createStore(plan)
    const today = new Date(2026, 9, 21, 10, 0, 0)

    const first = await generatePmForPlan(asTx(store.tx), { planId: plan.id, today, userId: "user-1" })
    // Weekly from 1 Oct with 7 days lead time up to 28 Oct: 8, 15, 22, 29? 29 > 28, so 8, 15, 22.
    expect(first.schedulesCreated).toBe(3)
    expect(first.workOrdersCreated).toBe(3)
    expect(store.workOrders.every((wo) => wo.workKind === "preventive" && wo.status === "open")).toBe(true)
    expect(store.results).toHaveLength(6)
    expect(store.tx.workOrderStatusHistory.create).toHaveBeenCalledTimes(3)
    expect(store.tx.$executeRaw).toHaveBeenCalled()

    const second = await generatePmForPlan(asTx(store.tx), { planId: plan.id, today, userId: "user-1" })
    expect(second).toEqual({ schedulesCreated: 0, workOrdersCreated: 0 })
    expect(store.schedules).toHaveLength(3)
    expect(store.workOrders).toHaveLength(3)
  })

  it("marks past pending rounds overdue", async () => {
    const plan = basePlan()
    const store = createStore(plan)
    await generatePmForPlan(asTx(store.tx), { planId: plan.id, today: new Date(2026, 9, 21, 10), userId: null })
    const statuses = store.schedules.map((s) => `${s.dueDate.toISOString().slice(0, 10)}:${s.status}`)
    expect(statuses).toEqual(["2026-10-08:overdue", "2026-10-15:overdue", "2026-10-22:pending"])
  })

  it("skips runtime-hour plans", async () => {
    const plan = basePlan({ frequencyUnit: "runtime_hour", frequencyValue: 250 })
    const store = createStore(plan)
    const outcome = await generatePmForPlan(asTx(store.tx), { planId: plan.id, today: new Date(2026, 9, 21), userId: null })
    expect(outcome.skipped).toBe("runtime_hour")
    expect(store.tx.maintenanceSchedule.createMany).not.toHaveBeenCalled()
    expect(store.tx.workOrder.create).not.toHaveBeenCalled()
  })

  it("skips plans whose machine was deleted", async () => {
    const plan = basePlan({ machine: { branchId: "branch-1", deletedAt: new Date() } })
    const store = createStore(plan)
    const outcome = await generatePmForPlan(asTx(store.tx), { planId: plan.id, today: new Date(2026, 9, 21), userId: null })
    expect(outcome.skipped).toBe("machine_deleted")
    expect(store.tx.workOrder.create).not.toHaveBeenCalled()
  })

  it("does not owe rounds that fell due before the plan was created", async () => {
    const plan = basePlan({
      startDate: new Date("2025-01-01T00:00:00.000Z"),
      frequencyUnit: "month",
      createdAt: new Date(2026, 9, 5, 9, 0, 0),
    })
    const store = createStore(plan)
    await generatePmForPlan(asTx(store.tx), { planId: plan.id, today: new Date(2026, 9, 21), userId: null })
    expect(store.schedules.map((s) => s.dueDate.toISOString().slice(0, 10))).toEqual([])
    expect((plan.lastGeneratedDate as Date | null)?.toISOString().slice(0, 10)).toBe("2026-10-01")
  })
})

describe("generateMaintenanceSchedulesForUser", () => {
  const managerRole = (branchId: string): UserRole => ({ branchId, branchName: "B", roleName: "Manager", permissions: null })
  const customRole = (branchId: string): UserRole => ({
    branchId,
    branchName: "B",
    roleName: "Planner",
    permissions: { schedules: ["read", "create"] } as never,
  })

  it("rejects users without schedules:create in any company branch", async () => {
    const db = {
      branch: { findMany: vi.fn().mockResolvedValue([{ id: "branch-1" }, { id: "branch-2" }]) },
      maintenancePlan: { findMany: vi.fn() },
    }
    const result = await generateMaintenanceSchedulesForUser(db as unknown as PrismaClient, {
      companyId: "c-1",
      roles: [managerRole("branch-1")],
      userId: "u-1",
    })
    expect(result).toEqual({ error: "Forbidden", status: 403 })
    expect(db.maintenancePlan.findMany).not.toHaveBeenCalled()
  })

  it("only generates plans in branches the user may create schedules for", async () => {
    const db = {
      branch: { findMany: vi.fn().mockResolvedValue([{ id: "branch-1" }, { id: "branch-2" }]) },
      maintenancePlan: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(),
    }
    const result = await generateMaintenanceSchedulesForUser(db as unknown as PrismaClient, {
      companyId: "c-1",
      roles: [customRole("branch-2")],
      userId: "u-1",
    })
    expect(result).toEqual({ data: { plans: 0, schedulesCreated: 0, workOrdersCreated: 0 } })
    const where = db.maintenancePlan.findMany.mock.calls[0][0].where
    const scoped = where.AND[1].OR
    expect(scoped[0].asset).toEqual({ companyId: "c-1", branchId: { in: ["branch-2"] } })
    expect(scoped[1]).toEqual({
      assetId: null,
      machine: { branchId: { in: ["branch-2"] }, branch: { companyId: "c-1" } },
    })
  })
})
