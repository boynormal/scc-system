"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { GlassCard, GlassInput } from "@/components/glass"
import { cn } from "@/lib/utils"
import type {
  CostCenterRow,
  ExpenseDto,
  ExpenseTypeOption,
  FinancePerms,
  LineDraft,
  Option,
  ProcessRow,
  UnitOption,
} from "./expense-types"
import { ExpenseLineDialog, computeDiscountBaht, computeLineAmount, computeLineNet, newLineDraft } from "./expense-line-dialog"
import { anyLineRequiresVendor, validateExpenseForm } from "./expense-form-validation"
import { FIN_GLASS_FIELD, FIN_GLASS_PANEL, formatBaht, sourceModuleLabel } from "./finance-theme"

export const NEW_EXPENSE_SOURCES_KEY = "finance:new-expense-sources"

export function clearNewExpenseSourcePrefill() {
  try {
    sessionStorage.removeItem(NEW_EXPENSE_SOURCES_KEY)
  } catch {
    // ignore unavailable storage
  }
}

export type PrefillPayload = {
  branchId?: string
  expenseDate?: string
  paymentMethod?: "cash" | "credit" | null
  lines: LineDraft[]
}

function todayYmdBangkok() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })
}

function itemToDrafts(item: ExpenseDto): LineDraft[] {
  return item.lines.map((l) => ({
    key: l.id,
    expenseTypeId: l.expenseTypeId,
    description: l.description ?? "",
    pricingMode: l.pricingMode,
    quantity: String(l.quantity),
    unitId: l.unitId ?? "",
    unitCode: l.unitCode ?? "",
    unitPrice: String(l.unitPrice),
    amount: String(l.amount),
    taxAmount: l.taxAmount ? String(l.taxAmount) : "",
    discountAmount: l.discountAmount ? String(l.discountAmount) : "",
    discountKind: "BAHT" as const,
    costCenterId: l.costCenterId ?? "",
    processId: l.processId ?? "",
    costObjectType: l.costObjectType ?? "",
    costObjectId: l.costObjectId ?? "",
    costObjectLabel: l.costObjectLabel ?? "",
    sourceKind: l.sourceKind,
    sourceModule: l.sourceModule,
    sourceType: l.sourceType,
    sourceDocumentId: l.sourceDocumentId,
    sourceLineId: l.sourceLineId,
    sourceAmountLocked: l.sourceKind !== "MANUAL" && l.sourceType !== "TRANSPORT_JOB",
  }))
}

