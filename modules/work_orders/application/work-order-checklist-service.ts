import type { PrismaClient } from "@prisma/client"
import { z } from "zod"
import type { UserRole } from "@/lib/permissions"
import { generateWONumber } from "./generate-wo-number"
import { loadScopedWorkOrder } from "./work-order-service"

const LOCKED = new Set(["handed_over", "completed", "closed", "cancelled"])

export const recordChecklistSchema = z.object({
  resultId: z.string().uuid(),
  status: z.enum(["pass", "fail", "na", "warning"]).nullable(),
  actualValue: z.string().trim().max(100).optional().nullable(),
  remark: z.string().trim().max(1000).optional().nullable(),
})

export type RecordChecklistInput = z.infer<typeof recordChecklistSchema>

function followUpDescription(input: {
  pmNumber: string
  itemName: string
  actualValue: string | null
  unit: string | null
  standardValue: string | null
  remark: string | null
}) {
  const lines = [`จากผลตรวจไม่ผ่านในใบ PM ${input.pmNumber}`, `หัวข้อตรวจ: ${input.itemName}`]
  if (input.standardValue) lines.push(`ค่ามาตรฐาน: ${input.standardValue}`)
  if (input.actualValue) lines.push(`ค่าที่วัดได้: ${input.actualValue}${input.unit ? ` ${input.unit}` : ""}`)
  if (input.remark) lines.push(`หมายเหตุ: ${input.remark}`)
  return lines.join("\n")
}

export async function recordChecklistResult(
  db: PrismaClient,
  params: { id: string; companyId: string; userId: string; roles: UserRole[]; input: RecordChecklistInput }
): Promise<
  | { data: { resultId: string; status: string | null; followUp: { id: string; woNumber: string; created: boolean } | null } }
  | { error: string; status: number }
> {
  const scoped = await loadScopedWorkOrder(db, { id: params.id, companyId: params.companyId, roles: params.roles, action: "update" })
  if (!scoped.ok) return scoped
  const workOrder = scoped.workOrder
  if (LOCKED.has(workOrder.status)) return { error: "ใบงานนี้บันทึกผลตรวจไม่ได้แล้ว", status: 400 }

  const actualValue = params.input.actualValue?.trim() || null
  const remark = params.input.remark?.trim() || null

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`chk:${params.input.resultId}`}))`
    const result = await tx.checklistResult.findFirst({
      where: { id: params.input.resultId, workOrderId: workOrder.id },
      include: {
        item: { select: { itemName: true, itemType: true, unit: true, standardValue: true } },
        followUp: { select: { id: true, woNumber: true } },
      },
    })
    if (!result) return { error: "ไม่พบข้อตรวจในใบงานนี้", status: 404 }
    if (result.item.itemType === "numeric" && actualValue && !Number.isFinite(Number(actualValue))) {
      return { error: "ค่าที่วัดต้องเป็นตัวเลข", status: 400 }
    }

    const status = params.input.status
    await tx.checklistResult.update({
      where: { id: result.id },
      data: {
        status,
        actualValue,
        remark,
        recordedBy: status ? params.userId : null,
        recordedAt: status ? new Date() : null,
      },
    })

    if (status !== "fail") {
      return { data: { resultId: result.id, status, followUp: result.followUp ? { ...result.followUp, created: false } : null } }
    }
    if (result.followUp) {
      return { data: { resultId: result.id, status, followUp: { ...result.followUp, created: false } } }
    }

    const woNumber = await generateWONumber(tx, workOrder.branchId)
    const followUp = await tx.workOrder.create({
      data: {
        woNumber,
        machineId: workOrder.machineId,
        assetId: workOrder.assetId,
        typeId: workOrder.typeId,
        branchId: workOrder.branchId,
        workKind: "corrective",
        status: "open",
        priority: workOrder.priority,
        title: `แก้ไขจากการตรวจ: ${result.item.itemName}`.slice(0, 255),
        description: followUpDescription({
          pmNumber: workOrder.woNumber,
          itemName: result.item.itemName,
          actualValue,
          unit: result.item.unit,
          standardValue: result.item.standardValue,
          remark,
        }),
        sourceWorkOrderId: workOrder.id,
        sourceChecklistResultId: result.id,
        createdBy: params.userId,
      },
      select: { id: true, woNumber: true },
    })
    await tx.workOrderStatusHistory.create({
      data: {
        workOrderId: followUp.id,
        toStatus: "open",
        changedBy: params.userId,
        reason: `สร้างจากผลตรวจไม่ผ่านในใบ ${workOrder.woNumber}`,
      },
    })
    return { data: { resultId: result.id, status, followUp: { ...followUp, created: true } } }
  })
}

export async function getChecklistView(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[] }
) {
  const scoped = await loadScopedWorkOrder(db, { ...params, action: "read" })
  if (!scoped.ok) return scoped
  const [results, followUps] = await Promise.all([
    db.checklistResult.findMany({
      where: { workOrderId: params.id },
      include: {
        item: {
          select: {
            id: true,
            sequence: true,
            section: true,
            itemName: true,
            itemType: true,
            standardValue: true,
            minValue: true,
            maxValue: true,
            unit: true,
            isRequired: true,
            template: { select: { id: true, name: true } },
          },
        },
        recorder: { select: { firstName: true, lastName: true } },
        followUp: { select: { id: true, woNumber: true, status: true } },
      },
    }),
    db.workOrder.findMany({
      where: { sourceWorkOrderId: params.id },
      select: { id: true, woNumber: true, title: true, status: true, sourceChecklistResultId: true },
      orderBy: { createdAt: "asc" },
    }),
  ])
  results.sort(
    (a, b) =>
      a.item.template.name.localeCompare(b.item.template.name) || a.item.sequence - b.item.sequence
  )
  return {
    data: {
      status: scoped.workOrder.status,
      locked: LOCKED.has(scoped.workOrder.status),
      blankRequired: results.filter((r) => r.status === null && r.item.isRequired).length,
      results: results.map((r) => ({
        id: r.id,
        status: r.status,
        actualValue: r.actualValue,
        remark: r.remark,
        recordedAt: r.recordedAt,
        recorderName: r.recorder ? `${r.recorder.firstName} ${r.recorder.lastName}`.trim() : null,
        followUp: r.followUp,
        item: {
          ...r.item,
          minValue: r.item.minValue?.toString() ?? null,
          maxValue: r.item.maxValue?.toString() ?? null,
        },
      })),
      followUps,
    },
  }
}
