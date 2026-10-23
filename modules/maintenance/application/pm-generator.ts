import type { FrequencyUnit, Prisma, PrismaClient } from "@prisma/client"
import { generateWONumber } from "@/modules/work_orders/application/generate-wo-number"
import {
  activeTargetWhere,
  targetAssetSelect,
  targetBranchId,
  targetInactiveReason,
  targetMachineSelect,
} from "@/modules/maintenance/application/pm-target"

const MAX_ROUNDS_PER_RUN = 500
const DAY_MS = 86_400_000

type Tx = Prisma.TransactionClient

/** วันที่ตามปฏิทินเครื่องเซิร์ฟเวอร์ เก็บเป็นเที่ยงคืน UTC ให้ตรงกับคอลัมน์ @db.Date */
export function toDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
}

/** ค่าจากคอลัมน์ @db.Date เป็นเที่ยงคืน UTC อยู่แล้ว ตัดเวลาที่อาจติดมาทิ้ง */
function utcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

/** รับ "YYYY-MM-DD" (หรือ ISO ที่ขึ้นต้นแบบนั้น) โดยไม่ขึ้นกับ timezone ของเครื่อง */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return Number.isNaN(date.getTime()) ? null : date
}

export function addFrequency(date: Date, unit: FrequencyUnit, value: number): Date | null {
  const next = new Date(date.getTime())
  switch (unit) {
    case "day":
      next.setUTCDate(next.getUTCDate() + value)
      return next
    case "week":
      next.setUTCDate(next.getUTCDate() + value * 7)
      return next
    case "month":
      next.setUTCMonth(next.getUTCMonth() + value)
      return next
    case "quarter":
      next.setUTCMonth(next.getUTCMonth() + value * 3)
      return next
    case "year":
      next.setUTCFullYear(next.getUTCFullYear() + value)
      return next
    default:
      return null
  }
}

export type PmGenerateOptions = {
  today?: Date
  companyId?: string
  branchIds?: string[] | "all"
  planIds?: string[]
  userId?: string | null
}

export type PmGenerateResult = {
  plans: number
  schedulesCreated: number
  workOrdersCreated: number
}

/**
 * สร้างใบ PM ให้รอบที่ยังไม่มีใบ ต้องเรียกใต้ล็อกของแผน (ดู generatePmForPlan)
 */
async function createPmWorkOrder(
  tx: Tx,
  input: {
    schedule: { id: string; dueDate: Date }
    plan: {
      id: string
      name: string
      description: string | null
      typeId: string
      machineId: string | null
      assetId: string | null
      estimatedDurationMin: number | null
    }
    branchId: string
    userId: string | null
  }
) {
  const { schedule, plan } = input
  const woNumber = await generateWONumber(tx, input.branchId)
  const plannedStart = new Date(schedule.dueDate.getTime())
  const workOrder = await tx.workOrder.create({
    data: {
      woNumber,
      scheduleId: schedule.id,
      machineId: plan.machineId,
      assetId: plan.assetId,
      typeId: plan.typeId,
      branchId: input.branchId,
      workKind: "preventive",
      status: "open",
      title: `PM: ${plan.name}`,
      description: plan.description,
      plannedStart,
      plannedEnd: plan.estimatedDurationMin
        ? new Date(plannedStart.getTime() + plan.estimatedDurationMin * 60_000)
        : null,
      createdBy: input.userId,
    },
    select: { id: true },
  })
  await tx.workOrderStatusHistory.create({
    data: { workOrderId: workOrder.id, toStatus: "open", changedBy: input.userId },
  })

  const items = await tx.checklistItem.findMany({
    where: {
      template: { isActive: true, planChecklistTemplates: { some: { planId: plan.id } } },
    },
    select: { id: true },
  })
  if (items.length > 0) {
    await tx.checklistResult.createMany({
      data: items.map((item) => ({ workOrderId: workOrder.id, itemId: item.id })),
      skipDuplicates: true,
    })
  }
  return workOrder
}

/**
 * ทำงานของแผนเดียวใน transaction ที่ถือล็อกของแผนไว้ รันซ้ำได้โดยไม่สร้างแถวเพิ่ม
 */
