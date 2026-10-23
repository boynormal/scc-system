"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Wrench } from "lucide-react"
import { GlassCard, GlassCardHeader, GlassCardTitle } from "@/components/glass"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import { Select } from "@/components/ui/select"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"

type LinkKind = "machine" | "vehicle"
type Candidate = { id: string; code: string; name: string }

type MaintenanceView = {
  enabled: boolean
  blockReason: string | null
  link: { kind: LinkKind; id: string; code: string; name: string } | null
  candidates: { machines: Candidate[]; vehicles: Candidate[] }
  plans: { id: string; name: string; isActive: boolean }[]
}

function linkValue(link: MaintenanceView["link"]) {
  return link ? `${link.kind}:${link.id}` : ""
}

export function AssetMaintenanceCard({ assetId, canUpdate }: { assetId: string; canUpdate: boolean }) {
  const t = useTranslations("assetMaintenance")
  const router = useRouter()
  const [view, setView] = useState<MaintenanceView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState("")
  const [saving, setSaving] = useState<"toggle" | "link" | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const json = await fetchJson<{ data: MaintenanceView }>(`/api/assets/${assetId}/maintenance`)
      setView(json.data)
      setSelected(linkValue(json.data.link))
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [assetId, t])

  useEffect(() => {
    load()
  }, [load])

  async function toggle() {
    if (!view) return
    setSaving("toggle")
    setNotice(null)
    try {
      await fetchJson(`/api/assets/${assetId}/maintenance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !view.enabled }),
      })
      await load()
      router.refresh()
    } catch (err) {
      setNotice(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    } finally {
      setSaving(null)
    }
  }

  async function saveLink() {
    setSaving("link")
    setNotice(null)
    const [kind, targetId] = selected.split(":")
    try {
      await fetchJson(`/api/assets/${assetId}/maintenance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected ? { kind, targetId } : { kind: null }),
      })
      await load()
      router.refresh()
    } catch (err) {
      setNotice(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState description={error} onRetry={load} />
  if (!view) return null

  const linkChanged = selected !== linkValue(view.link)

  return (
    <GlassCard>
      <GlassCardHeader>
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <GlassCardTitle>
            <span className="inline-flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              {t("title")}
            </span>
          </GlassCardTitle>
          <Badge variant={view.enabled ? "success" : "default"}>{view.enabled ? t("enabled") : t("disabled")}</Badge>
        </div>
      </GlassCardHeader>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-foreground">{t("hint")}</p>
          {canUpdate && (
            <Button
              type="button"
              variant={view.enabled ? "outline" : "primary"}
              loading={saving === "toggle"}
              disabled={!view.enabled && view.blockReason !== null}
              onClick={toggle}
            >
              {view.enabled ? t("turnOff") : t("turnOn")}
            </Button>
          )}
        </div>
        {!view.enabled && view.blockReason && <p className="text-sm text-amber-700 dark:text-amber-300">{view.blockReason}</p>}

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <Select
              id="asset-maintenance-link"
              label={t("linkLabel")}
              hint={t("linkHint")}
              value={selected}
              disabled={!canUpdate}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">{t("noLink")}</option>
              {view.candidates.machines.length > 0 && (
                <optgroup label={t("machines")}>
                  {view.candidates.machines.map((m) => (
                    <option key={m.id} value={`machine:${m.id}`}>
                      {m.code} · {m.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {view.candidates.vehicles.length > 0 && (
                <optgroup label={t("vehicles")}>
                  {view.candidates.vehicles.map((v) => (
                    <option key={v.id} value={`vehicle:${v.id}`}>
                      {v.code} · {v.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          </div>
          {canUpdate && (
            <Button type="button" variant="outline" loading={saving === "link"} disabled={!linkChanged} onClick={saveLink}>
              {t("saveLink")}
            </Button>
          )}
        </div>
        {view.link?.kind === "machine" && (
          <Link href={`/machines/${view.link.id}`} className="inline-block text-sm text-blue-700 hover:underline dark:text-blue-300">
            {t("openMachine", { code: view.link.code })}
          </Link>
        )}

        {notice && <p className="text-sm text-red-600 dark:text-red-400">{notice}</p>}

        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{t("plans", { count: view.plans.length })}</p>
            {view.enabled && (
              <Link
                href={`/maintenance/plans/new?assetId=${assetId}`}
                className="text-sm text-blue-700 hover:underline dark:text-blue-300"
              >
                {t("newPlan")}
              </Link>
            )}
          </div>
          {view.plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPlans")}</p>
          ) : (
            <ul className="space-y-1">
              {view.plans.map((plan) => (
                <li key={plan.id} className="flex items-center gap-2 text-sm">
                  <Link href={`/maintenance/plans/${plan.id}`} className="text-blue-700 hover:underline dark:text-blue-300">
                    {plan.name}
                  </Link>
                  {!plan.isActive && <Badge>{t("planInactive")}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </GlassCard>
  )
}
