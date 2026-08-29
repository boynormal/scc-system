"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Link2, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, formatDate } from "@/lib/utils"
import {
  GlassCard,
  GlassTable,
  GlassTableBody,
  GlassTableCell,
  GlassTableHead,
  GlassTableHeader,
  GlassTableRow,
} from "@/components/glass"
import { FinancePageHeader } from "./finance-page-header"
import { NEW_EXPENSE_SOURCES_KEY, type PrefillPayload } from "./expense-form-page"
import type { ExpenseSourceRow, FinancePerms, LineDraft } from "./expense-types"
import { FIN_GLASS_PANEL, formatBaht } from "./finance-theme"

const SOURCE_TYPE_LABELS: Record<string, string> = {
  TRANSPORT_REPAIR: "ค่าซ่อม (ขนส่ง)",
  TRANSPORT_TIRE: "ค่ายาง (ขนส่ง)",
}

function rowKey(row: ExpenseSourceRow) {
  return `${row.sourceType}-${row.sourceId}`
}

function sourceToLine(row: ExpenseSourceRow): LineDraft {
  return {
    key: rowKey(row),
    expenseTypeId: "",
    description: row.description,
    pricingMode: "AMOUNT",
    quantity: "1",
    unitId: "",
    unitCode: "",
    unitPrice: String(row.amount),
    amount: String(row.amount),
    taxAmount: "",
    discountAmount: "",
    discountKind: "BAHT",
    costCenterId: "",
    processId: "",
    costObjectType: row.suggestedCostObjectType,
    costObjectId: row.vehicleId,
    costObjectLabel: row.vehicleLabel,
    sourceKind: row.sourceKind,
    sourceModule: row.sourceModule,
    sourceType: row.sourceType,
    sourceDocumentId: row.sourceDocumentId,
    sourceLineId: row.sourceLineId,
  }
}

export function ExpenseSourcesView({ perms }: { perms: FinancePerms }) {
  const router = useRouter()
  const [rows, setRows] = useState<ExpenseSourceRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/finance/expenses/sources")
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError("โหลดข้อมูลไม่สำเร็จ")
      setRows([])
      return
    }
    setError(null)
    setRows((json.data ?? []) as ExpenseSourceRow[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(rowKey(r))), [rows, selected])
  const selectedBranch = selectedRows[0]?.branchId ?? null

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; rows: ExpenseSourceRow[] }>()
    for (const r of rows) {
      const g = map.get(r.groupKey) ?? { label: r.groupLabel, rows: [] }
      g.rows.push(r)
      map.set(r.groupKey, g)
    }
    return [...map.entries()]
  }, [rows])

  function toggle(row: ExpenseSourceRow) {
    const key = rowKey(row)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function createBillFrom(sourceRows: ExpenseSourceRow[]) {
    if (sourceRows.length === 0) return
    const branchId = sourceRows[0].branchId
    const payload: PrefillPayload = {
      branchId,
      expenseDate: sourceRows[0].date.slice(0, 10),
      paymentMethod: sourceRows[0].paymentMethod,
      lines: sourceRows.map(sourceToLine),
    }
    try {
      sessionStorage.setItem(NEW_EXPENSE_SOURCES_KEY, JSON.stringify(payload))
    } catch {
      // ignore
    }
    router.push("/finance/expenses/new")
  }

  const differentBranch = selectedRows.length > 1 && selectedRows.some((r) => r.branchId !== selectedBranch)

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="ผูกจากเอกสารต้นทาง"
        description="ต้นทุนจากโมดูลขนส่ง (ค่าซ่อม/ค่ายาง) ที่ยังไม่ถูกบันทึกเป็นค่าใช้จ่าย"
        actions={
          <Button
            type="button"
            icon={<Link2 className="h-4 w-4" />}
            className="rounded-xl bg-emerald-600 shadow-md shadow-emerald-600/20 hover:bg-emerald-700"
            disabled={!perms.canCreate || selectedRows.length === 0 || differentBranch}
            onClick={() => createBillFrom(selectedRows)}
          >
            สร้างบิลจากที่เลือก ({selectedRows.length})
          </Button>
        }
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {differentBranch && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          เลือกได้เฉพาะต้นทางในสาขาเดียวกันต่อ 1 บิล
        </p>
      )}

      {!loading && rows.length === 0 && !error ? (
        <GlassCard className={cn("flex flex-col items-center justify-center py-12 text-center", FIN_GLASS_PANEL)}>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-700 backdrop-blur-sm dark:bg-emerald-400/15 dark:text-emerald-200">
            <Truck className="h-7 w-7" />
          </span>
          <p className="mt-4 text-sm font-medium text-foreground">ไม่มีต้นทางที่ค้างผูก</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">ต้นทุนขนส่งทั้งหมดถูกบันทึกเป็นค่าใช้จ่ายแล้ว</p>
        </GlassCard>
      ) : (
        groups.map(([groupKey, group]) => (
          <div key={groupKey} className="space-y-2">
            <h2 className="px-1 text-sm font-semibold text-foreground">{group.label}</h2>
            <GlassTable className={cn("rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL)}>
              <GlassTableHeader className="border-slate-200/80 bg-white/70 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <GlassTableHead className="w-[4%]"> </GlassTableHead>
                  <GlassTableHead className="w-[16%] whitespace-nowrap">ประเภทต้นทาง</GlassTableHead>
                  <GlassTableHead className="w-[12%] whitespace-nowrap">วันที่</GlassTableHead>
                  <GlassTableHead className="w-[12%] whitespace-nowrap">รถ</GlassTableHead>
                  <GlassTableHead className="w-[28%]">รายละเอียด</GlassTableHead>
                  <GlassTableHead className="w-[14%] whitespace-nowrap text-right">จำนวนเงิน</GlassTableHead>
                  <GlassTableHead className="w-[14%] whitespace-nowrap text-right">การกระทำ</GlassTableHead>
                </tr>
              </GlassTableHeader>
              <GlassTableBody>
                {group.rows.map((row) => {
                  const key = rowKey(row)
                  const isSelected = selected.has(key)
                  const disabled =
                    !perms.canCreate ||
                    (!isSelected && selectedBranch !== null && row.branchId !== selectedBranch)
                  return (
                    <GlassTableRow key={key} className="bg-white/50 dark:bg-transparent">
                      <GlassTableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={isSelected}
                          disabled={disabled}
                          onChange={() => toggle(row)}
                        />
                      </GlassTableCell>
                      <GlassTableCell className="whitespace-nowrap font-medium text-foreground">
                        {SOURCE_TYPE_LABELS[row.sourceType] ?? row.sourceType}
                      </GlassTableCell>
                      <GlassTableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {formatDate(row.date)}
                      </GlassTableCell>
                      <GlassTableCell className="whitespace-nowrap">{row.vehicleLabel}</GlassTableCell>
                      <GlassTableCell className="text-muted-foreground">
                        <span className="line-clamp-1" title={row.description}>
                          {row.description}
                        </span>
                      </GlassTableCell>
                      <GlassTableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-foreground">
                        {formatBaht(row.amount)}
                      </GlassTableCell>
                      <GlassTableCell className="whitespace-nowrap text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          icon={<Link2 className="h-3.5 w-3.5" />}
                          disabled={!perms.canCreate}
                          onClick={() => createBillFrom([row])}
                        >
                          ผูกเป็นค่าใช้จ่าย
                        </Button>
                      </GlassTableCell>
                    </GlassTableRow>
                  )
                })}
              </GlassTableBody>
            </GlassTable>
          </div>
        ))
      )}
    </div>
  )
}
