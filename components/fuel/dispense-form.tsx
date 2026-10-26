"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { CheckCircle2, Search } from "lucide-react"
import type { FuelTankDto, FuelTxnDto } from "@/modules/fuel"
import { GlassDialog } from "@/components/glass"
import { DataPanel } from "@/components/shell/data-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  const [pickerOpen, setPickerOpen] = useState(false)
  const [assetSearch, setAssetSearch] = useState("")
  const [assets, setAssets] = useState<FuelAsset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [assetsError, setAssetsError] = useState<string | null>(null)
  const [asset, setAsset] = useState<FuelAsset | null>(null)
  const [meterReading, setMeterReading] = useState("")
  const [otherName, setOtherName] = useState("")
  const [otherNote, setOtherNote] = useState("")
  const [quantity, setQuantity] = useState("")
  const [occurredAt, setOccurredAt] = useState("")
  const [remark, setRemark] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<FuelTxnDto | null>(null)

  const tank = tanks.find((x) => x.id === tankId) ?? null
  const qty = Number(quantity)
  const afterQty = tank && quantity !== "" && Number.isFinite(qty) ? Math.round((tank.currentQty - qty) * 100) / 100 : null
  const meterType = asset?.fuelMeterType ?? "NONE"
  const lastMeter = !asset ? null : meterType === "ODOMETER" ? asset.lastOdometer : meterType === "HOUR_METER" ? asset.lastHourMeter : null

  useEffect(() => {
    if (!pickerOpen || !branchId) return
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
  }, [pickerOpen, branchId, assetSearch, t])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const isAsset = targetType === "ASSET"
    if (isAsset && !asset) {
      setError(t("selectAsset"))
      setBusy(false)
      return
    }
    try {
      const res = await fetchJson<{ data: FuelTxnDto }>("/api/fuel/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "DISPENSE",
          tankId,
          quantity: qty,
          targetType,
          assetId: isAsset ? asset?.id : null,
          meterReading: isAsset && meterType !== "NONE" && meterReading !== "" ? Number(meterReading) : null,
          otherTargetName: isAsset ? null : otherName,
          otherTargetNote: isAsset ? null : otherNote || null,
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
      setAsset(null)
      setOtherName("")
      setOtherNote("")
      setOccurredAt("")
      setRemark("")
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
            setAsset(null)
            setMeterReading("")
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
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-foreground">
                {t("asset")}
                <span className="ml-1 text-red-500">*</span>
              </span>
              <button
                type="button"
                disabled={!branchId}
                onClick={() => {
                  setAssetSearch("")
                  setPickerOpen(true)
                }}
                className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-left text-sm text-foreground hover:border-slate-400 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              >
                {asset ? `${asset.code} · ${asset.name}` : t("selectAsset")}
              </button>
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

      <GlassDialog solid open={pickerOpen} onOpenChange={setPickerOpen} title={t("selectAsset")}>
        <Input
          label={t("searchAsset")}
          icon={<Search className="h-4 w-4" />}
          value={assetSearch}
          onChange={(e) => setAssetSearch(e.target.value)}
          autoFocus
        />
        <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-border">
          {assetsLoading ? (
            <p className="px-4 py-6 text-sm text-foreground">{t("loading")}</p>
          ) : assetsError ? (
            <p className="px-4 py-6 text-sm text-red-600">{assetsError}</p>
          ) : assets.length === 0 ? (
            <p className="px-4 py-6 text-sm text-foreground">{t("noAssets")}</p>
          ) : (
            <ul>
              {assets.map((row) => (
                <li key={row.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      setAsset(row)
                      setMeterReading("")
                      setPickerOpen(false)
                    }}
                    className="flex w-full flex-col px-4 py-3 text-left hover:bg-muted"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {row.code} · {row.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{row.typeName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </GlassDialog>
    </DataPanel>
  )
}
