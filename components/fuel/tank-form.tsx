"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import type { FuelTankDto } from "@/modules/fuel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"

type Option = { id: string; name: string }

export function TankForm({
  tank,
  branches,
  fuelTypes,
  onDone,
}: {
  tank?: FuelTankDto
  branches: Option[]
  fuelTypes: Option[]
  onDone: () => void
}) {
  const t = useTranslations("fuel")
  const router = useRouter()
  const [form, setForm] = useState({
    branchId: tank?.branchId ?? (branches.length === 1 ? branches[0].id : ""),
    fuelTypeId: tank?.fuelTypeId ?? "",
    name: tank?.name ?? "",
    capacity: tank ? String(tank.capacity) : "",
    minLevel: tank ? String(tank.minLevel) : "0",
    isActive: tank?.isActive ?? true,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await fetchJson(tank ? `/api/fuel/tanks/${tank.id}` : "/api/fuel/tanks", {
        method: tank ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: form.branchId,
          fuelTypeId: form.fuelTypeId,
          name: form.name,
          capacity: Number(form.capacity),
          minLevel: Number(form.minLevel || 0),
          isActive: form.isActive,
        }),
      })
      onDone()
      router.refresh()
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label={t("branch")}
          required
          value={form.branchId}
          onChange={set("branchId")}
          placeholder={t("selectBranch")}
          options={branches.map((b) => ({ value: b.id, label: b.name }))}
        />
        <Select
          label={t("fuelType")}
          required
          value={form.fuelTypeId}
          onChange={set("fuelTypeId")}
          placeholder={t("fuelType")}
          options={fuelTypes.map((f) => ({ value: f.id, label: f.name }))}
        />
        <p className="text-sm text-foreground sm:col-span-2">
          {t("tankCode")}: <span className="font-semibold">{tank?.code ?? t("autoCode")}</span>
        </p>
        <Input label={t("tankName")} required maxLength={255} value={form.name} onChange={set("name")} />
        <Input
          label={t("capacity")}
          required
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          value={form.capacity}
          onChange={set("capacity")}
        />
        <Input
          label={t("minLevel")}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={form.minLevel}
          onChange={set("minLevel")}
          hint={t("minLevelHint")}
        />
      </div>
      {tank && (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            className="h-4 w-4 rounded border-input"
          />
          {t("active")}
        </label>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          {t("cancel")}
        </Button>
        <Button type="submit" loading={busy}>
          {t("save")}
        </Button>
      </div>
    </form>
  )
}
