/**
 * Smoke test ของ /api/device-sync/hip/* กับข้อมูลจริงที่ export จาก Pm2014.mdb
 *
 *   npx tsx scripts/hip-sync-smoke.ts <export.json> [baseUrl] [--keep]
 *
 * export.json = { users: [{badgeNumber,name}], punches: [{sourceRowId,badgeNumber,checkTime,checkType,verifyCode}] }
 * สร้างเครื่องสแกนชั่วคราวที่สาขาแรก ส่งข้อมูล 2 รอบ (รอบสองต้องซ้ำทั้งหมด) ผูก badge 1 ตัวกับพนักงานทดสอบ
 * แล้วลบทุกอย่างที่สร้าง (ยกเว้น --keep)
 */
import { readFileSync } from "node:fs"
import { prisma } from "@/shared/db"
import { issueDeviceKey, mapAttendanceBadge } from "@/modules/hr"

const BATCH = 2000

type Payload = { users: unknown[]; punches: Array<{ sourceRowId: number; badgeNumber: string }> }

async function post(baseUrl: string, key: string, body: unknown) {
  const res = await fetch(`${baseUrl}/api/device-sync/hip/batch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as { data?: Record<string, number>; error?: string }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${json.error}`)
  return json.data!
}

async function syncAll(baseUrl: string, key: string, payload: Payload) {
  const t0 = Date.now()
  let inserted = 0
  let duplicates = 0
  for (let i = 0; i < payload.punches.length; i += BATCH) {
    const r = await post(baseUrl, key, {
      clientVersion: "smoke",
      users: i === 0 ? payload.users : [],
      punches: payload.punches.slice(i, i + BATCH),
    })
    inserted += r.inserted
    duplicates += r.duplicates
  }
  return { inserted, duplicates, seconds: (Date.now() - t0) / 1000 }
}

async function main() {
  const file = process.argv[2]
  const baseUrl = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : "http://localhost:3000"
  const keep = process.argv.includes("--keep")
  if (!file) throw new Error("usage: tsx scripts/hip-sync-smoke.ts <export.json> [baseUrl] [--keep]")
  const payload = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")) as Payload

  const branch = await prisma.branch.findFirstOrThrow({ where: { isActive: true, deletedAt: null }, orderBy: { code: "asc" } })
  const admin = await prisma.user.findFirstOrThrow({ where: { companyId: branch.companyId, deletedAt: null } })
  const issued = issueDeviceKey()
  const device = await prisma.attendanceDevice.create({
    data: {
      companyId: branch.companyId,
      branchId: branch.id,
      name: `SMOKE ${new Date().toISOString()}`,
      apiKeyPrefix: issued.prefix,
      apiKeyHash: issued.hash,
    },
  })
  const person = await prisma.personnel.create({
    data: { companyId: branch.companyId, branchId: branch.id, rosterNo: `SMOKE-${Date.now()}`, displayName: "SMOKE TEST" },
  })

  try {
    const unauth = await fetch(`${baseUrl}/api/device-sync/hip/state`, { headers: { Authorization: "Bearer hip_bad" } })
    console.log("state with bad key →", unauth.status)

    const state = await fetch(`${baseUrl}/api/device-sync/hip/state`, { headers: { Authorization: `Bearer ${issued.key}` } })
    console.log("state →", state.status, JSON.stringify((await state.json()).data))

    const first = await syncAll(baseUrl, issued.key, payload)
    console.log("first sync →", first)
    const second = await syncAll(baseUrl, issued.key, payload)
    console.log("second sync →", second)

    const badgeCounts = await prisma.attendancePunch.groupBy({
      by: ["badgeId"],
      where: { deviceId: device.id },
      _count: { _all: true },
      orderBy: { _count: { badgeId: "desc" } },
      take: 1,
    })
    const top = badgeCounts[0]!
    const t0 = Date.now()
    const mapped = await mapAttendanceBadge(prisma, {
      companyId: branch.companyId,
      roles: [{ branchId: branch.id, branchName: branch.name, roleName: "Admin", permissions: null }],
      userId: admin.id,
      badgeId: top.badgeId,
      personnelId: person.id,
    })
    console.log("map badge →", { punches: top._count._all, ...mapped, seconds: (Date.now() - t0) / 1000 })

    const days = await prisma.attendanceDay.groupBy({
      by: ["status"],
      where: { personnelId: person.id },
      _count: { _all: true },
    })
    const sample = await prisma.attendanceDay.findFirst({ where: { personnelId: person.id }, orderBy: { workDate: "desc" } })
    const dev = await prisma.attendanceDevice.findUniqueOrThrow({ where: { id: device.id } })
    console.log("days →", JSON.stringify(days), "latest →", JSON.stringify(sample))
    console.log("device lastSourceRowId →", dev.lastSourceRowId)
  } finally {
    if (!keep) {
      const badgeIds = (await prisma.attendanceBadge.findMany({ where: { deviceId: device.id }, select: { id: true } })).map((b) => b.id)
      await prisma.auditLog.deleteMany({ where: { tableName: "attendance_badges", recordId: { in: badgeIds } } })
      await prisma.attendanceDay.deleteMany({ where: { personnelId: person.id } })
      await prisma.attendanceDevice.delete({ where: { id: device.id } })
      await prisma.personnelBranch.deleteMany({ where: { personnelId: person.id } })
      await prisma.personnel.delete({ where: { id: person.id } })
      console.log("cleaned up")
    }
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
