import { Prisma, type PrismaClient } from "@prisma/client"
import { z } from "zod"
import { loadScopedWorkOrder } from "@/modules/work_orders/application/work-order-service"

export const addTechnicianSchema = z.object({
  userId: z.string().uuid(),
})

type CrewWorkOrder = { id: string; assignedTo: string | null }

export type WorkOrderCrewMember = {
  userId: string
  name: string
  isAssignee: boolean
  hasRow: boolean
}

function displayName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`.trim()
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

export async function listWorkOrderCrew(
  db: PrismaClient,
  workOrder: CrewWorkOrder
): Promise<WorkOrderCrewMember[]> {
  const rows = await db.workOrderTechnician.findMany({
    where: { workOrderId: workOrder.id },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { assignedAt: "asc" },
  })
  const people: WorkOrderCrewMember[] = rows.map((row) => ({
    userId: row.userId,
    name: displayName(row.user),
    isAssignee: row.userId === workOrder.assignedTo,
    hasRow: true,
  }))
  if (workOrder.assignedTo && !people.some((person) => person.userId === workOrder.assignedTo)) {
    const assignee = await db.user.findFirst({
      where: { id: workOrder.assignedTo },
      select: { id: true, firstName: true, lastName: true },
    })
    if (assignee) {
      people.unshift({
        userId: assignee.id,
        name: displayName(assignee),
        isAssignee: true,
        hasRow: false,
      })
    }
  }
  return people
}

export async function listTechnicians(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: Parameters<typeof loadScopedWorkOrder>[1]["roles"] }
) {
  const scoped = await loadScopedWorkOrder(db, { ...params, action: "read" })
  if (!scoped.ok) return scoped
  return { data: await listWorkOrderCrew(db, scoped.workOrder) }
}

export async function addTechnician(
  db: PrismaClient,
  params: {
    id: string
    companyId: string
    roles: Parameters<typeof loadScopedWorkOrder>[1]["roles"]
    userId: string
  }
) {
  const scoped = await loadScopedWorkOrder(db, { ...params, action: "update" })
  if (!scoped.ok) return scoped
  const user = await db.user.findFirst({
    where: { id: params.userId, companyId: params.companyId, isActive: true, deletedAt: null },
    select: { id: true },
  })
  if (!user) return { error: "ไม่พบผู้ใช้หรือผู้ใช้ไม่พร้อมใช้งาน" as const, status: 400 as const }
  if (scoped.workOrder.assignedTo === params.userId) {
    return { data: { userId: params.userId, alreadyListed: true } }
  }
  const existing = await db.workOrderTechnician.findFirst({
    where: { workOrderId: params.id, userId: params.userId },
    select: { id: true },
  })
  if (existing) return { data: { userId: params.userId, alreadyListed: true } }
  try {
    await db.workOrderTechnician.create({
      data: { workOrderId: params.id, userId: params.userId },
    })
  } catch (error) {
    if (isUniqueConflict(error)) {
      return { error: "ช่างคนนี้อยู่ในรายชื่อแล้ว" as const, status: 409 as const }
    }
    throw error
  }
  return { data: { userId: params.userId, alreadyListed: false } }
}

export async function removeTechnician(
  db: PrismaClient,
  params: {
    id: string
    companyId: string
    roles: Parameters<typeof loadScopedWorkOrder>[1]["roles"]
    userId: string
  }
) {
  const scoped = await loadScopedWorkOrder(db, { ...params, action: "update" })
  if (!scoped.ok) return scoped
  if (scoped.workOrder.assignedTo === params.userId) {
    return { error: "ผู้รับผิดชอบหลักอยู่ในรายชื่อเสมอ" as const, status: 400 as const }
  }
  const open = await db.workOrderLaborEntry.count({
    where: { workOrderId: params.id, userId: params.userId, endedAt: null },
  })
  if (open > 0) {
    return { error: "ยังมีช่วงเวลาเปิดอยู่ ต้องจบก่อนถอดออก" as const, status: 400 as const }
  }
  await db.workOrderTechnician.deleteMany({
    where: { workOrderId: params.id, userId: params.userId },
  })
  return { data: { userId: params.userId } }
}
