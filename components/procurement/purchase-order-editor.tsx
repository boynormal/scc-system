"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  ClipboardList,
  Info,
  Save,
  Trash2,
  Undo2,
  X,
  Wallet,
} from "lucide-react"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"
import { cn } from "@/lib/utils"
import { DataPanel } from "@/components/shell/data-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import { MAX_PURCHASE_ATTACHMENTS, type PurchaseOrderStatusValue } from "@/modules/procurement/application/po-rules"
import { ConfirmDialog } from "./po-confirm-dialog"
import { PoLineEntry, poLineCol } from "./po-line-entry"
import { PoPhotos } from "./po-photos"
import {
  PO_FINANCE_BADGE,
  fmtDate,
  fmtMoney,
  fmtQty,
  isOverdue,
  todayIso,
  type PoAttachment,
  type PoLine,
  type PoOptions,
  type PurchaseOrder,
} from "./po-client"
import { PoStatusBadges } from "./purchase-order-list"
import { TouchPicker, touchInputClass } from "./touch-controls"

export type PoPermissions = { canCreate: boolean; canUpdate: boolean; canDelete: boolean; canSeeExpense: boolean }

type Header = {
  branchId: string
  supplierId: string
  orderDate: string
  neededDate: string
  requesterId: string
  notes: string
}

type Dialog = null | "order" | "receive" | "cancel" | "delete"
function headerFrom(po: PurchaseOrder | null): Header {
  return {
    branchId: po?.branchId ?? "",
    supplierId: po?.supplierId ?? "",
    orderDate: po?.orderDate ?? todayIso(),
    neededDate: po?.neededDate ?? "",
    requesterId: po?.requesterId ?? "",
    notes: po?.notes ?? "",
  }
}

function errorText(err: unknown, fallback: string): string {
  if (err instanceof ClientFetchError || err instanceof Error) return err.message || fallback
  return fallback
}

const STEPS: PurchaseOrderStatusValue[] = ["DRAFT", "ORDERED", "RECEIVED"]

