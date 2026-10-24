"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowLeft, Check, HandCoins, Paperclip, Pencil, Trash2, Undo2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { GlassDialog } from "@/components/glass"
import { DataPanel } from "@/components/shell/data-panel"
import { AppDataTable, AppDataTableBody, AppDataTableHead } from "@/components/shell/app-data-table"
import { formatDate, formatDateTime } from "@/lib/utils"
import type { FinancePerms } from "./expense-types"
import { formatBaht } from "./finance-theme"
import { INCOME_STATUS_BADGE, type IncomeAttachmentDto, type IncomeDto } from "./income-types"
import { IncomePrintButtons } from "./income-print-buttons"

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border py-2 text-sm last:border-0">
      <span className="shrink-0 text-foreground/80">{label}</span>
      <span className="text-right font-medium text-foreground">{value ?? "—"}</span>
    </div>
  )
}

function formatFileSize(size: number | null): string {
  if (size == null) return ""
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function apiError(json: { error?: unknown; code?: string }, status: number, fallback: string, denied: string, unavailable: string) {
  if (status === 403) return denied
  if (json.code === "STORAGE_UNAVAILABLE") return unavailable
  if (typeof json.error === "string" && json.error.trim()) return json.error
  if (json.error && typeof json.error === "object" && "message" in json.error) {
    const m = (json.error as { message?: unknown }).message
    if (typeof m === "string" && m.trim()) return m
  }
  return fallback
}

function todayYmdBangkok() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })
}

