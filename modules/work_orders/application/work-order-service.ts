import { z } from "zod"
import type { PrismaClient } from "@prisma/client"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { generateWONumber } from "@/modules/work_orders/application/generate-wo-number"

export const createWorkOrderSchema = z.object({
  scheduleId: z.string().uuid().optional(),
  machineId: z.string().uuid(),
  typeId: z.string().uuid(),
  branchId: z.string().uuid(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  imagesBefore: z.array(z.string()).optional(),
  imagesAfter: z.array(z.string()).optional(),
})

export const updateWorkOrderSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["draft", "open", "in_progress", "on_hold", "completed", "cancelled"]).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  plannedStart: z.string().nullable().optional(),
  plannedEnd: z.string().nullable().optional(),
  actualStart: z.string().nullable().optional(),
  actualEnd: z.string().nullable().optional(),
  rootCause: z.string().nullable().optional(),
  correctiveAction: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  downtimeMin: z.number().int().min(0).optional(),
  imagesBefore: z.array(z.string()).optional(),
  imagesAfter: z.array(z.string()).optional(),
})

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>
export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderSchema>

export async function listWorkOrders(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    status?: string | null
    priority?: string | null
    assignedTo?: string | null
    search?: string | null
    page: number
    pageSize: number
  }
) {
  const canRead =
    isAdminInAnyBranch(params.roles) ||
    getBranchIds(params.roles).some((bid) => hasPermission(params.roles, bid, "work_orders", "read"))
  if (!canRead) {
    return { error: "Forbidden" as const, status: 403 as const }
  }

  const base = { branch: { companyId: params.companyId } }
  let branchFilter: { branchId: string } | { branchId: { in: string[] } } | Record<string, never> = {}

  if (isAdminInAnyBranch(params.roles)) {
    if (params.branchId) {
      const inCompany = await db.branch.findFirst({
        where: { id: params.branchId, companyId: params.companyId, deletedAt: null, isActive: true },
        select: { id: true },
      })
      if (!inCompany) {
        return { error: "Invalid branch" as const, status: 400 as const }
      }
      branchFilter = { branchId: params.branchId }
    }
  } else {
    const allowed = getBranchIds(params.roles)
    if (allowed.length === 0) {
      return {
        data: [],
        total: 0,
        page: params.page,
        pageSize: params.pageSize,
        totalPages: 0,
      }
    }
    if (params.branchId) {
      if (!allowed.includes(params.branchId)) {
        return { error: "Forbidden" as const, status: 403 as const }
      }
      branchFilter = { branchId: params.branchId }
    } else {
      branchFilter = { branchId: { in: allowed } }
    }
  }

  const where = {
    ...base,
    ...branchFilter,
    ...(params.status && { status: params.status as never }),
    ...(params.priority && { priority: params.priority as never }),
    ...(params.assignedTo && { assignedTo: params.assignedTo }),
    ...(params.search && {
      OR: [
        { title: { contains: params.search, mode: "insensitive" as never } },
        { woNumber: { contains: params.search, mode: "insensitive" as never } },
      ],
    }),
  }

  const [data, total] = await Promise.all([
    db.workOrder.findMany({
      where,
      include: {
        machine: { select: { id: true, name: true, code: true } },
        type: { select: { id: true, name: true, code: true, color: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        branch: { select: { id: true, name: true } },
        _count: { select: { parts: true, checklistResults: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.workOrder.count({ where }),
  ])

  return {
    data,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  }
}

export async function createWorkOrder(
  db: PrismaClient,
  params: {
    companyId: string
    userId: string
    roles: UserRole[]
    input: CreateWorkOrderInput
  }
) {
  const { branchId, machineId } = params.input
  const branchOk = await db.branch.findFirst({
    where: { id: branchId, companyId: params.companyId, deletedAt: null, isActive: true },
    select: { id: true },
  })
  if (!branchOk) {
    return { error: "Invalid branch" as const, status: 400 as const }
  }
  if (!hasPermission(params.roles, branchId, "work_orders", "create")) {
    return { error: "Forbidden" as const, status: 403 as const }
  }
  const machineOk = await db.machine.findFirst({
    where: { id: machineId, deletedAt: null, branchId, branch: { companyId: params.companyId } },
    select: { id: true },
  })
  if (!machineOk) {
    return { error: "Invalid machine for branch" as const, status: 400 as const }
  }

  const woNumber = await generateWONumber(db, branchId)
  const { imagesBefore, imagesAfter, ...rest } = params.input
  const workOrder = await db.workOrder.create({
    data: {
      ...rest,
      woNumber,
      plannedStart: rest.plannedStart ? new Date(rest.plannedStart) : undefined,
      plannedEnd: rest.plannedEnd ? new Date(rest.plannedEnd) : undefined,
      status: "open",
      createdBy: params.userId,
    },
  })

  if ((imagesBefore && imagesBefore.length > 0) || (imagesAfter && imagesAfter.length > 0)) {
    const bef = JSON.stringify(imagesBefore ?? [])
    const aft = JSON.stringify(imagesAfter ?? [])
    await db.$executeRaw`
      UPDATE work_orders SET images_before = ${bef}::jsonb, images_after = ${aft}::jsonb
      WHERE id = ${workOrder.id}::uuid
    `
  }

  return { data: workOrder, woNumber }
}

export async function getWorkOrderDetail(db: PrismaClient, params: { id: string; companyId: string }) {
  const wo = await db.workOrder.findFirst({
    where: { id: params.id, machine: { branch: { companyId: params.companyId } } },
    include: {
      machine: { select: { id: true, name: true, code: true, branchId: true } },
      type: { select: { id: true, name: true, code: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
      branch: { select: { id: true, name: true } },
    },
  })
  if (!wo) return null

  const extra = await db.$queryRaw<{ images_before: unknown; images_after: unknown }[]>`
    SELECT images_before, images_after FROM work_orders WHERE id = ${params.id}::uuid LIMIT 1
  `

  return {
    ...wo,
    imagesBefore: extra[0]?.images_before ?? [],
    imagesAfter: extra[0]?.images_after ?? [],
  }
}

export async function getWorkOrdersForPage(
  db: PrismaClient,
  params: { companyId: string; search?: string }
) {
  return db.workOrder.findMany({
    where: {
      machine: { branch: { companyId: params.companyId } },
      ...(params.search && {
        OR: [
          { title: { contains: params.search, mode: "insensitive" } },
          { woNumber: { contains: params.search, mode: "insensitive" } },
          { description: { contains: params.search, mode: "insensitive" } },
          { assignee: { firstName: { contains: params.search, mode: "insensitive" } } },
          { assignee: { lastName: { contains: params.search, mode: "insensitive" } } },
        ],
      }),
    },
    include: {
      machine: { select: { id: true, name: true, code: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
      schedule: { select: { id: true, plan: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getWorkOrderDetailForPage(
  db: PrismaClient,
  params: { id: string; companyId: string }
) {
  const workOrder = await db.workOrder.findFirst({
    where: { id: params.id, machine: { branch: { companyId: params.companyId } } },
    include: {
      machine: { select: { id: true, name: true, code: true, branch: { select: { name: true } } } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
      schedule: {
        select: {
          id: true,
          dueDate: true,
          plan: { select: { name: true, type: { select: { code: true, color: true } } } },
        },
      },
      checklistResults: { include: { item: true, recorder: { select: { firstName: true, lastName: true } } } },
      parts: { include: { part: { select: { id: true, name: true, code: true, unit: true } } } },
    },
  })
  if (!workOrder) return null

  const extra = await db.$queryRaw<{ images_before: unknown; images_after: unknown }[]>`
    SELECT images_before, images_after FROM work_orders WHERE id = ${params.id}::uuid LIMIT 1
  `

  return {
    ...workOrder,
    imagesBefore: extra[0]?.images_before ?? [],
    imagesAfter: extra[0]?.images_after ?? [],
  } as any
}

export async function updateWorkOrder(
  db: PrismaClient,
  params: { id: string; companyId: string; input: UpdateWorkOrderInput }
) {
  const existing = await db.workOrder.findFirst({
    where: { id: params.id, machine: { branch: { companyId: params.companyId } } },
  })
  if (!existing) return null

  const { imagesBefore, imagesAfter, plannedStart, plannedEnd, actualStart, actualEnd, ...rest } = params.input

  const updated = await db.workOrder.update({
    where: { id: params.id },
    data: {
      ...rest,
      plannedStart: plannedStart ? new Date(plannedStart) : plannedStart === null ? null : undefined,
      plannedEnd: plannedEnd ? new Date(plannedEnd) : plannedEnd === null ? null : undefined,
      actualStart: actualStart ? new Date(actualStart) : actualStart === null ? null : undefined,
      actualEnd: actualEnd ? new Date(actualEnd) : actualEnd === null ? null : undefined,
    },
  })

  if (imagesBefore !== undefined || imagesAfter !== undefined) {
    const current = await db.$queryRaw<{ images_before: unknown; images_after: unknown }[]>`
      SELECT images_before, images_after FROM work_orders WHERE id = ${params.id}::uuid LIMIT 1
    `
    const bef = JSON.stringify(imagesBefore ?? current[0]?.images_before ?? [])
    const aft = JSON.stringify(imagesAfter ?? current[0]?.images_after ?? [])
    await db.$executeRaw`
      UPDATE work_orders SET images_before = ${bef}::jsonb, images_after = ${aft}::jsonb
      WHERE id = ${params.id}::uuid
    `
  }

  return updated
}

export async function deleteWorkOrder(db: PrismaClient, params: { id: string; companyId: string }) {
  const wo = await db.workOrder.findFirst({
    where: { id: params.id, machine: { branch: { companyId: params.companyId } } },
    include: { _count: { select: { transactions: true } } },
  })

  if (!wo) return { error: "Not found" as const, status: 404 as const }
  if (wo._count.transactions > 0) {
    return {
      error: { message: "ไม่สามารถลบใบสั่งงานที่มีการเบิกจ่ายอะไหล่แล้วได้" },
      status: 400 as const,
    }
  }

  await db.$transaction([
    db.workOrderTechnician.deleteMany({ where: { workOrderId: params.id } }),
    db.workOrderPart.deleteMany({ where: { workOrderId: params.id } }),
    db.checklistResult.deleteMany({ where: { workOrderId: params.id } }),
    db.workOrder.delete({ where: { id: params.id } }),
  ])

  return { success: true }
}
