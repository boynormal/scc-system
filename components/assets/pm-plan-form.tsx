"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { GlassForm, GlassFormActions, GlassInput } from "@/components/glass"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"
import { PmTemplateButton } from "@/components/assets/pm-template-button"

type PlanRow = { name: string; detail: string }
type TemplateOption = {
  id: string
  name: string
  isActive: boolean
  items: { name: string; detail: string | null }[]
}

function toRows(items: { name: string; detail?: string | null }[]): PlanRow[] {
  return items.length > 0 ? items.map((item) => ({ name: item.name, detail: item.detail ?? "" })) : [{ name: "", detail: "" }]
}

export function PmPlanForm({
  assetId,
  intervalDays,
  isActive,
  items,
  catalogVersion = 0,
}: {
  assetId: string
  intervalDays: number
  isActive: boolean
  items: { name: string; detail?: string | null }[]
  catalogVersion?: number
}) {
  const t = useTranslations("pmCheck")
  const router = useRouter()
  const [days, setDays] = useState(String(intervalDays))
  const [active, setActive] = useState(isActive)
  const [rows, setRows] = useState<PlanRow[]>(() => toRows(items))
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null)
  const [templateId, setTemplateId] = useState("")
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchJson<{ data: TemplateOption[] }>("/api/assets/pm-templates?activeOnly=true")
      .then((json) => {
        if (!cancelled) setTemplates(json.data.filter((row) => row.isActive))
      })
      .catch((err) => {
        if (!cancelled) setTemplateError(err instanceof ClientFetchError ? err.message : t("loadFailed"))
      })
    return () => {
      cancelled = true
    }
  }, [catalogVersion, t])

  function updateRow(index: number, patch: Partial<PlanRow>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  }

  function applyTemplate() {
    const template = templates?.find((row) => row.id === templateId)
    if (!template) return
    const dirty = rows.some((row) => row.name.trim() || row.detail.trim())
    if (dirty && !window.confirm(t("replaceItemsConfirm"))) return
    setRows(template.items.map((item) => ({ name: item.name, detail: item.detail ?? "" })))
  }

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
          items: rows.map((row) => ({ name: row.name, detail: row.detail })),
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
        <p className="text-xs text-muted-foreground">{t("templateHint")}</p>
        {templateError && <p className="text-sm text-red-600">{templateError}</p>}
        {templates && templates.length === 0 && <p className="text-sm text-foreground">{t("noTemplates")}</p>}
        {templates && templates.length > 0 && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[16rem] flex-1">
              <Select
                label={t("chooseTemplate")}
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
                options={[
                  { value: "", label: t("chooseTemplate") },
                  ...templates.map((row) => ({ value: row.id, label: row.name })),
                ]}
              />
            </div>
            <Button type="button" className="bg-slate-800 text-white hover:bg-slate-900" disabled={!templateId} onClick={applyTemplate}>
              {t("applyTemplate")}
            </Button>
          </div>
        )}
        {rows.map((row, index) => (
          <div key={index} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <GlassInput
              label={`${t("itemName")} ${index + 1}`}
              value={row.name}
              required
              maxLength={255}
              onChange={(event) => updateRow(index, { name: event.target.value })}
            />
            <GlassInput
              label={t("itemDetail")}
              value={row.detail}
              maxLength={255}
              onChange={(event) => updateRow(index, { detail: event.target.value })}
            />
            {rows.length > 1 && (
              <Button type="button" variant="danger" size="sm" onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))}>
                {t("removeItem")}
              </Button>
            )}
          </div>
        ))}
        {rows.length < 50 && (
          <Button
            type="button"
            onClick={() => setRows([...rows, { name: "", detail: "" }])}
            className="bg-slate-800 text-white hover:bg-slate-900"
          >
            {t("addItem")}
          </Button>
        )}
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

export function PmPlanEditor(props: {
  assetId: string
  intervalDays: number
  isActive: boolean
  items: { name: string; detail?: string | null }[]
}) {
  const [catalogVersion, setCatalogVersion] = useState(0)
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PmTemplateButton onChanged={() => setCatalogVersion((value) => value + 1)} />
      </div>
      <PmPlanForm {...props} catalogVersion={catalogVersion} />
    </div>
  )
}