export function PurchaseOrderEditor({ initial, perms }: { initial: PurchaseOrder | null; perms: PoPermissions }) {
  const t = useTranslations("procurement")
  const tc = useTranslations("common")
  const router = useRouter()

  const [po, setPo] = useState<PurchaseOrder | null>(initial)
  const [header, setHeader] = useState<Header>(() => headerFrom(initial))
  const [lines, setLines] = useState<PoLine[]>(() => initial?.lines ?? [])
  const [attachments, setAttachments] = useState<PoAttachment[]>(() => initial?.attachments ?? [])
  const [dirty, setDirty] = useState(false)
  const [options, setOptions] = useState<PoOptions | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ branchId?: string }>({})
  const [dialog, setDialog] = useState<Dialog>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [addKey, setAddKey] = useState(0)

  const status: PurchaseOrderStatusValue = po?.status ?? "DRAFT"
  const isNew = po === null
  const editable = status === "DRAFT" && (isNew ? perms.canCreate : perms.canUpdate)
  const canAct = !isNew && perms.canUpdate
  const canChangePhotos =
    (isNew && perms.canCreate) || (canAct && (status === "DRAFT" || status === "ORDERED"))
  const createFlight = useRef<Promise<PurchaseOrder | null> | null>(null)
  const total = useMemo(() => Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100, [lines])
  const editingLine = editIndex !== null ? (lines[editIndex] ?? null) : null

  const loadOptions = useCallback(async () => {
    setOptionsError(null)
    try {
      const res = await fetchJson<{ data: PoOptions }>("/api/procurement/options")
      setOptions(res.data)
      if (isNew) {
        setHeader((h) => ({
          ...h,
          branchId: h.branchId || (res.data.createBranchIds.length === 1 ? res.data.createBranchIds[0] : ""),
          requesterId: h.requesterId || res.data.currentUserId,
        }))
      }
    } catch (err) {
      setOptionsError(errorText(err, t("loadError")))
    }
  }, [isNew, t])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  function apply(next: PurchaseOrder) {
    setPo(next)
    setHeader(headerFrom(next))
    setLines(next.lines)
    setAttachments(next.attachments)
    setDirty(false)
    setEditIndex(null)
    setAddKey((k) => k + 1)
  }

  async function reload(id: string) {
    const res = await fetchJson<{ data: PurchaseOrder }>(`/api/procurement/purchase-orders/${id}`)
    apply(res.data)
    return res.data
  }

  function editHeader<K extends keyof Header>(key: K, value: Header[K]) {
    setHeader((h) => ({ ...h, [key]: value }))
    setFieldErrors((e) => ({ ...e, [key]: undefined }))
    setDirty(true)
    setNotice(null)
  }

  function saveLine(line: PoLine) {
    const index = editIndex
    setLines((ls) => (index === null ? [...ls, line] : ls.map((l, i) => (i === index ? line : l))))
    setDirty(true)
    setNotice(null)
    setEditIndex(null)
    setAddKey((k) => k + 1)
  }

  function removeLine() {
    if (editIndex === null) return
    const index = editIndex
    setLines((ls) => ls.filter((_, i) => i !== index))
    setDirty(true)
    setEditIndex(null)
    setAddKey((k) => k + 1)
  }

  function validate(): boolean {
    const next: typeof fieldErrors = {}
    if (!header.branchId) next.branchId = t("required")
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  function payload() {
    return {
      branchId: header.branchId,
      supplierId: header.supplierId || null,
      orderDate: header.orderDate,
      neededDate: header.neededDate || null,
      requesterId: header.requesterId || undefined,
      notes: header.notes.trim() || null,
      lines: lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitId: l.unitId,
        unitPrice: l.unitPrice,
        costObjectType: null,
        costObjectLabel: null,
      })),
    }
  }

  /** Creates the draft once. Later callers share the same request so a photo and Save cannot open two orders. */
  async function createDraft(): Promise<PurchaseOrder | null> {
    if (po) return po
    if (!validate()) return null
    if (!createFlight.current) {
      const flight = (async () => {
        const res = await fetchJson<{ data: PurchaseOrder }>("/api/procurement/purchase-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload()),
        })
        return res.data
      })()
      createFlight.current = flight
      void flight.finally(() => {
        if (createFlight.current === flight) createFlight.current = null
      })
    }
    const created = await createFlight.current
    if (!created) return null
    setPo(created)
    setDirty(false)
    return created
  }

  /** Saves the draft when needed and returns the order id, or null when validation failed. */
  async function persist(): Promise<string | null> {
    if (!validate()) return null
    if (isNew) {
      const created = await createDraft()
      return created?.id ?? null
    }
    if (dirty && editable) {
      await fetchJson(`/api/procurement/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      })
    }
    return po.id
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (err) {
      setError(errorText(err, t("saveError")))
    } finally {
      setBusy(false)
    }
  }

  const saveDraft = () =>
    run(async () => {
      const openedAsNew = window.location.pathname.endsWith("/procurement/new")
      const id = await persist()
      if (!id) return
      if (openedAsNew) {
        router.replace(`/procurement/${id}`)
        return
      }
      const next = await reload(id)
      setNotice(t("savedNo", { poNo: next.poNo }))
    })

  const transition = (to: PurchaseOrderStatusValue, reason?: string) =>
    run(async () => {
      const id = await persist()
      if (!id) return
      await fetchJson(`/api/procurement/purchase-orders/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, reason: reason ?? null }),
      })
      setDialog(null)
      setCancelReason("")
      if (window.location.pathname.endsWith("/procurement/new")) {
        router.replace(`/procurement/${id}`)
        return
      }
      await reload(id)
    })

  const removeDraft = () =>
    run(async () => {
      if (!po) return
      await fetchJson(`/api/procurement/purchase-orders/${po.id}`, { method: "DELETE" })
      setDirty(false)
      router.push("/procurement")
    })

  function startReceive() {
    setError(null)
    setDialog("receive")
  }

  if (!options && !optionsError) return <LoadingState title={tc("loading")} />
  if (!options) {
    return <ErrorState title={t("loadError")} description={optionsError ?? undefined} onRetry={() => void loadOptions()} retryLabel={tc("retry")} />
  }

  const branchOptions = options.branches
    .filter((b) => !editable || options.createBranchIds.includes(b.id) || b.id === header.branchId)
    .map((b) => ({ value: b.id, label: b.name }))
  if (po && !branchOptions.some((b) => b.value === po.branchId)) {
    branchOptions.push({ value: po.branchId, label: po.branchName })
  }
  const supplierOptions = [
    { value: "", label: t("supplierUnset") },
    ...options.suppliers.map((s) => ({ value: s.id, label: s.name, hint: s.code })),
  ]
  if (po?.supplierId && !supplierOptions.some((s) => s.value === po.supplierId)) {
    supplierOptions.push({ value: po.supplierId, label: po.supplierName ?? po.supplierId, hint: po.supplierCode })
  }
  const userOptions = options.users.map((u) => ({ value: u.id, label: u.name }))
  if (po && po.requesterName && !userOptions.some((u) => u.value === po.requesterId)) {
    userOptions.push({ value: po.requesterId, label: po.requesterName })
  }

  const labelClass = "block text-base font-medium text-foreground"
  const sectionTitle = "flex items-center gap-2 text-lg font-semibold text-foreground"

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          href="/procurement"
          aria-label={t("listTitle")}
          title={t("listTitle")}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{po ? po.poNo : t("newTitle")}</h1>
          {po && (status === "CANCELLED" || isOverdue(po)) ? <PoStatusBadges po={po} /> : null}
          {po && (po.createdByName || po.orderedAt || po.receivedAt) ? (
            <p className="truncate text-sm text-muted-foreground">
              {[
                po.createdByName ? t("createdBy", { name: po.createdByName }) : null,
                po.orderedAt ? t("orderedAt", { date: fmtDate(po.orderedAt) }) : null,
                po.receivedAt ? t("receivedAt", { date: fmtDate(po.receivedAt) }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
        {status === "CANCELLED" ? null : <Stepper status={status} po={po} />}
        {po && canAct && (status === "DRAFT" || status === "ORDERED") ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setError(null)
              setDialog("cancel")
            }}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-4 text-sm font-semibold text-red-700 ring-1 ring-inset ring-red-200 transition hover:bg-red-100 hover:ring-red-300 active:scale-95 disabled:pointer-events-none disabled:opacity-50 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800 dark:hover:bg-red-950/70"
          >
            <Ban className="h-4 w-4" />
            {t("cancelOrder")}
          </button>
        ) : null}
      </div>

      {status === "CANCELLED" ? (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <p className="text-base font-semibold">{t("cancelledBanner")}</p>
          {po?.cancelReason ? <p className="text-base">{t("cancelledReason", { reason: po.cancelReason })}</p> : null}
        </div>
      ) : null}

      <div className="grid gap-3 lg:h-[calc(100dvh-10.5rem)] lg:min-h-[34rem] lg:grid-cols-[28rem_minmax(0,1fr)]">
        <DataPanel className="order-2 flex min-h-0 min-w-0 flex-col lg:order-1">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3 sm:p-4">
            <section className="space-y-4">
              <h2 className={sectionTitle}>
                <Info className="h-5 w-5" />
                {t("tabInfo")}
              </h2>
              <div className="grid grid-cols-2 items-start gap-4">
                <ThaiDateField
                  label={
                    <>
                      {t("fieldOrderDate")}
                      <span className="ml-1 text-red-500">*</span>
                    </>
                  }
                  labelClass={labelClass}
                  value={header.orderDate}
                  onChange={(v) => editHeader("orderDate", v)}
                  disabled={!editable}
                />
                <TouchPicker
                  label={t("fieldBranch")}
                  required
                  value={header.branchId}
                  options={branchOptions}
                  onChange={(v) => editHeader("branchId", v)}
                  placeholder={t("pickBranch")}
                  searchPlaceholder={t("pickerSearch")}
                  emptyText={t("pickerEmpty")}
                  disabled={!editable}
                  error={fieldErrors.branchId}
                />
              </div>
              <div className="grid grid-cols-2 items-start gap-4">
                <TouchPicker
                  label={t("fieldSupplier")}
                  value={header.supplierId}
                  options={supplierOptions}
                  onChange={(v) => editHeader("supplierId", v)}
                  placeholder={t("pickSupplier")}
                  searchPlaceholder={t("pickerSearch")}
                  emptyText={t("pickerEmpty")}
                  disabled={!editable}
                />
                <ThaiDateField
                  label={t("fieldNeededDate")}
                  labelClass={labelClass}
                  value={header.neededDate}
                  min={header.orderDate}
                  onChange={(v) => editHeader("neededDate", v)}
                  disabled={!editable}
                  placeholder={t("pickDate")}
                />
              </div>
              <TouchPicker
                label={t("fieldRequester")}
                value={header.requesterId}
                options={userOptions}
                onChange={(v) => editHeader("requesterId", v)}
                placeholder={t("pickRequester")}
                searchPlaceholder={t("pickerSearch")}
                emptyText={t("pickerEmpty")}
                disabled={!editable}
              />
              <label className="block space-y-1.5">
                <span className={labelClass}>{t("fieldNotes")}</span>
                <textarea
                  value={header.notes}
                  onChange={(e) => editHeader("notes", e.target.value)}
                  disabled={!editable}
                  placeholder={t("notesPlaceholder")}
                  rows={3}
                  maxLength={4000}
                  className={cn(touchInputClass, "h-auto min-h-12 py-2.5")}
                />
              </label>
            </section>

            <section className="space-y-3 border-t border-border pt-4">
              <h2 className={sectionTitle}>
                <Camera className="h-5 w-5" />
                {t("sectionPhotos")}
                <span className="rounded-full bg-muted px-2 text-sm tabular-nums text-foreground">
                  {t("photosCount", { count: attachments.length, max: MAX_PURCHASE_ATTACHMENTS })}
                </span>
              </h2>
              <PoPhotos
                poId={po?.id ?? null}
                attachments={attachments}
                canChange={canChangePhotos}
                onChange={setAttachments}
                ensurePoId={po ? undefined : () => createDraft().then((created) => created?.id ?? null)}
                onDraftReady={(id) => router.replace(`/procurement/${id}`)}
              />
            </section>

            {po && editable && perms.canDelete ? (
              <div className="flex justify-center border-t border-border pt-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setError(null)
                    setDialog("delete")
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("deleteDraft")}
                </button>
              </div>
            ) : null}
          </div>
        </DataPanel>

        <DataPanel className="order-1 flex min-h-0 min-w-0 flex-col overflow-visible lg:order-2 lg:overflow-hidden">
          <div className="flex shrink-0 items-center justify-between gap-2 bg-muted/60 px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-base font-semibold text-foreground">
              <ClipboardList className="h-5 w-5 shrink-0" />
              {t("sectionLines")}
              <span
                className="rounded-full bg-background px-2 text-sm tabular-nums text-foreground ring-1 ring-inset ring-border"
                aria-label={t("itemsCount", { count: lines.length })}
              >
                {lines.length}
              </span>
            </span>
            {editIndex !== null ? (
              <span className="flex shrink-0 items-center gap-2">
                <span className="hidden text-sm font-semibold text-amber-800 dark:text-amber-200 sm:inline">
                  {t("editingLineNo", { no: editIndex + 1 })}
                </span>
                <button
                  type="button"
                  onClick={() => setEditIndex(null)}
                  className="inline-flex h-10 items-center gap-1 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                  {t("cancelEdit")}
                </button>
                <button
                  type="button"
                  onClick={removeLine}
                  className="inline-flex h-10 items-center gap-1 rounded-xl border border-red-300 bg-background px-3 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("removeLine")}
                </button>
              </span>
            ) : null}
          </div>

          {status === "ORDERED" ? (
            <p className="mx-3 mt-3 rounded-xl bg-muted px-3 py-2 text-sm text-foreground">{t("orderedEditHint")}</p>
          ) : null}
          <div className="shrink-0 border-b border-border bg-muted/70 px-3 py-2">
            <div className="flex w-full min-w-0 items-end gap-2 text-base font-semibold leading-tight text-foreground">
              <span className={poLineCol.name}>{t("lineDescription")}</span>
              <span className={poLineCol.qty}>{t("lineQuantity")}</span>
              <span className={poLineCol.unit}>{t("lineUnit")}</span>
              <span className={poLineCol.price} title={t("lineUnitPrice")}>{t("linePrice")}</span>
              <span className={cn(poLineCol.total, "text-right")}>{t("lineTotal")}</span>
            </div>
          </div>
          {editable ? (
            <div
              className={cn(
                "shrink-0 border-b border-border px-3 py-2",
                editIndex !== null ? "bg-amber-50 dark:bg-amber-950/30" : "bg-blue-50/60 dark:bg-blue-950/20"
              )}
            >
              <PoLineEntry
                key={editIndex === null ? addKey : `edit-${editIndex}`}
                line={editingLine}
                lineNo={editIndex === null ? null : editIndex + 1}
                units={options.units}
                autoFocus={addKey > 0 || editIndex !== null}
                onSave={saveLine}
              />
            </div>
          ) : null}

          <div className="min-h-[8rem] flex-1 overflow-y-auto">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-foreground">
                <ClipboardList className="h-10 w-10 text-muted-foreground/60" aria-hidden />
                <p className="text-base">{editable ? t("ticketEmpty") : t("ticketEmptyReadOnly")}</p>
              </div>
            ) : (
              <ul>
                {lines.map((line, index) => (
                  <li key={line.id ?? `new-${index}`} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => setEditIndex(index)}
                      className={cn(
                        "flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left text-base text-foreground enabled:hover:bg-muted disabled:cursor-default",
                        editIndex === index && "bg-amber-50 dark:bg-amber-950/30"
                      )}
                    >
                      <span className={cn(poLineCol.name, "truncate font-medium")}>{line.description}</span>
                      <span className={poLineCol.qty}>{fmtQty(line.quantity)}</span>
                      <span className={poLineCol.unit}>{line.unitCode || "—"}</span>
                      <span className={poLineCol.price}>{fmtMoney(line.unitPrice)}</span>
                      <span className={cn(poLineCol.total, "font-semibold")}>{fmtMoney(line.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="sticky bottom-0 z-20 shrink-0 space-y-2 rounded-b-xl border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(15_23_42/0.10)] backdrop-blur lg:static lg:shadow-none">
            <div className="flex items-end justify-between gap-2">
              <span className="text-base font-medium text-foreground">{t("estimatedTotal")}</span>
              <span className="text-3xl font-bold tabular-nums text-foreground">
                {fmtMoney(total)} <span className="text-base font-normal">{t("baht")}</span>
              </span>
            </div>
            {po && status === "RECEIVED" ? <FinanceStrip po={po} canSeeExpense={perms.canSeeExpense} /> : null}
            {error ? (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-base text-red-700 dark:bg-red-950/50 dark:text-red-200">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p role="status" className="rounded-xl bg-green-50 px-3 py-2 text-base text-green-800 dark:bg-green-950/50 dark:text-green-200">
                {notice}
              </p>
            ) : null}
            {renderActions()}
          </div>
        </DataPanel>
      </div>

      <ConfirmDialog
        open={dialog === "order"}
        title={t("confirmOrder")}
        message={t("orderConfirm")}
        confirmLabel={t("confirmOrder")}
        cancelLabel={tc("cancel")}
        busy={busy}
        error={dialog === "order" ? error : null}
        onConfirm={() => void transition("ORDERED")}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "receive"}
        title={t("receiveTitle")}
        message={t("receiveConfirm")}
        confirmLabel={t("confirmReceive")}
        cancelLabel={tc("cancel")}
        busy={busy}
        error={dialog === "receive" ? error : null}
        onConfirm={() => void transition("RECEIVED")}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "cancel"}
        title={t("cancelTitle")}
        confirmLabel={t("confirmCancel")}
        cancelLabel={t("keepOrder")}
        danger
        busy={busy}
        error={dialog === "cancel" ? error : null}
        confirmDisabled={!cancelReason.trim()}
        onConfirm={() => void transition("CANCELLED", cancelReason.trim())}
        onCancel={() => setDialog(null)}
      >
        <label className="block space-y-1.5">
          <span className={labelClass}>
            {t("cancelReason")}
            <span className="ml-1 text-red-500">*</span>
          </span>
          <textarea
            autoFocus
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t("cancelReasonPlaceholder")}
            rows={3}
            maxLength={500}
            className={cn(touchInputClass, "h-auto py-2.5")}
          />
        </label>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === "delete"}
        title={t("deleteDraft")}
        message={t("deleteDraftConfirm")}
        confirmLabel={t("deleteDraft")}
        cancelLabel={tc("cancel")}
        danger
        busy={busy}
        error={dialog === "delete" ? error : null}
        onConfirm={() => void removeDraft()}
        onCancel={() => setDialog(null)}
      />
    </div>
  )

  function renderActions() {
    const big = "h-14 whitespace-nowrap rounded-xl px-2 text-base font-semibold"
    const actionGrid = "grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2"

    if (status === "DRAFT" && editable) {
      const needsLines = lines.length === 0
      return (
        <div className="space-y-1.5">
        <div className={actionGrid}>
          <Button
            type="button"
            variant="outline"
            className={big}
            loading={busy && dialog === null}
            icon={<Save className="h-5 w-5" />}
            onClick={() => void saveDraft()}
          >
            {t("saveDraft")}
          </Button>
          <Button
            type="button"
            className={cn(
              big,
              "text-lg disabled:bg-slate-200 disabled:text-slate-600 disabled:opacity-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-300"
            )}
            disabled={busy || needsLines}
            icon={<Check className="h-5 w-5" />}
            onClick={() => {
              setError(null)
              if (validate()) setDialog("order")
            }}
          >
            {t("confirmOrder")}
          </Button>
        </div>
          {needsLines ? <p className="text-center text-sm text-muted-foreground">{t("orderNeedsLines")}</p> : null}
        </div>
      )
    }
    if (status === "ORDERED" && canAct) {
      return (
        <div className={actionGrid}>
          <Button
            type="button"
            variant="outline"
            className={big}
            loading={busy && dialog === null}
            icon={<Undo2 className="h-5 w-5" />}
            onClick={() => void transition("DRAFT")}
          >
            {t("backToDraft")}
          </Button>
          <Button
            type="button"
            className={cn(big, "bg-green-600 text-lg hover:bg-green-700")}
            disabled={busy}
            icon={<Check className="h-5 w-5" />}
            onClick={startReceive}
          >
            {t("markReceived")}
          </Button>
        </div>
      )
    }
    return (
      <Link
        href="/procurement"
        className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-base font-semibold text-foreground hover:bg-muted"
      >
        <ArrowLeft className="h-5 w-5" />
        {t("backToList")}
      </Link>
    )
  }
}

