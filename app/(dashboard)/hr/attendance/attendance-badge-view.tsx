"use client"

import { useCallback, useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Fingerprint } from "lucide-react"
import { fetchJson } from "@/lib/client-fetch"
import { GlassCard, GlassDialog } from "@/components/glass"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import { formatDateTime } from "./attendance-format"

type Filter = "unmapped" | "mapped" | "all"

type PersonRef = { id: string; rosterNo: string; displayName: string }

type BadgeRow = {
  id: string
  badgeNumber: string
  nameOnDevice: string | null
  device: { id: string; name: string }
  personnel: PersonRef | null
  suggestion: PersonRef | null
  punchCount: number
  lastPunchAt: string | null
}

type PersonOption = PersonRef & { inBranch: boolean }

const FILTERS: Filter[] = ["unmapped", "mapped", "all"]
const TZ = "Asia/Bangkok"

export function AttendanceBadgeView({ branchId, canUpdate }: { branchId: string; canUpdate: boolean }) {
  const t = useTranslations("attendance")
  const locale = useLocale()
  const [filter, setFilter] = useState<Filter>("unmapped")
  const [rows, setRows] = useState<BadgeRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [picking, setPicking] = useState<BadgeRow | null>(null)

  const load = useCallback(async () => {
    setRows(null)
    setError(null)
    try {
      const res = await fetchJson<{ data: BadgeRow[] }>(`/api/hr/attendance/badges?${new URLSearchParams({ branchId, filter })}`)
      setRows(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [branchId, filter])

  useEffect(() => {
    void load()
  }, [load])

  async function map(badge: BadgeRow, personnelId: string | null) {
    setSavingId(badge.id)
    setActionError(null)
    try {
      await fetchJson(`/api/hr/attendance/badges/${badge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personnelId }),
        timeoutMs: 90_000,
      })
      setPicking(null)
      await load()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <GlassCard padding="md">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={
                filter === f
                  ? "px-3 py-1.5 rounded-lg text-sm bg-slate-800 text-white"
                  : "px-3 py-1.5 rounded-lg text-sm border border-border text-muted-foreground hover:bg-muted"
              }
            >
              {t(`badges.filter.${f}`)}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{t("badges.hint")}</p>
        {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
      </GlassCard>

      <GlassCard padding="none">
        {error ? (
          <ErrorState description={error} onRetry={() => void load()} />
        ) : !rows ? (
          <LoadingState title={t("loading")} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Fingerprint}
            title={filter === "unmapped" ? t("badges.allMappedTitle") : t("badges.emptyTitle")}
            description={t("badges.emptyDescription")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-left text-muted-foreground">
                  <th className="p-3 font-medium">{t("badges.number")}</th>
                  <th className="p-3 font-medium">{t("badges.device")}</th>
                  <th className="p-3 font-medium text-right">{t("badges.punchCount")}</th>
                  <th className="p-3 font-medium">{t("badges.lastPunch")}</th>
                  <th className="p-3 font-medium">{t("badges.person")}</th>
                  {canUpdate && <th className="p-3" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-0">
                    <td className="p-3 font-mono">
                      {b.badgeNumber}
                      {b.nameOnDevice && b.nameOnDevice !== b.badgeNumber && (
                        <div className="text-xs text-muted-foreground">{b.nameOnDevice}</div>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{b.device.name}</td>
                    <td className="p-3 text-right">{b.punchCount.toLocaleString()}</td>
                    <td className="p-3 text-muted-foreground">{formatDateTime(b.lastPunchAt, TZ, locale)}</td>
                    <td className="p-3">
                      {b.personnel ? (
                        <span>
                          {b.personnel.displayName}{" "}
                          <span className="font-mono text-xs text-muted-foreground">{b.personnel.rosterNo}</span>
                        </span>
                      ) : b.suggestion ? (
                        <Badge variant="info">
                          {t("badges.suggested")}: {b.suggestion.displayName} ({b.suggestion.rosterNo})
                        </Badge>
                      ) : (
                        <Badge variant="warning">{t("badges.notMapped")}</Badge>
                      )}
                    </td>
                    {canUpdate && (
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          {!b.personnel && b.suggestion && (
                            <Button size="sm" disabled={savingId === b.id} onClick={() => void map(b, b.suggestion!.id)}>
                              {t("badges.useSuggestion")}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" disabled={savingId === b.id} onClick={() => setPicking(b)}>
                            {b.personnel ? t("badges.change") : t("badges.choose")}
                          </Button>
                          {b.personnel && (
                            <Button size="sm" variant="ghost" disabled={savingId === b.id} onClick={() => void map(b, null)}>
                              {t("badges.unmap")}
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {picking && (
        <PersonPicker
          branchId={branchId}
          badge={picking}
          saving={savingId === picking.id}
          onClose={() => setPicking(null)}
          onPick={(id) => void map(picking, id)}
        />
      )}
    </div>
  )
}

function PersonPicker({
  branchId,
  badge,
  saving,
  onClose,
  onPick,
}: {
  branchId: string
  badge: BadgeRow
  saving: boolean
  onClose: () => void
  onPick: (personnelId: string) => void
}) {
  const t = useTranslations("attendance")
  const [q, setQ] = useState("")
  const [options, setOptions] = useState<PersonOption[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetchJson<{ data: PersonOption[] }>(
          `/api/hr/attendance/personnel-options?${new URLSearchParams({ branchId, q })}`,
          { signal: ctrl.signal }
        )
        setOptions(res.data)
        setError(null)
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : String(e))
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [branchId, q])

  return (
    <GlassDialog open onOpenChange={(o) => !o && onClose()} title={t("badges.pickTitle", { badge: badge.badgeNumber })} solid>
      <div className="space-y-3">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("badges.searchPlaceholder")}
          aria-label={t("badges.searchPlaceholder")}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="max-h-80 overflow-y-auto divide-y divide-border rounded-lg border border-border">
          {!options ? (
            <p className="p-3 text-sm text-muted-foreground">{t("loading")}</p>
          ) : options.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{t("badges.noPerson")}</p>
          ) : (
            options.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={saving}
                onClick={() => onPick(p.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
              >
                <span>
                  {p.displayName} <span className="font-mono text-xs text-muted-foreground">{p.rosterNo}</span>
                </span>
                {!p.inBranch && <Badge variant="outline">{t("badges.otherBranch")}</Badge>}
              </button>
            ))
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("badges.pickNote")}</p>
      </div>
    </GlassDialog>
  )
}
