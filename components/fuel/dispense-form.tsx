"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { CheckCircle2, Search } from "lucide-react"
import type { FuelTankDto, FuelTxnDto } from "@/modules/fuel"
import { DataPanel } from "@/components/shell/data-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"
import { cn } from "@/lib/utils"
import { fmtMoney, fmtQty, localInputToIso } from "./fuel-format"
import { OccurredAtField, TankPicker, TankStatusLine, TextArea, initialBranchTank } from "./fuel-entry-shared"

type Option = { id: string; name: string }
type FuelAsset = {
  id: string
  code: string
  name: string
  typeName: string
  fuelMeterType: "ODOMETER" | "HOUR_METER" | "NONE"
  lastOdometer: number | null
  lastHourMeter: number | null
}

export function DispenseForm({
  branches,
  tanks: initialTanks,
  presetTankId,
}: {
  branches: Option[]
  tanks: FuelTankDto[]
  presetTankId?: string | null
}) {
  const t = useTranslations("fuel")
  const [tanks, setTanks] = useState(initialTanks)
  const [{ branchId, tankId }, setPick] = useState(() => initialBranchTank(branches, initialTanks, presetTankId))
  const [targetType, setTargetType] = useState<"ASSET" | "OTHER">("ASSET")
  const [assetSearch, setAssetSearch] = useState("")
  const [assets, setAssets] = useState<FuelAsset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [assetsError, setAssetsError] = useState<string | null>(null)
  const [assetId, setAssetId] = useState("")
  const [meterReading, setMeterReading] = useState("")
  const [otherName, setOtherName] = useState("")
  const [otherNote, setOtherNote] = useState("")
  const [quantity, setQuantity] = useState("")
  const [receiverName, setReceiverName] = useState("")
  const [occurredAt, setOccurredAt] = useState("")
  const [remark, setRemark] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<FuelTxnDto | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const tank = tanks.find((x) => x.id === tankId) ?? null
  const asset = assets.find((a) => a.id === assetId) ?? null
  const qty = Number(quantity)
  const afterQty = tank && quantity !== "" && Number.isFinite(qty) ? Math.round((tank.currentQty - qty) * 100) / 100 : null
  const meterType = asset?.fuelMeterType ?? "NONE"
  const lastMeter = !asset ? null : meterType === "ODOMETER" ? asset.lastOdometer : meterType === "HOUR_METER" ? asset.lastHourMeter : null

  useEffect(() => {
    if (!branchId || targetType !== "ASSET") return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setAssetsLoading(true)
      setAssetsError(null)
      const params = new URLSearchParams({ branchId })
      if (assetSearch.trim()) params.set("search", assetSearch.trim())
      fetchJson<{ data: FuelAsset[] }>(`/api/fuel/assets?${params.toString()}`, { signal: controller.signal })
        .then((res) => setAssets(res.data))
        .catch((err) => {
          if (controller.signal.aborted) return
          setAssetsError(err instanceof ClientFetchError ? err.message : t("loadFailed"))
        })
        .finally(() => {
          if (!controller.signal.aborted) setAssetsLoading(false)
        })
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [branchId, targetType, assetSearch, reloadKey, t])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const isAsset = targetType === "ASSET"
    try {
      const res = await fetchJson<{ data: FuelTxnDto }>("/api/fuel/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "DISPENSE",
          tankId,
          quantity: qty,
          targetType,
          assetId: isAsset ? assetId : null,
          meterReading: isAsset && meterType !== "NONE" && meterReading !== "" ? Number(meterReading) : null,
          otherTargetName: isAsset ? null : otherName,
          otherTargetNote: isAsset ? null : otherNote || null,
          receiverName: receiverName || null,
          occurredAt: localInputToIso(occurredAt),
          remark: remark || null,
        }),
      })
      setTanks((list) =>
        list.map((x) =>
          x.id === tankId
            ? {
                ...x,
                currentQty: res.data.balanceAfter,
                fillPercent: x.capacity > 0 ? Math.round((res.data.balanceAfter / x.capacity) * 1000) / 10 : 0,
                isLow: res.data.balanceAfter < x.minLevel,
              }
            : x
        )
      )
      setSaved(res.data)
      setQuantity("")
      setMeterReading("")
      setAssetId("")
      setOtherName("")
      setOtherNote("")
      setReceiverName("")
      setOccurredAt("")
      setRemark("")
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    } finally {
      setBusy(false)
    }
  }

  const segment = (value: "ASSET" | "OTHER", label: string) => (
    <button
      type="button"
      aria-pressed={targetType === value}
      onClick={() => setTargetType(value)}
      className={cn(
        "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        targetType === value ? "bg-blue-600 text-white shadow-sm" : "text-foreground hover:bg-muted"
      )}
    >
      {label}
    </button>
  )

  return (
    <DataPanel padding="md" className="max-w-3xl">
      {saved && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {t("saved")}: {t("type_DISPENSE")} {fmtQty(Math.abs(saved.quantity))} {saved.unit} →{" "}
              {saved.assetCode ? `${saved.assetCode} ${saved.assetName ?? ""}` : saved.otherTargetName}
            </p>
            <p>
              {t("totalCost")} {fmtMoney(saved.totalCost)} {t("baht")} · {t("remainingAfter")} {fmtQty(saved.balanceAfter)}{" "}
              {saved.unit}
            </p>
            <Link href={`/fuel/tanks/${saved.tankId}`} className="font-medium underline">
              {t("ledgerTitle")}
            </Link>
          </div>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <TankPicker
          branches={branches}
          tanks={tanks}
          branchId={branchId}
          tankId={tankId}
          onBranch={(id) => {
            const own = tanks.filter((x) => x.branchId === id)
            setPick({ branchId: id, tankId: own.length === 1 ? own[0].id : "" })
            setAssetId("")
          }}
          onTank={(id) => setPick((p) => ({ ...p, tankId: id }))}
        />
        {tank && <TankStatusLine tank={tank} afterQty={afterQty} />}

        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-foreground">{t("target")}</span>
          <div className="flex gap-1 rounded-lg border border-border bg-background p-1">
            {segment("ASSET", t("targetAsset"))}
            {segment("OTHER", t("targetOther"))}
          </div>
        </div>

        {targetType === "ASSET" ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label={t("searchAsset")}
                icon={<Search className="h-4 w-4" />}
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                disabled={!branchId}
              />
              <Select
                label={t("asset")}
                required
                value={assetId}
                onChange={(e) => {
                  setAssetId(e.target.value)
                  setMeterReading("")
                }}
                disabled={!branchId || assetsLoading}
                placeholder={assets.length ? t("selectAsset") : t("noAssets")}
                options={assets.map((a) => ({ value: a.id, label: `${a.code} · ${a.name} (${a.typeName})` }))}
                error={assetsError ?? undefined}
              />
            </div>
            {asset &&
              (meterType === "NONE" ? (
                <p className="text-sm text-foreground">{t("assetNoMeter")}</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label={meterType === "ODOMETER" ? t("meterOdometer") : t("meterHour")}
                    required
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={meterReading}
                    onChange={(e) => setMeterReading(e.target.value)}
                    hint={lastMeter !== null ? t("lastMeter", { value: fmtQty(lastMeter) }) : undefined}
                  />
                </div>
              ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={t("otherTargetName")}
              required
              maxLength={255}
              placeholder={t("otherTargetNamePlaceholder")}
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
            />
            <Input label={t("otherTargetNote")} maxLength={1000} value={otherNote} onChange={(e) => setOtherNote(e.target.value)} />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t("quantity")}
            required
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            max={tank ? tank.currentQty : undefined}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Input label={t("receiverName")} maxLength={255} value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
        </div>
        <OccurredAtField value={occurredAt} onChange={setOccurredAt} />
        <TextArea label={t("remark")} value={remark} onChange={setRemark} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" loading={busy} disabled={!tank}>
            {t("submitDispense")}
          </Button>
        </div>
      </form>
    </DataPanel>
  )
}
