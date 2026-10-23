import { z } from "zod"
import type { PrismaClient } from "@prisma/client"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type Action, type UserRole } from "@/lib/permissions"
import { permissionCoversBranch, readBranchSharing } from "@/shared/permissions/branch-sharing"
import { generateWONumber } from "@/modules/work_orders/application/generate-wo-number"
import { evaluateTransition, type WorkOrderStatusName } from "@/modules/work_orders/application/work-order-transitions"
import { loadRepairAsset } from "@/modules/maintenance/application/pm-asset-options"

const SCHEDULE_STATUS_FOR: Partial<Record<WorkOrderStatusName, "in_progress" | "completed" | "cancelled">> = {
  in_progress: "in_progress",
  handed_over: "completed",
  closed: "completed",
  cancelled: "cancelled",
}

export const createWorkOrderSchema = z
  .object({
    /** ทรัพย์สินที่ยังใช้งาน ไม่ต้องเปิดสวิตช์เข้าแผนซ่อมบำรุง */
    assetId: z.string().uuid().optional(),
    typeId: z.string().uuid(),
    /** งานทั่วไปต้องส่ง ถ้ามีทรัพย์สินต้องตรงกับสาขาของทรัพย์สิน */
    branchId: z.string().uuid().optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    plannedStart: z.string().optional(),
    plannedEnd: z.string().optional(),
    assignedTo: z.string().uuid().optional(),
    imagesBefore: z.array(z.string()).optional(),
    imagesAfter: z.array(z.string()).optional(),
  })
  .refine((v) => !!v.assetId || !!v.branchId, { message: "ต้องเลือกทรัพย์สิน หรือสาขาของงานทั่วไป" })

export const updateWorkOrderSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
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

export const transitionWorkOrderSchema = z.object({
  toStatus: z.string().min(1),
  reason: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
})

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>
export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderSchema>
export type TransitionWorkOrderInput = z.infer<typeof transitionWorkOrderSchema>

function shareFlagFor(action: Action, share: { view: boolean; edit: boolean; delete: boolean }) {
  if (action === "read") return share.view
  if (action === "update") return share.edit
  if (action === "delete") return share.delete
  return false
}

