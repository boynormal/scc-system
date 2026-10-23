import { Prisma, type PrismaClient } from "@prisma/client"
import { z } from "zod"
import { loadScopedWorkOrder } from "@/modules/work_orders/application/work-order-service"
import { listWorkOrderCrew } from "@/modules/work_orders/application/work-order-technician-service"
import { isHoldReason, type HoldReason } from "@/modules/work_orders/application/work-order-transitions"

const TERMINAL = new Set(["completed", "closed", "cancelled"])
const STARTABLE = new Set(["assigned", "in_progress", "on_hold"])

export const laborActionSchema = z.object({
  action: z.enum(["start", "pause", "resume", "finish"]),
  userId: z.string().uuid(),
  entryType: z.enum(["work", "travel"]).optional(),
  waitReason: z.string().optional(),
  note: z.string().max(500).optional(),
})

export const laborEditSchema = z.object({
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  reason: z.string().min(3),
  note: z.string().max(500).optional(),
})

export const laborManualSchema = z.object({
  userId: z.string().uuid(),
  entryType: z.enum(["work", "wait", "travel"]),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  waitReason: z.string().optional(),
  note: z.string().max(500).optional(),
  reason: z.string().min(3),
})

export const laborPostSchema = z.discriminatedUnion("mode", [
  laborActionSchema.extend({ mode: z.literal("action") }),
  laborManualSchema.extend({ mode: z.literal("manual") }),
])

export type LaborActionInput = z.infer<typeof laborActionSchema>
export type LaborEditInput = z.infer<typeof laborEditSchema>
export type LaborManualInput = z.infer<typeof laborManualSchema>
export type LaborEntryTypeName = "work" | "wait" | "travel"

export type LaborSummary = {
  userId: string
  workMinutes: number
  waitMinutes: number
  travelMinutes: number
}

type LaborSlice = {
  userId: string
  entryType: LaborEntryTypeName
  startedAt: Date
  endedAt: Date | null
}

type Fail = { error: string; status: number }

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function parseInstant(value: string): Date | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function reasonText(reason: string | undefined): string | null {
  const trimmed = reason?.trim() ?? ""
  if (trimmed.length < 3) return null
  return trimmed
}

function overlapWhere(userId: string, start: Date, end: Date, exceptId?: string) {
  return {
    userId,
    ...(exceptId ? { id: { not: exceptId } } : {}),
    startedAt: { lt: end },
    OR: [{ endedAt: { gt: start } }, { endedAt: null }],
  }
}

function entrySnapshot(entry: {
  entryType: string
  startedAt: Date
  endedAt: Date | null
  waitReason: string | null
  note: string | null
  editReason: string | null
}) {
  return {
    entryType: entry.entryType,
    startedAt: entry.startedAt.toISOString(),
    endedAt: entry.endedAt?.toISOString() ?? null,
    waitReason: entry.waitReason,
    note: entry.note,
    editReason: entry.editReason,
  }
}

export function summarizeLabor(entries: LaborSlice[], now: Date): LaborSummary[] {
  const totals = new Map<string, { work: number; wait: number; travel: number }>()
  for (const entry of entries) {
    const end = entry.endedAt ?? now
    const ms = Math.max(0, end.getTime() - entry.startedAt.getTime())
    const row = totals.get(entry.userId) ?? { work: 0, wait: 0, travel: 0 }
    row[entry.entryType] += ms
    totals.set(entry.userId, row)
  }
  return [...totals.entries()].map(([userId, row]) => ({
    userId,
    workMinutes: Math.round(row.work / 60_000),
    waitMinutes: Math.round(row.wait / 60_000),
    travelMinutes: Math.round(row.travel / 60_000),
  }))
}

async function onCrew(db: PrismaClient, workOrderId: string, assignedTo: string | null, userId: string) {
  if (assignedTo === userId) return true
  const row = await db.workOrderTechnician.findFirst({
    where: { workOrderId, userId },
    select: { id: true },
  })
  return row != null
}

