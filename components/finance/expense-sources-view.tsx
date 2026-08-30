"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, CircleOff, ExternalLink, Link2, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, formatDate } from "@/lib/utils"
import {
  GlassCard,
  GlassDialog,
  GlassInput,
  GlassTable,
  GlassTableBody,
  GlassTableCell,
  GlassTableHead,
  GlassTableHeader,
  GlassTableRow,
} from "@/components/glass"
import { FinancePageHeader } from "./finance-page-header"
import { NEW_EXPENSE_SOURCES_KEY, type PrefillPayload } from "./expense-form-page"
import type { ExpenseSourceRow, FinancePerms, LineDraft, Option } from "./expense-types"
import { FIN_GLASS_PANEL, SOURCE_TYPE_LABELS, formatBaht } from "./finance-theme"

function apiErrorMessage(json: unknown, fallback: string) {
  if (!json || typeof json !== "object") return fallback
  const error = (json as { error?: unknown }).error
  if (typeof error === "string" && error.trim()) return error
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) return message
  }
  return fallback
}

function rowKey(row: ExpenseSourceRow) {
  return `${row.sourceType}-${row.sourceId}`
}

function formatReferenceAmount(amount: number | null): string {
  if (amount == null) return "ยังไม่มียอดอ้างอิง"
  return formatBaht(amount)
}

const HAS_EXPENSE_BTN =
  "rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700"
const NO_EXPENSE_BTN =
  "rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/10"
const TABLE_ACTION_BTN = "h-8 shrink-0 whitespace-nowrap px-2.5"

function branchChipClass(active: boolean) {
  return cn(
    "rounded-full border px-3.5 py-1.5 text-sm font-medium",
    active
      ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200"
      : "border-slate-300 bg-white/80 text-muted-foreground hover:text-foreground dark:border-white/15 dark:bg-transparent"
  )
}

function sourceToLine(row: ExpenseSourceRow): LineDraft {
  const locked = row.amount != null && row.amount > 0
  const isJob = row.suggestedCostObjectType === "JOB"
  return {
    key: rowKey(row),
    expenseTypeId: "",
    description: row.description ?? "",
    pricingMode: "AMOUNT",
    quantity: "1",
    unitId: "",
    unitCode: "",
    unitPrice: locked ? String(row.amount) : "",
    amount: locked ? String(row.amount) : "",
    taxAmount: "",
    discountAmount: "",
    discountKind: "BAHT",
    costCenterId: "",
    processId: "",
    costObjectType: row.suggestedCostObjectType,
    costObjectId: isJob ? row.sourceDocumentId : row.vehicleId,
    costObjectLabel: isJob ? row.documentNo ?? row.description ?? "" : row.vehicleLabel,
    sourceKind: row.sourceKind,
    sourceModule: row.sourceModule,
    sourceType: row.sourceType,
    sourceDocumentId: row.sourceDocumentId,
    sourceLineId: row.sourceLineId,
    sourceAmountLocked: locked,
  }
}

