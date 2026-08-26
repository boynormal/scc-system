import type { PrismaClient } from "@prisma/client"
import { createNotifications } from "@/modules/notifications"
import { daysRemaining, getDueAlertLevel } from "./due-date-utils"

const ALERT_COPY: Record<
  "watch" | "approaching" | "urgent" | "expired",
  { type: "due_item_upcoming" | "due_item_overdue"; titlePrefix: string }
> = {
  watch: { type: "due_item_upcoming", titlePrefix: "เฝ้าระวัง" },
  approaching: { type: "due_item_upcoming", titlePrefix: "ใกล้ครบกำหนด" },
  urgent: { type: "due_item_upcoming", titlePrefix: "เร่งด่วน" },
  expired: { type: "due_item_overdue", titlePrefix: "หมดอายุ" },
}

export async function generateDueItemNotifications(db: PrismaClient, companyId: string) {
  const today = new Date()
  const openItems = await db.dueItem.findMany({
    where: { companyId, status: "open" },
    select: {
      id: true,
      title: true,
      endDate: true,
      ownerUserId: true,
      branchId: true,
    },
    take: 200,
  })
  if (openItems.length === 0) return { upcoming: 0, overdue: 0 }

  const existing = await db.notification.findMany({
    where: {
      isRead: false,
      refType: "DueItem",
      type: { in: ["due_item_upcoming", "due_item_overdue"] },
      refId: { in: openItems.map((i) => i.id) },
    },
    select: { userId: true, type: true, refId: true },
  })
  const seen = new Set(existing.map((n) => `${n.userId}:${n.type}:${n.refId}`))

  const adminCache = new Map<string, string[]>()
  async function recipientIds(item: (typeof openItems)[number]): Promise<string[]> {
    if (item.ownerUserId) return [item.ownerUserId]
    const cached = adminCache.get(item.branchId)
    if (cached) return cached
    const admins = await db.userBranchRole.findMany({
      where: {
        branchId: item.branchId,
        role: { name: { in: ["Admin", "Manager"] } },
      },
      select: { userId: true },
      distinct: ["userId"],
    })
    const ids = admins.map((a) => a.userId)
    adminCache.set(item.branchId, ids)
    return ids
  }

  const payloads: {
    userId: string
    type: "due_item_upcoming" | "due_item_overdue"
    title: string
    message: string
    link: string
    refId: string
    refType: string
  }[] = []

  for (const item of openItems) {
    const level = getDueAlertLevel(item.endDate, today)
    if (level === "normal") continue
    const copy = ALERT_COPY[level]
    const remaining = daysRemaining(item.endDate, today)
    const users = await recipientIds(item)
    const endLabel = item.endDate.toLocaleDateString("th-TH")
    const message =
      remaining <= 0
        ? `สิ้นสุด ${endLabel} · หมดอายุแล้ว`
        : `สิ้นสุด ${endLabel} · เหลือ ${remaining} วัน`
    for (const userId of users) {
      const key = `${userId}:${copy.type}:${item.id}`
      if (seen.has(key)) continue
      seen.add(key)
      payloads.push({
        userId,
        type: copy.type,
        title: `${copy.titlePrefix}: ${item.title}`,
        message,
        link: `/due-dates/${item.id}`,
        refId: item.id,
        refType: "DueItem",
      })
    }
  }

  await createNotifications(db, payloads)
  return {
    upcoming: payloads.filter((p) => p.type === "due_item_upcoming").length,
    overdue: payloads.filter((p) => p.type === "due_item_overdue").length,
  }
}

export async function generateAllDueItemNotifications(db: PrismaClient) {
  const companies = await db.company.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true },
  })
  let upcoming = 0
  let overdue = 0
  for (const company of companies) {
    const result = await generateDueItemNotifications(db, company.id)
    upcoming += result.upcoming
    overdue += result.overdue
  }
  return { upcoming, overdue }
}
