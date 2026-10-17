import { z } from "zod"
import type { PrismaClient } from "@prisma/client"
import { NotFoundError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { assertAttendanceBranch } from "./attendance-access"
import { localDateKey } from "./attendance-daily-summary"
import { rebuildAttendanceDays } from "./attendance-day-rebuild"
import { ensurePersonnelBranch } from "./personnel-branch-utils"

export const mapAttendanceBadgeSchema = z.object({
  personnelId: z.string().uuid().nullable(),
})

export type BadgeListFilter = "unmapped" | "mapped" | "all"

export async function listAttendanceBadges(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId: string; filter: BadgeListFilter }
) {
  await assertAttendanceBranch(db, { ...params, action: "read" })

  const badges = await db.attendanceBadge.findMany({
    where: {
      companyId: params.companyId,
      branchId: params.branchId,
      ...(params.filter === "unmapped" && { personnelId: null }),
      ...(params.filter === "mapped" && { personnelId: { not: null } }),
    },
    select: {
      id: true,
      badgeNumber: true,
      nameOnDevice: true,
      mappedAt: true,
      device: { select: { id: true, name: true } },
      personnel: { select: { id: true, rosterNo: true, displayName: true } },
    },
  })
  if (badges.length === 0) return []

  const stats = await db.attendancePunch.groupBy({
    by: ["badgeId"],
    where: { badgeId: { in: badges.map((b) => b.id) } },
    _count: { _all: true },
    _max: { punchAt: true },
  })
  const statByBadge = new Map(stats.map((s) => [s.badgeId, { count: s._count._all, last: s._max.punchAt }]))

  const unmappedNumbers = badges.filter((b) => !b.personnel).map((b) => b.badgeNumber)
  const suggestions = unmappedNumbers.length
    ? await db.personnel.findMany({
        where: {
          companyId: params.companyId,
          deletedAt: null,
          isActive: true,
          rosterNo: { in: unmappedNumbers },
          OR: [{ branchId: params.branchId }, { branchAssignments: { some: { branchId: params.branchId } } }],
        },
        select: { id: true, rosterNo: true, displayName: true },
      })
    : []
  const suggestionByRoster = new Map(suggestions.map((p) => [p.rosterNo, p]))

  return badges
    .map((b) => ({
      ...b,
      punchCount: statByBadge.get(b.id)?.count ?? 0,
      lastPunchAt: statByBadge.get(b.id)?.last ?? null,
      suggestion: b.personnel ? null : suggestionByRoster.get(b.badgeNumber) ?? null,
    }))
    .sort((a, b) => {
      const an = Number(a.badgeNumber)
      const bn = Number(b.badgeNumber)
      if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn
      return a.badgeNumber.localeCompare(b.badgeNumber)
    })
}

/** รายชื่อพนักงานให้เลือกผูก — คนในสาขาก่อน */
export async function searchPersonnelForBadge(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId: string; q: string }
) {
  await assertAttendanceBranch(db, { ...params, action: "read" })
  const q = params.q.trim()
  const rows = await db.personnel.findMany({
    where: {
      companyId: params.companyId,
      deletedAt: null,
      isActive: true,
      ...(q && {
        OR: [
          { displayName: { contains: q, mode: "insensitive" as const } },
          { rosterNo: { contains: q, mode: "insensitive" as const } },
        ],
      }),
    },
    select: {
      id: true,
      rosterNo: true,
      displayName: true,
      branchId: true,
      branchAssignments: { where: { branchId: params.branchId }, select: { branchId: true } },
    },
    orderBy: { displayName: "asc" },
    take: 200,
  })
  return rows
    .map((p) => ({
      id: p.id,
      rosterNo: p.rosterNo,
      displayName: p.displayName,
      inBranch: p.branchId === params.branchId || p.branchAssignments.length > 0,
    }))
    .sort((a, b) => Number(b.inBranch) - Number(a.inBranch))
    .slice(0, 30)
}

/** ผูก/ยกเลิกผูก badge แล้วคำนวณ attendance_days ใหม่ของทุกวันที่ badge นี้มีการสแกน */
export async function mapAttendanceBadge(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string; badgeId: string; personnelId: string | null }
) {
  const badge = await db.attendanceBadge.findFirst({
    where: { id: params.badgeId, companyId: params.companyId },
    select: { id: true, branchId: true, badgeNumber: true, personnelId: true },
  })
  if (!badge) throw new NotFoundError("ไม่พบเลขสแกน")
  const branch = await assertAttendanceBranch(db, { ...params, branchId: badge.branchId, action: "update" })

  if (params.personnelId) {
    const person = await db.personnel.findFirst({
      where: { id: params.personnelId, companyId: params.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!person) throw new ValidationError("ไม่พบพนักงาน")
  }
  if (badge.personnelId === params.personnelId) return { badgeId: badge.id, personnelId: badge.personnelId, daysUpdated: 0 }

  const result = await db.$transaction(
    async (tx) => {
      if (params.personnelId) await ensurePersonnelBranch(tx, params.personnelId, badge.branchId)

      await tx.attendanceBadge.update({
        where: { id: badge.id },
        data: {
          personnelId: params.personnelId,
          mappedById: params.personnelId ? params.userId : null,
          mappedAt: params.personnelId ? new Date() : null,
        },
      })
      await tx.attendancePunch.updateMany({
        where: { badgeId: badge.id },
        data: { personnelId: params.personnelId },
      })

      const punches = await tx.attendancePunch.findMany({
        where: { badgeId: badge.id },
        select: { punchAt: true },
      })
      const dateKeys = [...new Set(punches.map((p) => localDateKey(p.punchAt, branch.timezone)))]

      let daysUpdated = 0
      for (const personnelId of [badge.personnelId, params.personnelId]) {
        if (!personnelId) continue
        const r = await rebuildAttendanceDays(tx, {
          companyId: params.companyId,
          branchId: badge.branchId,
          timeZone: branch.timezone,
          keys: dateKeys.map((dateKey) => ({ personnelId, dateKey })),
        })
        daysUpdated += r.written
      }

      await tx.auditLog.create({
        data: {
          userId: params.userId,
          tableName: "attendance_badges",
          recordId: badge.id,
          action: "update",
          oldValues: { personnelId: badge.personnelId },
          newValues: { personnelId: params.personnelId, badgeNumber: badge.badgeNumber, punches: punches.length },
        },
      })
      return { daysUpdated }
    },
    { timeout: 60_000, maxWait: 10_000 }
  )

  return { badgeId: badge.id, personnelId: params.personnelId, daysUpdated: result.daysUpdated }
}
