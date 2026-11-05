"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Check,
  ClipboardList,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Scale,
  Send,
  Store,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"
import type { PickupDisplayStatus } from "@/modules/transport/application/pickup-request-rules"

type Option = { id: string; name: string }

type QueueRow = {
  id: string
  requestNo: number
  createdAt: string
  note: string | null
  lines: string[]
  displayStatus: PickupDisplayStatus
  plannedAt: string | null
  pickedAt: string | null
}

type Line = { key: number; cargoTypeId: string; quantity: string; unitId: string }

const STATUS_CLASS: Record<PickupDisplayStatus, string> = {
  waiting: "bg-[#fef3c7] text-[#92400e]",
  requeue: "bg-[#fef3c7] text-[#92400e]",
  scheduled: "bg-[#dbeafe] text-[#1e40af]",
  in_progress: "bg-[#e0e7ff] text-[#3730a3]",
  picked: "bg-[#d1fae5] text-[#065f46]",
  cancelled: "bg-[#e2e8f0] text-[#334155]",
}

function formatDate(iso: string | null, withTime = false) {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso))
}

let nextKey = 1
function blankLine(unitId = ""): Line {
  return { key: nextKey++, cargoTypeId: "", quantity: "", unitId }
}

function SectionLabel({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#1e3a8a]">
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  )
}