export async function applyLaborAction(
  db: PrismaClient,
  params: {
    id: string
    companyId: string
    actorId: string
    roles: Parameters<typeof loadScopedWorkOrder>[1]["roles"]
    input: LaborActionInput
  }
): Promise<
  | {
      data: {
        entryId: string
        entryType: LaborEntryTypeName
        autoClosed: { id: string; workOrderId: string; woNumber: string; endedAt: string } | null
      }
    }
  | Fail
> {
  const scoped = await loadScopedWorkOrder(db, { ...params, action: "update" })
  if (!scoped.ok) return scoped
  if (params.input.action === "pause" && !isHoldReason(params.input.waitReason ?? "")) {
    return { error: "ต้องระบุเหตุผลการรอ", status: 400 }
  }
  if (params.input.action === "start" && !STARTABLE.has(scoped.workOrder.status)) {
    return { error: "เริ่มจับเวลาในสถานะนี้ไม่ได้", status: 400 }
  }

  const now = new Date()
  try {
    return await db.$transaction(async (tx) => {
      const allowed = await onCrew(tx as PrismaClient, params.id, scoped.workOrder.assignedTo, params.input.userId)
      if (!allowed) return { error: "ผู้ใช้นี้ไม่อยู่ในรายชื่อช่างของใบงาน", status: 400 }

      const open = await tx.workOrderLaborEntry.findFirst({
        where: { userId: params.input.userId, endedAt: null },
        include: { workOrder: { select: { id: true, woNumber: true } } },
      })

      if (params.input.action === "start") {
        if (open && open.workOrderId === params.id) {
          return { error: "ช่างคนนี้กำลังจับเวลาบนใบงานนี้อยู่แล้ว", status: 400 }
        }
        let autoClosed: { id: string; workOrderId: string; woNumber: string; endedAt: string } | null = null
        if (open) {
          await tx.workOrderLaborEntry.update({
            where: { id: open.id },
            data: { endedAt: now, updatedBy: params.actorId },
          })
          autoClosed = {
            id: open.id,
            workOrderId: open.workOrderId,
            woNumber: open.workOrder.woNumber,
            endedAt: now.toISOString(),
          }
        }
        const created = await tx.workOrderLaborEntry.create({
          data: {
            workOrderId: params.id,
            userId: params.input.userId,
            entryType: params.input.entryType ?? "work",
            startedAt: now,
            note: params.input.note?.trim() || null,
            createdBy: params.actorId,
          },
        })
        if (scoped.workOrder.status === "assigned") {
          await tx.workOrder.update({
            where: { id: params.id },
            data: { status: "in_progress" },
          })
          await tx.workOrderStatusHistory.create({
            data: {
              workOrderId: params.id,
              fromStatus: "assigned",
              toStatus: "in_progress",
              changedBy: params.actorId,
              reason: "เริ่มจับเวลา",
            },
          })
        }
        return { data: { entryId: created.id, entryType: created.entryType, autoClosed } }
      }

      if (!open || open.workOrderId !== params.id) {
        return { error: "ไม่มีช่วงเวลาที่เปิดอยู่บนใบงานนี้", status: 400 }
      }

      if (params.input.action === "finish") {
        await tx.workOrderLaborEntry.update({
          where: { id: open.id },
          data: { endedAt: now, updatedBy: params.actorId },
        })
        return { data: { entryId: open.id, entryType: open.entryType, autoClosed: null } }
      }

      if (params.input.action === "pause") {
        if (open.entryType !== "work" && open.entryType !== "travel") {
          return { error: "ต้องมีช่วงทำงานหรือเดินทางที่เปิดอยู่", status: 400 }
        }
        await tx.workOrderLaborEntry.update({
          where: { id: open.id },
          data: { endedAt: now, updatedBy: params.actorId },
        })
        const created = await tx.workOrderLaborEntry.create({
          data: {
            workOrderId: params.id,
            userId: params.input.userId,
            entryType: "wait",
            startedAt: now,
            waitReason: params.input.waitReason as HoldReason,
            note: params.input.note?.trim() || null,
            createdBy: params.actorId,
          },
        })
        return { data: { entryId: created.id, entryType: "wait", autoClosed: null } }
      }

      if (open.entryType !== "wait") {
        return { error: "ต้องมีช่วงรอที่เปิดอยู่", status: 400 }
      }
      await tx.workOrderLaborEntry.update({
        where: { id: open.id },
        data: { endedAt: now, updatedBy: params.actorId },
      })
      const created = await tx.workOrderLaborEntry.create({
        data: {
          workOrderId: params.id,
          userId: params.input.userId,
          entryType: "work",
          startedAt: now,
          note: params.input.note?.trim() || null,
          createdBy: params.actorId,
        },
      })
      return { data: { entryId: created.id, entryType: "work", autoClosed: null } }
    })
  } catch (error) {
    if (isUniqueConflict(error)) return { error: "มีช่วงเวลาเปิดอยู่แล้ว", status: 409 }
    throw error
  }
}