export function ExpenseFormPage({
  mode,
  item,
  ignoreSourcePrefill = false,
}: {
  mode: "create" | "edit"
  item?: ExpenseDto
  ignoreSourcePrefill?: boolean
  perms: FinancePerms
}) {
  const router = useRouter()

  const [branches, setBranches] = useState<Option[]>([])
  const [types, setTypes] = useState<ExpenseTypeOption[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterRow[]>([])
  const [processes, setProcesses] = useState<ProcessRow[]>([])
  const [vendors, setVendors] = useState<Option[]>([])
  const [employees, setEmployees] = useState<Option[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])

  const [branchId, setBranchId] = useState(item?.branchId ?? "")
  const [expenseDate, setExpenseDate] = useState(item?.expenseDate ?? todayYmdBangkok())
  const [postingDate, setPostingDate] = useState(item?.postingDate ?? item?.expenseDate ?? todayYmdBangkok())
  const [vendorId, setVendorId] = useState(item?.vendorId ?? "")
  const [employeeId, setEmployeeId] = useState(item?.employeeId ?? "")
  const [paymentMethod, setPaymentMethod] = useState<string>(item?.paymentMethod ?? "")
  const [notes, setNotes] = useState(item?.notes ?? "")
  const [status, setStatus] = useState<string>(item?.status === "PENDING" ? "PENDING" : "DRAFT")

  const [lines, setLines] = useState<LineDraft[]>(item ? itemToDrafts(item) : [])
  const [editingLine, setEditingLine] = useState<LineDraft | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Load option lists; seed branch/lines from a "create from sources" hand-off.
  useEffect(() => {
    void Promise.all([
      fetch("/api/finance/branches", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/expense-types", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/cost-centers", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/processes", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/vendors", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/employees", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/master-data/units", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([b, t, c, p, v, e, u]) => {
        const branchRows = (b.data ?? []) as Option[]
        setBranches(branchRows)
        setTypes((t.data ?? []) as ExpenseTypeOption[])
        setCostCenters((c.data ?? []) as CostCenterRow[])
        setProcesses((p.data ?? []) as ProcessRow[])
        setVendors((v.data ?? []) as Option[])
        setEmployees((e.data ?? []) as Option[])
        const unitRows = (u.data ?? []) as UnitOption[]
        setUnits(unitRows)
        setLines((prev) =>
          prev.map((l) => {
            if (l.unitId || !l.unitCode) return l
            const match = unitRows.find((row) => row.code === l.unitCode)
            return match ? { ...l, unitId: match.id } : l
          })
        )

        if (mode === "create") {
          let seeded = false
          if (ignoreSourcePrefill) {
            clearNewExpenseSourcePrefill()
          } else {
            try {
              const raw = sessionStorage.getItem(NEW_EXPENSE_SOURCES_KEY)
              if (raw) {
                const payload = JSON.parse(raw) as PrefillPayload
                if (payload.lines?.length) {
                  setLines(payload.lines)
                  if (payload.branchId) setBranchId(payload.branchId)
                  if (payload.expenseDate) setExpenseDate(payload.expenseDate)
                  if (payload.paymentMethod) setPaymentMethod(payload.paymentMethod)
                  seeded = true
                }
              }
            } catch {
              // ignore malformed hand-off
            }
          }
          if (!seeded && !branchId && branchRows[0]) setBranchId(branchRows[0].id)
          if (!seeded) {
            const draft = newLineDraft()
            setLines([draft])
            setEditingLine(draft)
            setDialogOpen(true)
          }
        }
      })
      .catch(() => {
        setError("โหลดข้อมูลตัวเลือกไม่สำเร็จ กรุณารีเฟรชหน้า")
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const typeName = useMemo(() => {
    const map = new Map(types.map((t) => [t.id, t.name]))
    return (id: string) => map.get(id) ?? "—"
  }, [types])

  const unitName = useMemo(() => {
    const byId = new Map(units.map((u) => [u.id, u.name]))
    const byCode = new Map(units.map((u) => [u.code, u.name]))
    return (line: LineDraft) => {
      if (line.unitId && byId.has(line.unitId)) return byId.get(line.unitId) as string
      if (line.unitCode) return byCode.get(line.unitCode) ?? line.unitCode
      return "—"
    }
  }, [units])

  const vendorRequired = useMemo(() => anyLineRequiresVendor(lines, types), [lines, types])

  const totals = useMemo(() => {
    let amount = 0
    let tax = 0
    let discount = 0
    let net = 0
    for (const l of lines) {
      amount += computeLineAmount(l)
      tax += Number(l.taxAmount) || 0
      discount += computeDiscountBaht(l)
      net += computeLineNet(l)
    }
    return {
      amount: Math.round(amount * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      net: Math.round(net * 100) / 100,
    }
  }, [lines])

  // Group by source module for display (manual = null bucket).
  const groups = useMemo(() => {
    const map = new Map<string, LineDraft[]>()
    for (const l of lines) {
      const key = l.sourceModule ?? "__manual__"
      const arr = map.get(key) ?? []
      arr.push(l)
      map.set(key, arr)
    }
    return [...map.entries()]
  }, [lines])

  function openAddLine() {
    setEditingLine(newLineDraft())
    setDialogOpen(true)
  }

  function openEditLine(line: LineDraft) {
    setEditingLine(line)
    setDialogOpen(true)
  }

  function saveLine(draft: LineDraft) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.key === draft.key)
      if (idx === -1) return [...prev, draft]
      const next = [...prev]
      next[idx] = draft
      return next
    })
    setDialogOpen(false)
    setEditingLine(null)
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  async function submit(nextStatus?: string) {
    const formError = validateExpenseForm({ branchId, vendorId, lines, types })
    if (formError) {
      setError(formError)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        branchId,
        expenseDate,
        postingDate,
        vendorId: vendorId || null,
        employeeId: employeeId || null,
        paymentMethod: paymentMethod || null,
        notes: notes || null,
        status: nextStatus ?? status,
        lines: lines.map((l) => ({
          expenseTypeId: l.expenseTypeId,
          description: l.description || null,
          pricingMode: l.pricingMode,
          quantity: Number(l.quantity) || (l.pricingMode === "AMOUNT" ? 1 : 0),
          unitId: l.unitId || null,
          unitCode: l.unitCode || null,
          unitPrice: Number(l.unitPrice) || 0,
          amount: computeLineAmount(l),
          taxAmount: Number(l.taxAmount) || 0,
          discountAmount: computeDiscountBaht(l),
          costCenterId: l.costCenterId || null,
          processId: l.processId || null,
          costObjectType: l.costObjectType || null,
          costObjectId: l.costObjectId || null,
          costObjectLabel: l.costObjectLabel || null,
          sourceKind: l.sourceKind,
          sourceModule: l.sourceModule,
          sourceType: l.sourceType,
          sourceDocumentId: l.sourceDocumentId,
          sourceLineId: l.sourceLineId,
        })),
      }

      const url = mode === "edit" && item ? `/api/finance/expenses/${item.id}` : "/api/finance/expenses"
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : json.error?.message ?? "บันทึกไม่สำเร็จ")
        return
      }
      if (mode === "create") clearNewExpenseSourcePrefill()
      const savedId = json.data?.id ?? item?.id
      router.push(savedId ? `/finance/expenses/${savedId}` : "/finance/expenses")
      router.refresh()
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>
          กลับ
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {mode === "edit" ? `แก้ไข ${item?.expenseNo ?? ""}` : "สร้างบิลค่าใช้จ่ายใหม่"}
          </h1>
          {mode === "create" && (
            <p className="text-sm text-muted-foreground">บันทึกจาก Finance ได้โดยตรง ไม่ต้องมีเอกสารจากโมดูลอื่น</p>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <GlassCard className={cn("space-y-4 rounded-[1.5rem] p-5 shadow-none", FIN_GLASS_PANEL)}>
        <h2 className="text-sm font-semibold text-foreground">ข้อมูลหัวบิล</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            label="สาขา"
            required
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className={FIN_GLASS_FIELD}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
          <GlassInput label="วันที่เกิดรายการ" type="date" required value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          <GlassInput label="วันที่ลงบัญชี" type="date" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} />
          <Select
            label="ผู้ขาย / ผู้รับเงิน"
            required={vendorRequired}
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className={FIN_GLASS_FIELD}
            options={[{ value: "", label: vendorRequired ? "— เลือกผู้ขาย —" : "— ไม่ระบุ —" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]}
          />
          <Select
            label="พนักงานที่เกี่ยวข้อง"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className={FIN_GLASS_FIELD}
            options={[{ value: "", label: "— ไม่ระบุ —" }, ...employees.map((emp) => ({ value: emp.id, label: emp.name }))]}
          />
          <Select
            label="วิธีจ่าย"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className={FIN_GLASS_FIELD}
            options={[
              { value: "", label: "— ไม่ระบุ —" },
              { value: "cash", label: "เงินสด" },
              { value: "credit", label: "เครดิต" },
            ]}
          />
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">หมายเหตุ</span>
          <textarea
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </GlassCard>

      <GlassCard className={cn("space-y-3 rounded-[1.5rem] p-5 shadow-none", FIN_GLASS_PANEL)}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            รายการ ({lines.length} บรรทัด)
          </h2>
          <Button type="button" size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={openAddLine}>
            เพิ่มบรรทัด
          </Button>
        </div>

        {lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีบรรทัด กด “เพิ่มบรรทัด” เพื่อเริ่ม</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200/70 text-xs text-muted-foreground dark:border-white/10">
                <tr>
                  <th className="py-2 text-left font-medium">ประเภท / รายละเอียด</th>
                  <th className="py-2 text-right font-medium">จำนวน</th>
                  <th className="py-2 text-left font-medium">หน่วย</th>
                  <th className="py-2 text-right font-medium">ราคา/หน่วย</th>
                  <th className="py-2 text-right font-medium">จำนวนเงิน</th>
                  <th className="py-2 text-right font-medium">สุทธิ</th>
                  <th className="py-2 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([groupKey, groupLines]) => (
                  <Fragment key={`grp-${groupKey}`}>
                    <tr className="bg-slate-100/50 dark:bg-white/5">
                      <td colSpan={7} className="px-1 py-1.5 text-xs font-semibold text-muted-foreground">
                        {groupKey === "__manual__" ? "บันทึกเอง" : sourceModuleLabel(groupKey)}
                      </td>
                    </tr>
                    {groupLines.map((l) => (
                      <tr key={l.key} className="border-b border-slate-100/70 dark:border-white/5">
                        <td className="py-2">
                          <div className="font-medium text-foreground">{typeName(l.expenseTypeId)}</div>
                          {l.description && <div className="text-xs text-muted-foreground">{l.description}</div>}
                          {l.sourceAmountLocked && (
                            <span className="mt-0.5 inline-block rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">
                              ล็อกจากต้นทาง
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums">{l.pricingMode === "QTY_PRICE" ? l.quantity : "—"}</td>
                        <td className="py-2">{unitName(l)}</td>
                        <td className="py-2 text-right tabular-nums">{l.pricingMode === "QTY_PRICE" ? formatBaht(Number(l.unitPrice) || 0) : "—"}</td>
                        <td className="py-2 text-right tabular-nums">{formatBaht(computeLineAmount(l))}</td>
                        <td className="py-2 text-right font-semibold tabular-nums text-foreground">{formatBaht(computeLineNet(l))}</td>
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <button type="button" className="rounded p-1 text-muted-foreground hover:bg-slate-200/60 hover:text-foreground dark:hover:bg-white/10" onClick={() => openEditLine(l)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => removeLine(l.key)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lines.length > 0 && (
          <div className="flex flex-wrap items-end justify-end gap-6 border-t border-slate-200/70 pt-4 dark:border-white/10">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">จำนวนเงิน</div>
              <div className="tabular-nums text-sm font-medium text-foreground">{formatBaht(totals.amount)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">ภาษี</div>
              <div className="tabular-nums text-sm font-medium text-foreground">{formatBaht(totals.tax)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">ส่วนลด</div>
              <div className="tabular-nums text-sm font-medium text-foreground">{formatBaht(totals.discount)}</div>
            </div>
            <div className="min-w-[8rem] rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-2 text-right dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <div className="text-xs font-medium text-emerald-800/80 dark:text-emerald-200/80">สุทธิ</div>
              <div className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatBaht(totals.net)}</div>
            </div>
          </div>
        )}
      </GlassCard>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={cn("min-w-[12rem]", FIN_GLASS_FIELD)}
          options={[
            { value: "DRAFT", label: "บันทึกเป็นร่าง" },
            { value: "PENDING", label: "ส่งขออนุมัติ" },
          ]}
        />
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          ยกเลิก
        </Button>
        <Button type="button" loading={saving} onClick={() => submit()}>
          บันทึก
        </Button>
      </div>
      {error && (
        <p className="text-right text-sm text-red-600">{error}</p>
      )}

      {editingLine && (
        <ExpenseLineDialog
          open={dialogOpen}
          initial={editingLine}
          types={types}
          costCenters={costCenters}
          processes={processes}
          units={units}
          onClose={() => {
            setDialogOpen(false)
            setEditingLine(null)
          }}
          onSave={saveLine}
        />
      )}
    </div>
  )
}
