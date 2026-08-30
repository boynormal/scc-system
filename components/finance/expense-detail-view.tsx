"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Check,
  CreditCard,
  ExternalLink,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { GlassCard, GlassTabs } from "@/components/glass"
import { cn, formatDate, formatDateTime } from "@/lib/utils"
import type { ExpenseDto, ExpenseLineDto, FinancePerms } from "./expense-types"
import {
  formatExpenseSourceOrigin,
  summarizeExpenseSourceOrigin,
  type SourceOriginDisplay,
} from "./expense-source-origin"
import {
  COST_OBJECT_TYPE_LABELS,
  EXPENSE_STATUS_BADGE,
  EXPENSE_STATUS_LABELS,
  formatBaht,
  type ExpenseStatus,
} from "./finance-theme"
import { ExpenseStatusBadge } from "./finance-page-header"

const PANEL =
  "rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_24px_rgb(15_23_42/0.06)] dark:border-white/10 dark:bg-slate-900/50 dark:shadow-[0_12px_32px_rgb(0_0_0/0.35)]"

const TABS = [
  { id: "overview", label: "ภาพรวม" },
  { id: "lines", label: "รายการค่าใช้จ่าย" },
  { id: "related", label: "เอกสารที่เกี่ยวข้อง" },
  { id: "files", label: "ไฟล์แนบ" },
  { id: "history", label: "ประวัติการดำเนินการ" },
]

function dash(value: ReactNode) {
  return value ?? "—"
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-slate-100 py-2.5 text-sm last:border-0 dark:border-white/10">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{dash(value)}</span>
    </div>
  )
}

function lineOrigin(line: ExpenseLineDto) {
  return formatExpenseSourceOrigin({
    sourceKind: line.sourceKind,
    sourceModule: line.sourceModule,
    sourceType: line.sourceType,
    description: line.description,
    costObjectType: line.costObjectType,
    costObjectLabel: line.costObjectLabel,
  })
}

function sourceHref(sourceType: string | null | undefined, sourceDocumentId: string | null | undefined) {
  if (!sourceDocumentId) return null
  if (sourceType === "TRANSPORT_JOB") return `/transport/jobs/${sourceDocumentId}`
  return null
}

function sourceCode(origin: SourceOriginDisplay) {
  const fromRef = origin.reference?.match(/\b((?:TJ|JOB)-[A-Z0-9-]+)\b/i)?.[1]
  return fromRef ?? origin.reference
}

function SourceLink({
  origin,
  sourceType,
  sourceDocumentId,
}: {
  origin: SourceOriginDisplay
  sourceType?: string | null
  sourceDocumentId?: string | null
}) {
  if (origin.kind === "บันทึกเอง") return <span>บันทึกเอง</span>
  const href = sourceHref(sourceType, sourceDocumentId)
  const code = sourceCode(origin)
  return (
    <span className="flex flex-col items-end gap-0.5">
      <span>{origin.kind}</span>
      {code && href ? (
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          {code}
          <ExternalLink className="h-3 w-3" />
        </Link>
      ) : (
        code && <span className="text-xs font-normal text-muted-foreground">{code}</span>
      )}
    </span>
  )
}

