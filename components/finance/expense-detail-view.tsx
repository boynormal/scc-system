"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  ArrowLeft,
  Camera,
  Check,
  CreditCard,
  ExternalLink,
  History,
  Paperclip,
  Pencil,
  Trash2,
  Undo2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { GlassCard, GlassDialog } from "@/components/glass"
import { AppDataTable, AppDataTableBody, AppDataTableHead } from "@/components/shell/app-data-table"
import { cn, formatDate, formatDateTime } from "@/lib/utils"
import type { ExpenseAttachmentDto, ExpenseDto, ExpenseLineDto, FinancePerms } from "./expense-types"
import { formatExpenseSourceOrigin, type SourceOriginDisplay } from "./expense-source-origin"
import {
  COST_OBJECT_TYPE_LABELS,
  EXPENSE_STATUS_LABELS,
  formatBaht,
  solidBlueButtonClass,
  solidEmeraldButtonClass,
  solidRedButtonClass,
  solidYellowButtonClass,
  type ExpenseStatus,
} from "./finance-theme"
import { IncomeFileThumbs } from "./income-file-thumbs"

const PANEL =
  "rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_24px_rgb(15_23_42/0.06)] dark:border-white/10 dark:bg-slate-900/50 dark:shadow-[0_12px_32px_rgb(0_0_0/0.35)]"

const STATUS_CHIP_CLASS: Record<ExpenseStatus, string> = {
  DRAFT: "bg-[#eab308] text-[#1c1917]",
  PENDING: "bg-[#d97706] text-white",
  APPROVED: "bg-[#2563eb] text-white",
  PAID: "bg-[#16a34a] text-white",
  REJECTED: "bg-[#dc2626] text-white",
  CANCELLED: "bg-[#64748b] text-white",
}

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
    sourceDocumentNo: line.sourceDocumentNo,
  })
}

function sourceHref(sourceType: string | null | undefined, sourceDocumentId: string | null | undefined) {
  if (!sourceDocumentId) return null
  if (sourceType === "TRANSPORT_JOB") return `/transport/jobs/${sourceDocumentId}`
  return null
}

function sourceCode(line: ExpenseLineDto, origin: SourceOriginDisplay) {
  return line.sourceDocumentNo ?? origin.reference
}

function apiErrorMessage(
  json: { error?: unknown; code?: string },
  status: number,
  messages: { fallback: string; unavailable: string; denied: string }
): string {
  if (status === 403) return messages.denied
  if (json.code === "STORAGE_UNAVAILABLE") return messages.unavailable
  if (typeof json.error === "string" && json.error.trim()) return json.error
  if (json.error && typeof json.error === "object" && "message" in json.error) {
    const message = (json.error as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) return message
  }
  return messages.fallback
}