export function IncomeDetailView({ income, perms }: { income: IncomeDto; perms: FinancePerms }) {
  const t = useTranslations("financeIncome")
  const tFiles = useTranslations("expenseFiles")
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<IncomeAttachmentDto[]>(income.attachments)
  const [uploading, setUploading] = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receivedAt, setReceivedAt] = useState(todayYmdBangkok())
  const [paymentMethod, setPaymentMethod] = useState<string>(income.paymentMethod ?? "cash")
  const [unreceiveOpen, setUnreceiveOpen] = useState(false)
  const [unreceiveReason, setUnreceiveReason] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)

  const status = income.status
  const canEdit = perms.canUpdate && ["DRAFT", "PENDING", "REJECTED"].includes(status)
  const canClassify = perms.canUpdate && status === "RECEIVED"
  const canApprove = perms.canApprove && ["DRAFT", "PENDING"].includes(status)
  const canReceive = perms.canUpdate && status === "APPROVED"
  const canUnreceive = perms.canUpdate && status === "RECEIVED"
  const canDelete = perms.canDelete && !["RECEIVED", "CANCELLED"].includes(status)
  const canAttach = perms.canUpdate && status !== "CANCELLED"

  const history = useMemo(() => {
    const events: { id: string; title: string; at: string; by: string | null }[] = [
      { id: "created", title: t("historyCreated"), at: income.createdAt, by: income.createdByName },
    ]
    if (income.approvedAt) {
      events.push({
        id: "approved",
        title: status === "REJECTED" ? t("historyRejected") : t("historyApproved"),
        at: income.approvedAt,
        by: income.approvedByName,
      })
    }
    if (income.receivedAt) {
      events.push({ id: "received", title: t("historyReceived"), at: income.receivedAt, by: income.receivedByName })
    }
    return events
  }, [income, status, t])

  async function call(key: string, url: string, method: string, body?: unknown) {
    setBusy(key)
    setError(null)
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(apiError(json, res.status, t("actionFailed"), t("denied"), t("actionFailed")))
        return false
      }
      return true
    } catch {
      setError(t("actionFailed"))
      return false
    } finally {
      setBusy(null)
    }
  }

  async function transition(action: "approve" | "reject") {
    if (await call(action, `/api/finance/incomes/${income.id}/${action}`, "POST", {})) router.refresh()
  }

  async function submitReceive() {
    const ok = await call("receive", `/api/finance/incomes/${income.id}/receive`, "POST", {
      paymentMethod: paymentMethod || null,
      receivedAt: receivedAt || null,
    })
    if (ok) {
      setReceiveOpen(false)
      router.refresh()
    }
  }

  async function submitUnreceive() {
    const reason = unreceiveReason.trim()
    if (!reason) return
    const ok = await call("unreceive", `/api/finance/incomes/${income.id}/unreceive`, "POST", { reason })
    if (ok) {
      setUnreceiveOpen(false)
      setUnreceiveReason("")
      router.refresh()
    }
  }

  async function submitDelete() {
    if (await call("delete", `/api/finance/incomes/${income.id}`, "DELETE")) {
      router.push("/finance/incomes")
      router.refresh()
    }
  }

  async function upload(file: File) {
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(`/api/finance/incomes/${income.id}/files`, { method: "POST", body: form })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(apiError(json, res.status, tFiles("uploadFailed"), tFiles("denied"), tFiles("unavailable")))
        return
      }
      setFiles((prev) => [...prev, json.data as IncomeAttachmentDto])
    } catch {
      setError(tFiles("uploadFailed"))
    } finally {
      setUploading(false)
    }
  }

  async function removeFile(attachmentId: string) {
    setBusy(attachmentId)
    setError(null)
    try {
      const res = await fetch(`/api/finance/incomes/${income.id}/attachments/${attachmentId}`, { method: "DELETE" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(apiError(json, res.status, tFiles("deleteFailed"), tFiles("denied"), tFiles("unavailable")))
        return
      }
      setFiles((prev) => prev.filter((f) => f.id !== attachmentId))
    } catch {
      setError(tFiles("deleteFailed"))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-w-0 space-y-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => router.push("/finance/incomes")}
          >
            {t("back")}
          </Button>
          <h1 className="text-lg font-semibold text-foreground">{income.incomeNo}</h1>
          <Badge variant={INCOME_STATUS_BADGE[status]}>{t(`statuses.${status}`)}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IncomePrintButtons id={income.id} size="sm" />
          {(canEdit || canClassify) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Pencil className="h-3.5 w-3.5" />}
              onClick={() => router.push(`/finance/incomes/${income.id}/edit`)}
            >
              {canClassify ? t("editReceived") : t("edit")}
            </Button>
          )}
          {canApprove && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<X className="h-3.5 w-3.5" />}
                loading={busy === "reject"}
                onClick={() => void transition("reject")}
              >
                {t("reject")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                icon={<Check className="h-3.5 w-3.5" />}
                loading={busy === "approve"}
                onClick={() => void transition("approve")}
              >
                {t("approve")}
              </Button>
            </>
          )}
          {canReceive && (
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              icon={<HandCoins className="h-3.5 w-3.5" />}
              onClick={() => setReceiveOpen(true)}
            >
              {t("receive")}
            </Button>
          )}
          {canUnreceive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Undo2 className="h-3.5 w-3.5" />}
              onClick={() => setUnreceiveOpen(true)}
            >
              {t("unreceive")}
            </Button>
          )}
          {canDelete && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-red-600 dark:text-red-400"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => setDeleteOpen(true)}
            >
              {t("delete")}
            </Button>
          )}
        </div>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <DataPanel padding="md">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <p className="text-xs text-foreground/80">{t("netAmount")}</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
              {formatBaht(income.netAmount)}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2 text-sm text-foreground">
            <div>
              <p className="text-xs text-foreground/80">{t("amount")}</p>
              <p className="font-medium tabular-nums">{formatBaht(income.amount)}</p>
            </div>
            <div>
              <p className="text-xs text-foreground/80">{t("discount")}</p>
              <p className="font-medium tabular-nums">{formatBaht(income.discountAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-foreground/80">{t("vatLabel")}</p>
              <p className="font-medium tabular-nums">{formatBaht(income.taxAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-foreground/80">{t("taxMode")}</p>
              <p className="font-medium">{t(`taxModes.${income.taxMode}`)}</p>
            </div>
          </div>
        </div>
      </DataPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataPanel padding="md">
          <h2 className="mb-2 text-sm font-semibold text-foreground">{t("docInfo")}</h2>
          <InfoRow label={t("branch")} value={income.branchName} />
          <InfoRow label={t("payer")} value={income.payerName} />
          <InfoRow label={t("incomeDate")} value={formatDate(income.incomeDate)} />
          <InfoRow label={t("postingDate")} value={formatDate(income.postingDate)} />
          <InfoRow label={t("employee")} value={income.employeeName} />
          <InfoRow
            label={t("paymentMethod")}
            value={income.paymentMethod ? t(`paymentMethods.${income.paymentMethod}`) : null}
          />
          {income.receivedAt && <InfoRow label={t("receivedAt")} value={formatDate(income.receivedAt)} />}
          {income.notes && <InfoRow label={t("notes")} value={income.notes} />}
        </DataPanel>

        <DataPanel padding="md">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">{tFiles("title")}</h2>
            {canAttach && (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
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
                    if (file) void upload(file)
                  }}
                />
              </label>
            )}
          </div>
          {files.length === 0 ? (
            <p className="text-sm text-foreground/80">{tFiles("empty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {files.map((file) => (
                <li key={file.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{file.fileName ?? tFiles("unnamed")}</span>
                    {file.fileSize != null && (
                      <span className="text-xs text-foreground/80">{formatFileSize(file.fileSize)}</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <a href={file.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                      {tFiles("open")}
                    </a>
                    {canAttach && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                        disabled={busy === file.id}
                        onClick={() => void removeFile(file.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {busy === file.id ? tFiles("removing") : tFiles("remove")}
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DataPanel>
      </div>

      <DataPanel>
        <h2 className="px-4 py-3 text-sm font-semibold text-foreground">{t("linesTitle", { count: income.lineCount })}</h2>
        <AppDataTable>
          <AppDataTableHead>
            <tr>
              <th>#</th>
              <th>{t("type")}</th>
              <th>{t("costCenter")} / {t("process")}</th>
              <th className="text-right">{t("quantity")}</th>
              <th className="text-right">{t("unitPrice")}</th>
              <th className="text-right">{t("netAmount")}</th>
            </tr>
          </AppDataTableHead>
          <AppDataTableBody>
            {income.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2.5 tabular-nums">{l.lineNo}</td>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{l.incomeTypeName}</div>
                  {l.description && <div className="text-xs">{l.description}</div>}
                </td>
                <td className="px-4 py-2.5">
                  <div>{l.costCenterName ?? "—"}</div>
                  {l.processName && <div className="text-xs">{l.processName}</div>}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {l.pricingMode === "QTY_PRICE" ? `${l.quantity}${l.unitCode ? ` ${l.unitCode}` : ""}` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {l.pricingMode === "QTY_PRICE" ? formatBaht(l.unitPrice) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatBaht(l.netAmount)}</td>
              </tr>
            ))}
          </AppDataTableBody>
        </AppDataTable>
      </DataPanel>

      <DataPanel padding="md">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t("history")}</h2>
        <ol className="space-y-3">
          {history.map((event, index) => (
            <li key={event.id} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{event.title}</p>
                <p className="text-xs text-foreground/80">
                  {formatDateTime(event.at)}
                  {event.by ? ` · ${event.by}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </DataPanel>

      <GlassDialog open={receiveOpen} onOpenChange={setReceiveOpen} title={t("receiveTitle")} solid>
        <div className="space-y-3 text-[#0f172a]">
          <p className="text-sm">{t("receiveHint")}</p>
          <Input label={t("receivedAt")} type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
          <Select
            label={t("paymentMethod")}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            options={[
              { value: "cash", label: t("paymentMethods.cash") },
              { value: "credit", label: t("paymentMethods.credit") },
            ]}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setReceiveOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              loading={busy === "receive"}
              onClick={() => void submitReceive()}
            >
              {t("confirmReceive")}
            </Button>
          </div>
        </div>
      </GlassDialog>

      <GlassDialog
        open={unreceiveOpen}
        onOpenChange={(o) => {
          setUnreceiveOpen(o)
          if (!o) setUnreceiveReason("")
        }}
        title={t("unreceiveTitle")}
        solid
      >
        <div className="space-y-3 text-[#0f172a]">
          <p className="text-sm">{t("unreceiveHint")}</p>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">
              {t("reason")}
              <span className="ml-1 text-red-500">*</span>
            </span>
            <textarea
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              rows={3}
              maxLength={500}
              value={unreceiveReason}
              onChange={(e) => setUnreceiveReason(e.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setUnreceiveOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={!unreceiveReason.trim()}
              loading={busy === "unreceive"}
              onClick={() => void submitUnreceive()}
            >
              {t("confirmUnreceive")}
            </Button>
          </div>
        </div>
      </GlassDialog>

      <GlassDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={t("deleteTitle")} solid>
        <div className="space-y-3 text-[#0f172a]">
          <p className="text-sm">{t("deleteHint", { no: income.incomeNo })}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" variant="danger" size="sm" loading={busy === "delete"} onClick={() => void submitDelete()}>
              {t("delete")}
            </Button>
          </div>
        </div>
      </GlassDialog>
    </div>
  )
}
