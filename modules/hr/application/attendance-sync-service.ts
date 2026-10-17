import { z } from "zod"
import type { Prisma, PrismaClient } from "@prisma/client"
import { ValidationError } from "@/lib/errors"
import { localDateKey } from "./attendance-daily-summary"
import { rebuildAttendanceDays } from "./attendance-day-rebuild"
import type { AuthenticatedDevice } from "./attendance-device-service"

export const HIP_SYNC_MAX_PUNCHES = 2000
export const HIP_SYNC_MAX_USERS = 5000

const badgeNumber = z
  .string()
  .trim()
  .min(1)
  .max(30)

export const hipSyncBatchSchema = z.object({
  clientVersion: z.string().trim().max(30).optional(),
  users: z
    .array(z.object({ badgeNumber, name: z.string().trim().max(255).nullable().optional() }))
    .max(HIP_SYNC_MAX_USERS)
    .default([]),
  punches: z
    .array(
      z.object({
        sourceRowId: z.number().int().min(0),
        badgeNumber,
        /** เวลาท้องถิ่นของเครื่องสาขาพร้อม offset เช่น 2026-10-17T08:02:14+07:00 */
        checkTime: z.string().datetime({ offset: true }),
        checkType: z.string().trim().max(5).nullable().optional(),
        verifyCode: z.number().int().nullable().optional(),
      })
    )
    .max(HIP_SYNC_MAX_PUNCHES, `ส่งได้ไม่เกิน ${HIP_SYNC_MAX_PUNCHES} แถวต่อครั้ง`),
})

export type HipSyncBatchInput = z.infer<typeof hipSyncBatchSchema>

export function latestClientVersion(): string | null {
  return process.env.HIP_SYNC_LATEST_VERSION?.trim() || null
}

export async function getHipSyncState(db: PrismaClient, device: AuthenticatedDevice) {
  const unmappedBadges = await db.attendanceBadge.count({ where: { deviceId: device.id, personnelId: null } })
  return {
    device: { id: device.id, name: device.name },
    branch: { code: device.branch.code, name: device.branch.name, timezone: device.branch.timezone },
    lastSourceRowId: device.lastSourceRowId,
    unmappedBadges,
    latestClientVersion: latestClientVersion(),
  }
}

export async function ingestHipBatch(db: PrismaClient, device: AuthenticatedDevice, input: HipSyncBatchInput) {
  const names = new Map<string, string | null>()
  for (const u of input.users) names.set(u.badgeNumber, u.name ?? null)
  for (const p of input.punches) if (!names.has(p.badgeNumber)) names.set(p.badgeNumber, null)

  const punches = input.punches.map((p) => {
    const punchAt = new Date(p.checkTime)
    if (Number.isNaN(punchAt.getTime())) throw new ValidationError("checkTime ไม่ถูกต้อง")
    return { ...p, punchAt }
  })

  return db.$transaction(
    async (tx) => {
      const numbers = [...names.keys()]
      const existing = numbers.length
        ? await tx.attendanceBadge.findMany({
            where: { deviceId: device.id, badgeNumber: { in: numbers } },
            select: { badgeNumber: true, nameOnDevice: true },
          })
        : []
      const known = new Map(existing.map((b) => [b.badgeNumber, b.nameOnDevice]))

      const created = await tx.attendanceBadge.createMany({
        data: numbers
          .filter((n) => !known.has(n))
          .map((n) => ({
            companyId: device.companyId,
            branchId: device.branchId,
            deviceId: device.id,
            badgeNumber: n,
            nameOnDevice: names.get(n) ?? null,
          })),
        skipDuplicates: true,
      })
      for (const [n, name] of names) {
        if (name && known.has(n) && known.get(n) !== name) {
          await tx.attendanceBadge.update({
            where: { deviceId_badgeNumber: { deviceId: device.id, badgeNumber: n } },
            data: { nameOnDevice: name },
          })
        }
      }

      const badges = numbers.length
        ? await tx.attendanceBadge.findMany({
            where: { deviceId: device.id, badgeNumber: { in: numbers } },
            select: { id: true, badgeNumber: true, personnelId: true },
          })
        : []
      const badgeByNumber = new Map(badges.map((b) => [b.badgeNumber, b]))

      const run = await tx.attendanceSyncRun.create({
        data: {
          deviceId: device.id,
          received: punches.length,
          newBadges: created.count,
          clientVersion: input.clientVersion ?? null,
        },
        select: { id: true },
      })

      const rows: Prisma.AttendancePunchCreateManyInput[] = punches.map((p) => {
        const badge = badgeByNumber.get(p.badgeNumber)!
        return {
          companyId: device.companyId,
          branchId: device.branchId,
          deviceId: device.id,
          badgeId: badge.id,
          personnelId: badge.personnelId,
          punchAt: p.punchAt,
          checkType: p.checkType ?? null,
          verifyCode: p.verifyCode ?? null,
          sourceRowId: p.sourceRowId,
          syncRunId: run.id,
        }
      })
      const inserted = rows.length ? (await tx.attendancePunch.createMany({ data: rows, skipDuplicates: true })).count : 0
      const duplicates = rows.length - inserted

      await tx.attendanceSyncRun.update({ where: { id: run.id }, data: { inserted, duplicates } })

      const maxSourceRowId = punches.reduce((m, p) => Math.max(m, p.sourceRowId), 0)
      const current = await tx.attendanceDevice.findUniqueOrThrow({
        where: { id: device.id },
        select: { lastSourceRowId: true },
      })
      const lastSourceRowId = Math.max(current.lastSourceRowId, maxSourceRowId)
      await tx.attendanceDevice.update({
        where: { id: device.id },
        data: {
          lastSourceRowId,
          lastSyncedAt: new Date(),
          ...(input.clientVersion && { lastClientVersion: input.clientVersion }),
        },
      })

      const dayKeys = new Map<string, { personnelId: string; dateKey: string }>()
      for (const r of rows) {
        if (!r.personnelId) continue
        const dateKey = localDateKey(r.punchAt as Date, device.branch.timezone)
        dayKeys.set(`${r.personnelId}|${dateKey}`, { personnelId: r.personnelId, dateKey })
      }
      const days = await rebuildDaysPerPerson(tx, device, [...dayKeys.values()])

      const unmappedBadges = await tx.attendanceBadge.count({ where: { deviceId: device.id, personnelId: null } })

      return {
        syncRunId: run.id,
        received: rows.length,
        inserted,
        duplicates,
        newBadges: created.count,
        unmappedBadges,
        daysUpdated: days,
        lastSourceRowId,
        latestClientVersion: latestClientVersion(),
      }
    },
    { timeout: 60_000, maxWait: 10_000 }
  )
}

/** แยกต่อคนเพื่อไม่ให้ cross product ของคน × วัน กว้างเกินจำเป็น */
async function rebuildDaysPerPerson(
  tx: Prisma.TransactionClient,
  device: AuthenticatedDevice,
  keys: Array<{ personnelId: string; dateKey: string }>
): Promise<number> {
  const byPerson = new Map<string, Array<{ personnelId: string; dateKey: string }>>()
  for (const k of keys) {
    const list = byPerson.get(k.personnelId)
    if (list) list.push(k)
    else byPerson.set(k.personnelId, [k])
  }
  let written = 0
  for (const list of byPerson.values()) {
    const r = await rebuildAttendanceDays(tx, {
      companyId: device.companyId,
      branchId: device.branchId,
      timeZone: device.branch.timezone,
      keys: list,
    })
    written += r.written
  }
  return written
}
