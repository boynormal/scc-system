"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ClipboardCheck, Wrench } from "lucide-react"
import { GlassCard, GlassCardHeader, GlassCardTitle } from "@/components/glass"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { LoadingState } from "@/components/ui/loading-state"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"
import { WORK_ORDER_STATUS_LABEL, type WorkOrderStatusName } from "@/modules/work_orders/application/work-order-transitions"

type CheckStatus = "pass" | "fail" | "na" | "warning"

type ChecklistRow = {
  id: string
  status: CheckStatus | null
  actualValue: string | null
  remark: string | null
  recordedAt: string | null
  recorderName: string | null
  followUp: { id: string; woNumber: string; status: string } | null
  item: {
    id: string
    sequence: number
    section: string | null
    itemName: string
    itemType: "checkbox" | "numeric" | "text" | "select" | "photo"
    standardValue: string | null
    minValue: string | null
    maxValue: string | null
    unit: string | null
    isRequired: boolean
    template: { id: string; name: string }
  }
}

type FollowUp = { id: string; woNumber: string; title: string; status: string; sourceChecklistResultId: string | null }

type ChecklistView = {
  status: string
  locked: boolean
  blankRequired: number
  results: ChecklistRow[]
  followUps: FollowUp[]
}

type RecordResponse = {
  data: { resultId: string; status: CheckStatus | null; followUp: { id: string; woNumber: string; created: boolean } | null }
}

const STATUS_BUTTONS: { value: CheckStatus; tone: string }[] = [
  { value: "pass", tone: "bg-emerald-600 text-white border-emerald-600" },
  { value: "fail", tone: "bg-red-600 text-white border-red-600" },
  { value: "na", tone: "bg-slate-600 text-white border-slate-600" },
]

function statusLabel(status: string) {
  return WORK_ORDER_STATUS_LABEL[status as WorkOrderStatusName] ?? status
}

function standardText(item: ChecklistRow["item"]) {
  const range =
    item.minValue !== null || item.maxValue !== null ? `${item.minValue ?? "…"}–${item.maxValue ?? "…"}` : null
  return [item.standardValue, range, item.unit].filter(Boolean).join(" ")
}

