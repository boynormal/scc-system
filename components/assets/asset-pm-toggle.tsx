"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"
import type { AssetDto } from "./asset-types"

function blockReasonKey(asset: AssetDto): "pmBlockedInactive" | "pmBlockedRetired" | null {
  if (!asset.isActive) return "pmBlockedInactive"
  if (asset.status === "RETIRED" || asset.status === "DISPOSED") return "pmBlockedRetired"
  return null
}

export function AssetPmToggle({ asset, canUpdate }: { asset: AssetDto; canUpdate: boolean }) {
  const t = useTranslations("assets")
  const router = useRouter()
  const [enabled, setEnabled] = useState(asset.maintenancePmEnabled)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canUpdate) {
    return enabled ? <Badge variant="info">{t("maintenancePmOn")}</Badge> : <span className="text-[#334155]">—</span>
  }

  const blockKey = blockReasonKey(asset)
  const blocked = !enabled && blockKey !== null

  async function setPm(next: boolean) {
    if (busy || next === enabled) return
    setBusy(true)
    setError(null)
    try {
      await fetchJson(`/api/assets/${asset.id}/maintenance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      })
      setEnabled(next)
      router.refresh()
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("maintenancePmSaveFailed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <span title={blocked && blockKey ? t(blockKey) : undefined}>
        <Switch
          checked={enabled}
          disabled={busy || blocked}
          onCheckedChange={(checked) => void setPm(checked)}
          aria-label={t("maintenancePmToggle", { name: asset.name })}
        />
      </span>
      {error && <p className="max-w-[12rem] text-xs text-red-600">{error}</p>}
    </div>
  )
}
