import type { PrismaClient } from "@prisma/client"

export type NotificationType =
  | "overdue_schedule"
  | "upcoming_maintenance"
  | "wo_assigned"
  | "low_stock"
  | "wo_completed"

export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  message?: string
  link?: string
  refId?: string
  refType?: string
}

export async function listUserNotifications(
  db: PrismaClient,
  params: { userId: string; unreadOnly: boolean; limit: number }
) {
  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: {
        userId: params.userId,
        ...(params.unreadOnly && { isRead: false }),
      },
      orderBy: { createdAt: "desc" },
      take: params.limit,
    }),
    db.notification.count({
      where: { userId: params.userId, isRead: false },
    }),
  ])

  return { data: notifications, unreadCount }
}

export async function markNotificationRead(
  db: PrismaClient,
  params: { id: string; userId: string }
) {
  const notification = await db.notification.updateMany({
    where: { id: params.id, userId: params.userId },
    data: { isRead: true },
  })

  if (notification.count === 0) {
    return { error: "Not found" as const, status: 404 as const }
  }

  return { success: true }
}

export async function markAllNotificationsRead(db: PrismaClient, params: { userId: string }) {
  await db.notification.updateMany({
    where: { userId: params.userId, isRead: false },
    data: { isRead: true },
  })

  return { success: true }
}

export async function createNotification(db: PrismaClient, input: CreateNotificationInput) {
  return db.notification.create({ data: input })
}

export async function createNotifications(db: PrismaClient, inputs: CreateNotificationInput[]) {
  if (inputs.length === 0) return
  return db.notification.createMany({ data: inputs })
}

export async function notifyWOAssigned(
  db: PrismaClient,
  workOrderId: string,
  assigneeId: string,
  woTitle: string,
  woNumber: string
) {
  return createNotification(db, {
    userId: assigneeId,
    type: "wo_assigned",
    title: `มอบหมายงานใหม่: ${woNumber}`,
    message: woTitle,
    link: `/work-orders/${workOrderId}`,
    refId: workOrderId,
    refType: "WorkOrder",
  })
}

export async function notifyWOCompleted(
  db: PrismaClient,
  workOrderId: string,
  createdById: string,
  woTitle: string,
  woNumber: string
) {
  return createNotification(db, {
    userId: createdById,
    type: "wo_completed",
    title: `งานเสร็จสิ้น: ${woNumber}`,
    message: woTitle,
    link: `/work-orders/${workOrderId}`,
    refId: workOrderId,
    refType: "WorkOrder",
  })
}

export async function generateOverdueNotifications(db: PrismaClient, companyId: string) {
  const now = new Date()

  const overdueSchedules = await db.maintenanceSchedule.findMany({
    where: {
      machine: { branch: { companyId } },
      dueDate: { lt: now },
      status: "pending",
    },
    include: {
      machine: { select: { name: true, branchId: true } },
      plan: { select: { assignedRoleId: true } },
    },
    take: 50,
  })

  if (overdueSchedules.length === 0) return 0

  const admins = await db.userBranchRole.findMany({
    where: {
      branch: { companyId },
      role: { name: { in: ["Admin", "Manager"] } },
    },
    select: { userId: true },
    distinct: ["userId"],
  })

  if (admins.length === 0) return 0

  const notifications = overdueSchedules.flatMap((schedule) =>
    admins.map((admin) => ({
      userId: admin.userId,
      type: "overdue_schedule" as NotificationType,
      title: `กำหนดการเกินกำหนด: ${schedule.machine.name}`,
      message: `กำหนดการวันที่ ${schedule.dueDate.toLocaleDateString("th-TH")} ยังไม่ได้รับการดำเนินการ`,
      link: "/maintenance/schedules",
      refId: schedule.id,
      refType: "MaintenanceSchedule",
    }))
  )

  await db.notification.createMany({ data: notifications, skipDuplicates: true })
  return notifications.length
}

export async function generateLowStockNotifications(db: PrismaClient, companyId: string) {
  const inventory = await db.sparePartInventory.findMany({
    where: { branch: { companyId } },
    include: {
      part: { select: { name: true, minStock: true } },
      branch: { select: { id: true } },
    },
  })

  const lowStock = inventory.filter((i) => i.currentStock <= i.part.minStock)
  if (lowStock.length === 0) return 0

  const admins = await db.userBranchRole.findMany({
    where: {
      branch: { companyId },
      role: { name: { in: ["Admin", "Manager"] } },
    },
    select: { userId: true },
    distinct: ["userId"],
  })

  if (admins.length === 0) return 0

  const notifications = lowStock.flatMap((item) =>
    admins.map((admin) => ({
      userId: admin.userId,
      type: "low_stock" as NotificationType,
      title: `อะไหล่ใกล้หมด: ${item.part.name}`,
      message: `คงเหลือ ${item.currentStock} ${item.currentStock <= 0 ? "(หมด!)" : `(ต่ำกว่า min ${item.part.minStock})`}`,
      link: "/spare-parts",
      refId: item.id,
      refType: "SparePartInventory",
    }))
  )

  await db.notification.createMany({ data: notifications, skipDuplicates: true })
  return notifications.length
}

export async function generateCompanyNotifications(db: PrismaClient) {
  const companies = await db.company.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true },
  })

  let totalOverdue = 0
  let totalLowStock = 0

  for (const company of companies) {
    const [overdueCount, lowStockCount] = await Promise.all([
      generateOverdueNotifications(db, company.id),
      generateLowStockNotifications(db, company.id),
    ])
    totalOverdue += overdueCount
    totalLowStock += lowStockCount
  }

  return {
    overdueNotifications: totalOverdue,
    lowStockNotifications: totalLowStock,
  }
}