export async function generatePmForPlan(
  tx: Tx,
  input: { planId: string; today: Date; userId: string | null; extraDueDates?: Date[] }
): Promise<{ schedulesCreated: number; workOrdersCreated: number; skipped?: string }> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pm:${input.planId}`}))`

  const plan = await tx.maintenancePlan.findUnique({
    where: { id: input.planId },
    include: { machine: { select: targetMachineSelect }, asset: { select: targetAssetSelect } },
  })
  if (!plan || !plan.isActive) return { schedulesCreated: 0, workOrdersCreated: 0, skipped: "inactive" }
  const inactive = targetInactiveReason(plan)
  if (inactive) return { schedulesCreated: 0, workOrdersCreated: 0, skipped: inactive }
  const branchId = targetBranchId(plan)
  if (!branchId) return { schedulesCreated: 0, workOrdersCreated: 0, skipped: "no_target" }
  if (plan.frequencyUnit === "runtime_hour") {
    return { schedulesCreated: 0, workOrdersCreated: 0, skipped: "runtime_hour" }
  }

  const today = toDateOnly(input.today)
  const cutoff = new Date(today.getTime() + plan.leadTimeDays * DAY_MS)
  const endDate = plan.endDate ? utcDay(plan.endDate) : null
  const extras = (input.extraDueDates ?? []).map(utcDay)
  const extraTimes = new Set(extras.map((d) => d.getTime()))

  // Rounds that fell due before the plan existed are never owed.
  const notBefore = toDateOnly(plan.createdAt)
  const dueDates: Date[] = [...extras]
  let cursor = utcDay(plan.lastGeneratedDate ?? plan.startDate)
  let lastGenerated: Date | null = null
  for (let i = 0; i < MAX_ROUNDS_PER_RUN; i++) {
    const next = addFrequency(cursor, plan.frequencyUnit, plan.frequencyValue)
    if (!next || next > cutoff || (endDate && next > endDate)) break
    if (next >= notBefore) dueDates.push(next)
    lastGenerated = next
    cursor = next
  }

  let schedulesCreated = 0
  if (dueDates.length > 0) {
    const created = await tx.maintenanceSchedule.createMany({
      data: dueDates.map((dueDate) => ({
        planId: plan.id,
        machineId: plan.machineId,
        assetId: plan.assetId,
        dueDate,
        status: "pending" as const,
        isAutoGenerated: !extraTimes.has(dueDate.getTime()),
      })),
      skipDuplicates: true,
    })
    schedulesCreated = created.count
  }
  if (lastGenerated) {
    await tx.maintenancePlan.update({ where: { id: plan.id }, data: { lastGeneratedDate: lastGenerated } })
  }

  await tx.maintenanceSchedule.updateMany({
    where: { planId: plan.id, status: "pending", dueDate: { lt: today } },
    data: { status: "overdue" },
  })

  const needingWo = await tx.maintenanceSchedule.findMany({
    where: { planId: plan.id, status: { in: ["pending", "overdue"] }, workOrder: null },
    select: { id: true, dueDate: true },
    orderBy: { dueDate: "asc" },
  })
  let workOrdersCreated = 0
  for (const schedule of needingWo) {
    if (schedule.dueDate > cutoff && !extraTimes.has(schedule.dueDate.getTime())) continue
    await createPmWorkOrder(tx, {
      schedule,
      plan,
      branchId,
      userId: input.userId,
    })
    workOrdersCreated++
  }

  return { schedulesCreated, workOrdersCreated }
}

export async function generatePreventiveWork(
  db: PrismaClient,
  options: PmGenerateOptions = {}
): Promise<PmGenerateResult> {
  const today = options.today ?? new Date()
  if (Array.isArray(options.branchIds) && options.branchIds.length === 0) {
    return { plans: 0, schedulesCreated: 0, workOrdersCreated: 0 }
  }
  const scoped: Prisma.MaintenancePlanWhereInput[] = []
  if (options.companyId || Array.isArray(options.branchIds)) {
    const branchIds = Array.isArray(options.branchIds) ? { branchId: { in: options.branchIds } } : {}
    scoped.push({
      OR: [
        { asset: { ...(options.companyId ? { companyId: options.companyId } : {}), ...branchIds } },
        {
          assetId: null,
          machine: { ...branchIds, ...(options.companyId ? { branch: { companyId: options.companyId } } : {}) },
        },
      ],
    })
  }
  const plans = await db.maintenancePlan.findMany({
    where: {
      isActive: true,
      frequencyUnit: { not: "runtime_hour" },
      ...(options.planIds ? { id: { in: options.planIds } } : {}),
      AND: [activeTargetWhere(), ...scoped],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })

  const result: PmGenerateResult = { plans: 0, schedulesCreated: 0, workOrdersCreated: 0 }
  for (const plan of plans) {
    const outcome = await db.$transaction(
      (tx) => generatePmForPlan(tx, { planId: plan.id, today, userId: options.userId ?? null }),
      { timeout: 60_000 }
    )
    if (outcome.skipped) continue
    result.plans++
    result.schedulesCreated += outcome.schedulesCreated
    result.workOrdersCreated += outcome.workOrdersCreated
  }
  return result
}
