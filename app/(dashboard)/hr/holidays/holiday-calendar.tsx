"use client"

import { useCallback, useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react"
import { fetchJson } from "@/lib/client-fetch"
import { cn } from "@/lib/utils"
import { GlassDialog } from "@/components/glass"
import { ListFrame } from "@/components/shell/list-frame"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { LoadingState } from "@/components/ui/loading-state"
import { buildMonthCells, monthKeyOf, shiftMonthKey } from "@/modules/hr/application/attendance-day-calendar"
import { isSunday } from "@/modules/hr/application/attendance-off-days"

type Branch = { id: string; code: string; name: string }
type Holiday = {
  id: string
  name: string
  startDate: string
  endDate: string
  branches: Branch[]
  canUpdate: boolean
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const

function holidaysOn(date: string, rows: Holiday[]): Holiday[] {
  return rows.filter((row) => date >= row.startDate && date <= row.endDate)
}

function branchText(holiday: Holiday, allBranches: Branch[], allLabel: string): string {
  if (allBranches.length > 0 && holiday.branches.length === allBranches.length) return allLabel
  return holiday.branches.map((branch) => branch.name).join(", ")
}

export function HolidayCalendar({
  branches,
  today,
  canUpdate,
}: {
  branches: Branch[]
  today: string
  canUpdate: boolean
}) {
  const t = useTranslations("holidays")
  const locale = useLocale()
  const [month, setMonth] = useState(() => monthKeyOf(today))
  const [rows, setRows] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Holiday | null | "new">(null)
  const [seedDate, setSeedDate] = useState<string | null>(null)
  const year = Number(month.slice(0, 4))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchJson<{ data: Holiday[] }>(`/api/hr/holidays?year=${year}`)
      setRows(res.data)
    } catch (err: unknown) {
      setRows([])
      setError(err instanceof Error ? err.message : t("empty"))
    } finally {
      setLoading(false)
    }
  }, [t, year])

  useEffect(() => {
    void load()
  }, [load])

  function openNew(date?: string) {
    setSeedDate(date ?? null)
    setEditing("new")
  }

  async function remove(row: Holiday) {
    if (!window.confirm(t("confirmDelete"))) return
    const res = await fetch(`/api/hr/holidays/${row.id}`, { method: "DELETE" })
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      setError(json.error ?? t("empty"))
      return
    }
    setEditing(null)
    await load()
  }

  const monthLabel = new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
  const cells = buildMonthCells(month)
  const weekRows = Math.max(1, cells.length / 7)

  return (
    <ListFrame
      filters={
        <div className="flex w-full items-center gap-2">
          <Button type="button" variant="outline" className="h-9 px-2" onClick={() => setMonth(shiftMonthKey(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">{t("previous")}</span>
          </Button>
          <span className="min-w-36 text-center text-sm font-semibold text-foreground">{monthLabel}</span>
          <Button type="button" variant="outline" className="h-9 px-2" onClick={() => setMonth(shiftMonthKey(month, 1))}>
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">{t("next")}</span>
          </Button>
          {canUpdate && (
            <Button type="button" className="ml-auto" onClick={() => openNew()}>
              {t("add")}
            </Button>
          )}
        </div>
      }
    >
      {loading ? (
        <LoadingState title="…" />
      ) : error ? (
        <ErrorState description={error} onRetry={() => void load()} />
      ) : (
        <div className="flex h-[calc(100vh-18rem)] flex-col">
          <div className="grid shrink-0 grid-cols-7 border-b border-border">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-1 py-2 text-center text-xs font-medium text-foreground">
                {t(`weekdays.${day}`)}
              </div>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${weekRows}, minmax(0, 1fr))` }}>
            {cells.map((date, index) => {
              if (!date) return <div key={`empty-${index}`} className="h-full border-b border-r border-border bg-muted/40" />
              const items = holidaysOn(date, rows)
              const sunday = isSunday(date)
              return (
                <div
                  key={date}
                  className={cn(
                    "h-full overflow-auto border-b border-r border-border p-1",
                    sunday && "bg-amber-500/10",
                    date === today && "ring-2 ring-inset ring-blue-600"
                  )}
                >
                  <button
                    type="button"
                    disabled={!canUpdate}
                    onClick={() => openNew(date)}
                    className="mb-1 font-mono text-xs font-semibold tabular-nums text-foreground disabled:cursor-default"
                  >
                    {Number(date.slice(8, 10))}
                  </button>
                  <div className="space-y-1">
                    {sunday && (
                      <div className="rounded bg-amber-500/15 px-1 py-0.5 text-[11px] font-medium leading-tight text-foreground">
                        {t("sunday")}
                      </div>
                    )}
                    {items.map((item) => {
                      const label = (
                        <>
                          <span className="block truncate text-[11px] font-semibold">{item.name}</span>
                          <span className="block truncate text-[10px]">{branchText(item, branches, t("allBranches"))}</span>
                        </>
                      )
                      const className = "block w-full rounded border border-blue-600/30 bg-blue-500/10 px-1 py-0.5 text-left leading-tight text-foreground"
                      return item.canUpdate ? (
                        <button key={item.id} type="button" onClick={() => setEditing(item)} className={className}>
                          {label}
                        </button>
                      ) : (
                        <div key={item.id} className={className}>
                          {label}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {editing && (
        <HolidayDialog
          key={editing === "new" ? `new-${seedDate ?? ""}` : editing.id}
          holiday={editing === "new" ? null : editing}
          seedDate={editing === "new" ? seedDate : null}
          branches={branches}
          onClose={() => setEditing(null)}
          onDelete={editing !== "new" && editing.canUpdate ? () => void remove(editing) : undefined}
          onSaved={() => {
            setEditing(null)
            void load()
          }}
        />
      )}
    </ListFrame>
  )
}

function HolidayDialog({
  holiday,
  seedDate,
  branches,
  onClose,
  onDelete,
  onSaved,
}: {
  holiday: Holiday | null
  seedDate: string | null
  branches: Branch[]
  onClose: () => void
  onDelete?: () => void
  onSaved: () => void
}) {
  const t = useTranslations("holidays")
  const [name, setName] = useState(holiday?.name ?? "")
  const [startDate, setStartDate] = useState(holiday?.startDate ?? seedDate ?? "")
  const [endDate, setEndDate] = useState(holiday?.endDate ?? seedDate ?? "")
  const [branchIds, setBranchIds] = useState<string[]>(holiday?.branches.map((branch) => branch.id) ?? [])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const allChecked = branches.length > 0 && branches.every((branch) => branchIds.includes(branch.id))

  function toggleBranch(id: string) {
    setBranchIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  async function save() {
    if (!name.trim() || !startDate || !endDate || branchIds.length === 0) {
      setError(t("required"))
      return
    }
    setSaving(true)
    setError(null)
    const res = await fetch(holiday ? `/api/hr/holidays/${holiday.id}` : "/api/hr/holidays", {
      method: holiday ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), startDate, endDate, branchIds }),
    })
    setSaving(false)
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      setError(json.error ?? t("required"))
      return
    }
    onSaved()
  }

  return (
    <GlassDialog solid open onOpenChange={(open) => !open && onClose()} title={holiday ? t("edit") : t("add")} className="max-w-lg">
      <div className="space-y-4">
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Input label={t("name")} required value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t("start")} type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label={t("end")} type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">{t("branches")}</legend>
          <p className="text-xs text-muted-foreground">{t("scopeNote")}</p>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => setBranchIds(e.target.checked ? branches.map((branch) => branch.id) : [])}
            />
            {t("allBranches")}
          </label>
          <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-border p-2">
            {branches.map((branch) => (
              <label key={branch.id} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={branchIds.includes(branch.id)}
                  onChange={() => toggleBranch(branch.id)}
                />
                {branch.code} — {branch.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2">
          {onDelete && (
            <Button type="button" variant="outline" className="mr-auto" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              {t("delete")}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" disabled={saving} loading={saving} onClick={() => void save()}>
            {t("save")}
          </Button>
        </div>
      </div>
    </GlassDialog>
  )
}
