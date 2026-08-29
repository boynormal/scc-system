"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, CreditCard, Pencil, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/glass"
import { cn, formatDate } from "@/lib/utils"
import type { ExpenseDto, FinancePerms } from "./expense-types"
import {
  COST_OBJECT_TYPE_LABELS,
  EXPENSE_STATUS_BADGE,
  EXPENSE_STATUS_LABELS,
  FIN_GLASS_PANEL,
  formatBaht,
  sourceModuleLabel,
  type ExpenseStatus,
} from "./finance-theme"
import { ExpenseStatusBadge } from "./finance-page-header"

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200/60 py-2 text-sm dark:border-white/10">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value ?? "—"}</span>
    </div>
  )
}

export function ExpenseDetailView({ expense, perms }: { expense: ExpenseDto; perms: FinancePerms }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(action: "approve" | "reject" | "pay" | "delete") {
    setBusy(action)
    setError(null)
    const method = action === "delete" ? "DELETE" : "POST"
    const url =
      action === "delete"
        ? `/api/finance/expenses/${expense.id}`
        : `/api/finance/expenses/${expense.id}/${action}`
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: action === "delete" ? undefined : JSON.stringify({}),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : json.error?.message ?? "ทำรายการไม่สำเร็จ")
      return
    }
    if (action === "delete") {
      router.push("/finance/expenses")
    } else {
      router.refresh()
    }
  }

  const status = expense.status as ExpenseStatus
  const canEdit = perms.canUpdate && ["DRAFT", "PENDING", "REJECTED"].includes(status)
  const canApprove = perms.canApprove && ["DRAFT", "PENDING"].includes(status)
  const canPay = perms.canUpdate && status === "APPROVED"
  const canDelete = perms.canDelete && status !== "PAID"

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.push("/finance/expenses")}>
            กลับ
          </Button>
          <h1 className="text-xl font-bold text-foreground">{expense.expenseNo}</h1>
          <ExpenseStatusBadge label={EXPENSE_STATUS_LABELS[status]} className={EXPENSE_STATUS_BADGE[status]} />
        </div>
        <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatBaht(expense.netAmount)}</span>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className={cn("rounded-[1.5rem] p-5 shadow-none", FIN_GLASS_PANEL)}>
          <h2 className="mb-2 text-sm font-semibold text-foreground">ข้อมูลหัวบิล</h2>
          <Row label="สาขา" value={expense.branchName} />
          <Row label="วันที่เกิดรายการ" value={formatDate(expense.expenseDate)} />
          <Row label="วันที่ลงบัญชี" value={formatDate(expense.postingDate)} />
          <Row label="ต้นทาง" value={sourceModuleLabel(expense.sourceModule)} />
          <Row label="ผู้ขาย" value={expense.vendorName} />
          <Row label="พนักงาน" value={expense.employeeName} />
          <Row
            label="วิธีจ่าย"
            value={expense.paymentMethod === "cash" ? "เงินสด" : expense.paymentMethod === "credit" ? "เครดิต" : null}
          />
          {expense.notes && <Row label="หมายเหตุ" value={expense.notes} />}
          {expense.approvedByName && (
            <Row label="อนุมัติโดย" value={`${expense.approvedByName}${expense.approvedAt ? ` · ${formatDate(expense.approvedAt)}` : ""}`} />
          )}
          {expense.paidByName && (
            <Row label="จ่ายโดย" value={`${expense.paidByName}${expense.paidAt ? ` · ${formatDate(expense.paidAt)}` : ""}`} />
          )}
          <Row label="สร้างโดย" value={expense.createdByName} />
        </GlassCard>

        <GlassCard className={cn("rounded-[1.5rem] p-5 shadow-none", FIN_GLASS_PANEL)}>
          <h2 className="mb-2 text-sm font-semibold text-foreground">ยอดรวม</h2>
          <Row label="จำนวนเงิน" value={formatBaht(expense.amount)} />
          <Row label="ภาษี" value={formatBaht(expense.taxAmount)} />
          <Row label="ส่วนลด" value={formatBaht(expense.discountAmount)} />
          <Row label="ยอดสุทธิ" value={<span className="text-emerald-700 dark:text-emerald-300">{formatBaht(expense.netAmount)}</span>} />
          <Row label="จำนวนบรรทัด" value={`${expense.lineCount} บรรทัด`} />
        </GlassCard>
      </div>

      <GlassCard className={cn("rounded-[1.5rem] p-5 shadow-none", FIN_GLASS_PANEL)}>
        <h2 className="mb-3 text-sm font-semibold text-foreground">รายการ ({expense.lineCount} บรรทัด)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200/70 text-xs text-muted-foreground dark:border-white/10">
              <tr>
                <th className="py-2 text-left font-medium">ประเภท / รายละเอียด</th>
                <th className="py-2 text-left font-medium">หน่วยงาน / วัตถุต้นทุน</th>
                <th className="py-2 text-right font-medium">จำนวน</th>
                <th className="py-2 text-right font-medium">ราคา/หน่วย</th>
                <th className="py-2 text-right font-medium">จำนวนเงิน</th>
                <th className="py-2 text-right font-medium">สุทธิ</th>
                <th className="py-2 text-left font-medium">ต้นทาง</th>
              </tr>
            </thead>
            <tbody>
              {expense.lines.map((l) => (
                <tr key={l.id} className="border-b border-slate-100/70 dark:border-white/5">
                  <td className="py-2">
                    <div className="font-medium text-foreground">{l.expenseTypeName}</div>
                    {l.description && <div className="text-xs text-muted-foreground">{l.description}</div>}
                  </td>
                  <td className="py-2 text-muted-foreground">
                    <div>{l.costCenterName ?? "—"}</div>
                    {l.processName && <div className="text-xs">{l.processName}</div>}
                    {l.costObjectLabel && (
                      <div className="text-xs">
                        {(l.costObjectType ? COST_OBJECT_TYPE_LABELS[l.costObjectType] ?? "" : "")} {l.costObjectLabel}
                      </div>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {l.pricingMode === "QTY_PRICE" ? `${l.quantity}${l.unitCode ? ` ${l.unitCode}` : ""}` : "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums">{l.pricingMode === "QTY_PRICE" ? formatBaht(l.unitPrice) : "—"}</td>
                  <td className="py-2 text-right tabular-nums">{formatBaht(l.amount)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-foreground">{formatBaht(l.netAmount)}</td>
                  <td className="py-2 text-muted-foreground">{l.sourceKind === "MANUAL" ? "บันทึกเอง" : sourceModuleLabel(l.sourceModule)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {canEdit && (
          <Button type="button" variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => router.push(`/finance/expenses/${expense.id}/edit`)}>
            แก้ไข
          </Button>
        )}
        {canApprove && (
          <>
            <Button type="button" size="sm" className="bg-sky-600 hover:bg-sky-700" icon={<Check className="h-3.5 w-3.5" />} loading={busy === "approve"} onClick={() => act("approve")}>
              อนุมัติ
            </Button>
            <Button type="button" variant="outline" size="sm" icon={<X className="h-3.5 w-3.5" />} loading={busy === "reject"} onClick={() => act("reject")}>
              ปฏิเสธ
            </Button>
          </>
        )}
        {canPay && (
          <Button type="button" size="sm" className="bg-emerald-600 hover:bg-emerald-700" icon={<CreditCard className="h-3.5 w-3.5" />} loading={busy === "pay"} onClick={() => act("pay")}>
            ทำเครื่องหมายจ่ายแล้ว
          </Button>
        )}
        {canDelete && (
          <Button type="button" variant="outline" size="sm" className="text-red-600 hover:bg-red-50" icon={<Trash2 className="h-3.5 w-3.5" />} loading={busy === "delete"} onClick={() => act("delete")}>
            ลบ
          </Button>
        )}
      </div>
    </div>
  )
}
