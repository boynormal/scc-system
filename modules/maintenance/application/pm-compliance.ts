import type { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import { readableBranchIds } from "@/modules/maintenance/application/branch-scope"
import { toDateOnly } from "@/modules/maintenance/application/pm-generator"
import {
  resolveTarget,
  targetAssetSelect,
  targetHref,
  targetInactiveReason,
  targetScopeWhere,
} from "@/modules/maintenance/application/pm-target"

export type PmItemState = "on_time" | "late" | "open" | "due_today" | "upcoming" | "excluded"
export type PmExcludeReason = "cancelled" | "skipped" | "machine_deleted" | "asset_inactive"

export type PmComplianceItem = {
  scheduleId: string
  dueDate: Date
  state: PmItemState
  excludeReason: PmExcludeReason | null
  doneAt: Date | null
  plan: { id: string; name: string; typeCode: string; typeColor: string | null }
  target: { kind: "asset" | "machine"; id: string; name: string; code: string; href: string }
  branchName: string
  workOrder: { id: string; woNumber: string; status: string } | null
}

export type PmCompliance = {
  /** Rounds that count: due before today, plus rounds due today that are already done. */
  due: number
  onTime: number
  /** null when nothing is due yet. */
  rate: number | null
  late: number
  open: number
  dueToday: number
  upcoming: number
  excluded: { total: number; cancelled: number; skipped: number; machine_deleted: number; asset_inactive: number }
  items: PmComplianceItem[]
}

const DONE_STATUSES = ["handed_over", "closed"] as const

/** วันครบกำหนดเก็บเป็นเที่ยงคืน UTC ของวันนั้น เส้นตายคือสิ้นวันตามเวลาเซิร์ฟเวอร์ */
function endOfDueDay(dueDate: Date): Date {
  return new Date(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate() + 1)
}

export function classifyPmRound(input: {
  dueDate: Date
  scheduleStatus: string
  machineDeleted: boolean
  assetInactive?: boolean
  workOrderStatus: string | null
  doneAt: Date | null
  today: Date
}): { state: PmItemState; excludeReason: PmExcludeReason | null } {
  if (input.assetInactive) return { state: "excluded", excludeReason: "asset_inactive" }
  if (input.machineDeleted) return { state: "excluded", excludeReason: "machine_deleted" }
  if (input.scheduleStatus === "skipped") return { state: "excluded", excludeReason: "skipped" }
  if (input.scheduleStatus === "cancelled" || input.workOrderStatus === "cancelled") {
    return { state: "excluded", excludeReason: "cancelled" }
  }
  const today = toDateOnly(input.today).getTime()
  const due = input.dueDate.getTime()
  if (input.doneAt) {
    if (due > today) return { state: "upcoming", excludeReason: null }
    return { state: input.doneAt < endOfDueDay(input.dueDate) ? "on_time" : "late", excludeReason: null }
  }
  if (due > today) return { state: "upcoming", excludeReason: null }
  if (due === today) return { state: "due_today", excludeReason: null }
  return { state: "open", excludeReason: null }
}

/**
 * ตัวเลข PM compliance ของช่วงวันที่ ใช้ที่เดียวนี้เท่านั้น
 * ตัวตั้ง: ใบ PM ที่ส่งมอบหรือปิดภายในวันครบกำหนด
 * ตัวหาร: รอบที่ถึงกำหนดแล้วในช่วงนั้น รวมงานที่เลยกำหนดและยังไม่ปิด
 */
export async function getPMCompliance(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; from: Date; to: Date; today?: Date }
): Promise<PmCompliance> {
  const empty: PmCompliance = {
    due: 0,
    onTime: 0,
    rate: null,
    late: 0,
    open: 0,
    dueToday: 0,
    upcoming: 0,
    excluded: { total: 0, cancelled: 0, skipped: 0, machine_deleted: 0, asset_inactive: 0 },
    items: [],
  }
  const scope = readableBranchIds(params.roles, "schedules")
  if (scope !== "all" && scope.length === 0) return empty
  const today = params.today ?? new Date()

  const schedules = await db.maintenanceSchedule.findMany({
    where: {
      dueDate: { gte: params.from, lte: params.to },
      AND: [targetScopeWhere(params.companyId, scope)],
    },
    include: {
      plan: { select: { id: true, name: true, type: { select: { code: true, color: true } } } },
      machine: { select: { id: true, name: true, code: true, branchId: true, deletedAt: true, branch: { select: { name: true } } } },
      asset: { select: targetAssetSelect },
      workOrder: {
        select: {
          id: true,
          woNumber: true,
          status: true,
          closedAt: true,
          statusHistory: {
            where: { toStatus: { in: [...DONE_STATUSES] } },
            orderBy: { changedAt: "asc" },
            take: 1,
            select: { changedAt: true },
          },
        },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  })

  const result: PmCompliance = { ...empty, excluded: { ...empty.excluded }, items: [] }
  for (const schedule of schedules) {
    const target = resolveTarget(schedule)
    if (!target) continue
    const inactive = targetInactiveReason(schedule)
    const wo = schedule.workOrder
    const doneAt = wo
      ? wo.statusHistory[0]?.changedAt ??
        (DONE_STATUSES.includes(wo.status as (typeof DONE_STATUSES)[number]) ? wo.closedAt : null)
      : null
    const { state, excludeReason } = classifyPmRound({
      dueDate: schedule.dueDate,
      scheduleStatus: schedule.status,
      machineDeleted: inactive === "machine_deleted",
      assetInactive: inactive === "asset_inactive",
      workOrderStatus: wo?.status ?? null,
      doneAt,
      today,
    })

    if (state === "excluded" && excludeReason) {
      result.excluded.total++
      result.excluded[excludeReason]++
    } else if (state === "on_time") {
      result.due++
      result.onTime++
    } else if (state === "late") {
      result.due++
      result.late++
    } else if (state === "open") {
      result.due++
      result.open++
    } else if (state === "due_today") {
      result.dueToday++
    } else {
      result.upcoming++
    }

    result.items.push({
      scheduleId: schedule.id,
      dueDate: schedule.dueDate,
      state,
      excludeReason,
      doneAt,
      plan: {
        id: schedule.plan.id,
        name: schedule.plan.name,
        typeCode: schedule.plan.type.code,
        typeColor: schedule.plan.type.color,
      },
      target: { kind: target.kind, id: target.id, name: target.name, code: target.code, href: targetHref(target) },
      branchName: target.branchName ?? "",
      workOrder: wo ? { id: wo.id, woNumber: wo.woNumber, status: wo.status } : null,
    })
  }
  result.items.sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.target.code.localeCompare(b.target.code)
  )
  result.rate = result.due > 0 ? Math.round((result.onTime / result.due) * 1000) / 10 : null
  return result
}
