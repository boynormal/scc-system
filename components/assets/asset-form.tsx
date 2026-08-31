"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { GlassForm, GlassFormActions, GlassInput } from "@/components/glass"
import type { AssetDto } from "./asset-types"

type Option = { id: string; name: string }

export function AssetForm({ asset }: { asset?: AssetDto }) {
  const t = useTranslations("assets")
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [branches, setBranches] = useState<Option[]>([])
  const [suppliers, setSuppliers] = useState<Option[]>([])
  const [branchId, setBranchId] = useState(asset?.branchId ?? "")
  const [code, setCode] = useState(asset?.code ?? "")
  const [name, setName] = useState(asset?.name ?? "")
  const [type, setType] = useState(asset?.type ?? "VEHICLE")
  const [ownership, setOwnership] = useState(asset?.ownership ?? "COMPANY")
  const [status, setStatus] = useState(asset?.status ?? "REGISTERED")
  const [serialNumber, setSerialNumber] = useState(asset?.serialNumber ?? "")
  const [locationDetail, setLocationDetail] = useState(asset?.locationDetail ?? "")
  const [supplierId, setSupplierId] = useState(asset?.supplierId ?? "")
  const [acquiredAt, setAcquiredAt] = useState(asset?.acquiredAt ?? "")

  useEffect(() => {
    void fetch("/api/assets/options")
      .then((r) => r.json())
      .then((json) => {
        const branchRows = (json.data?.branches ?? []) as Option[]
        const supplierRows = (json.data?.suppliers ?? []) as Option[]
        setBranches(branchRows)
        setSuppliers(supplierRows)
        if (!asset && !branchId && branchRows[0]) setBranchId(branchRows[0].id)
      })
  }, [asset, branchId])

  async function suggestCode() {
    const res = await fetch("/api/assets/next-code")
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.data?.code) setCode(json.data.code)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      branchId,
      code,
      name,
      type,
      ownership,
      status,
      serialNumber: serialNumber || null,
      locationDetail: locationDetail || null,
      supplierId: supplierId || null,
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
    const id = asset?.id ?? json.data?.id
    router.push(id ? `/assets/${id}` : "/assets")
    router.refresh()
  }

  return (
    <GlassForm surfaced onSubmit={onSubmit} className="max-w-xl">
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
      <div className="space-y-1.5">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <GlassInput
              label={t("code")}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="AST-2026-00001"
            />
          </div>
          {!asset && (
            <Button type="button" variant="outline" onClick={() => void suggestCode()}>
              {t("codeSuggest")}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("codeHint")}</p>
      </div>
      <GlassInput label={t("name")} required value={name} onChange={(e) => setName(e.target.value)} />
      <Select
        label={t("type")}
        required
        value={type}
        onChange={(e) => setType(e.target.value as AssetDto["type"])}
        options={[
          { value: "VEHICLE", label: t("type_VEHICLE") },
          { value: "MACHINE", label: t("type_MACHINE") },
        ]}
      />
      <Select
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
      <GlassInput
        label={t("serialNumber")}
        value={serialNumber}
        onChange={(e) => setSerialNumber(e.target.value)}
      />
      <GlassInput
        label={t("locationDetail")}
        value={locationDetail}
        onChange={(e) => setLocationDetail(e.target.value)}
      />
      <Select
        label={t("supplier")}
        value={supplierId}
        onChange={(e) => setSupplierId(e.target.value)}
        options={[
          { value: "", label: t("supplierNone") },
          ...suppliers.map((s) => ({ value: s.id, label: s.name })),
        ]}
      />
      <div className="space-y-1.5">
        <GlassInput
          label={t("acquiredAt")}
          type="date"
          value={acquiredAt}
          onChange={(e) => setAcquiredAt(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">{t("acquiredHint")}</p>
      </div>
      <GlassFormActions>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {t("save")}
        </Button>
      </GlassFormActions>
    </GlassForm>
  )
}
