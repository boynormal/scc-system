"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowLeft, Camera, Check, HandCoins, History, Paperclip, Pencil, Trash2, Undo2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { GlassCard, GlassDialog } from "@/components/glass"
import { AppDataTable, AppDataTableBody, AppDataTableHead } from "@/components/shell/app-data-table"
import { cn, formatDate, formatDateTime } from "@/lib/utils"
import type { FinancePerms } from "./expense-types"
import { formatBaht, solidBlueButtonClass, solidEmeraldButtonClass, solidRedButtonClass, solidYellowButtonClass } from "./finance-theme"
import { type IncomeAttachmentDto, type IncomeDto } from "./income-types"
import { IncomePrintButtons } from "./income-print-buttons"
import { IncomeFileThumbs } from "./income-file-thumbs"

const PANEL =
  "rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_24px_rgb(15_23_42/0.06)] dark:border-white/10 dark:bg-slate-900/50 dark:shadow-[0_12px_32px_rgb(0_0_0/0.35)]"

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-slate-100 py-2.5 text-sm last:border-0 dark:border-white/10">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value ?? "—"}</span>
    </div>
  )
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
  const [historyOpen, setHistoryOpen] = useState(false)

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

  function ActionCluster() {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <IncomePrintButtons id={income.id} size="sm" className={solidBlueButtonClass} />
        {(canEdit || canClassify) && (
          <Button
            type="button"
            size="sm"
            className={solidYellowButtonClass}
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
              size="sm"
              className={solidYellowButtonClass}
              icon={<X className="h-3.5 w-3.5" />}
              loading={busy === "reject"}
              onClick={() => void transition("reject")}
            >
              {t("reject")}
            </Button>
            <Button
              type="button"
              size="sm"
              className={solidEmeraldButtonClass}
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
            className={solidEmeraldButtonClass}
            icon={<HandCoins className="h-3.5 w-3.5" />}
            onClick={() => setReceiveOpen(true)}
          >
            {t("receive")}
          </Button>
        )}
        {canUnreceive && (
          <Button
            type="button"
            size="sm"
            className={solidYellowButtonClass}
            icon={<Undo2 className="h-3.5 w-3.5" />}
            onClick={() => setUnreceiveOpen(true)}
          >
            {t("unreceive")}
          </Button>
        )}
        {canDelete && (
          <Button
            type="button"
            size="sm"
            className={solidRedButtonClass}
            icon={<Trash2 className="h-3.5 w-3.5" />}
            onClick={() => setDeleteOpen(true)}
          >
            {t("delete")}
          </Button>
        )}
      </div>
    )
  }

  const statusChipClass: Record<IncomeDto["status"], string> = {
    DRAFT: "bg-[#eab308] text-[#1c1917]",
    PENDING: "bg-[#d97706] text-white",
    APPROVED: "bg-[#2563eb] text-white",
    RECEIVED: "bg-[#16a34a] text-white",
    REJECTED: "bg-[#dc2626] text-white",
    CANCELLED: "bg-[#64748b] text-white",
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
            onClick={() => router.push("/finance/incomes")}
          >
            {t("back")}
          </Button>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{income.incomeNo}</h1>
        </div>
        <ActionCluster />
      </div>
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-slate-300 bg-[#ffffff] px-4 py-2.5 dark:border-white/15 dark:bg-[#0f172a]">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-[#0f172a] dark:text-white">{t("status")}</span>
            <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold", statusChipClass[status])}>
              {t(`statuses.${status}`)}
            </span>
          </div>
          <p className="text-sm font-medium text-[#0f172a] dark:text-white">
            {income.branchName}
            {" · "}
            {formatDate(income.incomeDate)}
            {income.payerName ? ` · ${income.payerName}` : ""}
          </p>
        </div>
        <p className="text-sm font-medium text-[#0f172a] dark:text-white">
          {income.createdByName
            ? t("createdAtByName", { at: formatDateTime(income.createdAt), name: income.createdByName })
            : t("createdAtBy", { at: formatDateTime(income.createdAt) })}
        </p>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="space-y-4">
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <GlassCard className={cn("p-5 shadow-none", PANEL)}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">{t("docInfo")}</h2>
              <Button
                type="button"
                size="sm"
                className={solidBlueButtonClass}
                icon={<History className="h-3.5 w-3.5" />}
                onClick={() => setHistoryOpen(true)}
              >
                {t("history")}
              </Button>
            </div>
            <InfoRow label={t("branch")} value={income.branchName} />
            <InfoRow label={t("incomeDate")} value={formatDate(income.incomeDate)} />
            <InfoRow label={t("postingDate")} value={formatDate(income.postingDate)} />
            <InfoRow label={t("payer")} value={income.payerName} />
            <InfoRow label={t("employee")} value={income.employeeName} />
            <InfoRow
              label={t("paymentMethod")}
              value={income.paymentMethod ? t(`paymentMethods.${income.paymentMethod}`) : null}
            />
            <InfoRow label={t("taxMode")} value={t(`taxModes.${income.taxMode}`)} />
            {income.receivedAt && <InfoRow label={t("receivedAt")} value={formatDate(income.receivedAt)} />}
            <InfoRow label={t("createdBy")} value={income.createdByName} />
            <InfoRow label={t("notes")} value={income.notes} />
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-white/10">
              <h3 className="mb-2 text-sm font-semibold text-foreground">{t("tabRelated")}</h3>
              <p className="text-sm text-muted-foreground">{t("relatedEmpty")}</p>
            </div>
          </GlassCard>

          <div className="min-w-0 space-y-4 lg:col-span-2">
          <GlassCard className={cn("p-5 shadow-none", PANEL)}>
            <h2 className="mb-4 text-sm font-semibold text-foreground">{t("linesTitle", { count: income.lineCount })}</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <AppDataTable>
                <AppDataTableHead sticky={false}>
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
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{l.lineNo}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{l.incomeTypeName}</div>
                        {l.description && <div className="text-xs text-muted-foreground">{l.description}</div>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div>{l.costCenterName ?? "—"}</div>
                        {l.processName && <div className="text-xs">{l.processName}</div>}
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
                    </tr>
                  ))}
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
                            if (file) void upload(file)
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
                            if (file) void upload(file)
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
                    onRemove={canAttach ? (key) => void removeFile(key) : undefined}
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
                  <span>{t("subtotal")}</span>
                  <span className="tabular-nums text-foreground">{formatBaht(income.amount)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("discount")}</span>
                  <span className="tabular-nums text-foreground">{formatBaht(income.discountAmount)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("vatLabel")}</span>
                  <span className="tabular-nums text-foreground">{formatBaht(income.taxAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold dark:border-white/10">
                  <span>{t("netAmount")}</span>
                  <span className="tabular-nums text-emerald-600 dark:text-emerald-300">{formatBaht(income.netAmount)}</span>
                </div>
              </div>
            </div>
          </GlassCard>
          </div>
        </div>
      </div>

      <GlassDialog open={historyOpen} onOpenChange={setHistoryOpen} title={t("history")} solid>
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
            <Button type="button" size="sm" className={solidBlueButtonClass} onClick={() => setReceiveOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              className={solidEmeraldButtonClass}
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
            <Button type="button" size="sm" className={solidBlueButtonClass} onClick={() => setUnreceiveOpen(false)}>
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
            <Button type="button" size="sm" className={solidBlueButtonClass} onClick={() => setDeleteOpen(false)}>
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