export function WorkOrderChecklistPanel(props: { workOrderId: string; canUpdate: boolean }) {
  const t = useTranslations("maintenancePm")
  const router = useRouter()
  const [view, setView] = useState<ChecklistView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { actualValue: string; remark: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const json = await fetchJson<{ data: ChecklistView }>(`/api/work-orders/${props.workOrderId}/checklist`)
      setView(json.data)
      setDrafts(
        Object.fromEntries(
          json.data.results.map((row) => [row.id, { actualValue: row.actualValue ?? "", remark: row.remark ?? "" }])
        )
      )
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("error"))
    } finally {
      setLoading(false)
    }
  }, [props.workOrderId, t])

  useEffect(() => {
    load()
  }, [load])

  async function save(row: ChecklistRow, status: CheckStatus | null) {
    const draft = drafts[row.id] ?? { actualValue: "", remark: "" }
    setSavingId(row.id)
    setNotice(null)
    try {
      const json = await fetchJson<RecordResponse>(`/api/work-orders/${props.workOrderId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultId: row.id,
          status,
          actualValue: draft.actualValue || null,
          remark: draft.remark || null,
        }),
      })
      if (json.data.followUp?.created) {
        setNotice({ tone: "ok", text: t("followUpCreated", { wo: json.data.followUp.woNumber }) })
      }
      await load()
      router.refresh()
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ClientFetchError ? err.message : t("error") })
    } finally {
      setSavingId(null)
    }
  }

  function saveOnBlur(row: ChecklistRow) {
    const draft = drafts[row.id]
    if (!draft) return
    if ((row.actualValue ?? "") === draft.actualValue && (row.remark ?? "") === draft.remark) return
    void save(row, row.status)
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState description={error} onRetry={load} />
  if (!view || (view.results.length === 0 && view.followUps.length === 0)) return null

  const editable = props.canUpdate && !view.locked
  let lastTemplate = ""

  return (
    <GlassCard padding="none">
      <GlassCardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <GlassCardTitle>
            <span className="inline-flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              {t("checklistTitle")}
            </span>
          </GlassCardTitle>
          {view.results.length > 0 && (
            <span
              className={`text-xs font-medium ${view.blankRequired > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}
            >
              {view.blankRequired > 0 ? t("blankRequired", { count: view.blankRequired }) : t("allRequiredDone")}
            </span>
          )}
        </div>
      </GlassCardHeader>
      <div className="px-5 pb-5 space-y-3">
        {notice && (
          <p
            role="status"
            className={`text-sm ${notice.tone === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`}
          >
            {notice.text}
          </p>
        )}
        {view.results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-semibold">{t("itemName")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("standardValue")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("result")}</th>
                  <th className="py-2 pr-3 font-semibold w-32">{t("actualValue")}</th>
                  <th className="py-2 font-semibold">{t("remark")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {view.results.map((row) => {
                  const showTemplate = row.item.template.name !== lastTemplate
                  lastTemplate = row.item.template.name
                  const draft = drafts[row.id] ?? { actualValue: "", remark: "" }
                  const busy = savingId === row.id
                  return (
                    <Fragment key={row.id}>
                      {showTemplate && (
                        <tr>
                          <td colSpan={5} className="pt-3 pb-1 text-xs font-semibold text-foreground">
                            {row.item.template.name}
                          </td>
                        </tr>
                      )}
                      <tr className="align-top">
                        <td className="py-2 pr-3 text-foreground">
                          {row.item.section && <span className="text-xs text-muted-foreground">{row.item.section} · </span>}
                          {row.item.itemName}
                          {row.item.isRequired && <span className="ml-1 text-red-500" aria-label={t("required")}>*</span>}
                          {row.followUp && (
                            <Link
                              href={`/work-orders/${row.followUp.id}`}
                              className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                            >
                              <Wrench className="w-3 h-3" />
                              {row.followUp.woNumber} · {statusLabel(row.followUp.status)}
                            </Link>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{standardText(row.item) || "—"}</td>
                        <td className="py-2 pr-3">
                          <div className="flex gap-1" role="group" aria-label={t("result")}>
                            {STATUS_BUTTONS.map((button) => {
                              const active = row.status === button.value
                              return (
                                <button
                                  key={button.value}
                                  type="button"
                                  disabled={!editable || busy}
                                  aria-pressed={active}
                                  onClick={() => save(row, active ? null : button.value)}
                                  className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                    active ? button.tone : "border-border text-foreground hover:bg-muted"
                                  }`}
                                >
                                  {t(`check_${button.value}`)}
                                </button>
                              )
                            })}
                          </div>
                          {row.recorderName && row.recordedAt && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {row.recorderName} ·{" "}
                              {new Date(row.recordedAt).toLocaleString("th-TH", {
                                timeZone: "Asia/Bangkok",
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {row.item.itemType === "numeric" || row.item.itemType === "text" || row.item.itemType === "select" ? (
                            <Input
                              aria-label={t("actualValue")}
                              inputMode={row.item.itemType === "numeric" ? "decimal" : undefined}
                              value={draft.actualValue}
                              disabled={!editable || busy}
                              onChange={(e) =>
                                setDrafts((current) => ({ ...current, [row.id]: { ...draft, actualValue: e.target.value } }))
                              }
                              onBlur={() => saveOnBlur(row)}
                              className="py-1"
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2">
                          <Input
                            aria-label={t("remark")}
                            value={draft.remark}
                            disabled={!editable || busy}
                            onChange={(e) =>
                              setDrafts((current) => ({ ...current, [row.id]: { ...draft, remark: e.target.value } }))
                            }
                            onBlur={() => saveOnBlur(row)}
                            className="py-1"
                          />
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {view.followUps.length > 0 && (
          <div className="space-y-1 border-t border-border pt-3">
            <p className="text-sm font-medium text-foreground">{t("followUps")}</p>
            {view.followUps.map((wo) => (
              <Link
                key={wo.id}
                href={`/work-orders/${wo.id}`}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <span className="text-foreground">
                  <span className="font-mono text-blue-600 dark:text-blue-400">{wo.woNumber}</span> {wo.title}
                </span>
                <span className="text-xs text-muted-foreground">{statusLabel(wo.status)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  )
}
