"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { GlassDialog, GlassForm, GlassFormActions, GlassInput } from "@/components/glass"
import type { IncomeCategoryRow, IncomeTypeOption } from "./income-types"

function errorText(json: { error?: unknown }, fallback: string): string {
  if (typeof json.error === "string" && json.error.trim()) return json.error
  if (json.error && typeof json.error === "object" && "message" in json.error) {
    const m = (json.error as { message?: unknown }).message
    if (typeof m === "string" && m.trim()) return m
  }
  return fallback
}

export function IncomeTypeDialog({
  state,
  categories,
  onOpenChange,
  onSaved,
}: {
  state: { open: boolean; row?: IncomeTypeOption }
  categories: IncomeCategoryRow[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const t = useTranslations("financeIncome")
  const row = state.row
  const [name, setName] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!state.open) return
    setName(row?.name ?? "")
    setCategoryId(row?.categoryId ?? "")
    setDescription(row?.description ?? "")
    setIsActive(row?.isActive ?? true)
    setError(null)
  }, [state.open, row])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch(row ? `/api/finance/income-types/${row.id}` : "/api/finance/income-types", {
      method: row ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        categoryId: categoryId || null,
        description: description || null,
        isActive,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      setError(errorText(await res.json().catch(() => ({})), t("saveFailed")))
      return
    }
    onSaved()
  }

  const categoryOptions = categories.filter((c) => c.isActive || c.id === categoryId)

  return (
    <GlassDialog
      open={state.open}
      onOpenChange={onOpenChange}
      title={row ? t("masterEditType") : t("masterAddType")}
      className="max-w-md"
    >
      <GlassForm surfaced={false} onSubmit={onSubmit}>
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <GlassInput label={t("masterName")} required value={name} onChange={(e) => setName(e.target.value)} />
        <Select
          label={t("masterCategory")}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={[{ value: "", label: t("none") }, ...categoryOptions.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <GlassInput label={t("masterDescription")} value={description} onChange={(e) => setDescription(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>{t("masterActive")}</span>
        </label>
        <GlassFormActions>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={saving}>
            {t("save")}
          </Button>
        </GlassFormActions>
      </GlassForm>
    </GlassDialog>
  )
}

export function IncomeCategoryDialog({
  state,
  onOpenChange,
  onSaved,
}: {
  state: { open: boolean; row?: IncomeCategoryRow }
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const t = useTranslations("financeIncome")
  const row = state.row
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [sequence, setSequence] = useState("0")
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!state.open) return
    setName(row?.name ?? "")
    setDescription(row?.description ?? "")
    setSequence(String(row?.sequence ?? 0))
    setIsActive(row?.isActive ?? true)
    setError(null)
  }, [state.open, row])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch(row ? `/api/finance/income-categories/${row.id}` : "/api/finance/income-categories", {
      method: row ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || null,
        sequence: Number(sequence) || 0,
        isActive,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      setError(errorText(await res.json().catch(() => ({})), t("saveFailed")))
      return
    }
    onSaved()
  }

  return (
    <GlassDialog
      open={state.open}
      onOpenChange={onOpenChange}
      title={row ? t("masterEditCategory") : t("masterAddCategory")}
      className="max-w-md"
    >
      <GlassForm surfaced={false} onSubmit={onSubmit}>
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <GlassInput label={t("masterName")} required value={name} onChange={(e) => setName(e.target.value)} />
        <GlassInput label={t("masterDescription")} value={description} onChange={(e) => setDescription(e.target.value)} />
        <GlassInput label={t("masterSequence")} type="number" value={sequence} onChange={(e) => setSequence(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>{t("masterActive")}</span>
        </label>
        <GlassFormActions>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={saving}>
            {t("save")}
          </Button>
        </GlassFormActions>
      </GlassForm>
    </GlassDialog>
  )
}