async function assertClosedRange(
  db: PrismaClient,
  params: {
    userId: string
    startedAt: string
    endedAt: string
    exceptId?: string
  }
): Promise<{ start: Date; end: Date } | Fail> {
  const start = parseInstant(params.startedAt)
  const end = parseInstant(params.endedAt)
  if (!start || !end) return { error: "เวลาไม่ถูกต้อง", status: 400 }
  if (end <= start) return { error: "เวลาจบต้องหลังเวลาเริ่ม", status: 400 }
  const now = new Date()
  if (end > now || start > now) return { error: "เวลาจบต้องไม่เกินเวลาปัจจุบัน", status: 400 }
  const overlap = await db.workOrderLaborEntry.findFirst({
    where: overlapWhere(params.userId, start, end, params.exceptId),
    select: { id: true },
  })
  if (overlap) return { error: "ช่วงเวลาซ้อนกับรายการอื่นของช่างคนนี้", status: 400 }
  return { start, end }
}

export async function editLaborEntry(
  db: PrismaClient,
  params: {
    id: string
    entryId: string
    companyId: string
    actorId: string
    roles: Parameters<typeof loadScopedWorkOrder>[1]["roles"]
    input: LaborEditInput
  }
): Promise<{ data: { id: string } } | Fail> {
  const scoped = await loadScopedWorkOrder(db, { ...params, action: "update" })
  if (!scoped.ok) return scoped
  if (TERMINAL.has(scoped.workOrder.status)) return { error: "ใบงานนี้แก้ไขเวลาไม่ได้", status: 400 }
  const reason = reasonText(params.input.reason)
  if (!reason) return { error: "ต้องระบุเหตุผล", status: 400 }

  return db.$transaction(async (tx) => {
    const entry = await tx.workOrderLaborEntry.findFirst({
      where: { id: params.entryId, workOrderId: params.id },
    })
    if (!entry) return { error: "Not found", status: 404 }
    if (!entry.endedAt) return { error: "ต้องจบช่วงเวลาก่อนแก้ไข", status: 400 }
    const range = await assertClosedRange(tx as PrismaClient, {
      userId: entry.userId,
      startedAt: params.input.startedAt,
      endedAt: params.input.endedAt,
      exceptId: entry.id,
    })
    if ("error" in range) return range
    const note = params.input.note === undefined ? entry.note : params.input.note.trim() || null
    const updated = await tx.workOrderLaborEntry.update({
      where: { id: entry.id },
      data: {
        startedAt: range.start,
        endedAt: range.end,
        note,
        editReason: reason,
        updatedBy: params.actorId,
      },
    })
    await tx.auditLog.create({
      data: {
        userId: params.actorId,
        tableName: "work_order_labor_entries",
        recordId: entry.id,
        action: "update",
        oldValues: entrySnapshot(entry) as Prisma.InputJsonValue,
        newValues: {
          ...entrySnapshot(updated),
          reason,
        } as Prisma.InputJsonValue,
      },
    })
    return { data: { id: updated.id } }
  })
}