export async function listWorkOrders(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    status?: string | null
    priority?: string | null
    assignedTo?: string | null
    machineId?: string | null
    assetId?: string | null
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

  const share = await readBranchSharing(db, params.companyId)
  const open = isAdminInAnyBranch(params.roles) || share.work_orders.view

  const base = { branch: { companyId: params.companyId } }
  let branchFilter: { branchId: string } | { branchId: { in: string[] } } | Record<string, never> = {}

  if (open) {
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
    ...(params.machineId && { machineId: params.machineId }),
    ...(params.assetId && { assetId: params.assetId }),
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
        asset: { select: { id: true, name: true, code: true } },
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
  const target = await resolveWorkOrderTarget(db, params.companyId, params.input)
  if ("error" in target) return target
  const { branchId, machineId, assetId } = target
  const branchOk = await db.branch.findFirst({
    where: { id: branchId, companyId: params.companyId, deletedAt: null, isActive: true },
    select: { id: true },
  })
  if (!branchOk) {
    return { error: "Invalid branch" as const, status: 400 as const }
  }
  const shareCreate = (await readBranchSharing(db, params.companyId)).work_orders.create
  if (!permissionCoversBranch(params.roles, "work_orders", "create", branchId, shareCreate)) {
    return { error: "Forbidden" as const, status: 403 as const }
  }

  const { imagesBefore, imagesAfter, typeId, priority, title, description, plannedStart, plannedEnd, assignedTo } =
    params.input
  const rest = { typeId, priority, title, description, plannedStart, plannedEnd, assignedTo }
  const status: WorkOrderStatusName = rest.assignedTo ? "assigned" : "open"
  const created = await db.$transaction(async (tx) => {
    const woNumber = await generateWONumber(tx, branchId)
    const workOrder = await tx.workOrder.create({
      data: {
        ...rest,
        branchId,
        machineId,
        assetId,
        woNumber,
        workKind: "corrective",
        plannedStart: rest.plannedStart ? new Date(rest.plannedStart) : undefined,
        plannedEnd: rest.plannedEnd ? new Date(rest.plannedEnd) : undefined,
        status,
        createdBy: params.userId,
      },
    })
    await tx.workOrderStatusHistory.create({
      data: {
        workOrderId: workOrder.id,
        toStatus: status,
        changedBy: params.userId,
      },
    })
    return { workOrder, woNumber }
  })

  if ((imagesBefore && imagesBefore.length > 0) || (imagesAfter && imagesAfter.length > 0)) {
    const bef = JSON.stringify(imagesBefore ?? [])
    const aft = JSON.stringify(imagesAfter ?? [])
    await db.$executeRaw`
      UPDATE work_orders SET images_before = ${bef}::jsonb, images_after = ${aft}::jsonb
      WHERE id = ${created.workOrder.id}::uuid
    `
  }

  const warning = target.vehicleId ? await openTransportRepairWarning(db, params.companyId, target.vehicleId) : null
  return { data: created.workOrder, woNumber: created.woNumber, warning }
}

/** แจ้งซ่อมทรัพย์สิน (สาขามาจากทรัพย์สิน) หรืองานทั่วไปที่มีแค่สาขา */
async function resolveWorkOrderTarget(
  db: PrismaClient,
  companyId: string,
  input: { assetId?: string; branchId?: string }
): Promise<
  | { branchId: string; machineId: string | null; assetId: string | null; vehicleId: string | null }
  | { error: string; status: 400 }
> {
  if (input.assetId) {
    const asset = await loadRepairAsset(db, companyId, input.assetId)
    if (!asset) return { error: "ไม่พบทรัพย์สิน หรือทรัพย์สินถูกปิดใช้ ปลดระวาง หรือจำหน่ายแล้ว", status: 400 }
    if (input.branchId && input.branchId !== asset.branchId) return { error: "Invalid branch", status: 400 }
    return {
      branchId: asset.branchId,
      machineId: asset.machineId,
      assetId: asset.id,
      vehicleId: asset.link?.kind === "vehicle" ? asset.link.id : null,
    }
  }
  if (!input.branchId) return { error: "ต้องเลือกทรัพย์สิน หรือสาขาของงานทั่วไป", status: 400 }
  return { branchId: input.branchId, machineId: null, assetId: null, vehicleId: null }
}

/** อ่านอย่างเดียว: ไม่บล็อกการสร้างใบงาน */
async function openTransportRepairWarning(db: PrismaClient, companyId: string, vehicleId: string) {
  const open = await db.transportRepairLog.findFirst({
    where: { companyId, vehicleId, status: { in: ["reported", "in_repair"] } },
    select: { repairNumber: true },
    orderBy: { reportedAt: "desc" },
  })
  return open ? `รถคันนี้มีใบแจ้งซ่อมขนส่งเปิดอยู่ (${open.repairNumber}) ตรวจว่าไม่ซ้ำงานกัน` : null
}

export async function loadScopedWorkOrder(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[]; action: Action }
) {
  const workOrder = await db.workOrder.findFirst({
    where: { id: params.id, branch: { companyId: params.companyId } },
  })
  if (!workOrder) return { ok: false as const, error: "Not found" as const, status: 404 as const }
  const share = await readBranchSharing(db, params.companyId)
  const action = params.action === "approve" ? "approve" : params.action
  const shared = action === "approve" ? false : shareFlagFor(action, share.work_orders)
  if (!permissionCoversBranch(params.roles, "work_orders", action, workOrder.branchId, shared)) {
    return { ok: false as const, error: "Forbidden" as const, status: 403 as const }
  }
  return { ok: true as const, workOrder }
}