export function PickupPublicForm({
  token,
  customerName,
  cargoTypes,
  units,
  requests,
}: {
  token: string
  customerName: string
  cargoTypes: Option[]
  units: Option[]
  requests: QueueRow[]
}) {
  const t = useTranslations("pickup")
  const router = useRouter()
  const [note, setNote] = useState("")
  const defaultUnitId = units[0]?.id ?? ""
  const [lines, setLines] = useState<Line[]>(() => [blankLine(defaultUnitId)])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const catalogReady = cargoTypes.length > 0 && units.length > 0

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function clearForm() {
    setLines([blankLine(defaultUnitId)])
    setNote("")
    setError(null)
    setSuccess(null)
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetchJson<{ data: { requestNo: number } }>(`/api/receive/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: note.trim() || null,
          lines: lines.map((line) => ({
            cargoTypeId: line.cargoTypeId,
            quantity: Number(line.quantity),
            unitId: line.unitId,
          })),
        }),
      })
      setSuccess(t("submitted", { no: res.data.requestNo }))
      setLines([blankLine(defaultUnitId)])
      setNote("")
      router.refresh()
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <section className="mb-4 rounded-[1.75rem] bg-white px-4 py-5 shadow-[0_12px_40px_rgb(30_64_175/0.12)]">
        <h2 className="text-base font-semibold text-[#0f172a]">{t("myQueue")}</h2>
        {requests.length === 0 ? (
          <p className="mt-3 text-sm text-[#334155]">{t("myQueueEmpty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {requests.map((row) => (
              <li key={row.id} className="rounded-lg border border-[#cbd5e1] bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#0f172a]">
                    {t("queueNo")} #{row.requestNo}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[row.displayStatus]}`}>
                    {t(`status_${row.displayStatus}`)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#334155]">{row.lines.join(", ")}</p>
                {row.note && <p className="mt-1 text-xs text-[#475569]">{row.note}</p>}
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-[#475569]">{t("requestedAt")}</dt>
                    <dd className="font-medium text-[#0f172a]">{formatDate(row.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-[#475569]">{t("plannedAt")}</dt>
                    <dd className="font-medium text-[#0f172a]">{formatDate(row.plannedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-[#475569]">{t("pickedAt")}</dt>
                    <dd className="font-medium text-[#0f172a]">{formatDate(row.pickedAt, true)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="overflow-hidden rounded-[1.75rem] shadow-[0_12px_40px_rgb(30_64_175/0.12)]">
      <header className="bg-[#1d4ed8] px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#1d4ed8]">
            <Package className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight">{t("publicTitle")}</h1>
            <p className="text-sm font-medium text-white">{t("publicSubtitle")}</p>
          </div>
          <ClipboardList className="h-8 w-8 shrink-0" aria-hidden />
        </div>
      </header>

      <section className="bg-white px-4 py-5">
        {!catalogReady ? (
          <p className="text-sm font-medium text-[#1e3a8a]">{t("noCatalog")}</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <div className="flex items-center gap-3 rounded-2xl border border-[#dbeafe] bg-[#f8fbff] px-3 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dbeafe] text-[#1d4ed8]">
                  <Store className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#1e3a8a]">{t("shopName")}</p>
                  <p className="truncate text-base font-bold text-[#0f172a]">{customerName}</p>
                </div>
              </div>
            </div>

            <div>
              <SectionLabel icon={Package}>{t("items")}</SectionLabel>
              <div className="space-y-5">
                {lines.map((line) => (
                  <div key={line.key} className="space-y-4">
                    {lines.length > 1 && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          aria-label={t("removeLine")}
                          onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))}
                          className="rounded-lg p-2 text-[#b91c1c]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      {cargoTypes.map((option) => {
                        const selected = option.id === line.cargoTypeId
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => updateLine(line.key, { cargoTypeId: option.id })}
                            className={
                              selected
                                ? "relative flex min-h-16 items-center justify-center rounded-2xl border-2 border-[#1d4ed8] bg-[#1d4ed8] px-1 text-[13px] font-semibold leading-tight text-white"
                                : "flex min-h-16 items-center justify-center rounded-2xl border-2 border-[#bfdbfe] bg-white px-1 text-[13px] font-semibold leading-tight text-[#1e3a8a]"
                            }
                          >
                            {selected && (
                              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#1d4ed8]">
                                <Check className="h-3 w-3" aria-hidden />
                              </span>
                            )}
                            {option.name}
                          </button>
                        )
                      })}
                    </div>

                    <div>
                      <SectionLabel icon={Scale}>{t("quantity")}</SectionLabel>
                      <div className="flex min-h-14 items-center gap-2 rounded-2xl border-2 border-[#bfdbfe] bg-white px-3">
                        <input
                          required
                          type="number"
                          min="0.01"
                          step="any"
                          inputMode="decimal"
                          aria-label={t("quantity")}
                          placeholder={t("quantityPlaceholder")}
                          value={line.quantity}
                          onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                          className="min-w-0 flex-1 bg-transparent text-base text-[#0f172a] outline-none placeholder:text-[#64748b]"
                        />
                        <span className="shrink-0 text-sm font-semibold text-[#1e3a8a]">{t("unit")}</span>
                      </div>
                    </div>

                    <div>
                      <SectionLabel icon={User}>{t("unit")}</SectionLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {units.map((option) => {
                          const selected = option.id === line.unitId
                          return (
                            <button
                              key={option.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => updateLine(line.key, { unitId: option.id })}
                              className={
                                selected
                                  ? "min-h-14 rounded-2xl border-2 border-[#1d4ed8] bg-[#1d4ed8] text-base font-bold text-white"
                                  : "min-h-14 rounded-2xl border-2 border-[#bfdbfe] bg-white text-base font-bold text-[#1e3a8a]"
                              }
                            >
                              {option.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {lines.length < 20 && (
                <button
                  type="button"
                  onClick={() => setLines((current) => [...current, blankLine(defaultUnitId)])}
                  className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-xl border border-[#bfdbfe] px-3 text-sm font-semibold text-[#1d4ed8]"
                >
                  <Plus className="h-4 w-4" />
                  {t("addLine")}
                </button>
              )}
            </div>

            <div>
              <SectionLabel icon={Pencil}>{t("note")}</SectionLabel>
              <textarea
                rows={3}
                maxLength={2000}
                value={note}
                placeholder={t("notePlaceholder")}
                onChange={(event) => setNote(event.target.value)}
                className="w-full rounded-2xl border-2 border-[#bfdbfe] bg-white px-3 py-3 text-base text-[#0f172a] outline-none placeholder:text-[#64748b] focus:border-[#1d4ed8]"
              />
            </div>

            {error && <p className="text-sm font-semibold text-[#b91c1c]">{error}</p>}
            {success && <p className="text-sm font-semibold text-[#047857]">{success}</p>}

            <button
              type="submit"
              disabled={saving}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#1d4ed8] text-base font-bold text-white disabled:opacity-60"
            >
              <Send className="h-5 w-5" aria-hidden />
              {saving ? "…" : t("submit")}
            </button>
            <button
              type="button"
              onClick={clearForm}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#bfdbfe] bg-white text-base font-semibold text-[#1e3a8a]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              {t("clear")}
            </button>
          </form>
        )}
      </section>
      </div>
    </div>
  )
}
