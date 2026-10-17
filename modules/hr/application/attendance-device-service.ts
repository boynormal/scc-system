import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { z } from "zod"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { assertAttendanceBranch, canAttendanceAnyBranch, listAttendanceBranches } from "./attendance-access"

const KEY_SCHEME = "hip"

export type IssuedDeviceKey = { prefix: string; key: string; hash: string }

export function hashDeviceSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex")
}

/** key รูปแบบ hip_<prefix 12>_<secret 43> — เก็บเฉพาะ prefix + sha256(key) */
export function issueDeviceKey(): IssuedDeviceKey {
  const prefix = randomBytes(9).toString("base64url")
  const secret = randomBytes(32).toString("base64url")
  const key = `${KEY_SCHEME}_${prefix}_${secret}`
  return { prefix, key, hash: hashDeviceSecret(key) }
}

export function parseDeviceKey(raw: string | null | undefined): { prefix: string; key: string } | null {
  if (!raw) return null
  const key = raw.replace(/^Bearer\s+/i, "").trim()
  const m = /^hip_([A-Za-z0-9_-]{12})_[A-Za-z0-9_-]{20,}$/.exec(key)
  if (!m) return null
  return { prefix: m[1]!, key }
}

export type AuthenticatedDevice = {
  id: string
  companyId: string
  branchId: string
  name: string
  lastSourceRowId: number
  branch: { code: string; name: string; timezone: string }
}

export async function authenticateDevice(
  db: PrismaClient,
  authorizationHeader: string | null
): Promise<AuthenticatedDevice> {
  const parsed = parseDeviceKey(authorizationHeader)
  if (!parsed) throw new UnauthorizedError("API key ไม่ถูกต้อง")

  const device = await db.attendanceDevice.findUnique({
    where: { apiKeyPrefix: parsed.prefix },
    select: {
      id: true,
      companyId: true,
      branchId: true,
      name: true,
      isActive: true,
      apiKeyHash: true,
      lastSourceRowId: true,
      branch: { select: { code: true, name: true, timezone: true, isActive: true, deletedAt: true } },
    },
  })
  if (!device?.apiKeyHash) throw new UnauthorizedError("API key ไม่ถูกต้อง")

  const expected = Buffer.from(device.apiKeyHash, "hex")
  const actual = Buffer.from(hashDeviceSecret(parsed.key), "hex")
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new UnauthorizedError("API key ไม่ถูกต้อง")
  }
  if (!device.isActive || !device.branch.isActive || device.branch.deletedAt) {
    throw new UnauthorizedError("เครื่องสแกนนี้ถูกปิดใช้งาน")
  }

  return {
    id: device.id,
    companyId: device.companyId,
    branchId: device.branchId,
    name: device.name,
    lastSourceRowId: device.lastSourceRowId,
    branch: { code: device.branch.code, name: device.branch.name, timezone: device.branch.timezone },
  }
}

export const createAttendanceDeviceSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().trim().min(1, "ต้องระบุชื่อเครื่อง").max(100),
  machineNumber: z.number().int().min(0).max(9999).nullable().optional(),
})

export const updateAttendanceDeviceSchema = z.object({
  name: z.string().trim().min(1, "ต้องระบุชื่อเครื่อง").max(100).optional(),
  machineNumber: z.number().int().min(0).max(9999).nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function listAttendanceDevices(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId?: string | null }
) {
  if (!canAttendanceAnyBranch(params.roles, "read")) throw new ForbiddenError()
  const branches = await listAttendanceBranches(db, params)
  const allowed = branches.map((b) => b.id)
  const branchIds = params.branchId ? allowed.filter((id) => id === params.branchId) : allowed
  if (branchIds.length === 0) return []

  const devices = await db.attendanceDevice.findMany({
    where: { companyId: params.companyId, branchId: { in: branchIds } },
    select: {
      id: true,
      branchId: true,
      name: true,
      machineNumber: true,
      apiKeyPrefix: true,
      lastSourceRowId: true,
      lastSyncedAt: true,
      lastClientVersion: true,
      isActive: true,
      createdAt: true,
      branch: { select: { code: true, name: true } },
      _count: { select: { badges: true, punches: true } },
      syncRuns: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, received: true, inserted: true, duplicates: true, newBadges: true, clientVersion: true, createdAt: true },
      },
    },
    orderBy: [{ branch: { code: "asc" } }, { name: "asc" }],
  })

  const unmapped = await db.attendanceBadge.groupBy({
    by: ["deviceId"],
    where: { deviceId: { in: devices.map((d) => d.id) }, personnelId: null },
    _count: { _all: true },
  })
  const unmappedByDevice = new Map(unmapped.map((u) => [u.deviceId, u._count._all]))

  return devices.map(({ _count, ...d }) => ({
    ...d,
    hasKey: d.apiKeyPrefix != null,
    badgeCount: _count.badges,
    punchCount: _count.punches,
    unmappedBadgeCount: unmappedByDevice.get(d.id) ?? 0,
  }))
}