/** Shows the date in Thai format; the native date input sits invisibly on top and opens the picker. */
function ThaiDateField({
  label,
  labelClass,
  value,
  min,
  onChange,
  disabled,
  placeholder,
}: {
  label: ReactNode
  labelClass: string
  value: string
  min?: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <label className="block space-y-1.5">
      <span className={labelClass}>{label}</span>
      <span className="relative block">
        <span
          className={cn(
            touchInputClass,
            "flex items-center justify-between gap-2",
            !value && "text-muted-foreground",
            disabled && "cursor-not-allowed bg-muted"
          )}
        >
          <span className="truncate">{value ? fmtDate(value) : (placeholder ?? "")}</span>
          <CalendarDays className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        </span>
        <input
          type="date"
          value={value}
          min={min}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker?.()
            } catch {
              /* some browsers only open the picker from the icon */
            }
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </span>
    </label>
  )
}

function Stepper({ status, po }: { status: PurchaseOrderStatusValue; po: PurchaseOrder | null }) {
  const t = useTranslations("procurement")
  const current = STEPS.indexOf(status)
  const labels = [t("stepDraft"), t("stepOrdered"), t("stepReceived")]
  const dates = [po?.orderDate ?? null, po?.orderedAt ?? null, po?.receivedAt ?? null]
  return (
    <ol className="order-last flex w-full items-center gap-1 sm:order-none sm:w-auto" aria-label={t("colStatus")}>
      {STEPS.map((step, i) => {
        const done = i < current || (i === current && status === "RECEIVED")
        const active = i === current && !done
        return (
          <li
            key={step}
            aria-current={i === current ? "step" : undefined}
            className={cn("flex min-w-0 items-center gap-1 sm:flex-none", i === current && "flex-1")}
          >
            {i > 0 ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
            <span
              aria-label={labels[i]}
              title={i <= current && dates[i] ? fmtDate(dates[i]) : undefined}
              className={cn(
                "inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-semibold sm:flex-none sm:text-base",
                done && "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-200",
                active && "border-blue-600 bg-blue-600 text-white",
                !done && !active && "border-border bg-background text-foreground"
              )}
            >
              {done ? <Check className="h-4 w-4 shrink-0" /> : <span className="tabular-nums">{i + 1}</span>}
              <span className={cn("truncate", i !== current && "hidden sm:inline")}>{labels[i]}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function FinanceStrip({ po, canSeeExpense }: { po: PurchaseOrder; canSeeExpense: boolean }) {
  const t = useTranslations("procurement")
  const finance = po.finance ?? { state: "PENDING" as const }
  const body =
    finance.state === "PENDING"
      ? t("financePendingHint")
      : finance.state === "NO_EXPENSE"
        ? finance.reason
          ? t("financeNoExpenseHint", { reason: finance.reason })
          : null
        : t("financeCreatedHint", { expenseNo: finance.expenseNo ?? "-" })
  const content = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
          <Wallet className="h-5 w-5" />
          {t("sectionFinance")}
        </span>
        <Badge variant={PO_FINANCE_BADGE[finance.state]} className="text-sm">
          {t(`finance_${finance.state}`)}
        </Badge>
      </span>
      {body ? <span className="mt-1 block text-sm text-foreground">{body}</span> : null}
    </>
  )
  if (finance.state === "EXPENSE_CREATED" && canSeeExpense && finance.expenseId) {
    return (
      <Link
        href={`/finance/expenses/${finance.expenseId}`}
        className="block min-h-12 rounded-xl border border-border bg-background px-3 py-2 hover:bg-muted"
      >
        {content}
      </Link>
    )
  }
  return <div className="rounded-xl border border-border bg-background px-3 py-2">{content}</div>
}
