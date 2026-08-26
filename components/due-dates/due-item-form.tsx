"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { GlassForm, GlassFormActions, GlassInput } from "@/components/glass"
import type { DueItemDto } from "./due-item-types"

type Option = { id: string; name: string }

export function DueItemForm({
  item,
  compact,
  onSaved,
  onCancel,
}: {
  item?: DueItemDto
  compact?: boolean
  onSaved?: () => void
  onCancel?: () => void
}) {
  const t = useTranslations("dueDates")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [branches, setBranches] = useState<Option[]>([])
  const [owners, setOwners] = useState<Option[]>([])
  const [branchId, setBranchId] = useState(item?.branchId ?? "")
  const [title, setTitle] = useState(item?.title ?? "")
  const [startDate, setStartDate] = useState(item?.startDate ?? "")
  const [endDate, setEndDate] = useState(item?.endDate ?? "")
  const [ownerUserId, setOwnerUserId] = useState(item?.ownerUserId ?? "")
  const [notes, setNotes] = useState(item?.notes ?? "")

  useEffect(() => {
    void Promise.all([
      fetch("/api/due-dates/branches").then((r) => r.json()),
      fetch("/api/due-dates/owners").then((r) => r.json()),
    ]).then(([b, o]) => {
      const branchRows = (b.data ?? []) as Option[]
      setBranches(branchRows)
      setOwners((o.data ?? []) as Option[])
      if (!item && !branchId && branchRows[0]) setBranchId(branchRows[0].id)
    })
  }, [item, branchId])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      branchId,
      title,
      startDate,
      endDate,
      ownerUserId: ownerUserId || null,
      notes: notes || null,
    }
    const res = await fetch(item ? `/api/due-dates/items/${item.id}` : "/api/due-dates/items", {
      method: item ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : json.error?.message ?? t("loadFailed"))
      return
    }
    if (onSaved) {
      onSaved()
      return
    }
    const id = item?.id ?? json.data?.id
    router.push(id ? `/due-dates/${id}` : "/due-dates")
    router.refresh()
  }

  return (
    <GlassForm surfaced={!compact} onSubmit={onSubmit} className={compact ? undefined : "max-w-xl"}>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <Select
        label={t("branch")}
        required
        value={branchId}
        onChange={(e) => setBranchId(e.target.value)}
        options={branches.map((b) => ({ value: b.id, label: b.name }))}
      />
      <GlassInput label={t("title")} required value={title} onChange={(e) => setTitle(e.target.value)} />
      <Select
        label={t("owner")}
        value={ownerUserId}
        onChange={(e) => setOwnerUserId(e.target.value)}
        placeholder={t("noOwner")}
        options={[{ value: "", label: t("noOwner") }, ...owners.map((o) => ({ value: o.id, label: o.name }))]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <GlassInput
          label={t("startDate")}
          type="date"
          required
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <GlassInput
          label={t("endDate")}
          type="date"
          required
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-foreground">{t("notes")}</span>
        <textarea
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <GlassFormActions>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {tCommon("cancel")}
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {t("save")}
        </Button>
      </GlassFormActions>
    </GlassForm>
  )
}