export function ExpenseDetailView({ expense, perms }: { expense: ExpenseDto; perms: FinancePerms }) {
  const router = useRouter()
  const tFiles = useTranslations("expenseFiles")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [unpayOpen, setUnpayOpen] = useState(false)
  const [unpayReason, setUnpayReason] = useState("")
  const [files, setFiles] = useState<ExpenseAttachmentDto[]>(expense.attachments)
  const [uploading, setUploading] = useState(false)

  const status = expense.status as ExpenseStatus
  const canEdit = perms.canUpdate && ["DRAFT", "PENDING", "REJECTED"].includes(status)
  const canClassify = perms.canUpdate && status === "PAID"
  const canAttach = perms.canUpdate && status !== "CANCELLED"
  const canApprove = perms.canApprove && ["DRAFT", "PENDING"].includes(status)
  const canReject = perms.canApprove && ["DRAFT", "PENDING", "APPROVED"].includes(status)
  const canPay = perms.canUpdate && status === "APPROVED"
  const canUnpay = perms.canApprove && status === "PAID"
  const canDelete = perms.canDelete && status !== "PAID"
  const unpayReasonOk = unpayReason.trim().length >= 1 && unpayReason.trim().length <= 500
  const relatedSources = useMemo(() => {
    const seen = new Set<string>()
    const rows: {
      key: string
      origin: SourceOriginDisplay
      href: string | null
      type: string | null
      documentNo: string | null
    }[] = []
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
        documentNo: line.sourceDocumentNo ?? origin.reference,
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

  async function submitUnpay() {
    const reason = unpayReason.trim()
    if (!reason || reason.length > 500) return
    setBusy("unpay")
    setError(null)
    try {
      const res = await fetch(`/api/finance/expenses/${expense.id}/unpay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : json.error?.message ?? "ทำรายการไม่สำเร็จ")
        return
      }
      setUnpayOpen(false)
      setUnpayReason("")
      router.refresh()
    } catch {
      setError("ทำรายการไม่สำเร็จ")
    } finally {
      setBusy(null)
    }
  }

  async function uploadAttachment(file: File) {
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(`/api/finance/expenses/${expense.id}/files`, { method: "POST", body: form })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(
          apiErrorMessage(json, res.status, {
            fallback: tFiles("uploadFailed"),
            unavailable: tFiles("unavailable"),
            denied: tFiles("denied"),
          })
        )
        return
      }
      setFiles((prev) => [...prev, json.data as ExpenseAttachmentDto])
    } catch {
      setError(tFiles("uploadFailed"))
    } finally {
      setUploading(false)
    }
  }

  async function removeAttachment(attachmentId: string) {
    setBusy(attachmentId)
    setError(null)
    try {
      const res = await fetch(`/api/finance/expenses/${expense.id}/attachments/${attachmentId}`, {
        method: "DELETE",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(
          apiErrorMessage(json, res.status, {
            fallback: tFiles("deleteFailed"),
            unavailable: tFiles("unavailable"),
            denied: tFiles("denied"),
          })
        )
        return
      }
      setFiles((prev) => prev.filter((item) => item.id !== attachmentId))
    } catch {
      setError(tFiles("deleteFailed"))
    } finally {
      setBusy(null)
    }
  }

  function ActionCluster() {
    const size = "sm"
    return (
      <div className="relative flex flex-wrap items-center justify-end gap-2">
        {canClassify && (
          <Button
            type="button"
            size={size}
            className={solidYellowButtonClass}
            icon={<Pencil className="h-3.5 w-3.5" />}
            onClick={() => router.push(`/finance/expenses/${expense.id}/edit`)}
          >
            แก้ข้อมูล
          </Button>
        )}
        {canEdit && (
          <Button
            type="button"
            size={size}
            className={solidYellowButtonClass}
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
            className={solidEmeraldButtonClass}
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
            className={solidEmeraldButtonClass}
            icon={<CreditCard className="h-3.5 w-3.5" />}
            loading={busy === "pay"}
            onClick={() => void act("pay")}
          >
            จ่ายแล้ว
          </Button>
        )}
        {canReject && (
          <Button
            type="button"
            size={size}
            className={solidYellowButtonClass}
            icon={<X className="h-3.5 w-3.5" />}
            loading={busy === "reject"}
            onClick={() => void act("reject")}
          >
            ปฏิเสธ
          </Button>
        )}
        {canUnpay && (
          <Button
            type="button"
            size={size}
            className={solidYellowButtonClass}
            icon={<Undo2 className="h-3.5 w-3.5" />}
            onClick={() => {
              setUnpayReason("")
              setUnpayOpen(true)
            }}
          >
            ยกเลิกการจ่าย
          </Button>
        )}
        {canDelete && (
          <Button
            type="button"
            size={size}
            className={solidRedButtonClass}
            icon={<Trash2 className="h-3.5 w-3.5" />}
            loading={busy === "delete"}
            onClick={() => void act("delete")}
          >
            ลบ
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="relative z-10 bg-transparent text-foreground hover:bg-transparent"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => router.push("/finance/expenses")}
          >
            กลับ
          </Button>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{expense.expenseNo}</h1>
        </div>
        <ActionCluster />
      </div>
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-slate-300 bg-[#ffffff] px-4 py-2.5 dark:border-white/15 dark:bg-[#0f172a]">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-[#0f172a] dark:text-white">สถานะ</span>
            <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold", STATUS_CHIP_CLASS[status])}>
              {EXPENSE_STATUS_LABELS[status]}
            </span>
          </div>
          <p className="text-sm font-medium text-[#0f172a] dark:text-white">
            {expense.branchName}
            {" · "}
            {formatDate(expense.expenseDate)}
            {expense.vendorName ? ` · ${expense.vendorName}` : ""}
          </p>
        </div>
        <p className="text-sm font-medium text-[#0f172a] dark:text-white">
          สร้างเมื่อ {formatDateTime(expense.createdAt)}
          {expense.createdByName ? ` โดย ${expense.createdByName}` : ""}
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <GlassCard className={cn("p-5 shadow-none", PANEL)}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">ข้อมูลเอกสาร</h2>
            <Button
              type="button"
              size="sm"
              className={solidBlueButtonClass}
              icon={<History className="h-3.5 w-3.5" />}
              onClick={() => setHistoryOpen(true)}
            >
              ประวัติการดำเนินการ
            </Button>
          </div>
          <InfoRow label="สาขา" value={expense.branchName} />
          <InfoRow label="วันที่เอกสาร" value={formatDate(expense.expenseDate)} />
          <InfoRow label="วันที่ลงบัญชี" value={formatDate(expense.postingDate)} />
          <InfoRow label="ผู้ขาย" value={expense.vendorName} />
          <InfoRow label="พนักงาน" value={expense.employeeName} />
          <InfoRow label="สร้างโดย" value={expense.createdByName} />
          <InfoRow label="หมายเหตุ" value={expense.notes} />
          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-white/10">
            <h3 className="mb-2 text-sm font-semibold text-foreground">เอกสารที่เกี่ยวข้อง</h3>
            {relatedSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">บิลนี้บันทึกเอง ไม่มีเอกสารต้นทางจากโมดูลอื่น</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-white/10">
                {relatedSources.map((row) => (
                  <li key={row.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">{row.origin.kind}</div>
                      <div className="truncate text-muted-foreground tabular-nums">{row.documentNo ?? "—"}</div>
                    </div>
                    {row.href && (
                      <Link
                        href={row.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {row.type === "TRANSPORT_JOB" ? "เปิดใบงาน" : "เปิดเอกสาร"}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </GlassCard>

        <div className="min-w-0 space-y-4 lg:col-span-2">
        <GlassCard className={cn("p-5 shadow-none", PANEL)}>
          <h2 className="mb-4 text-sm font-semibold text-foreground">รายการค่าใช้จ่าย ({expense.lineCount} รายการ)</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <AppDataTable>
              <AppDataTableHead sticky={false}>
                <tr>
                  <th>ลำดับ</th>
                  <th>รายการ</th>
                  <th>หน่วยงาน / วัตถุต้นทุน</th>
                  <th className="text-right">จำนวน</th>
                  <th className="text-right">ราคา/หน่วย</th>
                  <th className="text-right">จำนวนเงิน</th>
                  <th>อ้างอิง</th>
                </tr>
              </AppDataTableHead>
              <AppDataTableBody>
                {expense.lines.map((l, index) => {
                  const origin = lineOrigin(l)
                  const href = sourceHref(l.sourceType, l.sourceDocumentId)
                  const code = sourceCode(l, origin)
                  const openLabel = l.sourceType === "TRANSPORT_JOB" ? "เปิดใบงาน" : "เปิดเอกสาร"
                  return (
                    <tr key={l.id}>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{l.expenseTypeName}</div>
                        {l.description && <div className="text-xs text-muted-foreground">{l.description}</div>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div>{l.costCenterName ?? "—"}</div>                        {l.costObjectLabel && (
                          <div className="text-xs">
                            {(l.costObjectType ? COST_OBJECT_TYPE_LABELS[l.costObjectType] ?? "" : "")}{" "}
                            {l.costObjectLabel}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {l.pricingMode === "QTY_PRICE" ? `${l.quantity}${l.unitCode ? ` ${l.unitCode}` : ""}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {l.pricingMode === "QTY_PRICE" ? formatBaht(l.unitPrice) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                        {formatBaht(l.netAmount)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {origin.kind === "บันทึกเอง" ? (
                          "บันทึกเอง"
                        ) : (
                          <div>
                            <div>{origin.kind}</div>
                            {code && <div className="max-w-[12rem] truncate text-xs tabular-nums">{code}</div>}
                            {href && (
                              <Link
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                              >
                                {openLabel}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </AppDataTableBody>
            </AppDataTable>
          </div>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{tFiles("title")}</h3>
                {canAttach && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className={cn(solidBlueButtonClass, "inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium")}>
                      <Camera className="h-3.5 w-3.5" />
                      {uploading ? tFiles("uploading") : tFiles("takePhoto")}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        className="sr-only"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          e.target.value = ""
                          if (file) void uploadAttachment(file)
                        }}
                      />
                    </label>
                    <label className={cn(solidBlueButtonClass, "inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium")}>
                      <Paperclip className="h-3.5 w-3.5" />
                      {uploading ? tFiles("uploading") : tFiles("attach")}
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
                        className="sr-only"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          e.target.value = ""
                          if (file) void uploadAttachment(file)
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
              {files.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Paperclip className="h-4 w-4" />
                  {tFiles("empty")}
                </p>
              ) : (
                <IncomeFileThumbs
                  removeLabel={tFiles("remove")}
                  removingKey={busy}
                  onRemove={canAttach ? (key) => void removeAttachment(key) : undefined}
                  items={files.map((file) => {
                    const name = file.fileName ?? tFiles("unnamed")
                    return {
                      key: file.id,
                      name,
                      href: file.fileUrl,
                      preview: !name.toLowerCase().endsWith(".pdf"),
                      removable: canAttach,
                    }
                  })}
                />
              )}
            </div>
            <div className="w-full shrink-0 space-y-1.5 text-sm sm:max-w-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>รวม</span>
                <span className="tabular-nums text-foreground">{formatBaht(expense.amount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>ส่วนลด</span>
                <span className="tabular-nums text-foreground">{formatBaht(expense.discountAmount)}</span>
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
        </div>
      </div>

      <GlassDialog open={historyOpen} onOpenChange={setHistoryOpen} title="ประวัติการดำเนินการ" solid>
        <ol className="space-y-4">
          {history.map((event, index) => (
            <li key={event.id} className="flex gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  index === history.length - 1
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                )}
              >
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-[#0f172a]">{event.title}</p>
                <p className="text-xs text-[#475569]">
                  {formatDateTime(event.at)}
                  {event.by ? ` · ${event.by}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </GlassDialog>

      <GlassDialog
        open={unpayOpen}
        onOpenChange={(open) => {
          setUnpayOpen(open)
          if (!open) setUnpayReason("")
        }}
        title="ยกเลิกการจ่าย"
      >
        <p className="whitespace-pre-line text-sm text-foreground">
          {`การยกเลิกการจ่ายจะเปลี่ยนสถานะกลับเป็น APPROVED
ยอดเงินยังไม่สามารถแก้ไขได้
หากต้องการแก้ยอด ต้องปฏิเสธรายการก่อน`}
        </p>
        <label className="mt-4 block space-y-1.5">
          <span className="text-sm font-medium text-foreground">
            เหตุผล<span className="ml-1 text-red-500">*</span>
          </span>
          <textarea
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            rows={3}
            maxLength={500}
            value={unpayReason}
            onChange={(e) => setUnpayReason(e.target.value)}
            placeholder="ระบุเหตุผลในการยกเลิกการจ่าย"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" size="sm" className={solidBlueButtonClass} onClick={() => setUnpayOpen(false)}>
            ยกเลิก
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={!unpayReasonOk}
            loading={busy === "unpay"}
            onClick={() => void submitUnpay()}
          >
            ยืนยันยกเลิกการจ่าย
          </Button>
        </div>
      </GlassDialog>
    </div>
  )
}