export function ExpenseSourcesView({ perms }: { perms: FinancePerms }) {
  const router = useRouter()
  const [rows, setRows] = useState<ExpenseSourceRow[]>([])
  const [branches, setBranches] = useState<Option[]>([])
  const [branchId, setBranchId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailRow, setDetailRow] = useState<ExpenseSourceRow | null>(null)
  const [noExpenseRow, setNoExpenseRow] = useState<ExpenseSourceRow | null>(null)
  const [noExpenseReason, setNoExpenseReason] = useState("")
  const [noExpenseError, setNoExpenseError] = useState<string | null>(null)
  const [savingNoExpense, setSavingNoExpense] = useState(false)

  const canReview = perms.canCreate || perms.canUpdate

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/finance/expenses/sources", { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError("โหลดข้อมูลไม่สำเร็จ")
        setRows([])
        return
      }
      setError(null)
      setRows((json.data ?? []) as ExpenseSourceRow[])
      setSelected(new Set())
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetch("/api/finance/branches", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setBranches((json.data ?? []) as Option[]))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visibleRows = useMemo(
    () => (branchId ? rows.filter((r) => r.branchId === branchId) : rows),
    [rows, branchId]
  )
  const branchCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) {
      counts.set(r.branchId, (counts.get(r.branchId) ?? 0) + 1)
    }
    return counts
  }, [rows])

  const selectedRows = useMemo(
    () => visibleRows.filter((r) => selected.has(rowKey(r))),
    [visibleRows, selected]
  )
  const selectedBranch = selectedRows[0]?.branchId ?? null

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; rows: ExpenseSourceRow[] }>()
    for (const r of visibleRows) {
      const g = map.get(r.groupKey) ?? { label: r.groupLabel, rows: [] }
      g.rows.push(r)
      map.set(r.groupKey, g)
    }
    return [...map.entries()]
  }, [visibleRows])

  function selectBranch(id: string) {
    setBranchId(id)
    setSelected(new Set())
  }

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

  async function confirmNoExpense() {
    const row = noExpenseRow
    if (!row) return
    setSavingNoExpense(true)
    setNoExpenseError(null)
    try {
      const res = await fetch("/api/finance/expenses/sources/no-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          sourceType: row.sourceType,
          sourceDocumentId: row.sourceDocumentId,
          reason: noExpenseReason.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNoExpenseError(apiErrorMessage(json, "ปิดรายการไม่สำเร็จ"))
        return
      }
      const closedKey = rowKey(row)
      setRows((prev) => prev.filter((r) => rowKey(r) !== closedKey))
      setNoExpenseRow(null)
      setNoExpenseReason("")
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(closedKey)
        return next
      })
      await load()
    } catch {
      setNoExpenseError("ปิดรายการไม่สำเร็จ กรุณาลองอีกครั้ง")
    } finally {
      setSavingNoExpense(false)
    }
  }

  const differentBranch = selectedRows.length > 1 && selectedRows.some((r) => r.branchId !== selectedBranch)

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title={`คิวตรวจต้นทาง${loading ? "" : ` (${visibleRows.length})`}`}
        description="มีค่าใช้จ่ายออกจากคิวเมื่อบันทึกบิลแล้ว"
        actions={
          <Button
            type="button"
            icon={<Link2 className="h-4 w-4" />}
            className="rounded-xl bg-emerald-600 shadow-md shadow-emerald-600/20 hover:bg-emerald-700"
            disabled={!perms.canCreate || selectedRows.length === 0 || differentBranch}
            onClick={() => createBillFrom(selectedRows)}
          >
            มีค่าใช้จ่าย ({selectedRows.length})
          </Button>
        }
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {branches.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">สาขา</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={branchChipClass(branchId === "")}
            onClick={() => selectBranch("")}
          >
            ทั้งหมด ({rows.length})
          </Button>
          {branches.map((b) => (
            <Button
              key={b.id}
              type="button"
              size="sm"
              variant="outline"
              className={branchChipClass(branchId === b.id)}
              onClick={() => selectBranch(b.id)}
            >
              {b.name} ({branchCounts.get(b.id) ?? 0})
            </Button>
          ))}
        </div>
      )}
      {differentBranch && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          เลือกได้เฉพาะต้นทางในสาขาเดียวกันต่อ 1 บิล
        </p>
      )}

      {!loading && visibleRows.length === 0 && !error ? (
        <GlassCard className={cn("flex flex-col items-center justify-center py-12 text-center", FIN_GLASS_PANEL)}>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-700 backdrop-blur-sm dark:bg-emerald-400/15 dark:text-emerald-200">
            <Truck className="h-7 w-7" />
          </span>
          <p className="mt-4 text-sm font-medium text-foreground">ไม่มีรายการจากโมดูลที่รอตรวจสอบค่าใช้จ่าย</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            คิวว่างได้เพราะยังไม่มีต้นทางที่พร้อมตรวจ ถูกบันทึกบิลแล้ว ปิดว่าไม่มีค่าใช้จ่าย หรือไม่มีสิทธิ์เห็นข้อมูล
          </p>
        </GlassCard>
      ) : (
        groups.map(([groupKey, group]) => (
          <div key={groupKey} className="space-y-2">
            <h2 className="px-1 text-sm font-semibold text-foreground">{group.label}</h2>
            <GlassTable className={cn("rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL)}>
              <GlassTableHeader className="border-slate-200/80 bg-white/70 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <GlassTableHead className="w-[4%]"> </GlassTableHead>
                  <GlassTableHead className="whitespace-nowrap">เอกสาร</GlassTableHead>
                  <GlassTableHead className="whitespace-nowrap">สาขา</GlassTableHead>
                  <GlassTableHead className="whitespace-nowrap">ประเภท</GlassTableHead>
                  <GlassTableHead className="whitespace-nowrap">วันที่</GlassTableHead>
                  <GlassTableHead className="whitespace-nowrap">รถ</GlassTableHead>
                  <GlassTableHead>รายละเอียด</GlassTableHead>
                  <GlassTableHead className="whitespace-nowrap text-right">ยอดอ้างอิง</GlassTableHead>
                  <GlassTableHead className="whitespace-nowrap text-right">การกระทำ</GlassTableHead>
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
                      <GlassTableCell className="whitespace-nowrap">
                        <button
                          type="button"
                          className="text-left text-sm font-semibold tabular-nums text-blue-600 hover:underline dark:text-blue-400"
                          onClick={() => setDetailRow(row)}
                        >
                          {row.documentNo ?? "ดูรายละเอียด"}
                        </button>
                      </GlassTableCell>
                      <GlassTableCell className="whitespace-nowrap text-muted-foreground">
                        {row.branchName}
                      </GlassTableCell>
                      <GlassTableCell className="whitespace-nowrap font-medium text-foreground">
                        {SOURCE_TYPE_LABELS[row.sourceType] ?? row.sourceType}
                      </GlassTableCell>
                      <GlassTableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {formatDate(row.date)}
                      </GlassTableCell>
                      <GlassTableCell className="whitespace-nowrap">{row.vehicleLabel}</GlassTableCell>
                      <GlassTableCell className="text-muted-foreground">
                        <span className="line-clamp-1" title={row.description ?? undefined}>
                          {row.description ?? "—"}
                        </span>
                      </GlassTableCell>
                      <GlassTableCell className="whitespace-nowrap text-right tabular-nums text-foreground">
                        {formatReferenceAmount(row.amount)}
                      </GlassTableCell>
                      <GlassTableCell className="whitespace-nowrap px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            icon={<Check className="h-3.5 w-3.5" />}
                            className={cn(HAS_EXPENSE_BTN, TABLE_ACTION_BTN)}
                            disabled={!perms.canCreate}
                            onClick={() => createBillFrom([row])}
                          >
                            มีค่าใช้จ่าย
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            icon={<CircleOff className="h-3.5 w-3.5" />}
                            className={cn(NO_EXPENSE_BTN, TABLE_ACTION_BTN)}
                            disabled={!canReview}
                            onClick={() => {
                              setError(null)
                              setNoExpenseError(null)
                              setNoExpenseReason("")
                              setNoExpenseRow(row)
                            }}
                          >
                            ไม่มีค่าใช้จ่าย
                          </Button>
                        </div>
                      </GlassTableCell>
                    </GlassTableRow>
                  )
                })}
              </GlassTableBody>
            </GlassTable>
          </div>
        ))
      )}

      <GlassDialog
        open={detailRow != null}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null)
        }}
        title="รายละเอียดต้นทาง"
      >
        {detailRow && (
          <div className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">ประเภท</dt>
                <dd className="font-medium text-foreground">
                  {SOURCE_TYPE_LABELS[detailRow.sourceType] ?? detailRow.sourceType}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">เอกสาร</dt>
                <dd className="font-medium tabular-nums text-foreground">{detailRow.documentNo ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">สาขา</dt>
                <dd className="text-foreground">{detailRow.branchName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">วันที่</dt>
                <dd className="tabular-nums text-foreground">{formatDate(detailRow.date)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">รถ</dt>
                <dd className="text-foreground">{detailRow.vehicleLabel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">รายละเอียด</dt>
                <dd className="text-right text-foreground">{detailRow.description ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">ยอดอ้างอิง</dt>
                <dd className="tabular-nums text-foreground">{formatReferenceAmount(detailRow.amount)}</dd>
              </div>
            </dl>
            {detailRow.sourceType === "TRANSPORT_JOB" && (
              <Link
                href={`/transport/jobs/${detailRow.sourceDocumentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                เปิดใบงาน
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setDetailRow(null)}>
                ปิด
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<CircleOff className="h-3.5 w-3.5" />}
                className={NO_EXPENSE_BTN}
                disabled={!canReview}
                onClick={() => {
                  setError(null)
                  setNoExpenseError(null)
                  setNoExpenseReason("")
                  setNoExpenseRow(detailRow)
                  setDetailRow(null)
                }}
              >
                ไม่มีค่าใช้จ่าย
              </Button>
              <Button
                type="button"
                size="sm"
                icon={<Check className="h-3.5 w-3.5" />}
                className={HAS_EXPENSE_BTN}
                disabled={!perms.canCreate}
                onClick={() => {
                  setDetailRow(null)
                  createBillFrom([detailRow])
                }}
              >
                มีค่าใช้จ่าย
              </Button>
            </div>
          </div>
        )}
      </GlassDialog>

      <GlassDialog
        open={noExpenseRow != null}
        onOpenChange={(open) => {
          if (!open && !savingNoExpense) {
            setNoExpenseRow(null)
            setNoExpenseReason("")
            setNoExpenseError(null)
          }
        }}
        title="ปิดว่าไม่มีค่าใช้จ่าย"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            รายการนี้จะออกจากคิวโดยไม่สร้างบิลค่าใช้จ่าย (รวมถึงบิล 0 บาท)
          </p>
          {noExpenseRow && (
            <p className="text-sm text-foreground">
              {SOURCE_TYPE_LABELS[noExpenseRow.sourceType] ?? noExpenseRow.sourceType}
              {noExpenseRow.documentNo ? ` · ${noExpenseRow.documentNo}` : ""}
              {noExpenseRow.description ? ` · ${noExpenseRow.description}` : ""}
            </p>
          )}
          <GlassInput
            label="เหตุผล (ไม่บังคับ)"
            value={noExpenseReason}
            onChange={(e) => setNoExpenseReason(e.target.value)}
            placeholder="เช่น รับประกัน / ซ่อมภายใน / ไม่มีค่าใช้จ่าย"
          />
          {noExpenseError && <p className="text-sm text-red-600">{noExpenseError}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={savingNoExpense}
              onClick={() => {
                setNoExpenseRow(null)
                setNoExpenseReason("")
              }}
            >
              ยกเลิก
            </Button>
            <Button type="button" disabled={savingNoExpense} onClick={() => void confirmNoExpense()}>
              ยืนยันไม่มีค่าใช้จ่าย
            </Button>
          </div>
        </div>
      </GlassDialog>
    </div>
  )
}