export function ExpenseDetailView({ expense, perms }: { expense: ExpenseDto; perms: FinancePerms }) {
  const router = useRouter()
  const [tab, setTab] = useState("overview")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)

  const status = expense.status as ExpenseStatus
  const canEdit = perms.canUpdate && ["DRAFT", "PENDING", "REJECTED"].includes(status)
  const canApprove = perms.canApprove && ["DRAFT", "PENDING"].includes(status)
  const canPay = perms.canUpdate && status === "APPROVED"
  const canDelete = perms.canDelete && status !== "PAID"
  const headerOrigin = summarizeExpenseSourceOrigin(expense.lines)
  const primaryLinked = expense.lines.find((l) => l.sourceKind !== "MANUAL" && (l.sourceModule || l.sourceType))

  const relatedSources = useMemo(() => {
    const seen = new Set<string>()
    const rows: { key: string; origin: SourceOriginDisplay; href: string | null; type: string | null }[] = []
    for (const line of expense.lines) {
      const origin = lineOrigin(line)
      if (origin.kind === "บันทึกเอง") continue
      const key = `${line.sourceType ?? ""}::${line.sourceDocumentId ?? line.id}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({
        key,
        origin,
        href: sourceHref(line.sourceType, line.sourceDocumentId),
        type: line.sourceType,
      })
    }
    return rows
  }, [expense.lines])

  const history = useMemo(() => {
    const events: { id: string; title: string; at: string; by: string | null }[] = [
      { id: "created", title: "สร้างเอกสาร", at: expense.createdAt, by: expense.createdByName },
    ]
    if (expense.approvedAt) {
      events.push({ id: "approved", title: "อนุมัติ", at: expense.approvedAt, by: expense.approvedByName })
    }
    if (status === "REJECTED") {
      events.push({ id: "rejected", title: "ปฏิเสธ", at: expense.updatedAt, by: expense.approvedByName })
    }
    if (expense.paidAt) {
      events.push({ id: "paid", title: "ทำเครื่องหมายจ่ายแล้ว", at: expense.paidAt, by: expense.paidByName })
    }
    return events
  }, [expense, status])

  async function act(action: "approve" | "reject" | "pay" | "delete") {
    setBusy(action)
    setMoreOpen(false)
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

  function ActionCluster({ compact }: { compact?: boolean }) {
    const size = compact ? "sm" : "md"
    return (
      <div className="relative flex flex-wrap items-center justify-end gap-2">
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size={size}
            icon={<Pencil className="h-3.5 w-3.5" />}
            onClick={() => router.push(`/finance/expenses/${expense.id}/edit`)}
          >
            แก้ไข
          </Button>
        )}
        {canApprove && (
          <Button
            type="button"
            size={size}
            className="bg-emerald-600 shadow-md shadow-emerald-600/20 hover:bg-emerald-700"
            icon={<Check className="h-3.5 w-3.5" />}
            loading={busy === "approve"}
            onClick={() => void act("approve")}
          >
            อนุมัติ
          </Button>
        )}
        {canPay && (
          <Button
            type="button"
            size={size}
            className="bg-emerald-600 hover:bg-emerald-700"
            icon={<CreditCard className="h-3.5 w-3.5" />}
            loading={busy === "pay"}
            onClick={() => void act("pay")}
          >
            จ่ายแล้ว
          </Button>
        )}
        {(canDelete || canPay || canApprove) && (
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size={size}
              icon={<MoreHorizontal className="h-4 w-4" />}
              aria-label="เมนูเพิ่มเติม"
              onClick={() => setMoreOpen((open) => !open)}
            >
              {""}
            </Button>
            {moreOpen && (
              <div className="absolute right-0 z-30 mt-1 min-w-[10rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-slate-900">
                {canApprove && (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                    onClick={() => void act("reject")}
                  >
                    ปฏิเสธ
                  </button>
                )}
                {canPay && (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5"
                    onClick={() => void act("pay")}
                  >
                    ทำเครื่องหมายจ่ายแล้ว
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                    onClick={() => void act("delete")}
                  >
                    ลบ
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const statusBadgeClass =
    status === "DRAFT"
      ? "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/30 dark:bg-orange-500/15 dark:text-orange-200"
      : EXPENSE_STATUS_BADGE[status]

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => router.push("/finance/expenses")}
          >
            กลับ
          </Button>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{expense.expenseNo}</h1>
          <ExpenseStatusBadge label={EXPENSE_STATUS_LABELS[status]} className={statusBadgeClass} />
        </div>
        <ActionCluster compact />
      </div>
      <p className="text-sm text-muted-foreground">
        {expense.branchName}
        {" · "}
        {formatDate(expense.expenseDate)}
        {expense.vendorName ? ` · ${expense.vendorName}` : ""}
      </p>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <GlassTabs
        aria-label="ส่วนของบิลค่าใช้จ่าย"
        className="mb-0 mt-0"
        items={TABS}
        value={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <div className="space-y-4">
          <GlassCard className={cn("px-5 py-4 shadow-none", PANEL)}>
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <div>
                <p className="text-xs text-muted-foreground">ยอดสุทธิ</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-300">
                  {formatBaht(expense.netAmount)}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">จำนวนเงิน</p>
                  <p className="tabular-nums font-medium text-foreground">{formatBaht(expense.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ภาษี</p>
                  <p className="tabular-nums font-medium text-foreground">{formatBaht(expense.taxAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ส่วนลด</p>
                  <p className="tabular-nums font-medium text-foreground">{formatBaht(expense.discountAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">รายการ</p>
                  <p className="font-medium text-foreground">{expense.lineCount}</p>
                </div>
              </div>
            </div>
          </GlassCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard className={cn("p-5 shadow-none", PANEL)}>
              <h2 className="mb-3 text-sm font-semibold text-foreground">ข้อมูลเอกสาร</h2>
              <InfoRow label="สาขา" value={expense.branchName} />
              <InfoRow label="วันที่เอกสาร" value={formatDate(expense.expenseDate)} />
              <InfoRow label="วันที่ลงบัญชี" value={formatDate(expense.postingDate)} />
              <InfoRow label="ผู้ขาย" value={expense.vendorName} />
              <InfoRow label="พนักงาน" value={expense.employeeName} />
              <InfoRow label="สร้างโดย" value={expense.createdByName} />
              {expense.notes && <InfoRow label="หมายเหตุ" value={expense.notes} />}
            </GlassCard>

            <GlassCard className={cn("p-5 shadow-none", PANEL)}>
              <h2 className="mb-3 text-sm font-semibold text-foreground">ข้อมูลที่เกี่ยวข้อง</h2>
              <InfoRow
                label="ต้นทาง"
                value={
                  <SourceLink
                    origin={headerOrigin}
                    sourceType={primaryLinked?.sourceType}
                    sourceDocumentId={primaryLinked?.sourceDocumentId}
                  />
                }
              />
              {headerOrigin.kind !== "บันทึกเอง" && sourceCode(headerOrigin) && (
                <InfoRow label="เอกสารอ้างอิง" value={sourceCode(headerOrigin)} />
              )}
            </GlassCard>
          </div>
        </div>
      )}

      {tab === "lines" && (
        <GlassCard className={cn("p-5 shadow-none", PANEL)}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">รายการค่าใช้จ่าย ({expense.lineCount} รายการ)</h2>
            {canEdit && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => router.push(`/finance/expenses/${expense.id}/edit`)}
              >
                เพิ่มรายการ
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-xs text-muted-foreground dark:border-white/10">
                <tr>
                  <th className="py-2 pr-3 text-left font-medium">ลำดับ</th>
                  <th className="py-2 text-left font-medium">รายการ</th>
                  <th className="py-2 text-left font-medium">หน่วยงาน / วัตถุต้นทุน</th>
                  <th className="py-2 text-right font-medium">จำนวน</th>
                  <th className="py-2 text-right font-medium">ราคา/หน่วย</th>
                  <th className="py-2 text-right font-medium">จำนวนเงิน</th>
                  <th className="py-2 pl-3 text-left font-medium">อ้างอิง</th>
                </tr>
              </thead>
              <tbody>
                {expense.lines.map((l, index) => {
                  const origin = lineOrigin(l)
                  const href = sourceHref(l.sourceType, l.sourceDocumentId)
                  const code = sourceCode(origin)
                  return (
                    <tr key={l.id} className="border-b border-slate-100 dark:border-white/5">
                      <td className="py-3 pr-3 tabular-nums text-muted-foreground">{index + 1}</td>
                      <td className="py-3">
                        <div className="font-medium text-foreground">{l.expenseTypeName}</div>
                        {l.description && <div className="text-xs text-muted-foreground">{l.description}</div>}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        <div>{l.costCenterName ?? "—"}</div>
                        {l.processName && <div className="text-xs">{l.processName}</div>}
                        {l.costObjectLabel && (
                          <div className="text-xs">
                            {(l.costObjectType ? COST_OBJECT_TYPE_LABELS[l.costObjectType] ?? "" : "")}{" "}
                            {l.costObjectLabel}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {l.pricingMode === "QTY_PRICE" ? `${l.quantity}${l.unitCode ? ` ${l.unitCode}` : ""}` : "—"}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {l.pricingMode === "QTY_PRICE" ? formatBaht(l.unitPrice) : "—"}
                      </td>
                      <td className="py-3 text-right font-semibold tabular-nums text-foreground">
                        {formatBaht(l.netAmount)}
                      </td>
                      <td className="py-3 pl-3 text-muted-foreground">
                        {origin.kind === "บันทึกเอง" ? (
                          "บันทึกเอง"
                        ) : (
                          <div>
                            <div>{origin.kind}</div>
                            {code && href ? (
                              <Link
                                href={href}
                                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                              >
                                {code}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            ) : (
                              code && <div className="max-w-[12rem] truncate text-xs">{code}</div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>รวม</span>
                <span className="tabular-nums text-foreground">{formatBaht(expense.amount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>ภาษี</span>
                <span className="tabular-nums text-foreground">{formatBaht(expense.taxAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold dark:border-white/10">
                <span>ยอดสุทธิ</span>
                <span className="tabular-nums text-emerald-600 dark:text-emerald-300">{formatBaht(expense.netAmount)}</span>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {tab === "related" && (
        <GlassCard className={cn("p-5 shadow-none", PANEL)}>
          <h2 className="mb-3 text-sm font-semibold text-foreground">เอกสารที่เกี่ยวข้อง</h2>
          {relatedSources.length === 0 ? (
            <p className="text-sm text-muted-foreground">บิลนี้บันทึกเอง ไม่มีเอกสารต้นทางจากโมดูลอื่น</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/10">
              {relatedSources.map((row) => (
                <li key={row.key} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <div className="font-medium text-foreground">{row.origin.kind}</div>
                    <div className="text-muted-foreground">{sourceCode(row.origin) ?? "—"}</div>
                  </div>
                  {row.href && (
                    <Link href={row.href} className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400">
                      เปิดเอกสาร
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      )}

      {tab === "files" && (
        <GlassCard className={cn("p-5 shadow-none", PANEL)}>
          <h2 className="mb-3 text-sm font-semibold text-foreground">ไฟล์แนบ</h2>
          {expense.attachments.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Paperclip className="h-4 w-4" />
              ยังไม่มีไฟล์แนบ
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/10">
              {expense.attachments.map((file) => (
                <li key={file.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="font-medium text-foreground">{file.fileName ?? "ไฟล์"}</span>
                  <a href={file.fileUrl} className="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noreferrer">
                    เปิดไฟล์
                  </a>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      )}

      {tab === "history" && (
        <GlassCard className={cn("p-5 shadow-none", PANEL)}>
          <h2 className="mb-4 text-sm font-semibold text-foreground">ประวัติการดำเนินการ</h2>
          <ol className="space-y-4">
            {history.map((event, index) => (
              <li key={event.id} className="flex gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    index === history.length - 1
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                      : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                  )}
                >
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(event.at)}
                    {event.by ? ` · ${event.by}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </GlassCard>
      )}

      <div className="sticky bottom-0 z-20 -mx-6 mt-2 border-t border-slate-200/80 bg-white/90 px-6 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">สถานะ</span>
              <ExpenseStatusBadge label={EXPENSE_STATUS_LABELS[status]} className={statusBadgeClass} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              สร้างเมื่อ {formatDateTime(expense.createdAt)}
              {expense.createdByName ? ` โดย ${expense.createdByName}` : ""}
            </p>
          </div>
          <ActionCluster compact />
        </div>
      </div>
    </div>
  )
}
