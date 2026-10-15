"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { GlassForm, GlassFormActions, GlassInput } from "@/components/glass"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"

export function PmPlanForm({
  assetId,
  intervalDays,
  isActive,
  items,
}: {
  assetId: string
  intervalDays: number
  isActive: boolean
  items: { name: string }[]
}) {
  const t = useTranslations("pmCheck")
  const router = useRouter()
  const [days, setDays] = useState(String(intervalDays))
  const [active, setActive] = useState(isActive)
  const [rows, setRows] = useState(items.length > 0 ? items.map((item) => item.name) : [""])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await fetchJson(`/api/assets/${assetId}/pm`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intervalDays: Number(days),
          isActive: active,
          items: rows.map((name) => ({ name })),
        }),
      })
      router.refresh()
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <GlassForm onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full max-w-[10rem]">
          <GlassInput
            label={t("intervalDays")}
            type="number"
            min={1}
            max={3650}
            required
            value={days}
            onChange={(event) => setDays(event.target.value)}
          />
        </div>
        <label className="flex h-10 items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          {t("active")}
        </label>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{t("items")}</p>
        <p className="text-xs text-muted-foreground">{t("setupHint")}</p>
        {rows.map((name, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <GlassInput
                label={`${t("itemName")} ${index + 1}`}
                value={name}
                required
                maxLength={255}
                onChange={(event) => {
                  const next = [...rows]
                  next[index] = event.target.value
                  setRows(next)
                }}
              />
            </div>
            {rows.length > 1 && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))}
              >
                {t("removeItem")}
              </Button>
            )}
          </div>
        ))}
        <Button type="button" onClick={() => setRows([...rows, ""])} className="bg-slate-800 text-white hover:bg-slate-900">
          {t("addItem")}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <GlassFormActions>
        <Button type="submit" loading={saving}>
          {t("savePlan")}
        </Button>
      </GlassFormActions>
    </GlassForm>
  )
}