export async function createAttendanceDevice(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string; input: z.infer<typeof createAttendanceDeviceSchema> }
) {
  const { input } = params
  await assertAttendanceBranch(db, { ...params, branchId: input.branchId, action: "create" })

  const dup = await db.attendanceDevice.findFirst({
    where: { branchId: input.branchId, name: input.name },
    select: { id: true },
  })
  if (dup) throw new ValidationError("มีเครื่องสแกนชื่อนี้ในสาขาแล้ว")

  const issued = issueDeviceKey()
  const device = await db.attendanceDevice.create({
    data: {
      companyId: params.companyId,
      branchId: input.branchId,
      name: input.name,
      machineNumber: input.machineNumber ?? null,
      apiKeyPrefix: issued.prefix,
      apiKeyHash: issued.hash,
    },
    select: { id: true, name: true, branchId: true },
  })
  await db.auditLog.create({
    data: {
      userId: params.userId,
      tableName: "attendance_devices",
      recordId: device.id,
      action: "create",
      newValues: { name: device.name, branchId: device.branchId },
    },
  })
  return { device, apiKey: issued.key }
}

async function loadDeviceForManage(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  const device = await db.attendanceDevice.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true, branchId: true, name: true, machineNumber: true, isActive: true },
  })
  if (!device) throw new NotFoundError("ไม่พบเครื่องสแกน")
  await assertAttendanceBranch(db, { ...params, branchId: device.branchId, action: "update" })
  return device
}

export async function updateAttendanceDevice(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string; id: string; input: z.infer<typeof updateAttendanceDeviceSchema> }
) {
  const before = await loadDeviceForManage(db, params)
  const { input } = params
  if (input.name && input.name !== before.name) {
    const dup = await db.attendanceDevice.findFirst({
      where: { branchId: before.branchId, name: input.name, id: { not: before.id } },
      select: { id: true },
    })
    if (dup) throw new ValidationError("มีเครื่องสแกนชื่อนี้ในสาขาแล้ว")
  }
  const device = await db.attendanceDevice.update({
    where: { id: before.id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.machineNumber !== undefined && { machineNumber: input.machineNumber }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    select: { id: true, name: true, machineNumber: true, isActive: true },
  })
  await db.auditLog.create({
    data: {
      userId: params.userId,
      tableName: "attendance_devices",
      recordId: device.id,
      action: "update",
      oldValues: { name: before.name, machineNumber: before.machineNumber, isActive: before.isActive },
      newValues: { name: device.name, machineNumber: device.machineNumber, isActive: device.isActive },
    },
  })
  return device
}

/** ออก key ใหม่ — key เดิมใช้ไม่ได้ทันที */
export async function rotateAttendanceDeviceKey(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string; id: string }
) {
  const device = await loadDeviceForManage(db, params)
  const issued = issueDeviceKey()
  await db.attendanceDevice.update({
    where: { id: device.id },
    data: { apiKeyPrefix: issued.prefix, apiKeyHash: issued.hash },
  })
  await db.auditLog.create({
    data: {
      userId: params.userId,
      tableName: "attendance_devices",
      recordId: device.id,
      action: "update",
      newValues: { event: "rotate_api_key" },
    },
  })
  return { apiKey: issued.key }
}
