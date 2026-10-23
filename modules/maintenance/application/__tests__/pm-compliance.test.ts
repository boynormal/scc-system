import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import { classifyPmRound, getPMCompliance } from "@/modules/maintenance/application/pm-compliance"

const adminRole: UserRole = { branchId: "branch-1", branchName: "HQ", roleName: "Admin", permissions: null }
const today = new Date(2026, 9, 21, 10, 0, 0)
const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

function round(id: string, dueDate: string, extra: {
  status?: string
  machineDeleted?: boolean
  wo?: { status: string; doneAt?: Date; closedAt?: Date } | null
} = {}) {
  return {
    id,
    dueDate: utc(dueDate),
    status: extra.status ?? "pending",
    plan: { id: "plan-1", name: "PM", type: { code: "PM", color: null } },
    machine: { id: "m-1", name: "Lathe", code: "M01", deletedAt: extra.machineDeleted ? new Date() : null, branch: { name: "HQ" } },
    workOrder: extra.wo
      ? {
          id: `wo-${id}`,
          woNumber: `WO-${id}`,
          status: extra.wo.status,
          closedAt: extra.wo.closedAt ?? null,
          statusHistory: extra.wo.doneAt ? [{ changedAt: extra.wo.doneAt }] : [],
        }
      : null,
  }
}

describe("classifyPmRound", () => {
  it("counts handover before the end of the due day as on time", () => {
    const result = classifyPmRound({
      dueDate: utc("2026-10-10"),
      scheduleStatus: "completed",
      machineDeleted: false,
      workOrderStatus: "handed_over",
      doneAt: new Date(2026, 9, 10, 23, 30),
      today,
    })
    expect(result.state).toBe("on_time")
  })

  it("counts handover the next day as late", () => {
    const result = classifyPmRound({
      dueDate: utc("2026-10-10"),
      scheduleStatus: "completed",
      machineDeleted: false,
      workOrderStatus: "closed",
      doneAt: new Date(2026, 9, 11, 0, 5),
      today,
    })
    expect(result.state).toBe("late")
  })
})

describe("getPMCompliance", () => {
  it("builds the denominator from due rounds and reports exclusions separately", async () => {
    const db = {
      maintenanceSchedule: {
        findMany: vi.fn().mockResolvedValue([
          round("a", "2026-10-05", { status: "completed", wo: { status: "closed", doneAt: new Date(2026, 9, 5, 15) } }),
          round("b", "2026-10-06", { status: "completed", wo: { status: "handed_over", doneAt: new Date(2026, 9, 8, 9) } }),
          round("c", "2026-10-07", { status: "overdue", wo: { status: "in_progress" } }),
          round("d", "2026-10-08", { status: "overdue", wo: null }),
          round("e", "2026-10-09", { status: "cancelled", wo: { status: "cancelled" } }),
          round("f", "2026-10-12", { status: "skipped" }),
          round("g", "2026-10-13", { machineDeleted: true, wo: { status: "open" } }),
          round("h", "2026-10-21", { wo: { status: "open" } }),
          round("i", "2026-10-21", { status: "completed", wo: { status: "closed", doneAt: new Date(2026, 9, 21, 9) } }),
          round("j", "2026-10-25", { wo: { status: "open" } }),
        ]),
      },
    }
    const result = await getPMCompliance(db as unknown as PrismaClient, {
      companyId: "company-1",
      roles: [adminRole],
      from: utc("2026-10-01"),
      to: utc("2026-10-31"),
      today,
    })
    expect(result.due).toBe(5)
    expect(result.onTime).toBe(2)
    expect(result.late).toBe(1)
    expect(result.open).toBe(2)
    expect(result.rate).toBe(40)
    expect(result.dueToday).toBe(1)
    expect(result.upcoming).toBe(1)
    expect(result.excluded).toEqual({ total: 3, cancelled: 1, skipped: 1, machine_deleted: 1, asset_inactive: 0 })
    expect(result.items.find((item) => item.scheduleId === "g")?.excludeReason).toBe("machine_deleted")
  })

  it("returns nothing for a user without schedule read access", async () => {
    const db = { maintenanceSchedule: { findMany: vi.fn() } }
    const viewerElsewhere: UserRole = { branchId: "branch-1", branchName: "HQ", roleName: "Nobody", permissions: {} as never }
    const result = await getPMCompliance(db as unknown as PrismaClient, {
      companyId: "company-1",
      roles: [viewerElsewhere],
      from: utc("2026-10-01"),
      to: utc("2026-10-31"),
      today,
    })
    expect(result.due).toBe(0)
    expect(result.rate).toBeNull()
    expect(db.maintenanceSchedule.findMany).not.toHaveBeenCalled()
  })
})
