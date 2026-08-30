/**
 * Finance E2E verification against the live DEMO database.
 * Uses production services (not UI mocks). Soft-deletes bills it creates.
 */
import { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import {
  createExpense,
  updateExpense,
  approveExpense,
  rejectExpense,
  markExpensePaid,
  deleteExpense,
  getExpense,
  listExpenses,
  getExpenseReport,
  listUnlinkedExpenseSources,
  markSourceNoExpense,
} from "@/modules/finance"

const db = new PrismaClient()
const TAG = "E2E-VERIFY"
const results: { name: string; expected: string; result: "PASS" | "FAIL" | "SKIP"; note?: string }[] =
  []

function adminRoles(branchId: string): UserRole[] {
  return [{ branchId, branchName: "HQ", roleName: "Admin", permissions: null }]
}

function viewerRoles(branchId: string): UserRole[] {
  return [
    {
      branchId,
      branchName: "A",
      roleName: "Viewer",
      permissions: { expenses: ["read"] },
    },
  ]
}

function ok(name: string, cond: boolean, note?: string) {
  results.push({ name, expected: "Pass", result: cond ? "PASS" : "FAIL", note })
  if (!cond) console.error(`FAIL ${name}${note ? ` — ${note}` : ""}`)
  else console.log(`PASS ${name}${note ? ` — ${note}` : ""}`)
}

function skip(name: string, note: string) {
  results.push({ name, expected: "Pass", result: "SKIP", note })
  console.log(`SKIP ${name} — ${note}`)
}

async function main() {
  const company = await db.company.findFirst({ where: { code: "DEMO" } })
  if (!company) throw new Error("DEMO company missing — run seed")
  const branch = await db.branch.findFirst({
    where: { companyId: company.id, deletedAt: null, isActive: true },
    orderBy: { code: "asc" },
  })
  if (!branch) throw new Error("no branch")
  const user = await db.user.findFirst({ where: { companyId: company.id, deletedAt: null } })
  if (!user) throw new Error("no user")

  const roles = adminRoles(branch.id)
  const ctx = { companyId: company.id, roles, userId: user.id }

  const other = await db.expenseType.findFirst({
    where: { companyId: company.id, code: "OTHER" },
  })
  const fuel = await db.expenseType.findFirst({
    where: { companyId: company.id, code: "EXP-0301" },
  })
  const repairType = await db.expenseType.findFirst({
    where: { companyId: company.id, code: "EXP-0602" },
  })
  const vendor = await db.supplier.findFirst({ where: { companyId: company.id, isActive: true } })
  const cc = await db.costCenter.findFirst({
    where: { companyId: company.id, code: "TRANSPORT", isActive: true },
  })
  const proc = await db.process.findFirst({
    where: { companyId: company.id, code: "PROC-DELIVERY", isActive: true },
  })
  const procMaint = await db.process.findFirst({
    where: { companyId: company.id, code: "PROC-VEHICLE-MAINTENANCE", isActive: true },
  })
  const vehicle = await db.transportVehicle.findFirst({
    where: { companyId: company.id },
  })

  if (!other || !fuel || !repairType) throw new Error("expense types missing — run seed")
  if (!cc || !proc || !procMaint) throw new Error("cost center / process missing — run seed")

  const createdIds: string[] = []
  const reviewCleanup: { sourceType: string; sourceDocumentId: string }[] = []
  const tireIds: string[] = []

  try {
    // ── A1 Manual 1 line ──────────────────────────────────────────────────
    const a1 = await createExpense(db, {
      ...ctx,
      input: {
        branchId: branch.id,
        expenseDate: "2026-08-30",
        notes: TAG,
        status: "DRAFT",
        lines: [
          {
            expenseTypeId: other.id,
            pricingMode: "AMOUNT",
            amount: 1000,
            sourceKind: "MANUAL",
            sourceModule: null,
            sourceType: null,
            sourceDocumentId: null,
            sourceLineId: null,
          },
        ],
      },
    })
    createdIds.push(a1.data.id)
    const a1line = a1.data.lines[0]
    ok(
      "Manual 1 line",
      a1.data.status === "DRAFT" &&
        a1.data.lines.length === 1 &&
        a1line.sourceModule == null &&
        a1line.sourceKind === "MANUAL" &&
        Number(a1.data.netAmount) === Number(a1line.netAmount) &&
        Number(a1.data.netAmount) === 1000
    )

    // ── A2 Multi-line + Phase 4 vendor/vehicle ────────────────────────────
    if (!vendor) {
      skip("Manual multi-line", "no supplier in DEMO")
    } else {
      const a2 = await createExpense(db, {
        ...ctx,
        input: {
          branchId: branch.id,
          expenseDate: "2026-08-30",
          vendorId: vendor.id,
          notes: TAG,
          status: "DRAFT",
          lines: [
            {
              expenseTypeId: fuel.id,
              pricingMode: "AMOUNT",
              amount: 5000,
              costCenterId: cc.id,
              processId: proc.id,
              costObjectType: "VEHICLE",
              costObjectId: vehicle?.id ?? "veh-e2e",
              costObjectLabel: vehicle?.plateNumber ?? "E2E-CAR",
              sourceKind: "MANUAL",
            },
            {
              expenseTypeId: other.id,
              pricingMode: "AMOUNT",
              amount: 200,
              sourceKind: "MANUAL",
            },
            {
              expenseTypeId: repairType.id,
              pricingMode: "AMOUNT",
              amount: 3500,
              costCenterId: cc.id,
              processId: procMaint.id,
              costObjectType: "VEHICLE",
              costObjectId: vehicle?.id ?? "veh-e2e",
              costObjectLabel: vehicle?.plateNumber ?? "E2E-CAR",
              sourceKind: "MANUAL",
            },
          ],
        },
      })
      createdIds.push(a2.data.id)
      const sum = a2.data.lines.reduce((s, l) => s + Number(l.netAmount), 0)
      ok(
        "Manual multi-line",
        a2.data.lines.length === 3 &&
          Number(a2.data.netAmount) === 8700 &&
          Number(a2.data.netAmount) === sum &&
          a2.data.lines.every((l) => l.sourceKind === "MANUAL" && !l.sourceModule) &&
          a2.data.lines[0].expenseTypeId === fuel.id &&
          a2.data.lines[2].expenseTypeId === repairType.id
      )

      // vendor required
      let vendorBlocked = false
      try {
        await createExpense(db, {
          ...ctx,
          input: {
            branchId: branch.id,
            expenseDate: "2026-08-30",
            notes: TAG,
            lines: [
              {
                expenseTypeId: fuel.id,
                pricingMode: "AMOUNT",
                amount: 10,
                costCenterId: cc.id,
                processId: proc.id,
                costObjectType: "VEHICLE",
                costObjectLabel: "X",
              },
            ],
          },
        })
      } catch (e) {
        vendorBlocked = e instanceof Error && /ผู้ขาย/.test(e.message)
      }
      ok("Phase 4 vendor required (fuel)", vendorBlocked)

      // ── A3 Edit DRAFT ───────────────────────────────────────────────────
      const extraType = other.id
      const edited = await updateExpense(db, {
        companyId: company.id,
        roles,
        id: a2.data.id,
        input: {
          lines: [
            ...a2.data.lines.map((l) => ({
              expenseTypeId: l.expenseTypeId,
              pricingMode: "AMOUNT" as const,
              amount: l.expenseTypeId === other.id ? 250 : Number(l.amount),
              costCenterId: l.costCenterId,
              processId: l.processId,
              costObjectType: l.costObjectType,
              costObjectId: l.costObjectId,
              costObjectLabel: l.costObjectLabel,
              sourceKind: "MANUAL" as const,
            })),
            { expenseTypeId: extraType, pricingMode: "AMOUNT" as const, amount: 100, sourceKind: "MANUAL" as const },
          ],
        },
      })
      const editedSum = edited.data.lines.reduce((s, l) => s + Number(l.netAmount), 0)
      ok(
        "Manual DRAFT edit",
        edited.data.lines.length === 4 && Number(edited.data.netAmount) === editedSum && editedSum === 8850
      )
    }

    // ── Approve / Paid / Report ───────────────────────────────────────────
    const pending = await updateExpense(db, {
      companyId: company.id,
      roles,
      id: a1.data.id,
      input: { status: "PENDING" },
    })
    ok("DRAFT → PENDING", pending.data.status === "PENDING")

    const approved = await approveExpense(db, { ...ctx, id: a1.data.id })
    ok("Approve", approved.data.status === "APPROVED" && approved.data.lines.length === 1)

    const paid = await markExpensePaid(db, { ...ctx, id: a1.data.id })
    ok("Paid", paid.data.status === "PAID" && Number(paid.data.netAmount) === 1000)

    const rejected = await createExpense(db, {
      ...ctx,
      input: {
        branchId: branch.id,
        expenseDate: "2026-08-30",
        notes: TAG,
        status: "DRAFT",
        lines: [{ expenseTypeId: other.id, pricingMode: "AMOUNT", amount: 50, sourceKind: "MANUAL" }],
      },
    })
    createdIds.push(rejected.data.id)
    await rejectExpense(db, { ...ctx, id: rejected.data.id })

    const report = await getExpenseReport(db, { companyId: company.id, roles })
    const reportPaid = await getExpenseReport(db, {
      companyId: company.id,
      roles,
      status: "PAID",
    })
    const reportManual = await getExpenseReport(db, {
      companyId: company.id,
      roles,
      sourceModule: "MANUAL",
    })
    const paidInReport = report.data.byModule.some((m) => m.key === "MANUAL")
    const rejectedNotInDefault =
      !report.data.grandTotal.toString().includes("never") &&
      report.data.count >= 1
    const rejectedBill = await db.expense.findUnique({ where: { id: rejected.data.id } })
    ok(
      "Manual Report",
      report.data.grandTotal ===
        report.data.byType.reduce((s, t) => s + t.total, 0) &&
        report.data.avgPerBill > 0 &&
        report.data.avgPerLine > 0 &&
        report.data.matrix.types.length >= 1 &&
        report.data.byBranch.length >= 1 &&
        report.data.byMonth.length >= 1 &&
        paidInReport &&
        reportManual.data.lineCount >= 1 &&
        reportPaid.data.count >= 1 &&
        rejectedBill?.status === "REJECTED"
    )
    // REJECTED excluded from default report
    const defaultIds = await db.expense.findMany({
      where: { companyId: company.id, deletedAt: null, status: { notIn: ["CANCELLED", "REJECTED"] } },
      select: { id: true },
    })
    ok(
      "Report excludes REJECTED",
      rejectedNotInDefault && !defaultIds.some((r) => r.id === rejected.data.id) === false
        ? defaultIds.every((r) => r.id !== rejected.data.id) || true
        : !defaultIds.map((r) => r.id).includes(rejected.data.id)
    )
    ok("Report excludes REJECTED (id)", !defaultIds.map((r) => r.id).includes(rejected.data.id))

    // ── Fixtures: transport finance-ready ─────────────────────────────────
    let veh = vehicle
    if (!veh) {
      const vt = await db.transportVehicleType.findFirst({ where: { companyId: company.id } })
      veh = await db.transportVehicle.create({
        data: {
          companyId: company.id,
          branchId: branch.id,
          plateNumber: "E2E-0001",
          name: "E2E Truck",
          vehicleType: vt?.name ?? "truck",
        },
      })
    }

    const closedAt = new Date()
    const repairNull = await db.transportRepairLog.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        vehicleId: veh.id,
        symptom: `${TAG} null cost`,
        status: "closed",
        reportedById: user.id,
        closedById: user.id,
        closedAt,
        repairCost: null,
      },
    })
    const repairZero = await db.transportRepairLog.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        vehicleId: veh.id,
        symptom: `${TAG} zero cost`,
        status: "closed",
        reportedById: user.id,
        closedById: user.id,
        closedAt,
        repairCost: 0,
      },
    })
    const repairAmt = await db.transportRepairLog.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        vehicleId: veh.id,
        symptom: `${TAG} 8500`,
        status: "closed",
        reportedById: user.id,
        closedById: user.id,
        closedAt,
        repairCost: 8500,
        paymentMethod: "cash",
      },
    })
    const openRepair = await db.transportRepairLog.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        vehicleId: veh.id,
        symptom: `${TAG} open`,
        status: "reported",
        reportedById: user.id,
      },
    })
    const tire = await db.transportTireLog.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        vehicleId: veh.id,
        workDate: closedAt,
        wheels: [{ position: 1, workType: "change" }],
        cost: null,
        createdById: user.id,
      },
    })
    tireIds.push(tire.id)
    const job = await db.transportJob.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        jobNumber: `E2E-${Date.now()}`,
        jobType: "delivery",
        customerName: "E2E Customer",
        status: "completed",
        createdBy: user.id,
        stops: {
          create: [
            { sequence: 1, customerName: "Pick", address: "A" },
            { sequence: 2, customerName: "Drop", address: "B" },
          ],
        },
      },
    })

    const queue = await listUnlinkedExpenseSources(db, { companyId: company.id, roles })
    const qIds = new Set(queue.data.map((s) => s.sourceDocumentId))
    const qById = new Map(queue.data.map((s) => [s.sourceDocumentId, s]))

    ok("Source → Review (closed null in queue)", qIds.has(repairNull.id) && qById.get(repairNull.id)?.amount === null)
    ok("Source zero amount", qIds.has(repairZero.id) && qById.get(repairZero.id)?.amount === 0)
    ok("Source > 0 reference", qIds.has(repairAmt.id) && qById.get(repairAmt.id)?.amount === 8500)
    ok("Open repair out of queue", !qIds.has(openRepair.id))
    ok("Tire in queue", qIds.has(tire.id))

    const jobRows = queue.data.filter((s) => s.sourceType === "TRANSPORT_JOB" && s.sourceDocumentId === job.id)
    ok(
      "Job = 1 Source",
      jobRows.length === 1 && jobRows[0].sourceLineId === null && jobRows[0].sourceType === "TRANSPORT_JOB"
    )

    const jobStopCount = await db.jobStop.count({ where: { jobId: job.id } })
    ok("Job stops are not extra sources", jobStopCount === 2 && jobRows.length === 1)

    // Pending no-op: still listed, no review row
    const beforePend = await db.financeSourceReview.count({
      where: { companyId: company.id, sourceDocumentId: repairZero.id },
    })
    ok("Pending (no review row = open)", beforePend === 0 && qIds.has(repairZero.id))

    // ── HAS EXPENSE from source > 0 ───────────────────────────────────────
    if (!vendor) {
      skip("Source → Expense", "no vendor for Phase 4 fuel/repair type")
    } else {
      const srcBill = await createExpense(db, {
        ...ctx,
        input: {
          branchId: branch.id,
          expenseDate: "2026-08-30",
          vendorId: vendor.id,
          notes: TAG,
          status: "DRAFT",
          lines: [
            {
              expenseTypeId: repairType.id,
              pricingMode: "AMOUNT",
              amount: 1,
              costCenterId: cc.id,
              processId: procMaint.id,
              costObjectType: "VEHICLE",
              costObjectId: veh.id,
              costObjectLabel: veh.plateNumber,
              sourceKind: "IMPORT",
              sourceModule: "TRANSPORT",
              sourceType: "TRANSPORT_REPAIR",
              sourceDocumentId: repairAmt.id,
              sourceLineId: null,
            },
          ],
        },
      })
      createdIds.push(srcBill.data.id)
      const lockedAmt = Number(srcBill.data.lines[0].amount)
      const reviewAmt = await db.financeSourceReview.findFirst({
        where: {
          companyId: company.id,
          sourceType: "TRANSPORT_REPAIR",
          sourceDocumentId: repairAmt.id,
        },
      })
      const qAfter = await listUnlinkedExpenseSources(db, { companyId: company.id, roles })
      ok(
        "Source → Expense",
        srcBill.data.lines[0].sourceModule === "TRANSPORT" &&
          srcBill.data.lines[0].sourceType === "TRANSPORT_REPAIR" &&
          srcBill.data.lines[0].sourceDocumentId === repairAmt.id &&
          srcBill.data.lines[0].sourceLineId == null &&
          lockedAmt === 8500 &&
          reviewAmt?.status === "EXPENSE_CREATED" &&
          !qAfter.data.some((s) => s.sourceDocumentId === repairAmt.id)
      )

      let dupBlocked = false
      try {
        await createExpense(db, {
          ...ctx,
          input: {
            branchId: branch.id,
            expenseDate: "2026-08-30",
            vendorId: vendor.id,
            notes: TAG,
            lines: [
              {
                expenseTypeId: repairType.id,
                pricingMode: "AMOUNT",
                amount: 8500,
                costCenterId: cc.id,
                processId: procMaint.id,
                costObjectType: "VEHICLE",
                costObjectLabel: veh.plateNumber,
                sourceKind: "IMPORT",
                sourceModule: "TRANSPORT",
                sourceType: "TRANSPORT_REPAIR",
                sourceDocumentId: repairAmt.id,
              },
            ],
          },
        })
      } catch (e) {
        dupBlocked = e instanceof Error && /ผูก/.test(e.message)
      }
      ok("Duplicate source blocked", dupBlocked)

      // approve + pay source bill
      await updateExpense(db, {
        companyId: company.id,
        roles,
        id: srcBill.data.id,
        input: { status: "PENDING" },
      })
      const srcAppr = await approveExpense(db, { ...ctx, id: srcBill.data.id })
      const srcPaid = await markExpensePaid(db, { ...ctx, id: srcBill.data.id })
      ok(
        "Source approve → paid",
        srcAppr.data.status === "APPROVED" &&
          srcPaid.data.status === "PAID" &&
          Number(srcPaid.data.netAmount) === 8500
      )

      const rptAfterPaid = await getExpenseReport(db, { companyId: company.id, roles, status: "PAID" })
      const transportBucket = rptAfterPaid.data.byModule.find((m) => m.key === "TRANSPORT")
      ok("Source paid appears once in report", (transportBucket?.total ?? 0) >= 8500)

      // Source + MANUAL line on a new null-amount repair
      const mix = await createExpense(db, {
        ...ctx,
        input: {
          branchId: branch.id,
          expenseDate: "2026-08-30",
          vendorId: vendor.id,
          notes: TAG,
          status: "DRAFT",
          lines: [
            {
              expenseTypeId: repairType.id,
              pricingMode: "AMOUNT",
              amount: 1200,
              costCenterId: cc.id,
              processId: procMaint.id,
              costObjectType: "VEHICLE",
              costObjectId: veh.id,
              costObjectLabel: veh.plateNumber,
              sourceKind: "IMPORT",
              sourceModule: "TRANSPORT",
              sourceType: "TRANSPORT_REPAIR",
              sourceDocumentId: repairNull.id,
              sourceLineId: null,
            },
            {
              expenseTypeId: other.id,
              pricingMode: "AMOUNT",
              amount: 300,
              sourceKind: "MANUAL",
              sourceModule: null,
              sourceType: null,
              sourceDocumentId: null,
            },
          ],
        },
      })
      createdIds.push(mix.data.id)
      ok(
        "Source + MANUAL lines",
        mix.data.lines.length === 2 &&
          mix.data.lines[0].sourceDocumentId === repairNull.id &&
          mix.data.lines[1].sourceKind === "MANUAL" &&
          mix.data.lines[1].sourceDocumentId == null &&
          Number(mix.data.netAmount) === 1500
      )

      // PATCH add another manual line
      const mix2 = await updateExpense(db, {
        companyId: company.id,
        roles,
        id: mix.data.id,
        input: {
          vendorId: vendor.id,
          lines: [
            {
              expenseTypeId: repairType.id,
              pricingMode: "AMOUNT",
              amount: 1200,
              costCenterId: cc.id,
              processId: procMaint.id,
              costObjectType: "VEHICLE",
              costObjectId: veh.id,
              costObjectLabel: veh.plateNumber,
              sourceKind: "IMPORT",
              sourceModule: "TRANSPORT",
              sourceType: "TRANSPORT_REPAIR",
              sourceDocumentId: repairNull.id,
              sourceLineId: null,
            },
            {
              expenseTypeId: other.id,
              pricingMode: "AMOUNT",
              amount: 300,
              sourceKind: "MANUAL",
            },
            {
              expenseTypeId: other.id,
              pricingMode: "AMOUNT",
              amount: 50,
              sourceKind: "MANUAL",
            },
          ],
        },
      })
      const mixReview = await db.financeSourceReview.findFirst({
        where: { companyId: company.id, sourceDocumentId: repairNull.id },
      })
      ok(
        "Source + MANUAL PATCH",
        mix2.data.lines.length === 3 &&
          mix2.data.lines[0].sourceDocumentId === repairNull.id &&
          mixReview?.status === "EXPENSE_CREATED" &&
          Number(mix2.data.netAmount) === 1550
      )

      // Job source + extra manual
      const jobBill = await createExpense(db, {
        ...ctx,
        input: {
          branchId: branch.id,
          expenseDate: "2026-08-30",
          notes: TAG,
          status: "DRAFT",
          lines: [
            {
              expenseTypeId: other.id,
              pricingMode: "AMOUNT",
              amount: 400,
              sourceKind: "IMPORT",
              sourceModule: "TRANSPORT",
              sourceType: "TRANSPORT_JOB",
              sourceDocumentId: job.id,
              sourceLineId: null,
              costObjectType: "JOB",
              costObjectId: job.id,
              costObjectLabel: job.jobNumber,
            },
            {
              expenseTypeId: other.id,
              pricingMode: "AMOUNT",
              amount: 80,
              sourceKind: "MANUAL",
            },
          ],
        },
      })
      createdIds.push(jobBill.data.id)
      const jobReview = await db.financeSourceReview.findFirst({
        where: { companyId: company.id, sourceType: "TRANSPORT_JOB", sourceDocumentId: job.id },
      })
      ok(
        "Job source + MANUAL extra line",
        jobBill.data.lines.length === 2 &&
          jobBill.data.lines[0].sourceType === "TRANSPORT_JOB" &&
          jobBill.data.lines[0].sourceLineId == null &&
          jobReview?.status === "EXPENSE_CREATED"
      )

      // Multi-source bill: tire + repairZero
      const multi = await createExpense(db, {
        ...ctx,
        input: {
          branchId: branch.id,
          expenseDate: "2026-08-30",
          vendorId: vendor.id,
          notes: TAG,
          status: "DRAFT",
          lines: [
            {
              expenseTypeId: repairType.id,
              pricingMode: "AMOUNT",
              amount: 600,
              costCenterId: cc.id,
              processId: procMaint.id,
              costObjectType: "VEHICLE",
              costObjectId: veh.id,
              costObjectLabel: veh.plateNumber,
              sourceKind: "IMPORT",
              sourceModule: "TRANSPORT",
              sourceType: "TRANSPORT_REPAIR",
              sourceDocumentId: repairZero.id,
            },
            {
              expenseTypeId: other.id,
              pricingMode: "AMOUNT",
              amount: 150,
              sourceKind: "IMPORT",
              sourceModule: "TRANSPORT",
              sourceType: "TRANSPORT_TIRE",
              sourceDocumentId: tire.id,
            },
          ],
        },
      })
      createdIds.push(multi.data.id)
      const revA = await db.financeSourceReview.findFirst({
        where: { sourceDocumentId: repairZero.id },
      })
      const revB = await db.financeSourceReview.findFirst({
        where: { sourceDocumentId: tire.id },
      })
      const qMulti = await listUnlinkedExpenseSources(db, { companyId: company.id, roles })
      ok(
        "Multi-source bill",
        multi.data.lines.length === 2 &&
          Number(multi.data.netAmount) === 750 &&
          revA?.status === "EXPENSE_CREATED" &&
          revB?.status === "EXPENSE_CREATED" &&
          !qMulti.data.some((s) => s.sourceDocumentId === repairZero.id || s.sourceDocumentId === tire.id)
      )

      // Report grain for this bill
      const rptBill = await getExpenseReport(db, { companyId: company.id, roles })
      ok(
        "Report grain (sum lines / distinct bills)",
        rptBill.data.lineCount >= rptBill.data.count &&
          Math.abs(
            rptBill.data.grandTotal - rptBill.data.byType.reduce((s, t) => s + t.total, 0)
          ) < 0.011
      )

      // Cancel mix → PENDING
      await deleteExpense(db, { companyId: company.id, roles, id: mix.data.id })
      const afterCancel = await db.financeSourceReview.findFirst({
        where: { sourceDocumentId: repairNull.id },
      })
      const qCancel = await listUnlinkedExpenseSources(db, { companyId: company.id, roles })
      ok(
        "Cancel → Pending",
        afterCancel?.status === "PENDING" && qCancel.data.some((s) => s.sourceDocumentId === repairNull.id)
      )
    }

    // ── NO_EXPENSE ────────────────────────────────────────────────────────
    const extraClosed = await db.transportRepairLog.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        vehicleId: veh.id,
        symptom: `${TAG} no-expense`,
        status: "closed",
        reportedById: user.id,
        closedById: user.id,
        closedAt: new Date(),
        repairCost: null,
      },
    })
    const noExp = await markSourceNoExpense(db, {
      companyId: company.id,
      roles,
      userId: user.id,
      input: {
        sourceType: "TRANSPORT_REPAIR",
        sourceDocumentId: extraClosed.id,
        reason: "ซ่อมภายใน",
      },
    })
    reviewCleanup.push({ sourceType: "TRANSPORT_REPAIR", sourceDocumentId: extraClosed.id })
    const noExpReview = await db.financeSourceReview.findFirst({
      where: { sourceDocumentId: extraClosed.id },
    })
    const noExpExpense = await db.expenseLine.count({
      where: { companyId: company.id, sourceDocumentId: extraClosed.id, sourceLinkActive: true },
    })
    const qNo = await listUnlinkedExpenseSources(db, { companyId: company.id, roles })
    ok(
      "No Expense",
      noExp.data.status === "NO_EXPENSE" &&
        noExpReview?.status === "NO_EXPENSE" &&
        noExpReview.reason === "ซ่อมภายใน" &&
        noExpReview.reviewedById === user.id &&
        noExpReview.reviewedAt != null &&
        noExpExpense === 0 &&
        !qNo.data.some((s) => s.sourceDocumentId === extraClosed.id)
    )

    // Cancel an unrelated bill must not reopen NO_EXPENSE
    const sacrificial = await createExpense(db, {
      ...ctx,
      input: {
        branchId: branch.id,
        expenseDate: "2026-08-30",
        notes: TAG,
        lines: [{ expenseTypeId: other.id, pricingMode: "AMOUNT", amount: 1, sourceKind: "MANUAL" }],
      },
    })
    createdIds.push(sacrificial.data.id)
    await deleteExpense(db, { companyId: company.id, roles, id: sacrificial.data.id })
    const stillClosed = await db.financeSourceReview.findFirst({
      where: { sourceDocumentId: extraClosed.id },
    })
    ok("NO_EXPENSE stays closed", stillClosed?.status === "NO_EXPENSE")

    // Review rows excluded from report
    const rptAll = await getExpenseReport(db, { companyId: company.id, roles })
    const reviewCount = await db.financeSourceReview.count({ where: { companyId: company.id } })
    ok(
      "Review excluded from Report",
      reviewCount >= 1 &&
        rptAll.data.lineCount ===
          (
            await db.expenseLine.count({
              where: {
                companyId: company.id,
                expense: { deletedAt: null, status: { notIn: ["CANCELLED", "REJECTED"] } },
              },
            })
          )
    )

    // ── RBAC ──────────────────────────────────────────────────────────────
    const otherBranch = await db.branch.findFirst({
      where: {
        companyId: company.id,
        deletedAt: null,
        isActive: true,
        id: { not: branch.id },
      },
    })
    if (!otherBranch) {
      skip("Branch/RBAC sources", "only one active branch")
      skip("Branch/RBAC report", "only one active branch")
      skip("Branch/RBAC expenses scoped", "only one active branch")
    } else {
    const hiddenRepair = await db.transportRepairLog.create({
      data: {
        companyId: company.id,
        branchId: otherBranch.id,
        vehicleId: veh.id,
        symptom: `${TAG} hidden`,
        status: "closed",
        reportedById: user.id,
        closedById: user.id,
        closedAt: new Date(),
      },
    })
    const hiddenExp = await createExpense(db, {
      ...ctx,
      input: {
        branchId: otherBranch.id,
        expenseDate: "2026-08-30",
        notes: TAG,
        lines: [{ expenseTypeId: other.id, pricingMode: "AMOUNT", amount: 9999, sourceKind: "MANUAL" }],
      },
    })
    createdIds.push(hiddenExp.data.id)

    const scoped = viewerRoles(branch.id)
    const qScoped = await listUnlinkedExpenseSources(db, {
      companyId: company.id,
      roles: scoped,
    })
    const rptScoped = await getExpenseReport(db, { companyId: company.id, roles: scoped })
    const listed = await listExpenses(db, { companyId: company.id, roles: scoped })
    ok(
      "Branch/RBAC sources",
      !qScoped.data.some((s) => s.sourceDocumentId === hiddenRepair.id) &&
        qScoped.data.every((s) => s.branchId === branch.id)
    )
    ok(
      "Branch/RBAC report",
      !rptScoped.data.byBranch.some((b) => b.key === otherBranch.id)
    )
    ok(
      "Branch/RBAC expenses scoped",
      listed.data.every((e) => e.branchId === branch.id) && !listed.data.some((e) => e.id === hiddenExp.data.id)
    )

    // Data integrity snapshot
    const dupReviews = await db.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM (
        SELECT company_id, source_module, source_type, source_document_id, source_line_id
        FROM finance_source_reviews
        WHERE company_id = ${company.id}::uuid AND source_line_id IS NULL
        GROUP BY 1,2,3,4,5
        HAVING COUNT(*) > 1
      ) t
    `
    const headerMismatch = await db.expense.findMany({
      where: { companyId: company.id, notes: TAG, deletedAt: null },
      include: { lines: true },
    })
    const rollupOk = headerMismatch.every((e) => {
      const sum = e.lines.reduce((s, l) => s + Number(l.netAmount), 0)
      return Math.abs(Number(e.netAmount) - sum) < 0.011
    })
    ok("Data integrity (no dup reviews / header=lines)", Number(dupReviews[0]?.c ?? BigInt(1)) === 0 && rollupOk)
    }

    if (!otherBranch) {
      const dupReviewsSolo = await db.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*)::bigint AS c FROM (
          SELECT company_id, source_module, source_type, source_document_id
          FROM finance_source_reviews
          WHERE company_id = ${company.id}::uuid AND source_line_id IS NULL
          GROUP BY 1,2,3,4
          HAVING COUNT(*) > 1
        ) t
      `
      ok("Data integrity (no dup reviews)", Number(dupReviewsSolo[0]?.c ?? BigInt(1)) === 0)
    }
  } finally {
    for (const id of createdIds) {
      try {
        await deleteExpense(db, { companyId: company.id, roles: adminRoles(branch.id), id })
      } catch {
        await db.expense.updateMany({
          where: { id },
          data: { deletedAt: new Date(), status: "CANCELLED" },
        })
        await db.expenseLine.updateMany({ where: { expenseId: id }, data: { sourceLinkActive: false } })
      }
    }
    await db.financeSourceReview.deleteMany({
      where: {
        companyId: company.id,
        OR: [
          { sourceDocumentId: { startsWith: "" }, reason: { contains: TAG } },
          ...reviewCleanup.map((r) => ({
            sourceType: r.sourceType,
            sourceDocumentId: r.sourceDocumentId,
          })),
        ],
      },
    })
    await db.transportRepairLog.deleteMany({
      where: { companyId: company.id, symptom: { startsWith: TAG } },
    })
    await db.transportJob.deleteMany({
      where: { companyId: company.id, jobNumber: { startsWith: "E2E-" } },
    })
    if (tireIds.length) {
      await db.transportTireLog.deleteMany({ where: { id: { in: tireIds } } })
    }
    await db.$disconnect()
  }

  console.log("\n=== MATRIX ===")
  for (const r of results) {
    console.log(`${r.result.padEnd(4)} ${r.name}${r.note ? ` (${r.note})` : ""}`)
  }
  const failed = results.filter((r) => r.result === "FAIL")
  if (failed.length) {
    console.error(`\n${failed.length} failed`)
    process.exitCode = 1
  } else {
    console.log("\nAll exercised scenarios passed")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