export async function getWorkOrderDetail(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[] }
) {
  const scoped = await loadScopedWorkOrder(db, { ...params, action: "read" })
  if (!scoped.ok) return scoped
  const wo = await db.workOrder.findFirst({
    where: { id: params.id, branch: { companyId: params.companyId } },
    include: {
      machine: { select: { id: true, name: true, code: true, branchId: true } },
      asset: { select: { id: true, name: true, code: true, branchId: true } },
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
  params: { companyId: string; roles: UserRole[]; search?: string; machineId?: string; assetId?: string }
) {
  const listed = await listWorkOrders(db, {
    companyId: params.companyId,
    roles: params.roles,
    search: params.search,
    machineId: params.machineId,
    assetId: params.assetId,
    page: 1,
    pageSize: 200,
  })
  if ("error" in listed) return []
  const ids = listed.data.map((row) => row.id)
  return db.workOrder.findMany({
    where: {
      id: { in: ids },
      branch: { companyId: params.companyId },
      ...(params.machineId && { machineId: params.machineId }),
      ...(params.assetId && { assetId: params.assetId }),
    },
    include: {
      machine: { select: { id: true, name: true, code: true, branchId: true } },
      asset: { select: { id: true, name: true, code: true, branchId: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
      schedule: { select: { id: true, plan: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getWorkOrderDetailForPage(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[] }
) {
  const scoped = await loadScopedWorkOrder(db, { ...params, action: "read" })
  if (!scoped.ok) return null
  const workOrder = await db.workOrder.findFirst({
    where: { id: params.id, branch: { companyId: params.companyId } },
    include: {
      machine: { select: { id: true, name: true, code: true, branchId: true, branch: { select: { name: true } } } },
      asset: { select: { id: true, name: true, code: true, branchId: true, branch: { select: { name: true } } } },
      branch: { select: { name: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
      schedule: {
        select: {
          id: true,
          dueDate: true,
          plan: { select: { name: true, type: { select: { code: true, color: true } } } },
        },
      },
      sourceWorkOrder: { select: { id: true, woNumber: true, title: true } },
      parts: { include: { part: { select: { id: true, name: true, code: true, unit: true } } } },
      statusHistory: { orderBy: { changedAt: "desc" }, take: 20 },
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
  params: { id: string; companyId: string; roles: UserRole[]; input: UpdateWorkOrderInput }
) {
  const existing = await loadScopedWorkOrder(db, { ...params, action: "update" })
  if (!existing.ok) return existing

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

export async function deleteWorkOrder(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[] }
) {
  const scoped = await loadScopedWorkOrder(db, { ...params, action: "delete" })
  if (!scoped.ok) return scoped
  const wo = await db.workOrder.findFirst({
    where: { id: params.id, branch: { companyId: params.companyId } },
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
    db.workOrderStatusHistory.deleteMany({ where: { workOrderId: params.id } }),
    db.workOrderTechnician.deleteMany({ where: { workOrderId: params.id } }),
    db.workOrderPart.deleteMany({ where: { workOrderId: params.id } }),
    db.checklistResult.deleteMany({ where: { workOrderId: params.id } }),
    db.workOrder.delete({ where: { id: params.id } }),
  ])

  return { success: true }
}

export async function transitionWorkOrder(
  db: PrismaClient,
  params: {
    id: string
    companyId: string
    userId: string
    roles: UserRole[]
    input: TransitionWorkOrderInput
  }
): Promise<{ data: { id: string; status: string } } | { error: string; status: number }> {
  const scoped = await loadScopedWorkOrder(db, { ...params, action: "update" })
  if (!scoped.ok) return scoped
  const current = scoped.workOrder
  const hasApprove = permissionCoversBranch(params.roles, "work_orders", "approve", current.branchId, false)
  const decision = evaluateTransition({
    from: current.status,
    to: params.input.toStatus,
    reason: params.input.reason,
    hasApprove,
    assignedTo: params.input.assignedTo ?? current.assignedTo,
  })
  if (!decision.ok) return { error: decision.message, status: 400 as const }

  const toStatus = params.input.toStatus as WorkOrderStatusName
  const reason = params.input.reason?.trim() || null
  const blocksWhileTiming =
    toStatus === "ready_for_handover" ||
    toStatus === "handed_over" ||
    toStatus === "closed" ||
    toStatus === "cancelled"
  const outcome = await db.$transaction(async (tx) => {
    if (blocksWhileTiming) {
      const open = await tx.workOrderLaborEntry.count({
        where: { workOrderId: params.id, endedAt: null },
      })
      if (open > 0) return { error: "ยังมีช่างที่จับเวลาค้างอยู่" as const, status: 400 as const }
      const blankRequired = await tx.checklistResult.count({
        where: { workOrderId: params.id, status: null, item: { isRequired: true } },
      })
      if (blankRequired > 0) {
        return { error: `ยังมีข้อตรวจบังคับที่ยังไม่บันทึก ${blankRequired} ข้อ`, status: 400 as const }
      }
    }
    const row = await tx.workOrder.update({
      where: { id: params.id },
      data: {
        status: toStatus,
        ...(decision.rule.needsAssignee && params.input.assignedTo
          ? { assignedTo: params.input.assignedTo }
          : {}),
        ...(toStatus === "closed"
          ? { closedAt: new Date(), approvedBy: params.userId, approvedAt: new Date() }
          : {}),
      },
    })
    await tx.workOrderStatusHistory.create({
      data: {
        workOrderId: params.id,
        fromStatus: current.status,
        toStatus,
        changedBy: params.userId,
        reason,
      },
    })
    const scheduleStatus = SCHEDULE_STATUS_FOR[toStatus]
    if (current.scheduleId && scheduleStatus) {
      await tx.maintenanceSchedule.update({
        where: { id: current.scheduleId },
        data: { status: scheduleStatus },
      })
    }
    return { data: { id: row.id, status: row.status } }
  })

  return outcome
}