export async function addManualLaborEntry(
  db: PrismaClient,
  params: {
    id: string
    companyId: string
    actorId: string
    roles: Parameters<typeof loadScopedWorkOrder>[1]["roles"]
    input: LaborManualInput
  }
): Promise<{ data: { id: string } } | Fail> {
  const scoped = await loadScopedWorkOrder(db, { ...params, action: "update" })
  if (!scoped.ok) return scoped
  if (TERMINAL.has(scoped.workOrder.status)) return { error: "ใบงานนี้แก้ไขเวลาไม่ได้", status: 400 }
  const reason = reasonText(params.input.reason)
  if (!reason) return { error: "ต้องระบุเหตุผล", status: 400 }
  if (params.input.entryType === "wait" && !isHoldReason(params.input.waitReason ?? "")) {
    return { error: "ต้องระบุเหตุผลการรอ", status: 400 }
  }
  if (params.input.entryType !== "wait" && params.input.waitReason) {
    return { error: "เหตุผลการรอใช้ได้เฉพาะช่วงรอ", status: 400 }
  }

  return db.$transaction(async (tx) => {
    const allowed = await onCrew(tx as PrismaClient, params.id, scoped.workOrder.assignedTo, params.input.userId)
    if (!allowed) return { error: "ผู้ใช้นี้ไม่อยู่ในรายชื่อช่างของใบงาน", status: 400 }
    const range = await assertClosedRange(tx as PrismaClient, {
      userId: params.input.userId,
      startedAt: params.input.startedAt,
      endedAt: params.input.endedAt,
    })
    if ("error" in range) return range
    const created = await tx.workOrderLaborEntry.create({
      data: {
        workOrderId: params.id,
        userId: params.input.userId,
        entryType: params.input.entryType,
        startedAt: range.start,
        endedAt: range.end,
        waitReason: params.input.entryType === "wait" ? params.input.waitReason : null,
        note: params.input.note?.trim() || null,
        editReason: reason,
        createdBy: params.actorId,
        updatedBy: params.actorId,
      },
    })
    await tx.auditLog.create({
      data: {
        userId: params.actorId,
        tableName: "work_order_labor_entries",
        recordId: created.id,
        action: "create",
        newValues: {
          ...entrySnapshot(created),
          reason,
        } as Prisma.InputJsonValue,
      },
    })
    return { data: { id: created.id } }
  })
}

export async function getLaborView(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: Parameters<typeof loadScopedWorkOrder>[1]["roles"] }
) {
  const scoped = await loadScopedWorkOrder(db, { ...params, action: "read" })
  if (!scoped.ok) return scoped
  const crew = await listWorkOrderCrew(db, scoped.workOrder)
  const userIds = crew.map((person) => person.userId)
  const entries = await db.workOrderLaborEntry.findMany({
    where: { workOrderId: params.id },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { startedAt: "desc" },
  })
  const openRows = userIds.length === 0
    ? []
    : await db.workOrderLaborEntry.findMany({
        where: { userId: { in: userIds }, endedAt: null },
        include: { workOrder: { select: { id: true, woNumber: true } } },
      })
  const now = new Date()
  const summary = summarizeLabor(entries, now)
  const names = new Map(crew.map((person) => [person.userId, person.name]))
  return {
    data: {
      status: scoped.workOrder.status,
      technicians: crew.map((person) => {
        const open = openRows.find((row) => row.userId === person.userId) ?? null
        const onThis = open?.workOrderId === params.id
        return {
          userId: person.userId,
          name: person.name,
          isAssignee: person.isAssignee,
          removable: person.hasRow && !person.isAssignee && !onThis,
          openOnThis: onThis
            ? {
                id: open.id,
                entryType: open.entryType,
                waitReason: open.waitReason,
                startedAt: open.startedAt.toISOString(),
              }
            : null,
          openElsewhere:
            open && !onThis
              ? { workOrderId: open.workOrderId, woNumber: open.workOrder.woNumber }
              : null,
        }
      }),
      entries: entries.map((entry) => ({
        id: entry.id,
        userId: entry.userId,
        userName: `${entry.user.firstName} ${entry.user.lastName}`.trim(),
        entryType: entry.entryType,
        startedAt: entry.startedAt.toISOString(),
        endedAt: entry.endedAt?.toISOString() ?? null,
        waitReason: entry.waitReason,
        note: entry.note,
        editReason: entry.editReason,
      })),
      summary: summary.map((row) => ({ ...row, name: names.get(row.userId) ?? "" })),
    },
  }
}
