"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { GlassForm, GlassFormActions, GlassInput } from "@/components/glass"
import type { AssetDto } from "./asset-types"

type Option = { id: string; name: string }

const solidField =
  "border-[#94a3b8] bg-[#ffffff] text-[#0f172a] dark:border-[#94a3b8] dark:bg-[#ffffff] backdrop-blur-none"

export function AssetForm({
  asset,
  onSaved,
  onCancel,
}: {
  asset?: AssetDto
  onSaved?: () => void
  onCancel?: () => void
}) {
  const t = useTranslations("assets")
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [branches, setBranches] = useState<Option[]>([])
  const [types, setTypes] = useState<Option[]>([])
  const [branchId, setBranchId] = useState(asset?.branchId ?? "")
  const [code, setCode] = useState(asset?.code ?? "")
  const [name, setName] = useState(asset?.name ?? "")
  const [typeId, setTypeId] = useState(asset?.typeId ?? "")
  const [ownership, setOwnership] = useState(asset?.ownership ?? "COMPANY")
  const [status, setStatus] = useState(asset?.status ?? "REGISTERED")
  const [fuelMeterType, setFuelMeterType] = useState<AssetDto["fuelMeterType"]>(asset?.fuelMeterType ?? "NONE")
  const [serialNumber, setSerialNumber] = useState(asset?.serialNumber ?? "")
  const [details, setDetails] = useState(asset?.details ?? "")
  const [acquiredAt, setAcquiredAt] = useState(asset?.acquiredAt ?? "")

  useEffect(() => {
    void fetch("/api/assets/options")
      .then((r) => r.json())
      .then((json) => {
        const branchRows = (json.data?.branches ?? []) as Option[]
        const typeRows = (json.data?.types ?? []) as Option[]
        setBranches(branchRows)
        setTypes(
          asset?.typeId && !typeRows.some((row) => row.id === asset.typeId)
            ? [{ id: asset.typeId, name: asset.typeName }, ...typeRows]
            : typeRows
        )
        if (!asset && !branchId && branchRows[0]) setBranchId(branchRows[0].id)
        if (!asset && !typeId && typeRows[0]) setTypeId(typeRows[0].id)
      })
  }, [asset, branchId])

  useEffect(() => {
    if (asset) return
    void fetch("/api/assets/next-code")
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.code) setCode(json.data.code)
      })
      .catch(() => {})
  }, [asset])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      branchId,
      code,
      name,
      typeId,
      ownership,
      status,
      fuelMeterType,
      serialNumber: serialNumber || null,
      details: details || null,
      acquiredAt: acquiredAt || null,
    }
    const res = await fetch(asset ? `/api/assets/${asset.id}` : "/api/assets", {
      method: asset ? "PATCH" : "POST",
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
      router.refresh()
      return
    }
    const id = asset?.id ?? json.data?.id
    router.push(id ? `/assets/${id}` : "/assets")
    router.refresh()
  }

  return (
    <GlassForm surfaced={!onSaved} onSubmit={onSubmit} className={onSaved ? undefined : "max-w-xl"}>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <Select
        className={solidField}
        label={t("branch")}
        required
        value={branchId}
        onChange={(e) => setBranchId(e.target.value)}
        options={branches.map((b) => ({ value: b.id, label: b.name }))}
      />
      <div className="space-y-1.5">
        <GlassInput
          className="border-[#94a3b8] bg-[#e2e8f0] text-[#0f172a] dark:border-[#94a3b8] dark:bg-[#e2e8f0] backdrop-blur-none"
          label={t("code")}
          required
          readOnly
          value={code}
          placeholder="AST-2026-00001"
        />
        <p className="text-xs text-muted-foreground">{t("codeHint")}</p>
      </div>
      <GlassInput className={solidField} label={t("name")} required value={name} onChange={(e) => setName(e.target.value)} />
      <Select
        className={solidField}
        label={t("type")}
        required
        value={typeId}
        onChange={(e) => setTypeId(e.target.value)}
        options={types.map((row) => ({ value: row.id, label: row.name }))}
      />
      <Select
        className={solidField}
        label={t("ownership")}
        required
        value={ownership}
        onChange={(e) => setOwnership(e.target.value as AssetDto["ownership"])}
        options={[
          { value: "COMPANY", label: t("own_COMPANY") },
          { value: "LEASED", label: t("own_LEASED") },
          { value: "EXTERNAL", label: t("own_EXTERNAL") },
        ]}
      />
      <Select
        className={solidField}
        label={t("status")}
        required
        value={status}
        onChange={(e) => setStatus(e.target.value as AssetDto["status"])}
        options={[
          { value: "REGISTERED", label: t("st_REGISTERED") },
          { value: "ACTIVE", label: t("st_ACTIVE") },
          { value: "IDLE", label: t("st_IDLE") },
          { value: "RETIRED", label: t("st_RETIRED") },
          { value: "DISPOSED", label: t("st_DISPOSED") },
        ]}
      />
      <div className="space-y-1.5">
        <Select
          className={solidField}
          label={t("fuelMeterType")}
          required
          value={fuelMeterType}
          onChange={(e) => setFuelMeterType(e.target.value as AssetDto["fuelMeterType"])}
          options={[
            { value: "NONE", label: t("meter_NONE") },
            { value: "ODOMETER", label: t("meter_ODOMETER") },
            { value: "HOUR_METER", label: t("meter_HOUR_METER") },
          ]}
        />
        <p className="text-xs text-muted-foreground">{t("fuelMeterHint")}</p>
      </div>
      <GlassInput
        className={solidField}
        label={t("serialNumber")}
        value={serialNumber}
        onChange={(e) => setSerialNumber(e.target.value)}
      />
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground" htmlFor="asset-details">
          {t("details")}
        </label>
        <textarea
          id="asset-details"
          value={details}
          maxLength={2000}
          rows={4}
          onChange={(e) => setDetails(e.target.value)}
          className={`${solidField} w-full rounded-lg border px-3 py-2 text-sm`}
        />
        <p className="text-xs text-muted-foreground">{t("detailsHint")}</p>
      </div>
      <div className="space-y-1.5">
        <GlassInput
          className={solidField}
          label={t("acquiredAt")}
          type="date"
          value={acquiredAt}
          onChange={(e) => setAcquiredAt(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">{t("acquiredHint")}</p>
      </div>
      <GlassFormActions>
        <Button
          type="button"
          variant="outline"
          className="border-[#334155] bg-[#1e293b] text-white hover:bg-[#0f172a] hover:text-white dark:hover:bg-[#0f172a]"
          onClick={() => (onCancel ? onCancel() : router.back())}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {t("save")}
        </Button>
      </GlassFormActions>
    </GlassForm>
  )
}
