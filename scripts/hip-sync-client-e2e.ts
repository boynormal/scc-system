/**
 * End-to-end ของโปรแกรมสาขา tools/hip-sync (HipSync.exe --sync) กับเซิร์ฟเวอร์ที่รันอยู่
 *
 *   npx tsx scripts/hip-sync-client-e2e.ts <HipSync.exe> <Pm2014.mdb> [baseUrl] [--keep]
 *
 * สร้างเครื่องสแกนชั่วคราวที่สาขาแรก รันโปรแกรม 2 รอบ (รอบสองต้องไม่มีแถวใหม่) ตรวจจำนวนใน DB แล้วลบทิ้ง (ยกเว้น --keep)
 */
import { spawnSync } from "node:child_process"
import { prisma } from "@/shared/db"
import { issueDeviceKey } from "@/modules/hr"

function runClient(exe: string, env: Record<string, string>) {
  const t0 = Date.now()
  const r = spawnSync(exe, ["--sync"], { env: { ...process.env, ...env }, encoding: "utf8", timeout: 15 * 60_000 })
  return { status: r.status, stdout: r.stdout?.trim(), stderr: r.stderr?.trim(), seconds: (Date.now() - t0) / 1000 }
}

async function main() {
  const [exe, mdb] = process.argv.slice(2)
  const baseUrl = process.argv[4] && !process.argv[4].startsWith("--") ? process.argv[4] : "http://localhost:3000"
  const keep = process.argv.includes("--keep")
  if (!exe || !mdb) throw new Error("usage: tsx scripts/hip-sync-client-e2e.ts <HipSync.exe> <Pm2014.mdb> [baseUrl] [--keep]")

  const branch = await prisma.branch.findFirstOrThrow({ where: { isActive: true, deletedAt: null }, orderBy: { code: "asc" } })
  const issued = issueDeviceKey()
  const device = await prisma.attendanceDevice.create({
    data: {
      companyId: branch.companyId,
      branchId: branch.id,
      name: `E2E ${new Date().toISOString()}`,
      apiKeyPrefix: issued.prefix,
      apiKeyHash: issued.hash,
    },
  })
  const env = { HIPSYNC_SERVER_URL: baseUrl, HIPSYNC_DEVICE_KEY: issued.key, HIPSYNC_MDB_PATH: mdb }

  try {
    console.log("bad key →", runClient(exe, { ...env, HIPSYNC_DEVICE_KEY: `hip_${"x".repeat(12)}_${"y".repeat(43)}` }))
    console.log("first →", runClient(exe, env))
    console.log("second →", runClient(exe, env))

    const [punches, badges, runs, dev] = await Promise.all([
      prisma.attendancePunch.count({ where: { deviceId: device.id } }),
      prisma.attendanceBadge.count({ where: { deviceId: device.id } }),
      prisma.attendanceSyncRun.findMany({ where: { deviceId: device.id }, select: { inserted: true, duplicates: true, clientVersion: true } }),
      prisma.attendanceDevice.findUniqueOrThrow({ where: { id: device.id } }),
    ])
    const sample = await prisma.attendancePunch.findFirst({ where: { deviceId: device.id }, orderBy: { sourceRowId: "asc" } })
    console.log("db →", {
      punches,
      badges,
      runs: runs.length,
      insertedTotal: runs.reduce((a, r) => a + r.inserted, 0),
      clientVersions: [...new Set(runs.map((r) => r.clientVersion))],
      lastSourceRowId: dev.lastSourceRowId,
      lastClientVersion: dev.lastClientVersion,
      firstPunch: sample && { sourceRowId: sample.sourceRowId, punchAt: sample.punchAt.toISOString() },
    })
  } finally {
    if (!keep) {
      const badgeIds = (await prisma.attendanceBadge.findMany({ where: { deviceId: device.id }, select: { id: true } })).map((b) => b.id)
      await prisma.auditLog.deleteMany({ where: { tableName: "attendance_badges", recordId: { in: badgeIds } } })
      await prisma.attendanceDevice.delete({ where: { id: device.id } })
      console.log("cleaned up")
    }
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
