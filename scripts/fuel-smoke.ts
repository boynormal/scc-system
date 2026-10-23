/**
 * Fuel module smoke test against the configured database, using production services.
 * Creates a throwaway fuel type + tank, runs receive/dispense/reverse/adjust/report flows,
 * then hard-deletes everything it created (including low-level notifications).
 *
 *   npx tsx scripts/fuel-smoke.ts
 */
import { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import {
  adjustFuel,
  createFuelTank,
  createFuelType,
  deleteFuelTank,
  dispenseFuel,
  exportFuelTransactionsCsv,
  getFuelConsumptionReport,
  getFuelMovementReport,
  getFuelStockReport,
  getFuelTank,
  listFuelAssets,
  listFuelTransactions,
  receiveFuel,
  reverseFuelTransaction,
} from "@/modules/fuel"

const db = new PrismaClient()
const results: { name: string; ok: boolean; note?: string }[] = []

function check(name: string, ok: boolean, note?: string) {
  results.push({ name, ok, note })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? `  (${note})` : ""}`)
}

async function expectReject(name: string, fn: () => Promise<unknown>, pattern?: RegExp) {
  try {
    await fn()
    check(name, false, "did not throw")
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    check(name, pattern ? pattern.test(msg) : true, msg)
  }
}

async function main() {
  const admin = await db.userBranchRole.findFirst({
    where: { role: { name: "Admin" }, user: { isActive: true, deletedAt: null }, branch: { deletedAt: null } },
    select: { userId: true, branchId: true, branch: { select: { companyId: true, name: true } } },
  })
  if (!admin) throw new Error("No active Admin user found")
  const companyId = admin.branch.companyId
  const branchId = admin.branchId
  const userId = admin.userId
  const roles: UserRole[] = [{ branchId, branchName: admin.branch.name, roleName: "Admin", permissions: null }]
  const technician: UserRole[] = [{ branchId, branchName: admin.branch.name, roleName: "Technician", permissions: null }]
  const ctx = { companyId, roles, userId }

  let typeId: string | null = null
  let tankId: string | null = null
  let restoreMeter: { id: string; fuelMeterType: "ODOMETER" | "HOUR_METER" | "NONE" } | null = null
  try {
    const type = await createFuelType(db, { companyId, roles, input: { name: "Smoke diesel" } })
    typeId = type.data.id
    check("auto fuel type code + unit", /^FT-\d{3,}$/.test(type.data.code) && type.data.unit === "ลิตร", type.data.code)
    const tank = await createFuelTank(db, {
      companyId,
      roles,
      input: { branchId, fuelTypeId: typeId, name: "Smoke tank", capacity: 1000, minLevel: 100 },
    })
    tankId = tank.data.id
    check("auto tank code", /^TK-\d{3,}$/.test(tank.data.code), tank.data.code)
    check("create type + tank", tank.data.currentQty === 0)

    const at = () => new Date().toISOString()
    await expectReject(
      "receive without date and time rejected",
      () => receiveFuel(db, { ...ctx, input: { tankId: tankId!, quantity: 10, unitCost: 30 } }),
      /กรุณาระบุวันเวลา/
    )
    await receiveFuel(db, { ...ctx, input: { tankId, quantity: 500, unitCost: 30, occurredAt: at() } })
    await receiveFuel(db, { ...ctx, input: { tankId, quantity: 300, unitCost: 34, occurredAt: at() } })
    let t = (await getFuelTank(db, { companyId, roles, id: tankId })).data
    check("receive x2 moving average", t.currentQty === 800 && t.avgCost === 31.5, `qty=${t.currentQty} avg=${t.avgCost}`)

    await expectReject(
      "receive over capacity rejected",
      () => receiveFuel(db, { ...ctx, input: { tankId: tankId!, quantity: 300, unitCost: 30, occurredAt: at() } }),
      /ความจุ/
    )

    const d1 = await dispenseFuel(db, {
      ...ctx,
      roles: technician,
      input: { tankId, quantity: 450, targetType: "OTHER", otherTargetName: "Smoke generator", occurredAt: at() },
    })
    check("dispense OTHER at avg cost", d1.data.totalCost === 14175 && d1.data.balanceAfter === 350, `cost=${d1.data.totalCost}`)

    await expectReject(
      "dispense more than stock rejected",
      () => dispenseFuel(db, { ...ctx, input: { tankId: tankId!, quantity: 9999, targetType: "OTHER", otherTargetName: "x", occurredAt: at() } })
    )

    const assets = await listFuelAssets(db, { companyId, roles, branchId })
    const asset = assets.data[0]
    if (asset) {
      restoreMeter = { id: asset.id, fuelMeterType: asset.fuelMeterType }
      await db.asset.update({ where: { id: asset.id }, data: { fuelMeterType: "ODOMETER" } })
      const now = Date.now()
      const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString()
      const base = (asset.lastOdometer ?? 0) + 1000
      await dispenseFuel(db, {
        ...ctx,
        input: { tankId, quantity: 20, targetType: "ASSET", assetId: asset.id, meterType: "ODOMETER", meterReading: base, occurredAt: iso(2) },
      })
      await dispenseFuel(db, {
        ...ctx,
        input: { tankId, quantity: 20, targetType: "ASSET", assetId: asset.id, meterType: "ODOMETER", meterReading: base + 200, occurredAt: iso(1) },
      })
      check("dispense ASSET with odometer", true, `${asset.code}`)
      await expectReject(
        "odometer going backwards rejected",
        () =>
          dispenseFuel(db, {
            ...ctx,
            input: { tankId: tankId!, quantity: 5, targetType: "ASSET", assetId: asset.id, meterType: "ODOMETER", meterReading: base + 100, occurredAt: at() },
          }),
        /เลขไมล์|มิเตอร์/
      )
      const cons = await getFuelConsumptionReport(db, { companyId, roles, query: { assetId: asset.id } })
      const row = cons.data.find((r) => r.assetId === asset.id)
      check("consumption km/L", row?.odometer?.kmPerLiter != null, `km/L=${row?.odometer?.kmPerLiter}`)
    } else {
      check("dispense ASSET with odometer", true, "SKIP: no active asset in branch")
    }

    t = (await getFuelTank(db, { companyId, roles, id: tankId })).data
    const toLow = t.currentQty - 80
    await dispenseFuel(db, { ...ctx, input: { tankId, quantity: toLow, targetType: "OTHER", otherTargetName: "Smoke pump", occurredAt: at() } })
    const notes = await db.notification.count({ where: { refType: "FuelTank", refId: tankId } })
    check("low-level notification on crossing minLevel", notes > 0, `notifications=${notes}`)

    await expectReject(
      "technician cannot reverse",
      () => reverseFuelTransaction(db, { ...ctx, roles: technician, id: d1.data.id, input: { remark: "smoke" } })
    )
    await reverseFuelTransaction(db, { ...ctx, id: d1.data.id, input: { remark: "smoke" } })
    t = (await getFuelTank(db, { companyId, roles, id: tankId })).data
    check("reverse dispense restores qty", t.currentQty === 80 + 450, `qty=${t.currentQty} avg=${t.avgCost}`)
    await expectReject(
      "double reverse rejected",
      () => reverseFuelTransaction(db, { ...ctx, id: d1.data.id, input: { remark: "again" } })
    )

    const adj = await adjustFuel(db, { ...ctx, input: { tankId, measuredQty: t.currentQty - 5, remark: "dip smoke" } })
    check("adjust to measured qty", adj.data.quantity === -5)

    await expectReject("delete non-empty tank rejected", () => deleteFuelTank(db, { companyId, roles, id: tankId! }))

    const stock = await getFuelStockReport(db, { companyId, roles })
    check("stock report includes tank", stock.data.tanks.some((x) => x.id === tankId))
    const move = await getFuelMovementReport(db, { companyId, roles, query: {} })
    const mv = move.data.find((x) => x.tankId === tankId)
    check("movement report received 800", mv?.receivedQty === 800, `received=${mv?.receivedQty} dispensed=${mv?.dispensedQty}`)
    const ledger = await listFuelTransactions(db, { companyId, roles, filter: { tankId } })
    check("ledger lists rows", ledger.total >= 6, `rows=${ledger.total}`)
    const csv = await exportFuelTransactionsCsv(db, { companyId, roles, filter: { tankId } })
    check("CSV export", typeof csv === "string" ? csv.length > 0 : true)
    const last = ledger.data[0]
    t = (await getFuelTank(db, { companyId, roles, id: tankId })).data
    check("tank cache matches last ledger balance", last?.balanceAfter === t.currentQty, `ledger=${last?.balanceAfter} tank=${t.currentQty}`)
  } finally {
    if (tankId) {
      await db.notification.deleteMany({ where: { refType: "FuelTank", refId: tankId } })
      await db.fuelTransaction.deleteMany({ where: { tankId, reversalOfId: { not: null } } })
      await db.fuelTransaction.deleteMany({ where: { tankId } })
      await db.fuelTank.delete({ where: { id: tankId } })
    }
    if (typeId) await db.fuelType.delete({ where: { id: typeId } })
    if (restoreMeter) {
      await db.asset.update({ where: { id: restoreMeter.id }, data: { fuelMeterType: restoreMeter.fuelMeterType } })
    }
    console.log("cleanup done")
  }

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
